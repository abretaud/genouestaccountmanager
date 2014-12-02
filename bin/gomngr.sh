#!/bin/bash

if [ -e /tmp/gomngr.lock ]; then
  exit(1)
fi

touch /tmp/gomngr.lock

ls /tmp/*.update | sort -n -t _ -k 2 > /tmp/gomngr.list

while read p; do
  $p
done </tmp/gomngr.list

rm /tmp/gomngr.lock
