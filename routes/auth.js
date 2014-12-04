var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var goldap = require('../routes/goldap.js');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    users_db = db.get('users');


var ldap_manager = {
  auth: function(uid, password) {
    if(MAIL_CONFIG.ldap.host == 'fake') {
      return true;
    }
    return false;
  }
}


router.get('/logout', function(req, res) {
  req.session.destroy();
  res.send({});
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});


router.get('/auth', function(req, res) {
  var sess = req.session;
  if(sess.gomngr) {
  //if(req.cookies.gomngr !== undefined) {
    // Authenticated
    //users_db.findOne({_id: req.cookies.gomngr}, function(err, user){
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(user==null || err) {
        res.send({user: null, msg: err});
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
      }
      else {
        user.is_admin = false;
      }
      if(user.status == STATUS_PENDING_EMAIL){
        res.send({user: user, msg: 'Your account is waiting for email approval, check your mail inbox'});
        return;
      }
      if(user.status == STATUS_PENDING_APPROVAL){
        res.send({user: user, msg: 'Your account is waiting for admin approval'});
        return;
      }
      if(user.status == STATUS_EXPIRED){
        res.send({user: user, msg: 'Your account is expired, please contact the support for reactivation at '+GENERAL_CONFIG.support});
        return;
      }
      res.send({user: user, msg: ''});
    });
  }
  else {
    res.send({user: null, msg: 'User does not exists'});
  }
});

router.post('/auth/:id', function(req, res) {
  if(req.param('password')=="") {
    res.status(401).send('Missing password');
  }
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(! user) {
      res.status(404).send('User not found');
      return;
    }
    // Check bind with ldap
    var sess = req.session;
    sess.gomngr = user._id;
    if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
      user.is_admin = true;
    }
    else {
      user.is_admin = false;
    }
    var ip = req.headers['x-forwarded-for'] ||
     req.connection.remoteAddress ||
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress;
    if(user.is_admin && GENERAL_CONFIG.admin_ip.indexOf(ip) >= 0) {
      // Skip auth
      res.send({ user: user, msg: ''});
      res.end();
    }
    else {
      goldap.bind(user.uid, req.param('password'), function(err) {
        if(err) {
          res.send({ user: null, msg: err.message});
          res.end();
          return;
        }
        res.send({ user: user, msg: ''});
        res.end();
      });
    }
    //res.cookie('gomngr',user._id, { maxAge: 900000 });

  });
});


module.exports = router;
