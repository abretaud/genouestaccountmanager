var CONFIG = require('config');
var fs = require('fs');
var LDAP = require('LDAP');

var monk = require('monk'),
    db = monk(CONFIG.mongo.host+':'+CONFIG.mongo.port+'/'+CONFIG.general.db),
    groups_db = db.get('groups'),
    users_db = db.get('users');

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

  reset_password: function(user, fid, callback){

    var user_ldif = "";
    user_ldif += "dn: uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\n";
    user_ldif += "changetype: modify\n";
    user_ldif += "replace: password\n";
    user_ldif += "password: "+user.password+"\n";

    fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
      callback(err);
    });
  },

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


  modify: function(user, fid, callback) {
    /* Modify contact info
    dn: cn=Modify Me,dc=example,dc=com
    changetype: modify
    replace: mail
    mail: modme@example.com
    -
    add: title
    title: Grand Poobah
    -
    add: jpegPhoto
    jpegPhoto:< file:///tmp/modme.jpeg
    -
    delete: description
    */
    var user_ldif = "";
    user_ldif += "dn: uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\n";
    user_ldif += "changetype: modify\n";
    user_ldif += "replace: cn\n";
    user_ldif += "cn: "+user.firstname+" "+user.lastname+"\n";
    user_ldif += "replace: sn\n";
    user_ldif += "sn: "+user.lastname+"\n";
    var is_admin = false;
    if(CONFIG.general.admin.indexOf(user.uid) >= 0) {
      is_admin = true;
    }
    if(is_admin){
      if(user.is_genouest){
      user_ldif += "replace: ou\n";
      user_ldif += "ou: genouest\n";
      }
      else {
      user_ldif += "replace: ou\n";
      user_ldif += "ou: \n";
      }
      user_ldif += "replace: homedirectory\n";
      user_ldif += 'homedirectory: '+CONFIG.general.home+'/'+user.maingroup+'/'+user.group+'/'+user.uid+"\n";
      user_ldif += "replace: gidnumber\n";
      user_ldif += "mail: "+user.gidnumber+"\n";
    }
    user_ldif += "replace: givenname\n";
    user_ldif += "givenname: "+user.firstname+"\n";
    user_ldif += "replace: mail\n";
    user_ldif += "mail: "+user.email+"\n";
    user_ldif += "loginShell: mail\n";
    user_ldif += "loginShell: /bin/bash\n";

    if(is_admin && user.oldgroup != user.group) {
      user_ldif += "replace: gidnumber\n";
      user_ldif += "gidnumber: "+user.gidnumber+"\n";
      // Group membership modification
      user_ldif += "\ndn: cn="+user.oldgroup+",ou=groups,"+CONFIG.ldap.dn+"\n";
      user_ldif += "changetype: modify\n";
      user_ldif += "delete: memberUid\n";
      user_ldif += "memberUid: "+user.uid+"\n\n"
      user_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
      user_ldif += "changetype: modify\n";
      user_ldif += "add: memberUid\n";
      user_ldif += "memberUid: "+user.uid+"\n"
    }

    groups_db.findOne({'name': user.group}, function(err, group){
      if(err || group == null || group == undefined) {
        callback({err: "Group does not exists"});
        return;
      }
      fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
        if(err) {
            console.log(err);
        }
        callback(err);
      });
    });
  },

  add_group: function(group, fid, callback) {
    var user_ldif = "";
    user_ldif += "dn: cn="+group.name+",ou=groups,"+CONFIG.ldap.dn+"\n";
    user_ldif += "objectClass: top\n";
    user_ldif += "objectClass: posixGroup\n";
    user_ldif += "gidNumber: "+group.gid+"\n";
    user_ldif += "cn: "+group.name+"\n";
    user_ldif += "description: group for "+group.name+"\n";
    user_ldif += "\n";
    fs.writeFile(CONFIG.general.script_dir+'/'+group.name+"."+fid+".ldif", user_ldif, function(err) {
      if(err) {
          console.log(err);
      }
      callback(err);
    });
  },

  add: function(user, fid, callback) {

    var password = Math.random().toString(36).substring(7);
    var user_ldif = "";
    var group_ldif = "";
    user_ldif += "dn: uid="+user.uid+",ou=people,"+CONFIG.ldap.dn+"\n";
    user_ldif += "cn: "+user.firstname+" "+user.lastname+"\n";
    user_ldif += "sn: "+user.lastname+"\n";
    if(user.is_genouest){
      user_ldif += "ou: genouest\n";
    }
    else {
      user_ldif += "ou: external\n";
    }
    user_ldif += "givenname: "+user.firstname+"\n";
    user_ldif += "mail: "+user.email+"\n";
    user_ldif += 'homedirectory: '+CONFIG.general.home+'/'+user.maingroup+'/'+user.group+'/'+user.uid+"\n";
    user_ldif += "loginShell: /bin/bash\n";
    user_ldif += "userpassword: "+user.password+"\n";
    user_ldif += "uidnumber: "+user.uidnumber+"\n";
    user_ldif += "gidnumber: "+user.gidnumber+"\n";
    user_ldif += "objectClass: top\n";
    user_ldif += "objectClass: posixAccount\n";
    user_ldif += "objectClass: inetOrgPerson\n\n";

    groups_db.findOne({'name': user.group}, function(err, group){
      if(err || group == null || group == undefined) {
        user_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
        user_ldif += "objectClass: top\n";
        user_ldif += "objectClass: posixGroup\n";
        //user_ldif += "objectclass: groupofnames\n";
        user_ldif += "gidNumber: "+user.gidnumber+"\n";
        user_ldif += "cn: "+user.group+"\n";
        user_ldif += "description: group for "+user.group+"\n";
        user_ldif += "\n";
      }
      group_ldif += "dn: cn="+user.group+",ou=groups,"+CONFIG.ldap.dn+"\n";
      group_ldif += "changetype: modify\n";
      group_ldif += "add: memberUid\n";
      group_ldif += "memberUid: "+user.uid+"\n"

      fs.writeFile(CONFIG.general.script_dir+'/'+user.uid+"."+fid+".ldif", user_ldif, function(err) {
        if(err) {
            console.log(err);
        }
        if(group_ldif != "") {
          fs.writeFile(CONFIG.general.script_dir+'/group_'+user.group+"_"+user.uid+"."+fid+".ldif", group_ldif, function(err) {
            callback(err);
          });
        }
        else {
          callback(err);
        }
      });
    });

  }


}
