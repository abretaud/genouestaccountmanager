/**
* After migration, set regkey for users having no regkey
*/
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var CONFIG = require('config');
var notif = require('./routes/notif.js');
var fs = require('fs');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users'),
    groups_db = db.get('groups');


function timeConverter(tsp){
  var a = new Date(tsp);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var hour = a.getHours();
  var min = a.getMinutes();
  var sec = a.getSeconds();
  var time = date + ',' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
  return time;
}

var nbusers = 0;
var curusers = 0;

users_db.find({}, function(err, users){
  nbusers = users.length;
  for(var i=0;i<users.length;i++) {
     console.log(users[i].uid+': '+users[i].regkey);
     if(users[i].regkey == null) {
       console.log(users[i].uid+': generate');
       var regkey = Math.random().toString(36).substring(7);
       users_db.update({'_id': users[i]._id},{'$set': {regkey: regkey}}, function(err) {
           curusers++;
           if(curusers==nbusers){
             process.exit(0);
           }
       });
     }
     else {
        curusers++;
        if(curusers==nbusers){
           process.exit(0);
         }

     } 
  } 
});
