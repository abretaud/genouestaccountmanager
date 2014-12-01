var CONFIG = require('config');
var fs = require('fs');
var LDAP = require('LDAP');

var options = {
    uri: 'ldap://'+CONFIG.ldap.host, // string
    version: 3, // integer, default is 3,
    starttls: false, // boolean, default is false
    connecttimeout: -1, // seconds, default is -1 (infinite timeout), connect timeout
    timeout: 5000, // milliseconds, default is 5000 (infinite timeout is unsupported), operation timeout
    reconnect: true, // boolean, default is true,
    backoffmax: 32 // seconds, default is 32, reconnect timeout
};


module.exports = {

  bind: function(uid, password, callback) {
    var bind_options = {
      binddn: 'uid='+uid+'ou=people,'+CONFIG.ldap.dn,
      password: password
    }

    var fb_options = {
        base: CONFIG.ldap.admin_dn,
        filter: 'uid='+uid,
        scope: 'sub',
        attrs: '',
        password: password
    }
    var ldap = new LDAP(options);
    ldap.open(function(err) {
      ldap.findandbind(fb_options, function(err, data) {
      //ldap.simplebind(bind_options, function(err) {
        if(err) {
          console.log('Bind error: '+err);
        }
        else {
         console.log('Bind ok: '+uid)
        }
        //ldap.close();
        callback(err);
      });
    });
  },

  add: function(user, callback) {
    var password = Math.random().toString(36).substring(7);
    var user_ldif = "";
    user_ldif += "dn: uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\n";
    user_ldif += "cn: "+user.firstname+" "+user.lastname+"\n";
    user_ldif += "sn: "+user.lastname+"\n";
    user_ldif += "givenname: "+user.firstname+"\n";
    user_ldif += "mail: "+user.email+"\n";
    user_ldif += 'homedirectory: /home/'+user.group+'/'+user.uid+"\n";
    user_ldif += "loginShell: /bin/bash\n";
    user_ldif += "userpassword: "+user.password+"\n";
    user_ldif += "uidnumber: "+10000+"\n";
    user_ldif += "gidnumber: "+10000+"\n";
    user_ldif += "objectClass: top\n";
    user_ldif += "objectClass: posixAccount\n";
    user_ldif += "objectClass: inetOrgPerson\n";

    fs.writeFile("/tmp/"+user.uid+".ldif", user_ldif, function(err) {
      if(err) {
          console.log(err);
      } else {
          console.log("The file was saved!");
      }
      callback(err);
    });


    /*
    var attrs = [
      { attr: 'objectClass',  vals: [ 'organizationalPerson', 'person', 'inetOrgPerson', 'posixAccount', 'top' ] },
      { attr: 'cn',           vals: [ user.firstname+" "+user.lastname ] },
      { attr: 'sn',           vals: [ user.lastname ] },
      { attr: 'givenname',           vals: [ user.firstname ] },
      { attr: 'mail',      vals: [user.email] },
      { attr: 'homedirectory',   vals: ['/home/'+user.group+'/'+user.uid]},
      { attr: 'loginShell',      vals: ['/bin/bash'] },
      { attr: 'userpassword',      vals: [user.password] },
      { attr: 'uidnumber',      vals: [10000] },
      { attr: 'gidnumber',      vals: [10000] }
      ];
      var fb_options = {
          base: CONFIG.ldap.admin_dn,
          filter: 'cn=admin',
          scope: 'one',
          attrs: '',
          password: CONFIG.ldap.admin_password
      }
      ldap.open(function(err) {
        if(err) {
          console.log('Open error: '+err);
          ldap.close();
          return;
        }
        ldap.findandbind(fb_options, function(err, data) {
          if(err) {
            console.log('findandbind error:' +err);
            ldap.close();
            return;
          }
          ldap.add("uid="+user.uid+",ou=people,"+CONFIG.ldap.dn, [attrs], function(err){
            if(err) {
              console.log(err);
            }
            ldap.close();
          });
        });
      });
      */
  }


}
