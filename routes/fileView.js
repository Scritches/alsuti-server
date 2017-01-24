var _ = require('underscore')._,
    bytes = require('bytes'),
    device = require('express-device'),
    express = require('express'),
    fs = require('fs'),
    path = require('path');

var config = require('../config'),
    isTrue = require('../truthiness'),
    types = require('../types');

var router = express.Router();

router.get('/:file', function(req, res) {
  var db = req.app.get('database'),
      fileName = req.params.file,
      filePath = path.resolve(__dirname + '/../files/' + fileName);

  fs.stat(filePath, function(err, stats) {
    if(!err) {
      var fileHash = 'file:' + fileName;
      db.hgetall(fileHash, function(err, u) {
        if(!err && u != null) {
          u.fileName = fileName;
          u.fileSize = stats.size;
          u.encrypted = isTrue(u.encrypted) || false;
          u.public = isTrue(u.public) || false;

          for(k in ['title', 'description', 'user']) {
            if(_.has(u,k) == false)
              u[k] = null;
          }

          if(_.has(u, 'time') == false) {
            u.time = stats.birthtime.valueOf();
          }
        }
        else {
          u = {
            'fileName': fileName,
            'fileSize': stats.size,
            'title': null,
            'description': null,
            'time': stats.birthtime.valueOf(),
            'user': null,
            'encrypted': false,
            'public': false
          };
        }

        var fileExt = types.fileExtension(fileName);
        if(fileExt != null) {
          var t = types.getMimeType(fileExt);
          if(t != null) {
            u.fileType = t[0];
            u.subType = t[1];
          } else {
            u.fileType = null;
            u.subType = null;
          }
        }
        else {
          u.fileType = null;
          u.subType = null;
        }

        // try not to touch this code. it's sensitive.
        u.tooLarge = u.fileSize > bytes.parse(config.size_limits.file_view);
        if(u.tooLarge == false && u.encrypted == false) {
          if(u.fileType == 'text') {
            fs.readFile(filePath, function(err, data) {
              if(!err) {
                u.text = data.toString('utf8');
                renderView(u);
              }
              else {
                res.readError();
              }
            });
          }
          // unknown extensions/types
          else if(u.fileType == null) {
            fs.readFile(filePath, function(err, data) {
              if(!err) {
                if(types.isBinary(data, binaryThreshold)) {
                  // binary
                  u.fileType = 'application';
                  u.subType = 'octet-stream';
                }
                else {
                  // text
                  u.text = data.toString('utf8');
                }

                renderView(u);
              }
              else {
                res.readError();
              }
            });
          }
          else {
            renderView(u);
          }
        }
        else {
          // yay callback hell
          renderView(u);
        }
      });
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

  function readableSize(size) {
    var i;
    for(i=0; i < 5 && size > 1024; ++i) {
      size /= 1024;
    }

    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    return parseFloat(size).toFixed(2) + " " + units[i];
  }

  function renderView(u) {
    u.fileSize = readableSize(u.fileSize);
    if(u.fileType != null) {
      u.mimeType = u.fileType + '/' + u.subType;
    } else {
      u.mimeType = null;
    }

    res.setHeader('Cache-Control', "public, immutable");
    res.render('view', u);
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
