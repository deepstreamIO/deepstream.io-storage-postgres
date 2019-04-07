#!/usr/bin/env bash

echo "Before install - OS is $TRAVIS_OS_NAME"

if [[ $TRAVIS_OS_NAME = 'osx' ]]; then
    echo "Installing postgres on mac"
    echo "Updating homebrew"
    brew update
    echo "Installing and starting postgres"
    brew install postgresql
    rm -rf /usr/local/var/postgres
    initdb /usr/local/var/postgres
    pg_ctl -D /usr/local/var/postgres start
    psql -c "CREATE DATABASE travis_ci_test;" -U postgres
    psql -c "CREATE USER postgres WITH PASSWORD '';" -U postgres
fi
