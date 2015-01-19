/**
* Test expiration date of user, if expired, expire the user
*/
var STATUS_PENDING_EMAIL = 'Waiting for email approval';
var STATUS_PENDING_APPROVAL = 'Waiting for admin approval';
var STATUS_ACTIVE = 'Active';
var STATUS_EXPIRED = 'Expired';

var CONFIG = require('config');
var goldap = require('./routes/goldap.js');
var notif = require('./routes/notif.js');
var fs = require('fs');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    users_db = db.get('users');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var MAIL_CONFIG = CONFIG.mail;
var transport = null;


if(MAIL_CONFIG.host !== 'fake') {
  if(MAIL_CONFIG.user !== undefined && MAIL_CONFIG.user !== '') {
  transport = nodemailer.createTransport(smtpTransport({
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
    auth: {
        user: MAIL_CONFIG.user,
        pass: MAIL_CONFIG.password
    }
  }));
  }
  else {
  transport = nodemailer.createTransport(smtpTransport({
    host: MAIL_CONFIG.host, // hostname
    secureConnection: MAIL_CONFIG.secure, // use SSL
    port: MAIL_CONFIG.port, // port for secure SMTP
  }));

  }
}

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

// Find users expiring
users_db.find({status: STATUS_ACTIVE, expiration: {$lt: (new Date().getTime())}},{uid: 1}, function(err, users){
  var mail_sent = 0;
  for(var i=0;i<users.length;i++){
    var user = users[i];
    console.log('User: '+user.uid);
    var msg_activ = "User "+user.uid+" has expired, updating account";
    var msg_activ_html = msg_activ;
    var mailOptions = {
      from: MAIL_CONFIG.origin, // sender address
      to: CONFIG.general.support, // list of receivers
      subject: 'Genouest account expiration: '+user.uid, // Subject line
      text: msg_activ, // plaintext body
      html: msg_activ_html // html body
    };
    transport.sendMail(mailOptions, function(error, response){
        if(error){
          console.log(error);
        }
        var fid = new Date().getTime();
        goldap.reset_password(user, fid, function(err) {
            user.history.push({'action': 'expire', date: new Date().getTime()});
            users_db.update({uid: user.uid},{'$set': {status: STATUS_EXPIRED, expiration: new Date().getTime(), history: user.history}}, function(err){
              var script = "#!/bin/bash\n";
              script += "set -e \n"
              script += "ldapmodify -cx -w "+CONFIG.ldap.admin_password+" -D "+CONFIG.ldap.admin_cn+","+CONFIG.ldap.admin_dn+" -f "+CONFIG.general.script_dir+"/"+user.uid+"."+fid+".ldif\n";
              var script_file = CONFIG.general.script_dir+'/'+user.uid+"_"+fid+".update";
              fs.writeFile(script_file, script, function(err) {
                fs.chmodSync(script_file,0755);
                // Now remove from mailing list
                try {
                  notif.remove(user.email, function(err){
                      mail_sent++;
                      if(mail_sent == users.length) {
                        process.exit(code=0);
                      }
                    });
                }
                catch(err) {
                    mail_sent++;
                    if(mail_sent == users.length) {
                      process.exit(code=0);
                    }
                }
              });
            });
        });

    });

  }
  if(mail_sent == users.length) {
    process.exit(code=0);
  }

});
