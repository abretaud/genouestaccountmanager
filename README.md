# Genouest Manager

## Config

All configuration is in config/default.json. One can use config/default.json.template as example.

If server is using a prefix to access it (such as http://x.y.z/gomngr):

update manager/scripts/resources.js:

    var prefix = '/my_url_prefix';

and manager/index.html:

    <base href="/manager/" /> => <base href="/gomngr/manager/" />


## Installation

Requires openldap client and devel libs (apt-get install libldap2-dev) and uuid lib (uuid-dev)
Also needs nodejs, npm and bower installed

    npm install
    bower install


## Databases

Database used by softwaremanager is MongoDB. It also use OpenLDAP to insert LDIF files for account creation/update.

For an existing LDAP directory, one must import existing users and groups in mongo. There is no automatic script for this, but here is the following expecting schema to insert in MongoDB.

Insert groups:

    db.groups.insert({ "name" : "mygroup", "gid" : 20857) }
    
Insert users:

    > db.users.insert({
        "uid" : "my_linux_user_id",
        "email" : "my@email,
        "uidnumber" : 1046,
        "gidnumber" : 20857,
        "secondarygroups" : [ ], # list of group names, not ids
        "maingroup" : "",
        "group" : "mygroup",
        "status" : "Active",
        "loginShell" : "/bin/bash",
        "address" : "my work address",
        "lab" : "lab where I work",
        "responsible": "labs manager",
        "duration" : 1095, # how long account expiration should be extended when requested, in days
        "expiration" : 1515836315661, # timestamp where account expires (in ms)
        "firstname" : "Olivier",
        "lastname" : "Sallou",
        "history" : [], # keep empty
        "ip" : "127.0.0.1", # optional IP address of user, in case you use IP for access to servers
        "is_genouest" : true,
        "ssh" : "", # keep empty
        "why" : null # keep null
        })

## User management

Home directory will be build according to:

    CONFIG.general.home + ?user.maingroup + user.group
    Example:
        /home/mymaingroup/mygroup
        /home/mygroup #if mymaingroup is empty
        
Secondary groups can be added to a user. In this case, user will be added as a memberOf of this group.
User is also set as memberOf for main group.

## Running

    forever start -o out.log -e err.log app.js

## Development

To start server

    node app.ps

### Cron task

Some commands will be generated in script_dir (config), and executed by the cron task (see below). This means that some commands will have a small delay (cron execution).
Cron must be executed as root as it needs to create home etc.... Cron task may run on a different server, it only needs access to script directory.

Example:

    * * * * * /opt/gomngr/genouestaccountmanager/bin/gomngr.sh   /opt/gomngr/scripts http://127.0.0.1:3000 # URL to account manager
    
To manage user account expiration, add the following script to your cron:

    0 3 1 * * /opt/gomngr/genouestaccountmanager/test_expiration.sh >> /opt/gomngr/genouestaccountmanager/test_expiration.log 2>&1
    0 3 2 * * /opt/gomngr/genouestaccountmanager/expire.sh >> /opt/gomngr/genouestaccountmanager/expiration.log 2>&1

test_expiration check if user will expire *soon* and sends an email to the user so that he extends his account if needed.
expiration deactivates accounts if their expiration date is reached.


## Mailing

Users are subcsribed to a mailing list based on their email address. The email address of account is *MANDATORY*.
This is used to broadcast messages to all users. Mailing list is using mailchimp.

Standard smtp configuration is used for user notifications.

If you wish to use other mailing list system, or no mailing list, one can replace the routes/notif.js, replacing functions content by your own api or empty calls.

## Stopping

forever stop app.js


## Cron

bin/gomngr.sh should be croned to execute generated scritps (every minutes). It takes as input the path to the scripts location and the url of the gomngr server.
Must be executed as root

    gomngr.sh /opt/my_script_dir http://localhost:3000

Script execution includes home directory manipulation and ldap modifications. LDAP tools (ldap-utils with ldapmodify etc...) must be installed where the cron job is executed.


## Plugins

Software supports plugins to add some info and basic tasks in Web UI in user information page. Plugin needs to be declared in config file to be activated.
Plugins are stored in plugins directory, there are examples available.
Basically a plugin must react on user activation/deactivation, provide an Angular template and react on user update or plugin action. It must return a promise and always be successful (resolve, no reject).


## Testing

With env variable *export gomngr_auth=fake*, one can disable authentication password verification (**FOR TESTING ONLY**)