# Genouest Manager

## Requirements

LDAP users are expected to have DNS startnig with uid= and not cn=.
For an existing LDAP database, users should be migrated to match this DN.

Home directories are built with the following rule

    CONFIG.general.home ("/" CONFIG.general.main_groups ) "/" group.name "/" user.uid
    Example:
        /home/mygroup/myuserid

main_groups is an optional subpath selected by user, not present by default.


## Config

All configuration is in config/default.json

If server is using a prefix to access it (such as http://x.y.z/gomngr):

update manager/scripts/resources.js:

    var prefix = '/my_url_prefix';

and manager/index.html:

    <base href="/manager/" /> => <base href="/gomngr/manager/" />


Optional double authentication for administrators with config parameter double_authentication_for_admin.
It provides additional authentication via U2F devices or temporary email tokens.

## Installation

Requires openldap client and devel libs (apt-get install libldap2-dev) and uuid lib (uuid-dev)

npm install

bower install

## Starting from

### An empty LDAP

First step is to create the first admin user. To do so, register as a basic user via the Web UI and confirm the email.
Once this is done:

* disable, if set, double_authentication_for_admin in configuration
* disable for the time of admin validation the password verification:
  * set your computer ip in config field admin_ip and restart server
  * OR set env variable gomngr_auth=fake and restart server (**CAUTION**: this will disable checks for all users, access should be limited)
* login in UI, in password put anything
* Admin->Groups menu, create a new group matching the group of the admin user.
* Wait for group to be created in LDAP once cron has executed the script (check in *script_dir* the result of the command)
* Activate the user
* re-enable password verification (unset admin_ip in config or unset gomngr_auth env variable) and restart server
* Login in the Web UI to check login/password verification
* Optionally, re-enable double_authentication_for_admin in config

All other users will use standard registration process via WEB UI and admin wil be able to validate them via the UI (as well as for other admin).

### From an existing/populated LDAP

If an LDAP database already contains users, one need to:

* Check that users DN are like "uid=XXX,ou=..." and not "cn=xx yyy,ou=", else users DNs should be modified
* Import groups and users in gomngr database to sync gomgnr and ldap, to do so you can try the import_from_ldap script

    node import_from_ldap.js --test # Check first with no import
    # If everything is fine
    node import_from_ldap.js --import --admin admin_user_id # Check first with no import

Users will not be added to mailchimp mailing list.

## Running


forever start -o out.log -e err.log app.js

Some commands will be generated in script_dir (config), and executed by the cron task (see below). This means that some commands will have a small delay (cron execution).

## Stopping

forever stop app.js


## Cron

bin/gomngr.sh should be croned to execute generated scritps (every minutes). It takes as input the path to the scripts location and the url of the gomngr server.
Must be executed as root

    gomngr.sh /opt/my_script_dir http://localhost:3000

Script execution includes home directory manipulation and ldap modifications. LDAP tools (ldap-utils with ldapmodify etc...) must be installed where the cron job is executed.
