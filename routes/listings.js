var _ = require('underscore'),
    async = require('async'),
    express = require('express'),
    requireAuth = require('./userauth');

var router = express.Router();

// listing renderer
function renderListing(req, res, listingHash, title, publicUserListing) {
  var db = req.app.get('database');
  db.llen(listingHash, function(err, len) {
    if(publicUserListing && err) {
      res.render('error', {
        'title': "Error",
        'message': "No such user."
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

    db.lrange(listingHash, start, end, function(err, slugs) {
      async.map(slugs,
        // transform each slug into an object
        function(slug, done) {
          db.hgetall('upload:' + slug, function(err, s) {
            var u = {
              'fileName': slug,
              'title': null,
              'description': null,
              'time': null,
              'user': null,
              'encrypted': false,
            };

            if(_.has(s, 'title'))
              u.title = s.title;
            if(_.has(s, 'description'))
              u.description = s.description;
            if(_.has(s, 'time'))
              u.time = new Date(parseInt(s.time));
            if(_.has(s, 'user'))
              u.user = s.user;
            if(_.has(s, 'encrypted'))
              u.encrypted = s.encrypted == 'true';

            done(err, u);
          });
        },
        // render when all slugs are transformed
        function(err, uploads) {
          res.render('listing', {
            'title': title,
            'uploads': uploads,
            'page': page,
            'lastPage': end >= len,
            'showUser': publicUserListing == false
          });
        }
      );
    });
  });
}

// private listings
router.get('/private', requireAuth);
router.get('/private', function(req, res) {
  renderListing(req, res,
                'user:' + req.sessionUser + ':private',
                "Private Uploads", false);
});

// public listings
router.get('/public', function(req, res) {
  renderListing(req, res, 'public', "Public Uploads", false);
});
router.get('/user/:user/public', function(req, res) {
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  renderListing(req, res,
               'user:' + req.params.user + ':public',
               capitalize(req.params.user) + "'s Public Uploads",
               true);
});

module.exports = router;
