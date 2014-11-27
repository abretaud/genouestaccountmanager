var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var nodemailer = require('nodemailer');

var MAIL_CONFIG = require('config').mail;
var transport = null;


if(MAIL_CONFIG.host!='fake') {
  transport = nodemailer.createTransport('SMTP', {
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
    auth: {
        user: MAIL_CONFIG.user,
        pass: MAIL_CONFIG.password
    }
  });
}


var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    users_db = db.get('users');


var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

/* GET users listing. */
router.get('/', function(req, res) {
  res.send('respond with a resource');
});

router.get('/user/:id', function(req, res) {
  res.send('respond with a resource');
});

//Register
router.post('/user/:id', function(req, res) {
  console.log('New register request for '+req.param('id'));
  if(req.param('ip').split('.').length != 4) {
    res.send({'status': 1, 'msg': 'invalid data'});
    return;
  }

  users_db.findOne({_id: req.param('id')}, function(err, user){
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
        regkey: regkey
      }
      var uid = req.param('id');
      users_db.insert(user);
        var link = GENERAL_CONFIG.url +
                  encodeURI('user/+'+uid+'/confirm?regkey='+regkey);
      var mailOptions = {
        from: MAIL_CONFIG.origin, // sender address
        to: login, // list of receivers
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

//Update user info
router.put('/user/:id', function(req, res) {
  res.send('respond with a resource');
});

module.exports = router;
