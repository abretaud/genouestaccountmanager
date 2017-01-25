var CONFIG = require('config');
var fs = require('fs');
var mcapi = require('mailchimp-api/mailchimp');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');

mc = new mcapi.Mailchimp(CONFIG.mailchimp.apikey);

module.exports = {

  add: function(email, callback) {
    if(email==undefined ||email==null || email=='') {
      callback();
      return;
    }
    mc.lists.subscribe({id: CONFIG.mailchimp.list, email:{email: email}, double_optin: false, update_existing: true, send_welcome: true }, function(data) {
      events_db.insert({'date': new Date().getTime(), 'action': 'add ' + email + 'to mailing list' , 'logs': []}, function(err){});
      callback();
    }, function(error) {
      console.log("Failed to add "+email+" to mailing list");
    });
  },
  remove: function(email, callback) {
    if(email==undefined ||email==null || email=='') {
      callback();
      return;
    }
    try {
        mc.lists.unsubscribe({id: CONFIG.mailchimp.list, email:{email: email}, delete_member: true}, function(data) {
            events_db.insert({'date': new Date().getTime(), 'action': 'unsubscribe ' + email + 'from mailing list' , 'logs': []}, function(err){});
            callback();
        });
    }
    catch(err) {
        callback();
    }

  },
  modify: function(oldemail, newemail, callback) {
    console.log("Update email " + oldemail + " ==> " + newemail);
    if(newemail==undefined ||newemail==null || newemail=='') {
      callback();
      return;
    }
    mc.lists.subscribe({id: CONFIG.mailchimp.list, email:{email: newemail}, double_optin: false, update_existing: true, send_welcome: true }, function(data) {
      console.log(newemail+' subscribed');
      mc.lists.unsubscribe({id: CONFIG.mailchimp.list, email:{email: oldemail}, delete_member: true, send_notify: false }, function(data) {
        events_db.insert({'date': new Date().getTime(), 'action': 'update ' + newemail + 'in mailing list' , 'logs': []}, function(err){});
        console.log(oldemail+' unsubscribed');
        callback();
      }, function(error){
          events_db.insert({'date': new Date().getTime(), 'action': 'update error with ' + oldemail + 'in mailing list' , 'logs': []}, function(err){});
          console.log("Failed to unsubscribe " + oldemail + ": "+ error);
      });
    }, function(error) {
      console.log("Failed to add "+newemail+" to mailing list");
    });
  },
  send: function(subject, msg, callback) {
    mc.campaigns.create({type: 'plaintext',
                         options: {
                          list_id: CONFIG.mailchimp.list,
                          subject: subject,
                          from_email: CONFIG.general.support,
                          from_name: 'GenOuest Platform'
                        },
                        content: {
                          text: msg
                        }
                        }, function(data){
                              mc.campaigns.send({cid: data.id}, function(data){
                                callback();
                              });

                          });

  }

};
