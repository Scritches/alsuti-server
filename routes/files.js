var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    multer = require('multer'),
    path = require('path'),
    jo = require('jpeg-autorotate'),
    request = require('request'),
    shortid = require('shortid'),
    auth = require('./auth'),
    isTrue = require('../truthiness'),
    types = require('../types');

var router = express.Router();

router.get('/upload', auth.required);
router.get('/upload', function(req, res) {
  res.render('upload');
});

router.get('/paste', auth.required);
router.get('/paste', function(req, res) {
  res.render('paste');
});

router.get('/rehost', auth.required);
router.get('/rehost', function(req, res) {
  res.render('rehost');
});

var fileUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, callback) {
      callback(null, path.join(__dirname, '/../files/'));
    },
    filename: function(request, file, callback) {
      var fileExt = types.fileExtension(file.originalname);
      if(fileExt != null) {
        callback(null, shortid.generate() + '.' + fileExt);
      } else {
        callback(null, shortid.generate());
      };
    }
  })
});

router.post('/upload', auth.required);
router.post('/upload', fileUpload.single('file'));
router.post('/upload', function(req, res) {
  var fileExt,
      fileName,
      filePath;

  // upload
  if(_.has(req, 'file')) {
    fileExt = types.fileExtension(req.file.filename);
    fileName = req.file.filename;
    filePath = req.file.path;
    
    // multer handles the upload itself.
    // here we just autorotate jpeg images.

    if(fileExt != null && isTrue(req.body.encrypted) == false &&
       types.mimeMap['image']['jpeg'].indexOf(fileExt) != -1)
    {
      // autorotate jpeg images into correct orientation
      fs.readFile(filePath, function(readErr, data) {
        if(!readErr) {
          writeRotatedJPEG(data);
        } else {
          readError();
        }
      });
    }
    else {
      finalizeUpload(null);
    }
  }
  // paste
  else if(_.has(req.body, 'content')) {
    localPath = __dirname + '/../files/';

    if(_.has(req.body, 'extension')) {
      fileName = shortid.generate() + '.' + req.body.extension;
    } else {
      fileName = shortid.generate();
    }

    filePath = localPath + fileName;
    fs.writeFile(filePath, req.body.content, function(err) {
      finalizeUpload(err);
    });
  }
  // rehost
  else if(_.has(req.body, 'url')) {
    localPath = __dirname + '/../files/';
    try {
      request.head(req.body.url).on('response', function(response) {
        var mimeType = _.has(response.headers, 'content-type') ?
                       response.headers['content-type'] : null;

        if(mimeType != null) {
          fileExt = types.getExtension(mimeType);
        } else {
          fileExt = types.urlExtension(req.body.url);
        }

        if(fileExt != null) {
          fileName = shortid.generate() + '.' + fileExt;
        } else {
          fileName = shortid.generate();
        }

        filePath = localPath + fileName;
        request.get(req.body.url) // ...
          .pipe(fs.createWriteStream(filePath))
          .on('close', function() { finalizeUpload(null); })
      });
    }
    catch(e) {
      if(req.apiRequest) {
        res.api(true, {'message': "Invalid URL."});
      } else {
        res.render('info', {
          'title': 'Error',
          'message': "Invalid URL."
        });
      }
    }
  }
  else {
    res.status(400);
    if(req.apiRequest) {
      res.api(true, {'message': "Nothing was uploaded."});
    } else {
      res.redirect(req.headers.referer || '/private');
    }

    return;
  }

  function writeRotatedJPEG(data) {
    jo.rotate(data, {quality: 95}, function(err, buffer, orientation) {
      fs.writeFile(filePath, err == null ? buffer : data, function(err) {
        finalizeUpload(null);
      });
    });
  }

  function finalizeUpload(err) {
    var time = Date.now(),
        db = req.app.get('database'),
        m = db.multi(),
        fileHash = 'file:' + fileName,
        userHash = 'user:' + req.session.user;

    var _public = _.has(req.body, 'public') && isTrue(req.body.public);

    var metadata = [
      'user', req.session.user,
      'time', time,
      'encrypted', _.has(req.body, 'encrypted') && isTrue(req.body.encrypted),
      'public', _public,
    ];

    if(_.has(req.body, 'title')) {
      var title = req.body.title.trim();
      if(title.length > 0) {
        metadata.push('title', title);
      } else {
        m.hdel(fileHash, 'title');
      }
    }

    if(_.has(req.body, 'description')) {
      var desc = req.body.description.trim();
      if(desc.length > 0) {
        metadata.push('description', desc);
      } else {
        m.hdel(fileHash, 'description');
      }
    }

    m.hmset(fileHash, metadata);

    if(_public) {
      m.zadd('public', time, fileName);
      m.zadd(userHash + ':public', time, fileName);
    }
    else {
      m.zadd(userHash + ':private', time, fileName);
    }

    m.exec(function(err, replies) {
      if(!err) {
        // upload successful, return fileName
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
            res.render('info', {
              'error': true,
              'title': "Database Error",
              'message': "Failed to store metadata."
            });
          }
        });
      }
    });
  }

  function readError() {
    if(req.apiRequest) {
      res.api(true, {'message': "Cannot read from file/URL."});
    } else {
      res.render('info', {
        'error': true,
        'title': "Upload Error",
        'message': "Cannot read file/URL."
      });
    }
  }

  function writeError() {
    if(req.apiRequest) {
      res.api(true, {'message': "Cannot write file."});
    } else {
      res.render('info', {
        'error': true,
        'title': "Upload Error",
        'message': "Cannot write file."
      });
    }
  }
});

