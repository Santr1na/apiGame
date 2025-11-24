#!/bin/bash

# IMMEDIATE FIX: Install IGDB dependency on production server
# Run this command on your production server:

cd /root/gameAPI/apiGame && npm install igdb-api-node@6.0.5 && pm2 restart gameApi --update-env