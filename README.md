# Genouest Manager

## Config

update manager/scripts/resources.js:

    var prefix = '/my_url_prefix';

and manager/index.html:

    <base href="/manager/" /> => <base href="/gomngr/manager/" />


## Installation

Requires openldap client and devel libs (apt-get install libldap2-dev) and uuid lib (uuid-dev)

npm install

bower install

## Running

forever start -o out.log -e err.log app.js

## Stopping

forever stop app.js