router.get('/edit/:file', auth.required);
router.get('/edit/:file', function(req, res) {
  var db = req.app.get('database'),
           fileHash = 'file:' + req.params.file;

  db.hgetall(fileHash, function(err, u) {
    if(!err && u != null) {
      if(req.session.admin || req.session.validate(u.user)) {
        res.render('edit', {
          'fileName': req.params.file,
          'title': u.title || "",
          'description': u.description || "",
          'public': isTrue(u.public),
          'returnPath': req.headers.referer || ('/' + req.params.file)
        });
      }
      else {
        res.render('info', {
          'title': "Not Authorized",
          'message': "You are not allowed to edit this file.",
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
      fileHash = 'file:' + fileName,
      returnPath = req.body.returnPath || ('/' + fileName);

  db.hgetall(fileHash, function(err, u) {
    if(!err && u != null) {
      if(req.session.admin || req.session.validate(u.user)) {
        if(_.has(req.body, 'title')) {
          newTitle = req.body.title.trim();
        } else {
          newTitle = null;
        }

        if(_.has(req.body, 'description')) {
          newDesc = req.body.description.trim();
        } else {
          newDesc = null;
        }

        if(_.has(req.body, 'public')) {
          nowPublic = isTrue(req.body.public);
        } else {
          nowPublic = false;
        }

        var m = db.multi();

        if(newTitle != u.title) {
          if(newTitle != null && newTitle.length > 0) {
            m.hset(fileHash, 'title', newTitle);
          } else {
            m.hdel(fileHash, 'title');
          }
        }

        if(newDesc != u.description) {
          if(newDesc != null && newDesc.length > 0) {
            m.hset(fileHash, 'description', newDesc);
          } else {
            m.hdel(fileHash, 'description');
          }
        }

        if(nowPublic != u.public) {
          // update public flag
          m.hset(fileHash, 'public', nowPublic);
          // transfer slug to appropriate list(s)
          if(nowPublic) {
            m.zrem('user:' + u.user + ':private', fileName);
            m.zadd('public', u.time, fileName);
            m.zadd('user:' + u.user + ':public', u.time, fileName);
          } else {
            m.zrem('public', fileName);
            m.zrem('user:' + u.user + ':public', fileName);
            m.zadd('user:' + u.user + ':private', u.time, fileName);
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
                'error': true,
                'title': "Database Error",
                'message': "Could not edit file details.",
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
      fileHash = 'file:' + fileName;

  db.hgetall(fileHash, function(err, u) {
    if(!err && u != null) {
      if(req.session.admin || req.session.validate(u.user)) {
        res.render('delete', {
          'fileName': fileName,
          'title': u.title,
          'user': u.user,
          'public': u.public,
          'cancelReturnPath': req.headers.referer || ('/' + fileName),
          'deleteReturnPath': isTrue(u.public) ? '/user/' + u.user : '/private'
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
        'error': true,
        'title': "Error",
        'message': "No such file.",
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
        'error': true,
        'title': "Client Error",
        'message': "No file specified."
      });
    }
    return;
  }

  var db = req.app.get('database'),
      m = db.multi(),
      fileName = req.body.file || null,
      filePath = __dirname + '/../files/' + fileName;
      fileHash = 'file:' + fileName;

  db.hgetall(fileHash, function(err, u) {
    if(!err && u != null) {
      if(req.session.admin || req.session.validate(u.user)) {
        // delete file
        fs.unlink(filePath, function(err) {
          var m = db.multi(),
              userHash = 'user:' + u.user;

          // delete metadata

          m.del(fileHash);
          if(isTrue(u.public)) {
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
                  'error': true,
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

router.get('/:file', function(req, res, rf) {
  var db = req.app.get('database'),
      fileName = req.params.file,
      fileHash = 'file:' + fileName;

  var filePath,
      fileExt;

  db.hgetall(fileHash, function(err, u) {
    if(!err && u != null) {
      for(k in ['title', 'description', 'user', 'time']) {
        if(_.has(u,k) == false)
          u[k] = null;
      }

      filePath = path.resolve(__dirname + '/../files/' + fileName);
      fileExt = types.fileExtension(fileName);

      u.encrypted = isTrue(u.encrypted) || false;
      u.public = isTrue(u.public) || false;

      if(u.encrypted) {
        // render encrypted views without initial content
        renderView(u, null);
      } else {
        fs.readFile(filePath, function(err, data) {
          if(!err) {
            renderView(u, data);
          }
          else {
            if(req.apiRequest) {
              res.api(true, "Cannot read file.");
            } else {
              res.render('info', {
                'error': true,
                'title': "Error",
                'message': "Cannot read file.",
                'returnPath': req.headers.referer || null
              });
            }
          }
        });
      }
    }
    else {
      if(req.apiRequest) {
        res.api(true, "No such file.");
      } else {
        res.render('info', {
          'error': true,
          'title': "Error",
          'message': "No such file.",
          'returnPath': req.headers.referer || null
        });
      }
    }
  });

  function renderView(u, content) {
    var fileType,
        subType;

    if(fileExt != null) {
      var t = types.getMimeType(fileExt);
      if(t != null) {
        fileType = t[0];
        subType = t[1];
      } else {
        fileType = null;
        subType = null;
      }
    }
    else if(u.encrypted == false && types.isBinary(content, binaryThreshold)) {
      fileType = 'application';
      subType = 'octet-stream';
    }
    else {
      fileType = null;
      subType = null;
    }

    fs.stat(filePath, function(err, stats) {
      function readableSize(size) {
        var i;
        for(i=0; i < 5 && size > 1024; ++i) {
          size /= 1024;
        }

        var units = ['B', 'KB', 'MB', 'GB', 'TB'];
        return parseFloat(size).toFixed(2) + " " + units[i];
      }

      var env = {
        'fileName': fileName,
        'title': u.title,
        'description': u.description,
        'user': u.user,
        'time': u.time,
        'encrypted': u.encrypted,
        'fileType': fileType,
        'subType': subType,
        'fileExt': fileExt,
        'fileSize': readableSize(stats['size'])
      };

      if(u.encrypted == false) {
        env.content = content.toString('utf-8');
      }

      res.setHeader('Cache-Control', "public, immutable");
      res.render('view', env);
    });
  }
});

router.get('/x/:file', function(req, res) {
  var filePath = path.resolve(__dirname + '/../files/' + req.params.file);
  fs.access(filePath, function(err) {
    if(!err) {
      res.sendFile(filePath);
    } else {
      res.status(404);
    }
  });
});

module.exports = router;
