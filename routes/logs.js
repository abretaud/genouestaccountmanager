var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    groups_db = db.get('groups'),
    databases_db = db.get('databases'),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');

router.get('/log', function(req, res){
    events_db.find({}, function(err, events){
        res.send(events);
        res.end();
    });
});

router.get('/log/:id', function(req, res){
  file = req.param('id')+'.log';
  log_file = GENERAL_CONFIG.script_dir+'/'+file;
  fs.readFile(log_file, 'utf8', function (err,data) {
    if (err) {
      res.status(500).send(err);
      res.end();
      return;
    }
    res.send({log: data})
    res.end();
    return;
  });
});

module.exports = router;
