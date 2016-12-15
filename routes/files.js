var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid'),
    auth = require('./auth'),
    isTrue = require('../truthiness');

function getFileExt(str) {
  var m = str.match(/\.[a-z]+\w+$/i);
  return m != null ? m[0] : '';
}
function getUrlExt(url) {
  var m = url.match(/(\.[a-z]+\w{2,3})(?:\?\S+)?$/i);
  return m != null ? m[1] : '';
}

var router = express.Router();

router.get('/', auth.required);
router.get('/', function(req, res) {
  res.render('upload', {
    'title': "Upload",
    'session': req.session
  });
});

router.post('/upload', auth.required);
router.post('/upload', function(req, res) {
  var localPath,
      fileName;

  if(_.has(req.files, 'fileupload')) {
    localPath = __dirname + '/../files/';
    fileName = shortid.generate() + getFileExt(req.files.fileupload.path);
    fs.readFile(req.files.fileupload.path, function(err, data) {
      fs.writeFile(localPath + fileName, data, function(err) {
        postWrite(err);
      });
    });
  }
  else if(_.has(req.body, 'content')) {
    localPath = __dirname + '/../files/';
    if(_.has(req.body, 'extension')) {
      fileName = shortid.generate() + '.' + req.body.extension;
    } else {
      fileName = shortid.generate();
    }

    fs.writeFile(localPath + fileName, req.body.content, function(err) {
      postWrite(err);
    });
  }
  else if(_.has(req.body, 'url')) {
    localPath = __dirname + '/../files/';
    fileName = shortid.generate() + getUrlExt(req.body.url);
    request.get(req.body.url) // ...
      .pipe(fs.createWriteStream(localPath + fileName))
      .on('close', function() {
        postWrite(null);
      });
  }
  else {
    res.status(400);
    if(req.apiRequest) {
      res.api(true, {'message': "Nothing was uploaded."});
    } else {
      res.redirect('/');
    }

    return;
  }

  function postWrite(err) {
    if(err) {
      if(req.apiRequest) {
        res.api(true, {'message': "Cannot write file."});
      } else {
        res.render('info', {
          'title': "Upload Error",
          'message': "Cannot write file."
        });
      }

      return;
    }

    var time = Date.now(),
        db = req.app.get('database'),
        m = db.multi(),
        fHash = 'file:' + fileName,
        userHash = 'user:' + req.session.user,
        encrypted = isTrue(req.body.encrypted) || false,
        _public = isTrue(req.body.public) || false;

    var metadata = [
      'user', req.session.user,
      'time', time,
      'encrypted', encrypted,
      'public', _public
    ];

    if(_.has(req.body, 'title') && req.body.title != null) {
      var title = req.body.title.trim();
      if(title.length > 0) {
        metadata.push('title', title);
      }
    }

    if(_.has(req.body, 'description') && req.body.description != null) {
      var desc = req.body.description.trim();
      if(desc.length > 0) {
        metadata.push('description', desc);
      }
    }

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
          res.api(false, {'fileName': fileName});
        } else {
          res.status(302);
          res.redirect('/' + fileName);
        }
      }
      else {
        // database error, get rid of file
        fs.unlink(localPath + fileName, function(err) {
          if(req.apiRequest) {
            res.api(true, {'message': "Database error."});
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

  db.hmget(fHash, ['user', 'title', 'description', 'public'], function(err, data) {
    if(!err) {
      if(req.session.auth(data[0])) {
        res.render('edit', {
          'fileName': req.params.file,
          'title': data[1],
          'description': data[2],
          'public': isTrue(data[3]),
          'returnPath': req.headers.referer || ('/' + req.params.file)
        });
      }
      else {
        res.render('info', {
          'title': "Not Authorized",
          'message': "You are not allowed to edit this file."
        });
      }
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
      res.api(true, {'message': "No file specified."});
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
      if(req.session.auth(user)) {
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
              res.api(false, {'message': "File edited successfully."});
            } else {
              res.redirect(returnPath);
            }
          }
          else {
            if(req.apiRequest) {
              res.api(true, {'message': "Database error."});
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
          res.api(true, {'message': "You are not allowed to edit this file."});
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
        res.api(true, {'message': "No such file."});
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
      if(req.session.auth(data[1])) {
        res.render('delete', {
          'fileName': fileName,
          'title': data[0],
          'user': data[1],
          'public': isTrue(data[2]),
          'returnPath': req.headers.referer || ('/' + fileName),
          'delReturnPath': isTrue(data[2]) ? '/user/' + data[1] : '/private'
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
      res.api(true, {'message': "No file specified."});
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
      if(req.session.auth(data[0])) {
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
                res.api(false, {'message': "File deleted."});
              } else {
                res.redirect(req.body.returnPath || '/');
              }
            }
            else {
              if(req.apiRequest) {
                res.api(true, {'message': "Database error."});
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
          res.api(true, {'message': "Not authorized."});
        } else {
          res.redirect(req.body.returnPath || '/');
        }
      }
    }
    else {
      if(req.apiRequest) {
        res.api(true, {'message': "No such file."});
      } else {
        res.redirect(req.body.returnPath || '/');
      }
    }
  });
});

function sendFile(req, res) {
  var filePath = path.resolve(__dirname + '/../files/' + req.params.file);
  fs.access(filePath, function(err) {
    if(!err) {
      res.sendFile(filePath);
    } else {
      res.status(404);
    }
  });
}

router.get('/:file', function(req, res, rf) {
  var db = req.app.get('database'),
      fileName = req.params.file,
      fHash = 'file:' + fileName;

  db.hgetall(fHash, function(err, u) {
    if(!err && u != null) {
      for(k in ['title', 'description', 'user', 'time']) {
        if(_.has(u,k) == false)
          u[k] = null;
      }

      u.encrypted = isTrue(u.encrypted) || false;
      u.public = isTrue(u.public) || false;

      var filePath = path.resolve(__dirname + '/../files/' + fileName),
          fileExt = getFileExt(filePath).substr(1);

      if(req.device.type == 'bot') {
        sendFile(req, res);
        return;
      }

      fs.readFile(filePath, {'encoding':'utf8'},  function(err, data) {
        if(!err) {
          function isImage(ext) {
            return ['gif', 'jpg', 'jpeg', 'png', 'svg', 'bmp', 'ico'].indexOf(ext) != -1;
          }

          res.render('view', {
            'returnPath': req.headers.referer || null,
            'isImage': isImage(fileExt),
            'fileExt': fileExt,
            'fileName': fileName,
            'title': u.title,
            'description': u.description,
            'user': u.user,
            'time': u.time,
            'encrypted': u.encrypted,
            'content': data.toString(),
            'session': req.session,
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
router.get('/x/:file', sendFile);

// handle deprecated encrypted views
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
