#!/bin/bash

if [ "a$1" == "a" ]; then
 echo "Missing script directory parameter"
 exit 1
fi

if [ -e /tmp/gomngr.lock ]; then
  exit 1
fi

touch /tmp/gomngr.lock

ls $1/*.update | sort -n -t _ -k 2 > /tmp/gomngr.list

while read p; do
  $p
done </tmp/gomngr.list

rm /tmp/gomngr.lock
