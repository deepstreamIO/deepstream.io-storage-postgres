#!/usr/bin/env bash

echo "Before install - OS is $TRAVIS_OS_NAME"

echo "Installing postgres on mac"
if [[ $TRAVIS_OS_NAME = 'osx' ]]; then
    echo "Updating homebrew"
    brew update
    echo "Installing and starting postgres"
    brew install postgresql
    rm -rf /usr/local/var/postgres
    initdb /usr/local/var/postgres
    pg_ctl -D /usr/local/var/postgres start
fi