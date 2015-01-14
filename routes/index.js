var express = require('express');
var router = express.Router();
var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

/* GET home page. */
router.get('/', function(req, res) {
  res.redirect(GENERAL_CONFIG.url+'/manager/index.html');
});

module.exports = router;
