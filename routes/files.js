var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid'),
    requireAuth = require('./userauth'),
    isTrue = require('./truthiness');

var router = express.Router();

router.get('/', requireAuth);
router.get('/', function(req, res) {
  res.render('upload', {
    'title': "Upload",
    'sessionUser': req.sessionUser
  });
});

router.post('/upload', requireAuth);
router.post('/upload', function(req, res) {
  var localPath,
      ext,
      fileName,
      url;

  if(_.has(req.files, 'fileupload')) {
    localPath = __dirname + '/../files/';
    ext = _.last(req.files.fileupload.originalname.split('.'));
    fileName = shortid.generate() + '.' + ext;
    url = req.app.get('externalPath') + '/' + fileName;

    fs.readFile(req.files.fileupload.path, function(err, data) {
      fs.writeFile(localPath + fileName, data, function(err) {
        postWrite(err);
      });
    });
  }
  else if(_.has(req.body, 'uri')) {
    localPath = __dirname + '/../files/';
    ext = _.last(req.body.uri.split('.')).replace(/\?.*$/,'').replace(/:.*$/,'');
    fileName = shortid.generate() + '.' + ext;
    url = req.app.get('externalPath') + '/' + fileName;

    request.get(req.body.uri) // ...
      .pipe(fs.createWriteStream(localPath + fileName))
      .on('close', function() {
        postWrite(err);
      });
  }
  else if(_.has(req.body, 'content')) {
    localPath = __dirname + '/../files/';
    ext = req.body.extension;
    fileName = shortid.generate() + '.' + req.body.extension;
    url = req.app.get('externalPath') + '/' + fileName;

    fs.writeFile(localPath + fileName, req.body.content, function(err) {
      postWrite(err);
    });
  }
  else {
    res.status(400);
    if(req.apiRequest) {
      res.setHeader('Content-Type', 'application/json');
      res.json({'error': "Nothing was uploaded."});
    }
    else {
      res.redirect('/');
    }

    return;
  }

  function postWrite(err) {
    if(err) {
      if(req.apiRequest) {
        res.setHeader('Content-Type', 'application/json');
        res.json({'error': "Cannot write file."});
      }
      else {
        res.redirect('/');
      }
      return;
    }

    var db = req.app.get('database'),
        uHash = 'upload:' + fileName,
        userHash = 'user:' + req.sessionUser,
        encrypted = isTrue(req.body.encrypted) || false,
        _public = isTrue(req.body.public) || false,
        title = req.body.title || null,
        description = req.body.description || null;

    async.series([
      function(done) {
        var pairs = [
          'user', req.sessionUser,
          'time', Date.now(),
          'encrypted', encrypted,
          'public', _public
        ];

        if(title != null) {
          title = title.trim();
          if(title.length > 0) {
            pairs.push('title');
            pairs.push(title);
          }
        }

        if(description != null) {
          description = desc.trim();
          if(desc.length > 0) {
            pairs.push('description');
            pairs.push(description);
          }
        }

        db.hmset(uHash, pairs, function(err, reply) {
          done(err);
        });
      },
      function(done) {
        if(_public) {
          db.multi([
            ['lpush', 'public', fileName],
            ['lpush', userHash + ':public', fileName]
          ]).exec(function(err, replies) {
            done(err);
          });
        }
        else {
          db.lpush(userHash + ':private', fileName, function(err, reply) {
            done(err);
          });
        }
      }],
      function(err) {
        if(!err) {
          // upload successful, return url
          if(req.apiRequest) {
            res.setHeader('Content-Type', 'application/json');
            res.json({'url': url});
          }
          else {
            res.status(302);
            res.redirect(url);
          }
        }
        else {
          // database error, file still written
          fs.unlink(localPath + fileName, function(err) {
            if(req.apiRequest) {
              res.setHeader('Content-Type', 'application/json');
              res.json({'error': "Database error."});
            }
            else {
              res.redirect('/');
            }
          });
        }
      }
    );
  }
});
/*
router.get('/rename', requireAuth);
router.get('/rename', function(req, res) {
  res.render('rename', u);
});

router.post('/rename', requireAuth);
router.post('/rename', function(req, res) {
});

router.get('/delete', requireAuth);
router.get('/delete/:file', function(req, res) {
  res.render('delete', u);
}
*/
router.post('/delete', requireAuth);
router.post('/delete', function(req, res) {
  var fileName = req.body.file || null;
  if(fileName == null) {
    if(req.apiRequest) {
      res.setHeader('Content-Type', 'application/json');
      res.json({'error': "No file specified."});
    }
    else {
      res.status(400);
      res.render('info', {
        'title': "Error",
        'message': "No file specified."
      });
    }
    return;
  }

  var db = req.app.get('database'),
      uHash = 'upload:' + fileName;

  db.hmget(uHash, ['user', 'public'], function(err, data) {
    if(!err) {
      // check if authorized user owns this file
      if(data[0] == req.sessionUser) {
        var userHash = 'user:' + data[0],
            filePath = __dirname + '/../files/' + fileName;

        // delete file and then the metadata
        fs.unlink(filePath, function(err) {
          db.del(uHash);
          if(isTrue(data[1])) {
            db.lrem('public', 1, fileName);
            db.lrem(userHash + ':public', 1, fileName);
          }
          else {
            db.lrem(userHash + ':private', 1, fileName);
          }
        });

        if(req.apiRequest) {
          res.setHeader('Content-Type', 'application/json');
          res.json({'success': "File deleted."});
        }
        else {
          res.redirect(req.body.returnPath || '/');
        }
      }
      else {
        if(req.apiRequest) {
          res.setHeader('Content-Type', 'application/json');
          res.json({'error': "Not authorized."});
        }
        else {
          res.redirect(req.body.returnPath || '/');
        }
      }
    }
    else {
      if(req.apiRequest) {
        res.setHeader('Content-Type', 'application/json');
        res.json({'error': "No such file."});
      }
      else {
        res.redirect(req.body.returnPath || '/');
      }
    }
  });
});

router.get('/:file', function(req, res, rf) {
  var u;
  async.series([
    function(done) {
      var db = req.app.get('database'),
          uHash = 'upload:' + req.params.file;

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

        u.encrypted = isTrue(u.encrypted) || false;
        u.public = isTrue(u.public) || false;

        done();
      });
    }],
    function(err) {
      if(u == null) {
        if(req.apiRequest) {
          res.setHeader('Content-Type', 'application/json');
          res.json({'error': "File not found."});
        }
        else {
          res.render('info', {
            'title': "Error",
            'message': "File not found.",
            'returnPath': req.headers.referer || null
          });
        }
        return;
      }

      var filePath = __dirname + '/../files/' + req.params.file,
          ext = _.last(req.params.file.split('.')).toLowerCase();

      function isImage(ext) {
        return ['gif', 'jpg', 'jpeg', 'png', 'svg', 'bmp', 'ico'].indexOf(ext) != -1;
      }

      if(req.device.type == 'bot' ||
         (u.encrypted == false && isImage(ext)))
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
            if(req.apiRequest) {
              res.setHeader('Content-Type', 'application/json');
              res.json({'error': "Cannot read file."});
            }
            else {
              res.render('info', {
                'title': "Error",
                'message': "Cannot read file.",
                'returnPath': req.headers.referer || null
              });
            }
          }
        });
      }
    }
  );
});

// handle deprecated encrypted views
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
