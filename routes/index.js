var _ = require('underscore')._,
    async = require('async'),
    cj = require('node-cryptojs-aes'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid');

var router = express.Router();

if(_.has(process.env, 'ALSUTI_LISTINGS')) {
  var listingsPerPage = parseInt(process.env.ALSUTI_LISTINGS, 10);
  if(listingsPerPage <= 0) {
    listingsPerPage = 25; // default to 25
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
        // TODO: stop using mtime and store this info into database via /upload
        uploadTime: fs.statSync(dir + fileName).mtime.getTime(),
        encrypted: false,
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

    var db = req.app.locals.db;
    async.forEachSeries(uploads, function(u,done) {
      // get metadata for each upload
      db.hget(u.fileName, 'encrypted', function(err, reply) {
        u.encrypted = !err && reply == 'true';
        db.hget(u.fileName, 'title', function(err, reply) {
          u.title = !err ? reply : null;
          db.hget(u.fileName, 'description', function(err, reply) {
            u.description = !err ? reply : null;
            done();
          });
        });
      });
    },
    function(err) {
      var page;
      if(_.has(req.query, 'page')) {
        page = parseInt(req.query['page']);
        if(page < 1)
          page = 1;
      }
      else {
        page = 1;
      }

      // paginate and render

      var start = (page - 1) * listingsPerPage,
          end = start + listingsPerPage,
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

  var localPath,
      slug;

  res.setHeader('Content-Type', 'application/text');
  if(_.has(req.files, 'fileupload')) {
    localPath = __dirname + '/../files/';
    slug = shortid.generate() + '.' + _.last(req.files.fileupload.originalname.split('.'));
    fs.readFile(req.files.fileupload.path, function(err, data) {
      fs.writeFile(localPath + slug, data, function(err) {
        res.send(external_path + '/' + slug); 
      });
    });
  }
  else if(_.has(req.body, 'uri')) {
    localPath = __dirname + '/../files/';
    slug = shortid.generate() + '.' + _.last(req.body.uri.split('.')).replace(/\?.*$/,'').replace(/:.*$/,'');
    request.get(req.body.uri).pipe(fs.createWriteStream(localPath + slug))
      .on('close', function() {
        res.send(external_path + '/' + slug); 
      });
  }
  else if(_.has(req.body, 'content')) {
    localPath = __dirname + '/../files/';
    slug = shortid.generate() + '.' + req.body.extension;
    fs.writeFile(localPath + slug, req.body.content, function(err) {
      res.send(external_path + '/' +  slug); 
    });
  }
  else {
    res.status(400);
    res.send("Error: no data");
    return;
  }

  var handleReply = function(err, reply) {
    if(err)
      console.log("Redis Error: " + err);
  }

  var db = req.app.locals.db;
  db.hset(slug, 'encrypted', req.body.encrypted);
  db.hset(slug, 'title', req.body.title);
  db.hset(slug, 'description', req.body.description);
});

router.get('/:file', function(req, res) {
  var db = req.app.locals.db,
      filePath = __dirname + '/../files/' + req.params.file,
      ext = _.last(req.params.file.split('.')).toLowerCase();

  var encrypted,
      title,
      description;

  async.series([
    function(done) {
      db.hget(req.params.file, 'encrypted', function(err, reply) {
        encrypted = (!err && reply == 'true') ? true : false;
        done();
      });
    },
    function(done) {
      db.hget(req.params.file, 'title', function(err, reply) {
        title = !err ? reply : null;
        done();
      });
    },
    function(done) {
      db.hget(req.params.file, 'description', function(err, reply) {
        description = !err ? reply : null;
        done();
      });
    }],
    function(err) {
      if(req.device.type == 'bot' || (encrypted == false && _.include(['jpg', 'png', 'gif', 'jpeg'], ext))) {
        res.sendFile(path.resolve(filePath));
      } else {
        fs.readFile(filePath, 'utf-8', function(err, data) {
          if(!err) {
            res.render('view', {
              'fileName': req.params.file,
              'content': data.toString('utf-8'),
              'encrypted': encrypted,
              'title': title,
              'description': description
            });
          }
          else {
            res.send('Error: File not found');
          }
        });
      }
    }
  );
});

// redirect deprecated urls for backwards compatibility
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
