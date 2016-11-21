#!/usr/bin/env node

var _ = require('underscore')._,
    async = require('async'),
    fs = require('fs'),
    redis = require('redis');

var db = redis.createClient(),
//  base64 regex from http://stackoverflow.com/a/18967082
    b64m = new RegExp("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})([=]{1,2})?$");

if(_.has(process.env, 'DB')) {
  db.select(process.env.DB);
}

fs.readdir('files', function(err, files) {
  var encrypted;
  async.each(files, function(file, done) {
    fs.readFile("files/" + file, 'utf-8', function(err, data) {
      if(err) {
        done();
        return;
      }

      db.hget(file, 'encrypted', function(err, reply) {
        if(reply == null) {
          process.stdout.write(file + ": detecting base64.. ");
          encrypted = b64m.test(data) ? true : false;
          process.stdout.write(encrypted + '\n');
          db.hset(file, 'encrypted', encrypted);
        }

        done();
      });
    });
  },
  function(err) {
    console.log("closing db link");
    db.quit();
  });
});

