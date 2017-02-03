var CONFIG = require('config');
var fs = require('fs');
var mcapi = require('mailchimp-api/mailchimp');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    web_db = db.get('web'),
    users_db = db.get('users'),
    events_db = db.get('events');


mc = new mcapi.Mailchimp(CONFIG.mailchimp.apikey);

mc.lists.memberInfo({id: CONFIG.mailchimp.list, emails:[{email: 'TTolivier.sallou@irisa.fr'}]}, function(data) {
   console.log(data);

});
