#!/usr/bin/node

var _ = require('underscore')._,
    fs = require('fs'),
    redis = require('redis'),
    process = require('process');

var config = require('../config'),
    isTrue = require('../truthiness');

var argv = process.argv.slice(2);
if(argv.length < 2) {
  console.log("Arguments: <user> <private/public>");
  process.exit(1);
}

var user = argv[0];

var state;
if(argv[1] == 'private') {
  state = false;
} else if(argv[1] == 'public') {
  state = true;
} else {
  console.log("Invalid argument(s), expected 'private' or 'public'.");
  process.exit(1);
}

var db = redis.createClient();
if(_.has(config, 'database')) {
  console.log("> Selecting database " + config.database);
  db.select(config.database);
}

fs.readdir(__dirname + '/../files', function(err, fileNames) {
  var listingHash = 'user:' + user + ':' + argv[1];
  fileNames.forEach(function(fileName) {
    db.hgetall('file:' + fileName, function(err, u) {
      if(u != null && u.user == user && isTrue(u.public) == state) {
        console.log(fileName);
        db.zadd(listingHash, u.time, fileName);
      }
    });
  });
});

db.quit();
