var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var escapeshellarg = require('escapeshellarg');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

router.get('/log/:id/:fid', function(req, res){
  file = req.param('id')+'.'+req.param('fid')+'.update.log';
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
