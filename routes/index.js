var _ = require('underscore')._,
    async = require('async'),
    cj = require('node-cryptojs-aes'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid');

var router = express.Router();

// file listings
if(_.has(process.env, 'ALSUTI_LISTING')) {
  itemsPerPage = parseInt(process.env.ALSUTI_LISTING, 10);
  if(itemsPerPage <= 0) {
    itemsPerPage = 20; // default to 20
  }

  router.get('/', function(req, res) {
    var dir = './files/',
        uploads = fs.readdirSync(dir);

    // filter hidden
    uploads = uploads.filter(function(fileName) {
      return fileName.startsWith('.') == false;
    })
    // map into upload object
    .map(function(fileName) {
        return {
          fileName: fileName,
          externalPath: null,
          uploadTime: fs.statSync(dir + fileName).birthtime.getTime(),
          title: null,
          description: null
        };
    })
    // sort by upload time
    .sort(function(a,b) {
      return a.uploadTime - b.uploadTime;
    })
    // reverse for chronological order
    .reverse();

    // set externalPath/title/description for each upload
    var db = req.app.get('db');
    async.forEachSeries(uploads, function(u,done) {
      db.fetch(u.fileName + '.encrypted', function(err, key, value) {
        u.externalPath = (!err && value == 'true' ? '/e/' : '/') + u.fileName;
        db.fetch(u.fileName + '.title', function(err, key, value) {
          u.title = !err ? value : null;
          db.fetch(u.fileName + '.description', function(err, key, value) {
            u.description = !err ? value : null;
            done(); // suck my dick, async
          });
        });
      });
    }, function(err) {
      var page;
      if(_.has(req.query, 'page')) {
        page = parseInt(req.query['page']);
        if(page < 1)
          page = 1;
      }
      else {
        page = 1;
      }

      var start = (page - 1) * itemsPerPage,
          end = start + itemsPerPage,
          lastPage = end >= uploads.length;

      res.render('listing', {
        'title': "File Listing",
        'page': page,
        'lastPage': lastPage,
        'uploads': uploads.slice(start, end)
      });
    });
  });
}

router.post('/upload', function(req, res) {
  var api_key = req.app.get('api_key');
  if(req.body.api_key != api_key) {
    res.status(401);
    res.send('Error: Incorrect API key');
    return;
  }

  var external_path = req.app.get('external_path');
  res.setHeader('Content-Type', 'application/text');
  console.log(req.body);

  var localPath,
      slug;

  if(_.has(req.files, 'fileupload')) {
    localPath = __dirname + '/../files/';
    slug = shortid.generate() + '.' + _.last(req.files.fileupload.originalname.split('.'));

    fs.readFile(req.files.fileupload.path, function(err, data) {
      fs.writeFile(localPath + slug, data, function(err) {
        if(_.has(req.body, 'encrypted') && req.body.encrypted) {
          res.send(external_path + '/e/' + slug);
        } else {
          res.send(external_path + '/' + slug); 
        }
      });
    });
  }
  else if(_.has(req.body, 'uri')) {
    localPath = __dirname + '/../files/';
    slug = shortid.generate() + '.' + _.last(req.body.uri.split('.')).replace(/\?.*$/,'').replace(/:.*$/,'');

    request.get(req.body.uri).pipe(fs.createWriteStream(localPath + slug))
      .on('close', function() {
        if(_.has(req.body, 'encrypted') && req.body.encrypted) {
          res.send(external_path + '/e/' + slug); 
        } else {
          res.send(external_path + '/' + slug); 
        }
      });
  }
  else if(_.has(req.body, 'content')) {
    localPath = __dirname + '/../files/';
    slug = shortid.generate() + '.' + req.body.extension;

    fs.writeFile(localPath + slug, req.body.content, function(err) {
      if(_.has(req.body, 'encrypted') && req.body.encrypted) {
        res.send(external_path + '/e/' + slug); 
      } else {
        res.send(external_path + '/' + slug); 
      }
    });
  }
  else {
    res.status(400);
    res.send("Error: no data");
    return;
  }

  var onStore = function(err, key, val) {
    if(err) {
      console.log("[unqlite] " + "store error: " + key + " -> " + val);
    } else {
      console.log("[unqlite] " + key + " -> " + val);
    }
  }

  var k;
  var db = req.app.get('db');

  async.series([
    function(done) {
      if(_.has(req.body, 'encrypted') && req.body.encrypted) {
        db.store(slug + '.encrypted', 'true', function(err, key, val) {
          onStore(err, key, val);
          done();
        });
      } else {
        done();
      }
    },
    function(done) {
      if(_.has(req.body, 'title') && req.body.title.length > 0) {
        db.store(slug + '.title', req.body.title, function(err, key, val) {
          onStore(err, key, val);
          done();
        });
      } else {
        done();
      }
    },
    function(done) {
      if(_.has(req.body, 'description') && req.body.description.length > 0) {
        db.store(slug + '.description', req.body.description, function(err, key, val) {
          onStore(err, key, val);
        });
      } else {
        done();
      }
    }],
    function(err) {
    }
  );
});

router.get('/e/:file', function(req, res) {
  var filePath = __dirname + '/../files/' + req.params.file;

  if(req.device.type == 'bot') {
    res.sendFile(path.resolve(filePath));
  } else {
    fs.readFile(filePath, 'utf-8', function(err, data) {
      if(!err && data) {
        var title,
            description;

        async.series([
          function(done) {
            var db = req.app.get('db');
            db.fetch(req.params.file + '.title', function(err, key, value) {
              title = !err ? value : null;
              db.fetch(req.params.file + '.description', function(err, key, value) {
                description = !err ? value : null;
                done();
              });
            });
          }
        ], function(err) {
          res.render('view', {
            'fileName': req.params.file,
            'content': data.toString('utf-8'),
            'encrypted': true,
            'title': title,
            'description': description
          });
        });
      }
      else {
        res.send('Error: File not found');
      }
    });
  }
});

router.get('/:file', function(req, res) {
  var filePath = __dirname + '/../files/' + req.params.file,
      ext = _.last(req.params.file.split('.')).toLowerCase();

  if(req.device.type == 'bot' || _.include([ 'jpg', 'png', 'gif', 'jpeg' ], ext)) {
    res.sendFile(path.resolve(filePath)); 
  } else {
    fs.readFile(filePath, 'utf-8', function(err, data) {
      if(!err && data) {
        var title,
            description;

        async.series([
          function(done) {
            var db = req.app.get('db');
            db.fetch(req.params.file + '.title', function(err, key, value) {
              title = !err ? value : null;
              db.fetch(req.params.file + '.description', function(err, key, value) {
                description = !err ? value : null;
                done();
              });
            });
          }
        ], function(err) {
          res.render('view', {
            'fileName': req.params.file,
            'content': data.toString('utf-8'),
            'title': title,
            'description': description
          });
        });
      } else {
        res.send('Error: File not found');
      }
    });
  }
});

module.exports = router;
