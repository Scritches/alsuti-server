var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid'),
    requireAuth = require('./userauth');

var router = express.Router();

router.post('/upload', requireAuth);
router.post('/upload', function(req, res) {
  var localPath,
      fileName;

  res.setHeader('Content-Type', 'application/text');

  if(_.has(req.files, 'fileupload')) {
    localPath = __dirname + '/../files/';
    fileName = shortid.generate() + '.' +
					 _.last(req.files.fileupload.originalname.split('.'));

    fs.readFile(req.files.fileupload.path, function(err, data) {
      fs.writeFile(localPath + fileName, data, function(err) {
        res.send(req.app.get('externalPath') + '/' + fileName);
      });
    });
  }
  else if(_.has(req.body, 'uri')) {
    localPath = __dirname + '/../files/';
    fileName = shortid.generate() + '.' + 
					 _.last(req.body.uri.split('.')).replace(/\?.*$/,'').replace(/:.*$/,'');

    request.get(req.body.uri).pipe(fs.createWriteStream(localPath + fileName))
      .on('close', function() {
        res.send(req.app.get('externalPath') + '/' + fileName);
      });
  }
  else if(_.has(req.body, 'content')) {
    localPath = __dirname + '/../files/';
    fileName = shortid.generate() + '.' + req.body.extension;
    fs.writeFile(localPath + fileName, req.body.content, function(err) {
      res.send(req.app.get('externalPath') + '/' + fileName);
    });
  }
  else {
    res.status(400);
    res.send("Error: Nothing was uploaded");
    return;
  }

  // store metadata

  var db = req.app.get('database'),
      uHash = 'upload:' + fileName,
      userHash = 'user:' + req.sessionUser,
      encrypted = _.has(req.body, 'encrypted') && req.body.encrypted == 'true',
      _public = _.has(req.body, 'public') && req.body.public == 'true',
      title = req.body.title || null,
      description = req.body.description || null;

  db.hmset(uHash,
    'user', req.sessionUser,
    'time', Date.now(),
    'encrypted', encrypted,
    'public', _public
  );

  if(title != null) {
    title = title.trim();
    if(title.length > 0)
      db.hset(uHash, 'title', title);
  }
  if(description != null) {
    description = description.trim();
    if(description.length > 0)
      db.hset(uHash, 'description', description);
  }

  if(_public) {
    db.lpush('public', fileName);
    db.lpush(userHash + ':public', fileName);
  }
  else {
    db.lpush(userHash + ':private', fileName);
  }
});

router.post('/rename', requireAuth);
router.post('/rename', function(req, res) {
});

router.post('/delete', requireAuth);
router.post('/delete', function(req, res) {
  res.setHeader('Content-Type', 'application/text');

  var fileName = req.body.file || null;
  if(fileName == null) {
    res.send("Error: No file specified.");
    return;
  }

  var db = req.app.get('database'),
      uHash = 'upload:' + fileName;

  db.hmget(uHash, ['user', 'public'], function(err, data) {
    if(!err && data[0] != null) {
      // check if authorized user owns this file
      if(data[0] == req.sessionUser) {
        var userHash = 'user:' + data[0],
            filePath = __dirname + '/../files/' + fileName;

        // delete metadata
        db.del(uHash);
        if(data[1] == 'true') {
          db.lrem('public', 1, fileName);
          db.lrem(userHash + ':public', 1, fileName);
        }
        else {
          db.lrem(userHash + ':private', 1, fileName);
        }

        fs.unlink(filePath, function(err) {
          res.send("Success: File deleted.");
        });
      }
      else {
        res.send("Error: Not authorized.");
      }
    }
    else {
      res.send("Error: No such file.");
    }
  });
});

router.get('/', requireAuth);
router.get('/', function(req, res) {
  res.render('upload', {
    'title': "Upload",
    'sessionUser': req.sessionUser
  });
});

router.get('/:file', function(req, res) {
  var u;
  async.series([
    function(done) {
      var db = req.app.get('database'),
          uHash = 'upload:' + req.params['file'];

      db.hgetall(uHash, function(err, obj) {
        if(err != null || obj == null) {
          u = null;
          done(err);
          return;
        }

        u = obj;

        if(_.has(u, 'title') == false)
          u.title = null;
        if(_.has(u, 'description') == false)
          u.description = null;
        if(_.has(u, 'user') == false)
          u.user = null;

        if(_.has(u, 'time'))
          u.time = u.time;
        else
          u.time = null;

        if(_.has(u, 'encrypted'))
          u.encrypted = u.encrypted == 'true';
        else
          u.encrypted = false;

        done();
      });
    }],
    function(err) {
      if(u == null) {
        res.render('info', {
          'title': "Error",
          'message': "File not found."
        });
        return;
      }

			var filePath = __dirname + '/../files/' + req.params.file,
					ext = _.last(req.params.file.split('.')).toLowerCase();

      if(req.device.type == 'bot' ||
         (u.encrypted == false && _.include(['jpg', 'png', 'gif', 'jpeg'], ext)))
      {
        res.sendFile(path.resolve(filePath));
      }
      else {
        fs.readFile(filePath, 'utf-8', function(err, data) {
          if(!err) {
            res.render('view', {
              'fileName': req.params.file,
              'title': u.title,
              'description': u.description,
              'user': u.user,
              'time': u.time,
              'encrypted': u.encrypted,
              'content': data.toString('utf-8')
            });
          }
          else {
            res.render('info', {
              'title': "Error",
              'message': "Cannot read file."
            });
          }
        });
      }
    }
  );
});

// handle deprecated URLs for encrypted file view
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
