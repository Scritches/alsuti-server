var _ = require('underscore')._,
    async = require('async'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    shortid = require('shortid'),
    requireAuth = require('./userauth');

var router = express.Router();

router.get('/', requireAuth);
router.get('/', function(req, res) {
  res.render('upload', {
    'authenticated': _.has(req, 'sessionUser')
  });
});

router.post('/upload', requireAuth);
router.post('/upload', function(req, res) {
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

  // update database

	var db = req.app.get('database'),
	    uHash = 'upload:' + slug,
	    time = Date.now(),
	    encrypted = _.has(req.body, 'encrypted') && req.body.encrypted == 'true';

  db.hmset(uHash,
    'user', req.body.user,
    'time', time,
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

  var userHash = 'user:' + req.sessionUser;
  if(_.has(req.body, 'public') && req.body.public == 'true') {
    db.lpush('public', slug);
    db.lpush(userHash + ':public', slug);
  }
  else {
    db.lpush(userHash + ':private', slug);
  }
});

router.get('/:file', function(req, res) {
  var attrs;
  async.series([
    function(done) {
      var db = req.app.get('database'),
          uHash = 'upload:' + req.params.file;

      db.hgetall(uHash, function(err, obj) {
        if(!err && obj)
          attrs = obj;
        else
          attrs= {};

        if(_.has(attrs, 'title') == false)
          attrs.title = null;
        if(_.has(attrs, 'description') == false)
          attrs.description = null;
        if(_.has(attrs, 'user') == false)
          attrs.user = null;

        if(_.has(attrs, 'time'))
          attrs.time = new Date(parseInt(attrs.time));
        else
          attrs.time = null;

        if(_.has(attrs, 'encrypted'))
          attrs.encrypted = attrs.encrypted == 'true';
        else
          attrs.encrypted = false;

        done();
      });
    }],
    function(err) {
			var filePath = __dirname + '/../files/' + req.params.file,
					ext = _.last(req.params.file.split('.')).toLowerCase();

      if(req.device.type == 'bot' || (attrs.encrypted == false &&
         _.include(['jpg', 'png', 'gif', 'jpeg'], ext)))
      {
        res.sendFile(path.resolve(filePath));
      }
      else {
        fs.readFile(filePath, 'utf-8', function(err, data) {
          if(!err) {
            res.render('view', {
              'fileName': req.params.file,
              'title': attrs.title,
              'description': attrs.description,
              'user': attrs.user,
              'time': attrs.time,
              'encrypted': attrs.encrypted,
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

router.get('/delete/:file', requireAuth);
router.get('/delete/:file', function(req, res) {

})

// handle deprecated URLs for encrypted file view
router.get('/e/:file', function(req, res) {
  res.redirect(301, '/' + req.params.file);
});

module.exports = router;
