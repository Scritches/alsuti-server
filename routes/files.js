var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid');

var router = express.Router();

// file upload
router.post('/upload', function(req, res) {
  if(_.has(req.body, 'user') == false ||
		 _.has(req.body, 'password') == false)
	{
    res.status(401);
    res.send("Error: Authentication Required");
		return;
  }

  var db = req.app.locals.db,
      userHash = 'user:' + req.body.user;

  db.hget(userHash, 'password', function(err, pHash) {
    bcrypt.compare(req.body.password, pHash, function(err, result) {
      if(err || result == false) {
        res.status(401);
        res.send("Error: authentication failed");
        return;
      }

      // receive file and write to disk
      var external_path = req.app.get('external_path');
      var localPath,
          slug;

      res.setHeader('Content-Type', 'application/text');
      if(_.has(req.files, 'fileupload')) {
        localPath = __dirname + '/../files/';
        slug = shortid.generate() + '.' +
							 _.last(req.files.fileupload.originalname.split('.'));

        fs.readFile(req.files.fileupload.path, function(err, data) {
          fs.writeFile(localPath + slug, data, function(err) {
            res.send(external_path + '/' + slug); 
          });
        });
      }
      else if(_.has(req.body, 'uri')) {
        localPath = __dirname + '/../files/';
        slug = shortid.generate() + '.' + 
							 _.last(req.body.uri.split('.')).replace(/\?.*$/,'').replace(/:.*$/,'');

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

			var encrypted = _.has(req.body, 'encrypted') && req.body.encrypted,
					_public = _.has(req.body, 'public') && req.body.public == 'true';

      // push to slug lists

      if(_public) {
        db.lpush('public', slug);
        db.lpush(userHash + ':public', slug);
      } else {
        db.lpush(userHash + ':private', slug);
      }

      // set upload:<slug> fields

      var uHash = 'upload:' + slug;

      db.hmset(uHash,
        'user', req.body.user,
        'time', (new Date()).getTime(),
        'encrypted', encrypted
      );

      if(_.has(req.body, 'title')) {
        req.body.title = req.body.title.trim();
        if(req.body.title.length > 0)
          db.hset(uHash, 'title', req.body.title);
      }
      if(_.has(req.body, 'description')) {
        req.body.description = req.body.description.trim();
        if(req.body.description.length > 0)
          db.hset(uHash, 'description', req.body.description);
      }
    });
  });
});

// file view
router.get('/:file', function(req, res) {
  var title,
      description,
      time,
      user,
      encrypted,
      _public;

  var db = req.app.locals.db,
      uHash = 'upload:' + req.params.file;

  async.series([
    function(done) {
      db.hget(uHash, 'title', function(err, reply) {
        title = !err ? reply : null;
        done();
      });
    },
    function(done) {
      db.hget(uHash, 'description', function(err, reply) {
        description = !err ? reply : null;
        done();
      });
    },
    function(done) {
      db.hget(uHash, 'time', function(err, reply) {
        time = !err ? Date(parseInt(reply)) : null;
        done();
      });
    },
    function(done) {
      db.hget(uHash, 'user', function(err, reply) {
        user = !err ? reply : null;
        done();
      });
    },
    function(done) {
      db.hget(uHash, 'encrypted', function(err, reply) {
        encrypted = (!err && reply == 'true') ? true : false;
        done();
      });
    },
    function(done) {
      db.hget(uHash, 'public', function(err, reply) {
        _public = (!err && reply == 'true') ? true : false;
        done();
      });
    }],
    function(err) {
			var filePath = __dirname + '/../files/' + req.params.file,
					ext = _.last(req.params.file.split('.')).toLowerCase();

      if(req.device.type == 'bot' ||
         (encrypted == false && _.include(['jpg', 'png', 'gif', 'jpeg'], ext)))
      {
        res.sendFile(path.resolve(filePath));
      }
      else {
        fs.readFile(filePath, 'utf-8', function(err, data) {
          if(!err) {
            res.render('view', {
              'fileName': req.params.file,
              'title': title,
              'description': description,
              'time': time,
              'user': user,
              'encrypted': encrypted,
              'public': _public,
              'content': data.toString('utf-8')
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

// handle deprecated URLs for encrypted file views
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
