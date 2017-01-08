var _ = require('underscore')._,
    fs = require('fs'),
    express = require('express'),
    path = require('path');

var auth = require('../auth'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/edit/:file', auth.require);
router.get('/edit/:file', function(req, res) {
  var db = req.app.get('database'),
           filePath = path.resolve(__dirname + '/../files/' + req.params.file),
           fileHash = 'file:' + req.params.file;

  fs.access(filePath, function(err, stats) {
    if(err) {
      res.render('info', {
        'error': true,
        'title': "Error",
        'message': "No such file.",
      });

      return;
    }

    db.hgetall(fileHash, function(err, u) {
      if(!err) {
        if(req.session.admin || req.session.validate(u.user)) {
          if(u == null) {
            u = {
              'title': null,
              'description': null,
              'public': false
            };
          }

          u.public = isTrue(u.public) || false;
          res.render('edit', {
            'fileName': req.params.file,
            'title': u.title || null,
            'description': u.description || null,
            'public': u.public,
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
        res.dbError();
      }
    });
  });
});

router.post('/edit', auth.require);
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
      filePath = path.resolve(__dirname + '/../files/' + fileName);

  fs.stat(filePath, function(err, stats) {
    if(err) {
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

      return;
    }

    var fileHash = 'file:' + fileName;
    db.hgetall(fileHash, function(err, u) {
      if(!err) {
        var returnPath = req.body.returnPath || ('/' + fileName);

        if(u == null) {
          u = {
            'title': null,
            'description': null,
            'user': null,
            'time': stats.birthtime.valueOf(),
            'public': false
          };
        }

        if(req.session.admin || req.session.validate(u.user)) {
          var m = db.multi(),
              newTitle = _.has(req.body, 'title') ? req.body.title.trim() : null,
              newDesc = _.has(req.body, 'description') ? req.body.description.trim() : null;
              nowPublic = _.has(req.body, 'public') && isTrue(req.body.public);

          if(_.has(u, 'user') == false) {
            u.user = null;
          }

          if(_.has(u, 'time') == false) {
            u.time = stats.birthtime.valueOf();
            m.hset(fileHash, 'time', u.time);
          }

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
              m.zadd('public', u.time, fileName);
              if(u.user != null) {
                m.zrem('user:' + u.user + ':private', fileName);
                m.zadd('user:' + u.user + ':public', u.time, fileName);
              }
            } else {
              m.zrem('public', fileName);
              if(u.user != null) {
                m.zrem('user:' + u.user + ':public', fileName);
                m.zadd('user:' + u.user + ':private', u.time, fileName);
              }
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
              res.dbError();
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
        res.dbError();
      }
    });
  });
});

router.get('/delete/:file', auth.require);
router.get('/delete/:file', function(req, res) {
  var db = req.app.get('database'),
      fileName = req.params.file,
      filePath = path.resolve(__dirname + '/../files/' + fileName);

  fs.access(filePath, function(err) {
    if(err) {
      res.render('info', {
        'error': true,
        'title': "Error",
        'message': "No such file.",
      });

      return;
    }

    var fileHash = 'file:' + fileName;
    db.hgetall(fileHash, function(err, u) {
      if(!err) {
        if(u == null) {
          u = {
            'title': null,
            'user': null,
            'public': false
          };
        }

        var fileURL = '/' + fileName;
        if(req.session.admin || req.session.validate(u.user)) {
          u.public = isTrue(u.public);

          var deleteReturnPath;
          if(_.has(req.headers, 'referer') && req.headers.referer.endsWith(fileURL) == false) {
            deleteReturnPath = req.headers.referer;
          } else if(u.user != null) {
            deleteReturnPath = u.public ? ('/user/' + u.user + '/public') : '/private';
          } else {
            deleteReturnPath = '/public';
          }

          res.render('delete', {
            'fileName': fileName,
            'title': u.title,
            'user': u.user,
            'public': u.public,
            'cancelReturnPath': req.headers.referer || fileURL,
            'deleteReturnPath': deleteReturnPath
          });
        }
        else {
          res.render('info', {
            'title': "Not Authorized",
            'message': "You are not allowed to delete this file.",
            'returnPath': req.headers.referer || fileURL
          });
        }
      }
      else {
        res.dbError();
      }
    });
  });
});

router.post('/delete', auth.require);
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

  var fileName = req.body.file,
      filePath = path.resolve(__dirname + '/../files/' + fileName);

  fs.access(filePath, function(err, stats) {
    if(err) {
      if(req.apiRequest) {
        res.api(true, {'message': "No such file."});
      } else {
        res.redirect(req.body.returnPath || '/');
      }

      return;
    }

    if(req.session.admin || req.session.validate(u.user)) {
      var db = req.app.get('database'),
          m = db.multi();

      // delete file
      fs.unlink(filePath, function(err) {
        if(!err) {
          if(req.apiRequest) {
            res.api(false, {'message': "File deleted."});
          } else {
            res.redirect(req.body.returnPath || '/');
          }
        }

        // delete metadata if it exists
        var fileHash = 'file:' + fileName;
        db.hgetall(fileHash, function(err, u) {
          if(!err) {
            if(u != null) {
              var m = db.multi(),
                  userHash = 'user:' + u.user;

              m.del(fileHash);
              if(isTrue(u.public)) {
                m.zrem('public', fileName);
                m.zrem(userHash + ':public', fileName);
              }
              else {
                m.zrem(userHash + ':private', fileName);
              }

              m.exec();
            }
          }
          else {
            res.dbError();
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
  });
});

module.exports = router;
