var express = require('express');
var router = express.Router();
var cookieParser = require('cookie-parser');
var session = require('express-session');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+GENERAL_CONFIG.db),
    groups_db = db.get('groups'),
    databases_db = db.get('databases'),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');

var plugins = CONFIG.plugins;
if(plugins === undefined){
    plugins = [];
}
var plugins_modules = {};
var plugins_info = [];
for(var i=0;i<plugins.length;i++){
    plugins_modules[plugins[i].name] = require('../plugins/'+plugins[i].name);
    if(plugins[i].display_name === undefined) { plugins[i]['display_name'] = plugins[i].name; }
    if(plugins[i].admin_only === undefined) { plugins[i]['admin_only'] = true; }
    plugins_info.push({'name': plugins[i].name, 'url': '../plugin/' + plugins[i].name, 'display_name': plugins[i]['display_name'], 'admin_only': plugins[i]['admin_only']})
}
/**
Plugins must provide functions:

 - template() <= return Angular html data. Template can use model from plugin_data.PLUGIN_NAME.MODEL_VARIABLE_NAME, form buttons should will updated model and must be called with method plugin_update(PLUGIN_NAME)
 - activate(user_id, user_info), returns updated user info (same as get_data)
 - deactivate(user_id)
 - get_data(user_id)
 - set_data(user_id, user_info)

 They also must return a Promise, except template() which must return template text

 Plugin promises should not reject unless all other plugins should not be handled. In case of error, it should log it in events and return with a resolve.
 If an error need to be catched, simply set an *error* parameter to your object to get info and display it in your template

 In user_info, the parameter is_admin will be set if the logged user is an admin (not the managed user)

*/

router.get('/plugin', function(req, res) {
  res.send(plugins_info);
});


router.get('/plugin/:id', function(req, res) {
  var template = plugins_modules[req.param('id')].template();
  res.send(template);
  // res.send("<div>hello {{user.uid}}</div><div><input ng-model=\"plugin_data.test.my\"></input> <button ng-click=\"plugin_update('" + req.param('id')+ "')\" class=\"button\">Update</button></div>");
});

router.get('/plugin/:id/:user', function(req, res) {
    var sess = req.session;
    if(! sess.gomngr) {
      res.status(401).send('Not authorized');
      return;
    }
    users_db.findOne({_id: sess.gomngr}, function(err, user){
      if(err || user == null){
        res.status(404).send('User not found');
        return;
      }
      if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
        user.is_admin = false;
      }
      else {
        user.is_admin = true;
      }
      plugins_modules[req.param('id')].get_data(req.param('user'), user.uid).then(function(result){
        res.send(result);
      });
    });

  //res.send(plugins_modules[req.param('id')].get_data(req.param('user')));
});

router.post('/plugin/:id/:user', function(req, res) {
  console.log("update plugin");
  var sess = req.session;
  if(! sess.gomngr) {
    res.status(401).send('Not authorized');
    return;
  }
  users_db.findOne({_id: sess.gomngr}, function(err, user){
    if(err || user == null){
      res.status(404).send('User not found');
      return;
    }
    if(GENERAL_CONFIG.admin.indexOf(user.uid) < 0){
      user.is_admin = false;
    }
    else {
      user.is_admin = true;
    }
    plugins_modules[req.param('id')].set_data(req.param('user'), req.body, user.uid).then(function(result){
      res.send(result);
    }, function(err){
      res.status(400).send(err);
    });
  });


  /*
  var plugin_res = plugins_modules[req.param('id')].set_data(req.param('user'), req.body);
  if(plugin_res.error !== undefined) {
      res.status(400).send(plugin_res.error);
  }
  else {
      res.send(plugins_modules[req.param('id')].set_data(req.param('user'), req.body));
  }
  */

});
module.exports = router;
