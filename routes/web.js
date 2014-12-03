var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    web_db = db.get('web'),
    users_db = db.get('users');


/**
* Change owner
*/
router.put('/web/:id/owner/:old/:new', function(req, res) {
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
    web_db.update({_id: req.param('id')},{'$set': {owner: req.param('new')}}, function(err){
      res.send({message: 'Owner changed from '+req.param('old')+' to '+req.param('new')})
    });
  });
});

router.get('/web', function(req, res) {
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
    web_db.find(filter, function(err, databases){
      res.send(databases);
    });
  });
});

router.post('/web/:id', function(req, res) {
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, session_user){
    web = {
      owner: session_user.uid,
      name: req.param('id'),
      url: req.param('url'),
      description: req.param('description')
    }
    web_db.insert(web, function(err){
      res.send({web: web, message: ''});
    });
  });
});

router.delete('/web/:id', function(req, res) {
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
    var filter = {_id: req.param('id')};
    if(!session_user.is_admin) {
      filter['owner'] = session_user.uid;
    }
    web_db.remove(filter, function(err){
        res.send(null);
    });
  });
});


module.exports = router;
