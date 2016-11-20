var express = require('express'),
    fs = require('fs'),
    shortid = require('shortid'),
    _ = require('underscore')._,
    request = require('request'),
    cj = require('node-cryptojs-aes'),
    path = require('path'),
    router = express.Router(),
    unqlite = require('unqlite');

var db = new unqlite.Database('alsuti.db');
db.open(unqlite.OPEN_CREATE, function(err) {
  if(err)
    throw err;
});

// file listings
if(_.has(process.env, 'ALSUTI_LISTINGS') && process.env.ALSUTI_LISTINGS == 'on') {
  router.get('/', function(req, res) {
    var dir = './files/';

    var uploads = fs.readdirSync(dir)
    // filter hidden files
    .filter(function(fileName) {
      return fileName.startsWith('.') == false;
    })
    // map each fileName into an upload object
    .map(function(fileName) {
      var u = {
        fileName: fileName,
        uploadTime: fs.statSync(dir + fileName).birthtime.getTime(),
        externalPath: '/' + fileName,
        title: null,
        description: null,
      };

      db.fetch(fileName + '.encrypted', function(err, key, value) {
        if(!err && value == 'true')
          u.externalPath = '/e' + u.externalPath;
      });
      db.fetch(fileName + '.title', function(err, key, value) {
        if(!err)
          u.title = value;
      });
      db.fetch(fileName + '.description', function(err, key, value) {
        if(!err)
          u.description = value;
      });

      return u;
    })
    // sort by upload time
    .sort(function(a,b) {
      return a.uploadTime - b.uploadTime;
    })
    // reverse for chronological order
    .reverse();

    var page;
    if (_.has(req.query, 'page')) {
      page = parseInt(req.query['page']);
      if(page < 1)
        page = 1;
    }
    else {
      page = 1;
    }

    var itemsPerPage;
    if(_.has(process.env, 'ALSUTI_LISTINGS_PAGE_SIZE'))
      itemsPerPage = parseInt(process.env.ALSUTI_LISTINGS_PAGE_SIZE, 10);
    else
      itemsPerPage = 20; // default to 20

    // paginate
    var start = (page - 1) * itemsPerPage,
        end = start + itemsPerPage;

    // check if last page
    var lastPage;
    if(end >= uploads.length) {
      end = uploads.length;
      lastPage = true;
    } else {
      lastPage = false;
    }

    res.render('listing', {
      'title': "File Listing",
      'currentPage': page,
      'lastPage': lastPage,
      'uploads': uploads.slice(start, end)
    });
  });
}

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
    else {
        return;
    }

    var storeError = function(err,key,value) {
        console.log("error: could not store \"" + key + "\" -> \"" + value + "\"");
    }

    db.store(newName + '.encrypted', req.body.encrypted, storeError);
    db.store(newName + '.title', req.body.title, storeError);
    db.store(newName + '.description', req.body.description, storeError);
  }
  else {
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
          'content': data.toString('utf-8'),
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
          'content': data.toString('utf-8')
        });
      } else {
        res.send('Error: File not found');
      }
    });
  }
});

module.exports = router;
