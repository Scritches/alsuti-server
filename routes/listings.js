var _ = require('underscore'),
    async = require('async'),
    express = require('express'),
    router = express.Router();

// private upload listing handler
router.get('/private', function(req, res) {
  var db = req.app.locals.db,
      sessionHash = 'session:' + req.cookies['session'];

  db.hget(sessionHash, 'user', function(err, sessionUser) {
    if(err) {
      res.render('error', {
        'title': "Authentication Required",
        'message': "This doesn't work because you aren't logged in.",
        'retryAuth': true
      });

      return;
    }

    var listingHash = 'user:' + sessionUser + ':private';
    renderListing(req, res, listingHash, "Private Uploads", true);
  });
});

// handler for public listings (global and user)
var publicListing = function(req, res) {
  if(_.has(req.params, 'user')) {
    listingHash = req.params.user + ':public';
    title = req.params.user.charAt(0).toUpperCase() +
            req.params.user.slice(1) + "'s Public Uploads";
    userListing = true;
  }
  else if(req.path == '/public') {
    listingHash = 'public';
    title = "Public Uploads";
    userListing = false;
  }

  renderListing(req, res, listingHash, title, userListing);
}

// main listing renderer
var renderListing = function(req, res, listingHash, title, userListing) {
  var db = req.app.locals.db;
  db.llen(listingHash, function(err, len) {
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
              'public': true
            };

            if(_.has(s, 'title'))
              u.title = null;
            if(_.has(s, 'description'))
              u.description = null;
            if(_.has(s, 'time'))
              u.time = new Date(parseInt(s.time));
            if(_.has(s, 'user'))
              u.user = s.user;
            if(_.has(s, 'encrypted'))
              u.encrypted = s.encrypted == 'true';
            if(_.has(s, 'public'))
              u.public = s.public;

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
            'showUser': userListing == false
          });
        }
      );
    });
  });
}

router.get('/public', publicListing);        // all public uploads
router.get('/:user/public', publicListing);  // user-specific public uploads

module.exports = router;
