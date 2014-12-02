var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var cookieParser = require('cookie-parser');

var goldap = require('../routes/goldap.js');

var MAIL_CONFIG = CONFIG.mail;
var transport = null;


if(MAIL_CONFIG.host !== 'fake') {
  if(MAIL_CONFIG.user !== undefined && MAIL_CONFIG.user !== '') {
  transport = nodemailer.createTransport(smtpTransport({
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
    auth: {
        user: MAIL_CONFIG.user,
        pass: MAIL_CONFIG.password
    }
  }));
  }
  else {
  transport = nodemailer.createTransport(smtpTransport({
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
  }));

  }
}


var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    groups_db = db.get('groups'),
    users_db = db.get('users');


var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

router.get('/group', function(req, res){
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, user){
    if(err || user == null){
      res.status(404).send('User not found');
      return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
      res.status(401).send('Not authorized');
      return;
    }
    groups_db.find({}, function(err, groups){
      res.json(groups);
    });
  });
});

// Get users listing - for admin
router.get('/user', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, user){
    if(err || user == null){
      res.status(404).send('User not found');
      return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
      res.status(401).send('Not authorized');
      return;
    }
    users_db.find({}, function(err, users){
      res.json(users);
    });
  });
});

// activate user
router.get('/user/:id/activate', function(req, res) {
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(!user) {
      res.send({msg: 'User does not exists'})
      res.end();
      return;
    }
    user.password = Math.random().toString(36).substring(7);
    var minuid = 1000;
    var mingid = 1000;
    users_db.findOne(sort=[('uidnumber', -1)], function(err, data){
      if(!err && data){
        minuid = data.uidnumber+1;
      }
      groups_db.findOne(sort=[('gid', -1)], function(err, data){
        if(!err && data){
          mingid = data.gid+1;
        }
        user.uidnumber = minuid;
        user.gidnumber = mingid;
        goldap.add(user, function(err) {
          if(!err){
            users_db.update({uid: req.param('id')},{'$set': { status: STATUS_ACTIVE}}, function(err){
              groups_db.update({'name': user.group}, {'$set': { 'gid': user.gidnumber}}, {upsert:true}, function(err){
                var script = "#!/bin/bash\n";
                script += "set -e \n"
                script += "ldapadd -h "+CONFIG.ldap.host+" -cx -w "+CONFIG.ldap.admin_password+" -D cn=admin,dc=nodomain -f "+CONFIG.general.script_dir+"/"+user.uid+".ldif\n";
                script += "if [ -e "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+".ldif"+"]; then\n"
                script += "\tldapmodify -cx -w "+CONFIG.ldap.admin_password+" -D cn=admin,dc=nodomain -f "+CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+".ldif\n";
                script += "fi\n"
                script += "mkdir -p /home/"+user.group+'/'+user.uid+"\n";
                script += "mkdir -p /omaha-beach/"+user.uid+"\n";
                script += "chown -R "+user.uid+" /home/"+user.group+'/'+user.uid+"\n";
                script += "chown -R "+user.uid+" /omaha-beach/"+user.uid+"\n";
                fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+".update", script, function(err) {
                  res.send({msg: 'Activation in progress'});
                });
              });
            });

          }
          else {
            res.send({msg: err});
          }
        });



      });
    });

  });

});

// Get user - for logged user or admin
router.get('/user/:id', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, session_user){

    users_db.findOne({uid: req.param('id')}, function(err, user){
      if(err){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
      }
      else {
        user.is_admin = false;
      }
      if(sess.gomngr === user._id || GENERAL_CONFIG.admin.indexOf(session_user.uid) >= 0){
        res.json(user);
      }
      else {
        res.status(401).send('Not authorized');
        return;
      }

    });

  });
});

// Registration mail confirmation
router.get('/user/:id/confirm', function(req, res) {
  var uid = req.param('id');
  var regkey = req.param('regkey');
  users_db.findOne({uid: uid}, function(err, user) {
    if(! user) {
      res.status(401).send('Invalid user');
      return;
    }
    else {
        if(user.regkey == regkey) {
          var account_event = {action: 'email_confirm', date: new Date().getTime()};
          users_db.update({ _id: user._id},
                          { $set: {status: STATUS_PENDING_APPROVAL},
                            $push: {history: account_event}
                          }, function(err) {});
          var mailOptions = {
            from: MAIL_CONFIG.origin, // sender address
            to: GENERAL_CONFIG.support, // list of receivers
            subject: 'Genouest account registration', // Subject line
            text: 'New account registration waiting for approval: '+uid, // plaintext body
            html: 'New account registration waiting for approval: '+uid // html body
          };
          if(transport!==null) {
            transport.sendMail(mailOptions, function(error, response){
              if(error){
                console.log(error);
              }
              res.redirect(GENERAL_CONFIG.url+'/manager/index.html#/login');
              res.end();
              return;
            });
          }
          else {
            res.redirect(GENERAL_CONFIG.url+'/manager/index.html#/login');
            res.end();
          }
        }
        else {
          res.status(401).send('Invalid registration key');
          return;
        }
    }
  });
});



