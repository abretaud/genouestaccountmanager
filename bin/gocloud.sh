#!/bin/bash

source /etc/profile.d/rvm.sh

#rvm use 2.2.0
rvm use ruby-2.2.0

ruby /opt/gomngr/genouestaccountmanager/bin/gomngr-cloud.rb $@
