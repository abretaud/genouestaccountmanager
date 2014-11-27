var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    users_db = db.get('users');


router.get('/logout', function(req, res) {
  res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
  res.send({});
});


router.get('/auth', function(req, res) {
  if(req.cookies.gomngr !== undefined) {
    // Authenticated
    users_db.findOne({_id: req.param('id')}, function(err, user){
      if(user.status == STATUS_PENDING_EMAIL){
        res.send({user: null, msg: 'Your account is waiting for email approval, check your mail inbox'});
        return;
      }
      if(user.status == STATUS_PENDING_APPROVAL){
        res.send({user: null, msg: 'Your account is waiting for admin approval'});
        return;
      }
      if(user.status == STATUS_EXPIRED){
        res.send({user: null, msg: 'Your account is expired, please contact the support for reactivation at '+GENERAL_CONFIG.support});
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) >= 0) {
        user.is_admin = true;
      }
      else {
        user.is_admin = false;
      }
      res.send({user: user, msg: ''});
    });
  }
  else {
    res.send({user: null, msg: 'User does not exists'});
  }
});

router.post('/auth/:id', function(req, res) {
  users_db.findOne({uid: req.param('id')}, function(err, user){
    if(! user) {
      res.status(404).send('User not found');
      return;
    }
    // Check bind with ldap
    res.status(401).send('Not yet implemented');
    //res.cookie('gomngr',req.param('id'), { maxAge: 900000 });
    return;
  });
});


module.exports = router;
