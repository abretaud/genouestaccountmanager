/**
* Test expiration date of user, if expired, expire the user
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

fs.readFile('/opt/gomngr/migrate/migrate/extract/group_list.csv', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  lines = data.split('\n');
  nbgroup = lines.length;
  curgroup = 0;
  for(var i=0;i<lines.length;i++) {
    group = lines[i].split(',');
    if(group.length>0) {
      groups_db.insert({name: group[0], gid: parseInt(group[1])}, function(err){
        curgroup++;
        if(nbgroup == curgroup) {
          process.exit(0);
        }
      });   
    }
    else {
      curgroup++;
      if(nbgroup == curgroup) {
        process.exit(0);
      }
    }
  }
});
