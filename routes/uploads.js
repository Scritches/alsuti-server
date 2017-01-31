var _ = require('underscore')._,
    async = require('async'),
    express = require('express'),
    fs = require('fs'),
    jo = require('jpeg-autorotate'),
    multer = require('multer'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid');

var auth = require('../auth'),
    config = require('../config'),
    isTrue = require('../truthiness'),
    types = require('../types');

var router = express.Router();

function finalizeUpload(fileName, req, res) {
  var time = Date.now(),
      db = req.app.get('database'),
      m = db.multi(),
      fileHash = 'file:' + fileName,
      userHash = 'user:' + req.session.user;

  var metadata = [
    'time', time,
    'user', req.session.user,
    'encrypted', _.has(req.body, 'encrypted') && isTrue(req.body.encrypted),
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

  if(_.has(req.body, 'public') && isTrue(req.body.public)) {
    metadata.push('public', true);
    m.zadd('public', time, fileName);
    m.zadd(userHash + ':public', time, fileName);
  }
  else {
    metadata.push('public', false);
    m.zadd(userHash + ':private', time, fileName);
  }

  m.hmset(fileHash, metadata);

  m.exec(function(err, replies) {
    if(!err) {
      // upload successful, return fileName
      if(req.apiRequest) {
        res.api(false, {'fileName': fileName});
      }
      else {
        res.status(302);
        res.redirect('/' + fileName);
      }
    }
    else {
      res.dbError();
    }
  });
}

function readError(req, res, returnPath) {
  if(req.apiRequest) {
    res.api(true, {'message': "Cannot read from file/URL."});
  }
  else {
    res.render('info', {
      'error': true,
      'title': "Upload Error",
      'message': "Cannot read file.",
      'returnPath': returnPath
    });
  }
}

function writeError(req, res, returnPath) {
  if(req.apiRequest) {
    res.api(true, {'message': "Cannot write file."});
  }
  else {
    res.render('info', {
      'error': true,
      'title': "Upload Error",
      'message': "Cannot write file.",
      'returnPath': returnPath
    });
  }
}

router.get('/paste', auth.require);
router.get('/paste', function(req, res) {
  res.render('paste');
});

router.post('/paste', auth.require);
router.post('/paste', function(req, res) {
  var textUploader = req.app.get('textUploader');
  textUploader(req, res, function(err) {
    if(err) {
      if(req.apiRequest) {
        res.api(true, err.message);
      }
      else {
        res.render('info', {
          'error': true,
          'title': err.title,
          'message': err.message,
          'returnPath': '/paste'
        });
      }
      return;
    }

    if(_.has(req.body, 'content') && req.body.content.length > 0) {
      var fileExt;
      if(_.has(req.body, 'extension')) {
        fileExt = req.body.extension.trim();
        if(fileExt.length == 0) {
          fileExt = null;
        }
      }

      if(fileExt != null) {
        fileName = shortid.generate() + '.' + fileExt;
      } else {
        fileName = shortid.generate();
      }

      filePath = path.resolve(__dirname + '/../files/' + fileName);
      fs.writeFile(filePath, req.body.content, function(err) {
        if(!err) {
          finalizeUpload(fileName, req, res);
        } else {
          writeError(req, res, '/paste');
        }
      });
    }
    else {
      res.status(400);
      if(req.apiRequest) {
        res.api(true, {'message': "No content."});
      }
      else {
        res.render('info', {
          'error': true,
          'title': 'Error',
          'message': "No content.",
          'returnPath': '/paste',
          'redirect': 5
        });
      }
    }
  });
});

router.get('/rehost', auth.require);
router.get('/rehost', function(req, res) {
  res.render('rehost');
});

router.post('/rehost', auth.require);
router.post('/rehost', function(req, res) {
  var textUploader = req.app.get('textUploader');
  textUploader(req, res, function(err) {
    if(err) {
      if(req.apiRequest) {
        res.api(true, err.message);
      }
      else {
        res.render('info', {
          'error': true,
          'title': err.title,
          'message': err.message,
          'returnPath': '/rehost'
        });
      }
      return;
    }

    var url = _.has(req.body, 'url') ? req.body.url.trim() : null;
    if(url != null && url.length > 0) {
      try {
        request.get(url, verify=false).on('response', function(r) {
          var mimeType = _.has(r.headers, 'content-type') ? r.headers['content-type'] : null;

          if(mimeType != null) {
            fileExt = types.getExtension(mimeType);
          }

          if(!fileExt) {
            fileExt = types.urlExtension(req.body.url);
          }

          if(fileExt != null) {
            fileName = shortid.generate() + '.' + fileExt;
          } else {
            fileName = shortid.generate();
          }

          filePath = path.resolve(__dirname + '/../files/' + fileName);
          r.pipe(fs.createWriteStream(filePath))
           .on('error', function(err) { writeError(req, res, '/rehost'); })
           .on('close', function() { finalizeUpload(fileName, req, res); })
        });
      }
      catch(e) {
        if(req.apiRequest) {
          res.api(true, {
            'message': e.name + ": " + e.message
          });
        }
        else {
          res.render('info', {
            'error': true,
            'title': 'Error',
            'message': "Invalid URL.",
            'returnPath': '/rehost',
            'redirect': 5
          });
        }
      }
    }
    else {
      res.status(400);
      if(req.apiRequest) {
        res.api(true, {'message': "No URL specified."});
      }
      else {
        res.render('info', {
          'error': true,
          'title': 'Error',
          'message': "No URL specified.",
          'returnPath': '/rehost',
          'redirect': 5
        });
      }
    }
  });
});

router.get('/upload', auth.require);
router.get('/upload', function(req, res) {
  res.render('upload');
});

router.post('/upload', auth.require);
router.post('/upload', function(req, res) {
  var fileExt,
      fileName,
      filePath;

  var fileUploader = req.app.get('fileUploader');
  fileUploader(req, res, function(err) {
    if(err) {
      if(req.apiRequest) {
        res.api(true, err.message);
      }
      else {
        res.render('info', {
          'error': true,
          'title': err.title,
          'message': err.message,
          'returnPath': '/upload'
        });
      }

      return;
    }

    if(_.has(req, 'file')) {
      fileExt = types.fileExtension(req.file.filename);
      fileName = req.file.filename;
      filePath = path.resolve(__dirname + '/../files/' + fileName);

      var encrypted = _.has(req.body, 'encrypted') && isTrue(req.body.encrypted),
          type = types.getMimeType(fileExt);

      if(encrypted == false && type != null && type[0] == 'image' && type[1] == 'jpeg') {
        fs.readFile(filePath, function(err, data) {
          if(!err) {
            jo.rotate(data, {quality: 90}, function(err, buffer, orientation) {
              fs.writeFile(filePath, err == null ? buffer : data, function(err) {
                if(!err) {
                  finalizeUpload(fileName, req, res);
                } else {
                  writeError(req, res, '/upload');
                }
              });
            });
          }
          else {
            readError(res, res, '/upload');
          }
        });
      }
      else {
        finalizeUpload(fileName, req, res);
      }
    }
    else {
      if(req.apiRequest) {
        res.api(true, {'message': "No file uploaded."});
      }
      else {
        res.render('info', {
          'error': true,
          'title': "Error",
          'message': "No file uploaded.",
          'returnPath': '/upload',
          'redirect': 4
        });
      }
    }
  });
});

module.exports = router;
