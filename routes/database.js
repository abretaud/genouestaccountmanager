var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    databases_db = db.get('databases'),
    users_db = db.get('users');

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
    databases_db.findOne({name: db.name}, function(err, database){
      if(database) {
        res.send({database: null, message: 'Database already exists, please use an other name'});
      }
      else {
        databases_db.insert(db, function(err){
          console.log('TODO: create db and user, then send email with conn info');
          res.send({database: db, message: 'TODO: create db and user, then send email with conn info'});
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
        res.send(null);
    });
  });
});


module.exports = router;
