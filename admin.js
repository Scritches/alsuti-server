#!/usr/bin/env node

var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    fs = require('fs'),
    redis = require('redis');

var db = redis.createClient(),
    argv = process.argv.slice(2),
//  base64 regex from http://stackoverflow.com/a/18967082
    b64m = new RegExp("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})([=]{1,2})?$");

if(_.has(process.env, 'ALSUTI_DATABASE')) {
  db.select(process.env.ALSUTI_DATABASE);
}

if(argv[0] == 'users') {
  if(argv.length != 4) {
    console.log("4 arguments required, " + argv.length + " given.");
    db.quit();
    return;
  }

	var userHash = 'user:' + argv[2];
  if(argv[1] == 'add') {
    var passwordHash = bcrypt.hashSync(argv[3]);
    db.hset(userHash, 'password', passwordHash);
    process.stdout.write(">> added user '" + argv[2] + "'\n>> password hash: "+ passwordHash);
  }
  else if(argv[1] == 'del') {
    db.del(userHash);
    db.del(userHash + ':public');
    console.log(">> deleted user '" + argv[2] + "'");
  }

  db.quit();
}
else if(argv[0] == 'mkdb') {
  var user = null,
      _public = false;

  for(var i=1; i < argv.length; ++i) {
    if(argv[i].startsWith('user=')) {
      user = argv[i].split('=')[1];
    } else if (argv[i] == 'public') {
      _public = true;
    }
  }

  db.del('public');

  var slugs = fs.readdirSync('files').filter(function(slug) {
    return slug.startsWith(".") == false;
  });

  var uploads = slugs.map(function(slug) {
    var filePath = 'files/' + slug;
    return {
      'fileName': slug,
      'time': fs.statSync(filePath).mtime.getTime(),
      'encrypted': b64m.test(fs.readFileSync(filePath, 'utf-8').toString()),
      'public': _public
    };
  }).sort(function(a,b) {
    return a.time - b.time;
  });

  for(var i=0; i < uploads.length; ++i) {
    var u = uploads[i],
        uHash = 'upload:' + u.fileName,
        settings = [];

    if(_public) {
      db.lpush('public', u.fileName);
    }

    if(user != null) {
      db.hset(uHash, 'user', user);
      db.lpush(userHash + ':public', u.fileName);
    }

    db.hmset(uHash,
      'time', u.time,
      'encrypted', u.encrypted ? 'true' : 'false'
    );

    console.log(u.fileName + ": " + "encrypted=" + (u.encrypted ? 'yes' : 'no') + ", time=" + u.time.toString());
  }

  if(_public) {
    console.log("> public by default");
  }
  if(user != null) {
    console.log("> default user = " + user);
  }

  console.log(">> database generated");
  db.quit();
}
