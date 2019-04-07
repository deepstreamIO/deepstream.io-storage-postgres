#!/usr/bin/env bash

echo "Before install - OS is $TRAVIS_OS_NAME"

if [[ $TRAVIS_OS_NAME = 'osx' ]]; then
#    echo "Installing postgres on mac"
#    echo "Updating homebrew"
#    brew update
#    echo "Installing and starting postgres"
#    brew uninstall postgresql
#    brew cleanup postgresql
#    brew install postgresql@9.6
#    rm -rf /usr/local/var/postgres
#    initdb /usr/local/var/postgres
    pg_ctl -D /usr/local/var/postgres start
fi
