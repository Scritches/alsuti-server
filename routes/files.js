var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid'),
    auth = require('./userauth'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/', auth.required);
router.get('/', function(req, res) {
  res.render('upload', {
    'title': "Upload",
    'sessionUser': req.sessionUser
  });
});

router.post('/upload', auth.required);
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
      req.api(true, "Nothing was uploaded.");
    } else {
      res.redirect('/');
    }

    return;
  }

  function postWrite(err) {
    if(err) {
      if(req.apiRequest) {
        res.api(true, "Cannot write file.");
      } else {
        res.render('info', {
          'title': "Upload Error",
          'message': "Cannot write file."
        });
      }

      return;
    }

    var db = req.app.get('database'),
        m = db.multi(),
        fHash = 'file:' + fileName,
        userHash = 'user:' + req.sessionUser,
        time = Date.now(),
        title = req.body.title || null,
        desc = req.body.description || null,
        encrypted = isTrue(req.body.encrypted) || false,
        _public = isTrue(req.body.public) || false;

    var metadata = {
      'user': req.sessionUser,
      'time': time,
      'encrypted': encrypted,
      'public': _public
    };

    if(title != null) {
      title = title.trim();
      if(title.length > 0) {
        metadata.titie = title;
      }
    }

    if(desc != null) {
      desc = desc.trim();
      if(desc.length > 0) {
        metadata.description = desc;
      }
    }

    console.log(fHash);
    console.log(metadata);
    m.hmset(fHash, metadata);

    if(_public) {
      m.zadd('public', time, fileName);
      m.zadd(userHash + ':public', time, fileName);
    }
    else {
      m.zadd(userHash + ':private', time, fileName);
    }

    m.exec(function(err, replies) {
      if(!err) {
        // upload successful, return url
        if(req.apiRequest) {
          res.api(false, url);
        } else {
          res.status(302);
          res.redirect(url);
        }
      }
      else {
        // database error, file still written
        fs.unlink(localPath + fileName, function(err) {
          if(req.apiRequest) {
            res.api(true, "Database error.");
          } else {
            res.redirect('/');
          }
        });
      }
    });
  }
});

router.get('/edit/:file', auth.required);
router.get('/edit/:file', function(req, res) {
  var db = req.app.get('database'),
           fHash = 'file:' + req.params.file;

  db.hmget(fHash, ['title', 'description', 'public'], function(err, data) {
    if(!err) {
      res.render('edit', {
        'fileName': req.params.file,
        'title': data[0],
        'description': data[1],
        'public': isTrue(data[2]),
        'returnPath': '/' + req.params.file
      });
    }
    else {
      res.render('info', {
        'title': "Error",
        'message': "No such file.",
      });
    }
  });
});

router.post('/edit', auth.required);
router.post('/edit', function(req, res) {
  if(_.has(req.body, 'file') == false) {
    if(req.apiRequest) {
      res.api(true, "No file specified.");
    } else {
      res.render('info', {
        'title': "Client Error",
        'message': "No file specified."
      });
    }

    return;
  }

  var db = req.app.get('database'),
      fileName = req.body.file,
      fHash = 'file:' + fileName,
      returnPath = req.body.returnPath || ('/' + fileName);

  db.hmget(fHash, ['user', 'time', 'title', 'description', 'public'], function(err, data) {
    if(!err) {
      var user = data[0];
      if(req.authAs(user)) {
        var m = db.multi(),
            time = data[1],
            title = data[2],
            desc = data[3],
            _public = isTrue(data[4]);
            newTitle = req.body.title.trim() || null,
            newDesc = req.body.description.trim() || null,
            nowPublic = isTrue(req.body.public) || false;

        if(newTitle != title) {
          if(newTitle != null && newTitle.length > 0) {
            m.hset(fHash, 'title', newTitle);
          } else {
            m.hdel(fHash, 'title');
          }
        }

        if(newDesc != desc) {
          if(newDesc != null && newDesc.length > 0) {
            m.hset(fHash, 'description', newDesc);
          } else {
            m.hdel(fHash, 'description');
          }
        }

        if(nowPublic != _public) {
          // update public flag
          m.hset(fHash, 'public', nowPublic);
          if(nowPublic) {
            m.zrem('user:' + user + ':private', fileName);
            m.zadd('public', time, fileName);
            m.zadd('user:' + user + ':public', time, fileName);
          } else {
            m.zrem('public', fileName);
            m.zrem('user:' + user + ':public', fileName);
            m.zadd('user:' + user + ':private', time, fileName);
          }
        }

        m.exec(function(err, replies) {
          if(!err) {
            if(req.apiRequest) {
              res.setHeader('Content-Type', 'application/json');
              res.json({
                'error': false,
                'file': fileName,
                'success': "File edited successfully."
              });
            }
            else {
              res.redirect(returnPath);
            }
          }
          else {
            if(req.apiRequest) {
              res.api(true, "Database error.");
            } else {
              res.render('info', {
                'title': "Database Error",
                'message': "Failed to edit file details.",
                'returnPath': returnPath
              });
            }
          }
        });
      }
      else {
        if(req.apiRequest) {
          res.api(true, "You are not allowed to edit this file.");
        } else {
          res.render('info', {
            'title': "Not Authorized",
            'message': "You are not allowed to edit this file.",
            'returnPath': returnPath
          });
        }
      }
    }
    else {
      if(req.apiRequest) {
        res.api(true, "No such file.");
      }
      else {
        res.render('info', {
          'title': 'Error',
          'message': "No such file.",
          'returnPath': req.headers.referer || '/'
        });
      }
    }
  });
});

