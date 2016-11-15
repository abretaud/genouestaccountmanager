var CONFIG = require('config');
var fs = require('fs');
var mcapi = require('mailchimp-api/mailchimp');


mc = new mcapi.Mailchimp(CONFIG.mailchimp.apikey);

/*
mc.lists.members({id: CONFIG.mailchimp.list, opts: {start: 0, limit: 100}}, function(data){
    console.log(data);
});

mc.lists.members({id: CONFIG.mailchimp.list, opts: {start: 1, limit: 100}}, function(data){
    console.log(data);
});

mc.lists.members({id: CONFIG.mailchimp.list, opts: {start: 2, limit: 100}}, function(data){
    console.log(data);
});

mc.lists.members({id: CONFIG.mailchimp.list, opts: {start: 3, limit: 100}}, function(data){
    console.log(data);
});

*/

mc.lists.subscribe({id: CONFIG.mailchimp.list, email:{email: 'adesgroux@inra.fr'}, double_optin: false, update_existing: true, send_welcome: true }, function(data) {
    mc.lists.unsubscribe({id: CONFIG.mailchimp.list, email:{email: 'adesgroux@rennes.inra.fr'}, delete_member: true, send_notify: false }, function(data) {
        console.log('email updated');
      }, function(error){
          console.log("Failed to unsubscribe " + email + ": "+ error);
      });
    }, function(error) {
      console.log("Failed to add "+email+" to mailing list " +  error);
    });

