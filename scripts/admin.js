#!/usr/bin/env node

var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    fs = require('fs'),
    path = require('path'),
    redis = require('redis');

var config = require('../config'),
    isTrue = require('../truthiness');

var db = redis.createClient(),
    argv = process.argv.slice(2),
//  base64 regex
    b64m = new RegExp("^[A-Za-z0-9+/=]+$");

function setUser(name, password, admin) {
  var userHash = 'user:' + name,
      pHash = bcrypt.hashSync(password);

  db.hmset(userHash, ['password', pHash, 'admin', admin, 'inviteQuota', isTrue(admin) ? -1 : 20], function(err, reply) {
    if(!err) {
      console.log("User configured: " + name + " [admin=" + admin + "]");
    } else {
      console.log("Database error.")
    }
  });
}

function delUser(name) {
  var userHash = 'user:' + name,
      m = db.multi();

  m.del(userHash);
  m.del(userHash + ':public');
  m.del(userHash + ':private');

  m.exec(function(err, replies) {
    if(!err) {
      console.log("User deleted: " + argv[1]);
    } else {
      console.log("Database error.");
    }
  });
}

function setAdmin(name, state) {
  var userHash = 'user:' + name;
  db.hset(userHash, ['admin', state], function(err, reply) {
    if(!err) {
      console.log("User configured: " + name + " [admin=" + state + "]");
    } else {
      console.log(name + ": no such user");
    }
  });
}

function main() {
  if(_.has(config, 'database')) {
    console.log("> Selecting database " + config.database);
    db.select(config.database);
  }

  if(argv[0] == 'flush') {
    db.flushdb();
  }
  else if(argv[0] == 'setuser') {
    if(argv.length >= 3) {
      setUser(argv[1], argv[2], argv[3]);
    } else {
      console.log("Error: 'setuser' needs 2 arguments, " + (argv.length - 1) + " were given.");
    }
  }
  else if(argv[0] == 'deluser') {
    if(argv.length == 2) {
      delUser(argv[1]);
    } else {
      console.log("Error: 'deluser' needs 1 argument, " + (argv.length - 1) + " were given.");
    }
  }
  else if(argv[0] == 'setadmin') {
    if(argv.length == 3) {
      setAdmin(argv[1], argv[2]);
    } else {
      console.log("Error: 'setadmin' needs 2 arguments, " + (argv.length - 1) + " were given.");
    }
  }
  else if(argv[0] == 'mkdb') {
    var admin = null,
        password = null,
        _public = false;

    for(var i=1; i < argv.length; ++i) {
      if(argv[i].startsWith('admin=')) {
        admin = argv[i].split('=').slice(1).join();
      }
      else if(argv[i].startsWith('password=')) {
        password = argv[i].split('=').slice(1).join();
      }
      else if(argv[i] == 'public') {
        _public = true;
      }
    }

    if(admin == null || password == null) {
      console.log("Error: you must specify an administrator user and password.");
      console.log("Example: ./admin mkdb admin=someone password=something");
      return;
    }

    console.log("\nAll uploads will be " + (_public ? "public." : "private."));
    setUser(admin, password, 'yes'); // add default admin user

    var fileNames = fs.readdirSync(path.resolve(__dirname + '/../files')).filter(function(fn) {
      return fn.substr(0,1) != '.';
    });

    for(var i=0; i < fileNames.length; ++i) {
      var fileName = fileNames[i],
          filePath = './files/' + fileName,
          fileHash = 'file:' + fileName;

      var u = {
        'fileName': fileName,
        'user': admin,
        'time': fs.statSync(filePath).mtime.getTime(),
        'encrypted': b64m.test(fs.readFileSync(filePath, 'utf-8').toString()),
        'public': _public
      };

      var m = db.multi();

      m.hmset(fileHash,
        'user', admin,
        'time', u.time,
        'encrypted', u.encrypted,
        'public', u.public
      );

      // push to user upload lists
      var userHash = 'user:' + admin;
      if(_public) {
        m.zadd('public', u.time, u.fileName);
        m.zadd(userHash + ':public', u.time, u.fileName);
      } else {
        m.zadd(userHash + ':private', u.time, u.fileName);
      }

      m.exec();
      console.log(u.fileName + ", time=" + u.time + (u.encrypted ? ", encrypted" : ", plain"));
    }
  }
}

main();
db.quit();