router.get('/delete/:file', auth.required);
router.get('/delete/:file', function(req, res) {
  var db = req.app.get('database'),
      fileName = req.params.file,
      fHash = 'file:' + fileName;

  db.hmget(fHash, ['title', 'user', 'public'], function(err, data) {
    if(!err) {
      if(req.authAs(data[1])) {
        res.render('delete', {
          'fileName': fileName,
          'title': data[0],
          'user': data[1],
          'public': isTrue(data[2]),
          'returnPath': req.headers.referer || '/'
        });
      }
      else {
        res.render('info', {
          'title': "Not Authorized",
          'message': "You are not allowed to delete this file.",
          'returnPath': req.headers.referer || ('/' + fileName)
        });
      }
    }
    else {
      res.render('info', {
        'title': "Error",
        'message': "No such file.",
        'returnPath': req.headers.referer || '/'
      });
    }
  });
});

router.post('/delete', auth.required);
router.post('/delete', function(req, res) {
  if(_.has(req.body, 'file') == false) {
    if(req.apiRequest) {
      res.api(true, "No file specified.");
    } else {
      res.status(400);
      res.render('info', {
        'title': "Client Error",
        'message': "No file specified."
      });
    }
    return;
  }

  var db = req.app.get('database'),
      fileName = req.body.file || null,
      filePath = __dirname + '/../files/' + fileName;
      fHash = 'file:' + fileName;

  db.hmget(fHash, ['user', 'public'], function(err, data) {
    if(!err) {
      if(req.authAs(data[0])) {
        // delete file
        fs.unlink(filePath, function(err) {
          var m = db.multi(),
              userHash = 'user:' + data[0];

          // delete metadata

          m.del(fHash);
          if(isTrue(data[1])) {
            m.zrem('public', fileName);
            m.zrem(userHash + ':public', fileName);
          }
          else {
            m.zrem(userHash + ':private', fileName);
          }

          m.exec(function(err, replies) {
            if(!err) {
              if(req.apiRequest) {
                res.api(false, "File deleted.");
              } else {
                res.redirect(req.body.returnPath || '/');
              }
            }
            else {
              if(req.apiRequest) {
                res.api(true, "Database error.");
              } else {
                res.render('info', {
                  'title': "Database Error",
                  'message': "Something went wrong."
                });
              }
            }
          });
        });
      }
      else {
        if(req.apiRequest) {
          res.api(true, "Not authorized.");
        } else {
          res.redirect(req.body.returnPath || '/');
        }
      }
    }
    else {
      if(req.apiRequest) {
        res.api(true, "No such file.");
      } else {
        res.redirect(req.body.returnPath || '/');
      }
    }
  });
});

router.get('/:file', auth.optional);
router.get('/:file', function(req, res, rf) {
  var db = req.app.get('database'),
      fHash = 'file:' + req.params.file;

  db.hgetall(fHash, function(err, u) {
    if(!err && u != null) {
      for(k in ['title', 'description', 'user', 'time']) {
        if(_.has(u,k) == false)
          u[k] = null;
      }

      u.encrypted = isTrue(u.encrypted) || false;
      u.public = isTrue(u.public) || false;

      var filePath = path.resolve(__dirname + '/../files/' + req.params.file),
          ext = _.last(req.params.file.split('.')).toLowerCase();

      fs.readFile(filePath, 'utf-8', function(err, data) {
        if(!err) {
          function isImage(ext) {
            return ['gif', 'jpg', 'jpeg',
                    'png', 'svg', 'bmp', 'ico'].indexOf(ext) != -1;
          }

          res.render('view', {
            'authorized': req.auth(),
            'isOwner': req.authAs(u.user),
            'image': isImage(ext),
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
            res.api(true, "Cannot read file.");
          } else {
            res.render('info', {
              'title': "Error",
              'message': "Cannot read file.",
              'returnPath': req.headers.referer || null
            });
          }
        }
      });
    }
    else {
      if(req.apiRequest) {
        res.api(true, "No such file.");
      } else {
        res.render('info', {
          'title': "Error",
          'message': "No such file.",
          'returnPath': req.headers.referer || null
        });
      }
    }
  });
});

// used for displaying unencrypted text/images in web view
router.get('/raw/:file', function(req, res) {
  var filePath = path.resolve(__dirname + '/../files/' + req.params.file);
  fs.access(filePath, function(err) {
    if(!err) {
      res.sendFile(filePath);
    } else {
      res.status(404);
    }
  });
});

// handle deprecated encrypted views
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
