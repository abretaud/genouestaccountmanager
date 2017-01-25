var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var cookieParser = require('cookie-parser');

var goldap = require('../routes/goldap.js');
var notif = require('../routes/notif.js');

var MAIL_CONFIG = CONFIG.mail;
var transport = null;

var get_ip = require('ipware')().get_ip;


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
    projects_db = db.get('projects'),
    users_db = db.get('users'),
    events_db = db.get('events');

router.get('/project', function(req, res){
      var sess = req.session;
      if(! sess.gomngr) {
        res.status(401).send('Not authorized');
        return;
      }
      //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
      users_db.findOne({_id: sess.gomngr}, function(err, user){
        if(err || user == null){
          res.status(404).send('User not found');
          return;
        }
        if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
          res.status(401).send('Not authorized');
          return;
        }
        projects_db.find({}, function(err, groups){
          res.send(groups);
          return;
        });
      });
});

router.post('/project', function(req, res){
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }
      projects_db.findOne({'id': req.param('id')}, function(err, project){
         if(err || project != null){
            res.status(401).send('Not authorized or project already exists');
            return;
         }
        new_project = {
            'id': req.param('id'),
            'owner': req.param('owner'),
            'group': req.param('group'),
            'size': req.param('size'),
            'expire': req.param('expire')
        }
        projects_db.insert(new_project, function(err){
            events_db.insert({'date': new Date().getTime(), 'action': 'new project creation: ' + req.param('id') , 'logs': []}, function(err){});
            res.send({'msg': 'Project created'});
            return;
        });

      });
    });
});

router.delete('/project/:id', function(req, res){
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }
      projects_db.remove({'id': req.param('id')}, function(err){
          events_db.insert({'date': new Date().getTime(), 'action': 'remove project ' + req.param('id') , 'logs': []}, function(err){});

            res.send({'msg': 'Project deleted'});
            return;
        });

    });
});

router.post('/project/:id', function(req, res){
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    //{'id': project.id},{'size': project.size, 'expire': new Date(project.expire).getTime, 'owner': project.owner, 'group': project.group}
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        res.status(401).send('Not authorized');
        return;
      }
      projects_db.findOne({'id': req.param('id')}, function(err, project){
         if(err || project == null){
            res.status(401).send('Not authorized or project not found');
            return;
         }
        new_project = { '$set': {
            'owner': req.param('owner'),
            'group': req.param('group'),
            'size': req.param('size'),
            'expire': req.param('expire')
        }}
        projects_db.update({'id': req.param('id')}, new_project, function(err){
            events_db.insert({'date': new Date().getTime(), 'action': 'update project ' + req.param('id') , 'logs': []}, function(err){});
            res.send({'msg': 'Project updated'});
            return;
        });

      });
    });
});


module.exports = router;
