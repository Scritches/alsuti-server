var _ = require('underscore'),
    async = require('async'),
    express = require('express'),
    requireAuth = require('./userauth'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/private', requireAuth);
router.get('/private', function(req, res) {
  renderListing(req, res, false,
                'user:' + req.sessionUser + ':private',
                "Private Uploads");
});

router.get('/public', function(req, res) {
  renderListing(req, res, false, 'public', "Public Uploads");
});

router.get('/user/:user/public', function(req, res) {
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  renderListing(req, res, true,
                'user:' + req.params.user + ':public',
                capitalize(req.params.user) + "'s Public Uploads");
});

// listing renderer
function renderListing(req, res, publicUserListing, listingHash, title) {
  var db = req.app.get('database');
  db.llen(listingHash, function(err, len) {
    if(publicUserListing && err) {
      res.render('info', {
        'title': "Error",
        'message': "No such user.",
      });
      return;
    }

    var page;
    if(_.has(req.query, 'page')) {
      page = parseInt(req.query['page']);
      if(page < 1)
        page = 1;
    }
    else {
      page = 1;
    }

    var listingsPerPage = parseInt(process.env.ALSUTI_LISTINGS) || 25,
        start = (page - 1) * listingsPerPage,
        end = start + listingsPerPage - 1;

    db.lrange(listingHash, start, end, function(err, fileNames) {
      async.map(fileNames,
        // transform each slug into an object
        function(fileName, done) {
          db.hgetall('upload:' + fileName, function(err, s) {
            var u = {
              'fileName': fileName,
              'title': s.title || null,
              'description': s.description || null,
              'time': s.time || null,
              'user': s.user || null,
              'encrypted': isTrue(s.encrypted) || false,
            };

            done(err, u);
          });
        },
        // render when all slugs are transformed
        function(err, uploads) {
          if(req.apiRequest) {
            res.json(uploads);
            res.setHeader('Content-Type', 'application/json');
          }
          else {
            res.render('listing', {
              'title': title,
              'uploads': uploads,
              'page': page,
              'lastPage': end >= len,
              'showUser': publicUserListing == false
            });
          }
        }
      );
    });
  });
}

module.exports = router;
