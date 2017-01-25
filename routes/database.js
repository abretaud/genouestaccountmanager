var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users'),
    events_db = db.get('events');

var mysql = require('mysql');

var connection;

function handleDisconnect() {
  connection = mysql.createConnection({
    host     : CONFIG.mysql.host,
    user     : CONFIG.mysql.user,
    password : CONFIG.mysql.password,
    insecureAuth: true
  }); // Recreate the connection, since
                                                  // the old one cannot be reused.

  connection.connect(function(err) {              // The server is either down
    if(err) {                                     // or restarting (takes a while sometimes).
      console.log('error when connecting to db:', err);
      setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
    }                                     // to avoid a hot loop, and to allow our node script to
  });                                     // process asynchronous requests in the meantime.
                                          // If you're also serving http, display a 503 error.
  connection.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
      handleDisconnect();                         // lost due to either server restart, or a
    } else {                                      // connnection idle timeout (the wait_timeout
      throw err;                                  // server variable configures this)
    }
  });
}

handleDisconnect();


var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

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

/**
* Change owner
*/
router.put('/database/:id/owner/:old/:new', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, session_user){
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
      session_user.is_admin = true;
    }
    else {
      session_user.is_admin = false;
    }
    if(!session_user.is_admin) {
      res.status(401).send('Not authorized');
      return;
    }
    databases_db.update({name: req.param('id')},{'$set': {owner: req.param('new')}}, function(err){
      events_db.insert({'date': new Date().getTime(), 'action': 'database changed from '+req.param('old')+' to '+req.param('new'), 'logs': []}, function(err){});
      res.send({message: 'Owner changed from '+req.param('old')+' to '+req.param('new')});
      res.end();
      return;
    });
  });
});


router.get('/database', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, session_user){
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
      session_user.is_admin = true;
    }
    else {
      session_user.is_admin = false;
    }
    var filter = {};
    if(!session_user.is_admin) {
      filter = {owner: session_user.uid}
    }
    databases_db.find(filter, function(err, databases){
      res.send(databases);
      return;
    });
  });
});

router.get('/database/owner/:owner', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, session_user){
    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
      session_user.is_admin = true;
    }
    else {
      session_user.is_admin = false;
    }
    var filter = {owner: req.param('owner')}
    databases_db.find(filter, function(err, databases){
      res.send(databases);
      return;
    });
  });
});

router.post('/database/:id', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, session_user){
    db = {
      owner: session_user.uid,
      name: req.param('id')
    }
    if (!req.param('id').match(/^[0-9a-z_]+$/)) {
      res.send({database: null, message: 'Database name must be alphanumeric [0-9a-z_]'});
      res.end();
      return;
    }
    databases_db.findOne({name: db.name}, function(err, database){
      if(database) {
        res.send({database: null, message: 'Database already exists, please use an other name'});
        res.end();
        return;
      }
      else {
        databases_db.insert(db, function(err){
            var sql = "CREATE DATABASE "+req.param('id')+";\n";
            connection.query(sql, function(err, results) {
              if (err) {
                res.send({message: 'Creation error: '+err});
                res.end();
                return
              }
              var password = Math.random().toString(36).substring(10);
              sql = "CREATE USER '"+req.param('id')+"'@'%' IDENTIFIED BY '"+password+"';\n";
              connection.query(sql, function(err, results) {
                if (err) {
                  res.send({message: 'Failed to create user'});
                  res.end();
                  return
                }
                sql = "GRANT ALL PRIVILEGES ON "+req.param('id')+".* TO '"+req.param('id')+"'@'%'\n";
                connection.query(sql, function(err, results) {
                  if (err) {
                    res.send({message: 'Failed to grant access to user'});
                    res.end();
                    return
                  }
                  // Now send message
                  var msg = "Database created:\n";
                  msg += " Host: " + CONFIG.mysql.host+"\n";
                  msg += " Database: " + req.param('id')+"\n";
                  msg += " User: " + req.param('id')+"\n";
                  msg += " Password: " + password+"\n";
                  var mailOptions = {
                    from: CONFIG.mail.origin, // sender address
                    to: session_user.email+","+CONFIG.general.accounts, // list of receivers
                    subject: 'Database creation', // Subject line
                    text: msg, // plaintext body
                    html: msg // html body
                  };
                  if(transport!==null) {
                    transport.sendMail(mailOptions, function(error, response){
                      if(error){
                        console.log(error);
                      }
                      events_db.insert({'date': new Date().getTime(), 'action': 'database ' + req.param('id')+ 'created by ' +  sess.gomngr, 'logs': []}, function(err){});
                      res.send({message:'Database created, credentials will be sent by mail'});
                      return;
                    });
                  }
                });
              });

          });
        });
      }
    });
  });
});

router.delete('/database/:id', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }

  users_db.findOne({_id: sess.gomngr}, function(err, session_user){

    if(CONFIG.general.admin.indexOf(session_user.uid) >= 0) {
      session_user.is_admin = true;
    }
    else {
      session_user.is_admin = false;
    }
    var filter = {name: req.param('id')};
    if(!session_user.is_admin) {
      filter['owner'] = session_user.uid;
    }

    databases_db.remove(filter, function(err){

        var sql = "DROP USER '"+req.param('id')+"'@'%';\n";
        connection.query(sql, function(err, results) {
          sql = "DROP DATABASE "+req.param('id')+";\n";
          connection.query(sql, function(err, results) {
            res.send({message: ''});
            res.end();
            return;
          });
        });

    });
  });
});


module.exports = router;
