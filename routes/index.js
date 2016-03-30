var express = require('express'),
    fs = require('fs'),
    shortid = require('shortid'),
    _ = require('underscore')._,
    request = require('request'),
    cj = require('node-cryptojs-aes'),
    path = require('path'),
    router = express.Router();

/* GET home page. */
router.post('/upload', function(req, res) {
  res.setHeader('Content-Type', 'application/text');
  console.log(req.body);

  if(req.body.api_key == req.api_key) {
    if(_.has(req.files, 'fileupload')) {
      fs.readFile(req.files.fileupload.path, function(err, data) {
        var newName = shortid.generate() + '.' + _.last(req.files.fileupload.originalname.split('.'))
            newPath = __dirname + '/../files/';

        fs.writeFile(newPath + newName, data, function(err) {
          if(req.body.encrypted) {
            res.send(req.external_path + '/e/' + newName); 
          } else {
            res.send(req.external_path + '/' + newName); 
          }
        });
      });
    } else if(_.has(req.body, 'uri')) {
      var newName = shortid.generate() + '.' + _.last(req.body.uri.split('.')).replace(/\?.*$/,'').replace(/:.*$/,'')
          newPath = __dirname + '/../files/';

      request.get(req.body.uri).pipe(fs.createWriteStream(newPath + newName))
        .on('close', function() {
          if(req.body.encrypted) {
            res.send(req.external_path + '/e/' + newName); 
          } else {
            res.send(req.external_path + '/' + newName); 
          }
        });
    } else if(_.has(req.body, 'content')) {
      var newName = shortid.generate() + '.' + req.body.extension,
          newPath = __dirname + '/../files/';

      fs.writeFile(newPath + newName, req.body.content, function(err) {
        if(req.body.encrypted) {
          res.send(req.external_path + '/e/' + newName); 
        } else {
          res.send(req.external_path + '/' + newName); 
        }
      });
    }
  } else {
    res.send('Error: Incorrect API key');
  }
});

router.get('/e/:file', function(req, res) {
  var filePath = __dirname + '/../files/' + req.params.file;

  if(req.device.type == 'bot') {
    res.sendFile(path.resolve(filePath));
  } else {
    fs.readFile(filePath, 'utf-8', function(err, data) {
      if (!err && data) {
        res.render('view', { 
          'fileName': req.params.file,
          'content': data.toString('utf-8').trim(),
          'encrypted': true
        });
      } else {
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
        res.render('view', {
          'fileName': req.params.file,
          'content': data.toString('utf-8').trim()
        });
      } else {
        res.send('Error: File not found');
      }
    });
  }
});

module.exports = router;
