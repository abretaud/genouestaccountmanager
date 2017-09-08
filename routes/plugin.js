var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];
for(var i=0;i<plugins.length;i++){
    plugins_modules[plugins[i].name] = require('../plugins/'+plugins[i].name);
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name})
}

router.get('/plugin', function(req, res) {
  // TODO get template from plugin
  res.send(plugins_info);
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});


router.get('/plugin/:id', function(req, res) {
  // TODO get template from plugin
  var template = plugins_modules[req.param('id')].template();
  res.send(template);
  // res.send("<div>hello {{user.uid}}</div><div><input ng-model=\"plugin_data.test.my\"></input> <button ng-click=\"plugin_update('" + req.param('id')+ "')\" class=\"button\">Update</button></div>");
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

router.get('/plugin/:id/:user', function(req, res) {
  // TODO get data from plugin
  res.send(plugins_modules[req.param('id')].get_data(req.param('user')));
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

router.post('/plugin/:id/:user', function(req, res) {
  // TODO send data to plugin
  console.log("update plugin");
  var plugin_res = plugins_modules[req.param('id')].set_data(req.param('user'), req.body);
  if(plugin_res.error !== undefined) {
      res.status(400).send(plugin_res.error);
  }
  else {
      res.send(plugins_modules[req.param('id')].set_data(req.param('user'), req.body));
  }
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

router.post('/plugin/:id/:user/activate', function(req, res) {
  // TODO send data to plugin
  console.log("activate plugin");
  res.send(plugins_modules[req.param('id')].activate(req.param('user')));
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

router.post('/plugin/:id/:user/deactivate', function(req, res) {
  // TODO send data to plugin
  console.log("deactivate plugin");
  res.send(plugins_modules[req.param('id')].deactivate(req.param('user')));
  //res.cookie('gomngr',null, { maxAge: 900000, httpOnly: true });
});

module.exports = router;