// Register
router.post('/user/:id', function(req, res) {
  console.log('New register request for '+req.param('id'));
  if(req.param('ip').split('.').length != 4) {
    res.send({'status': 1, 'msg': 'invalid data'});
    return;
  }

  users_db.findOne({uid: req.param('id')}, function(err, user){
      if(user){
        res.send({'status': 1, 'msg': 'User id already exists'});
        //res.status(401).send('User id already exists');
        return;
      }

      var regkey = Math.random().toString(36).substring(7);
      var user = {
        status: STATUS_PENDING_EMAIL,
        uid: req.param('id'),
        firstname: req.param('firstname'),
        lastname: req.param('lastname'),
        email: req.param('email'),
        address: req.param('address'),
        lab: req.param('lab'),
        responsible: req.param('responsible'),
        group: req.param('group'),
        ip: req.param('ip'),
        regkey: regkey,
        is_genouest: false,
        uidnumber: -1,
        gidnumber: -1,
        duration: req.param('duration'),
        expiration: new Date().getTime() + 1000*3600*24*365*req.param('duration'),
        loginShell: '/bin/bash',
        history: [{action: 'register', date: new Date().getTime()}]
      }
      var uid = req.param('id');
      users_db.insert(user);
        var link = GENERAL_CONFIG.url +
                  encodeURI('/user/'+uid+'/confirm?regkey='+regkey);
      var mailOptions = {
        from: MAIL_CONFIG.origin, // sender address
        to: user.email, // list of receivers
        subject: 'Genouest account registration', // Subject line
        text: 'You have created an account on GenOuest platform,' +
              'please confirm your subscription at the following link: '+
              link, // plaintext body
        html: 'You have created an account on GenOuest Platform, please confirm '+
               'your subscription at the following link: <a href="'+link+'">'+
               link+'</a>' // html body
      };
      if(transport!==null) {
        transport.sendMail(mailOptions, function(error, response){
          if(error){
            console.log(error);
          }
        });
      }
      res.send({'status': 0, 'msg': 'A confirmation email has been sent, please check your mailbox to validate your account creation. Once validated, the platform team will analyse your request and validate it.'});

  });
});

// Update user info
router.put('/user/:id', function(req, res) {
  /*
  uid: req.param('id'),
  firstname: req.param('firstname'),
  lastname: req.param('lastname'),
  email: req.param('email'),
  address: req.param('address'),
  lab: req.param('lab'),
  responsible: req.param('responsible'),
  group: req.param('group'),
  ip: req.param('ip'),
  regkey: regkey,
  is_genouest: false,
  expiration: new Date().getTime() + 1000*3600*24*365*req.param('duration'),
  loginShell: '/bin/bash',
  history: [{action: 'register', date: new Date().getTime()}]
  */
  users_db.findOne({uid: req.param('id')}, function(err, user){

    user.firstname = req.param('firstname');
    user.lastname = req.param('lastname');
    user.email = req.param('email');
    user.address = req.param('address');
    user.lab = req.param('lab');
    user.responsible = req.param('responsible');
    var is_admin = false;
    if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
      is_admin = true;
    }

    if(is_admin){
      user.group = req.param('group'); // TODO manage ldap group membership modif
      user.ip = req.param('ip');
      user.is_genouest = req.param('is_genouest');
    }
    user.history.push({'action': 'update info', date: new Date().getTime()})

      if(is_admin) {
        user.is_admin = true;
      }
      if(user.status == STATUS_ACTIVE){
        goldap.modify(user, function(err){
          var script = "#!/bin/bash\n";
          script += "set -e \n"
          script += "ldapmodify -cx -w "+CONFIG.ldap.admin_password+" -D cn=admin,dc=nodomain -f "+CONFIG.general.script_dir+"/"+user.uid+".ldif\n";
          fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+".update", script, function(err) {
            res.send(user);
          });
        });
      }
      else {
        res.send(user);
      }


  });


});

module.exports = router;
