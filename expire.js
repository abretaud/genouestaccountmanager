/**
* Test expiration date of user, if expired, expire the user
*/
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var CONFIG = require('config');
var goldap = require('./routes/goldap.js');
var notif = require('./routes/notif.js');
var fs = require('fs');

var Promise = require('promise');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');
    events_db = db.get('events');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var MAIL_CONFIG = CONFIG.mail;
var transport = null;

var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];
for(var i=0;i<plugins.length;i++){
    plugins_modules[plugins[i].name] = require('./plugins/'+plugins[i].name);
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name})
}


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

function timeConverter(tsp){
  var a = new Date(tsp);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

// Find users expiring
users_db.find({status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime())}},{uid: 1}, function(err, users){
  var mail_sent = 0;
  for(var i=0;i<users.length;i++){
    (function(index) {
    var user = users[index];
    console.log('User: ' + user.uid + 'has expired');
    var msg_activ = "User "+user.uid+" has expired, updating account";
    var msg_activ_html = msg_activ;
    var mailOptions = {
      from: MAIL_CONFIG.origin, // sender address
      to: CONFIG.general.support, // list of receivers
      subject: 'Genouest account expiration: '+user.uid, // Subject line
      text: msg_activ, // plaintext body
      html: msg_activ_html // html body
    };
    transport.sendMail(mailOptions, function(error, response){
        if(error){
          console.log(error);
        }
        var fid = new Date().getTime();
        goldap.reset_password(user, fid, function(err) {
            if(err) { console.log(user.uid + ': failed to reset password') }
            user.history.push({'action': 'expire', date: new Date().getTime()});
            users_db.update({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}}, function(err){
              var script = "#!/bin/bash\n";
              script += "set -e \n"
              script += "ldapmodify -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
              var script_file = CONFIG.general.script_dir+'/'+user.uid+"_"+fid+".update";
              events_db.insert({'owner': 'cron', 'date': new Date().getTime(), 'action': 'user ' + req.param('id')+ 'deactivated by cron', 'logs': []}, function(err){});

              var plugin_call = function(plugin_info, user){
                  return new Promise(function (resolve, reject){
                      var res = plugins_modules[plugin_info.name].deactivate(user);
                      resolve(res);
                  });
              };
              Promise.all(plugins_info.map(function(plugin_info){
                  return plugin_call(plugin_info, user.uid);
              })).then(function(results){
                  fs.writeFile(script_file, script, function(err) {
                    fs.chmodSync(script_file,0755);
                    // Now remove from mailing list
                    try {
                      notif.remove(user.email, function(err){
                          mail_sent++;
                          if(mail_sent == users.length) {
                            process.exit(code=0);
                          }
                        });
                    }
                    catch(err) {
                        mail_sent++;
                        if(mail_sent == users.length) {
                          process.exit(code=0);
                        }
                    }
                  });
              });


            });
        });

    });
  }(i));
  }
  if(mail_sent == users.length) {
    process.exit(code=0);
  }

});
