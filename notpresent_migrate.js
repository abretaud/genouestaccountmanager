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

groups_db.find({}, function(err, groups){

fs.readFile('/opt/gomngr/migrate/migrate/extract/notpresent_list.csv', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  lines = data.split('\n');
  nbuser = lines.length;
  curuser = 0;
  for(var i=0;i<lines.length;i++) {
    user = lines[i].split(',');
    if(user.length>1) {
      var group = null;
      for(var m=0;m<groups.length;m++) {
        if(user[3] == groups[m].gid) {
           group = groups[m].name;
          break;
        }
      }
      var maingroup = null;
      for(var m=0;m<CONFIG.general.main_groups.length;m++) {
        console.log('test '+'/home/'+CONFIG.general.main_groups[m]+'/'+group+'/'+user[0]);
        if(fs.existsSync('/home/'+CONFIG.general.main_groups[m]+'/'+group+'/'+user[0])) {
          maingroup = CONFIG.general.main_groups[m];
          break;
        }
      }
      console.log('maingroup='+maingroup);

      var is_genouest = false;
      if(user[6] == 'genouest'){
        is_genouest = true;
      }
      var status = STATUS_ACTIVE;
      // Set 3 years expiration
      var expiration = new Date().getTime()+3*3600*24*365*1000;
      var guser = {
        status: status,
        uid: user[0],
        firstname: user[7],
        lastname: user[8],
        email: user[1],
        address: 'unknown',
        lab: 'unknown',
        responsible: 'unknown',
        group: group,
        maingroup: maingroup,
        ip: '127.0.0.1',
        regkey: null,
        is_genouest: is_genouest,
        uidnumber: parseInt(user[2]),
        gidnumber: parseInt(user[3]),
        duration: 3,
        expiration: expiration,
        loginShell: user[4],
        history: [{action: 'imported', date: new Date().getTime()}]
      }
      /*
      console.log(guser);
      curuser++;
      if(nbuser == curuser) {
        process.exit(0);
      }
      */

      
      users_db.insert(guser, function(err){
        curuser++;
        if(nbuser == curuser) {
          process.exit(0);
        }
      });
      
    }
    else {
      curuser++;
      if(nbuser == curuser) {
        process.exit(0);
      }
    }
  }
});

});
