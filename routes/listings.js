var _ = require('underscore'),
    async = require('async'),
    express = require('express'),
    auth = require('./userauth'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/private', auth.required);
router.get('/private', function(req, res) {
  renderListing(req, res, 'user:' + req.sessionUser + ':private',
                "Private Uploads", false);
});

router.get('/public', function(req, res) {
  renderListing(req, res, 'public', "Public Uploads", true);
});

router.get('/user/:user', function(req, res) {
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  var db = req.app.get('database');
  db.exists('user:' + req.params.user, function(err, exists) {
    if(exists) {
      renderListing(req, res, 'user:' + req.params.user + ':public',
                    capitalize(req.params.user) + "'s Public Uploads",
                    false);
    }
    else {
      res.render('info', {
        'title': "Error",
        'message': "No such user.",
      });
    }
  });

});

// listing renderer
function renderListing(req, res, zHash, title, showUserColumn) {
  var page;
  if(_.has(req.query, 'page')) {
    page = parseInt(req.query['page']);
    if(page < 1)
      page = 1;
  }
  else {
    page = 1;
  }

  var db = req.app.get('database'),
      count = req.query.count || 15,
      start = count * (page - 1),
      end = (start + count) - 1;

  var m = db.multi();

  m.zcount(zHash, '-inf', '+inf');
  m.zrevrange(zHash, start, end);

  m.exec(function(err, replies) {
    if(!err) {
      var len = replies[0],
          fileNames = replies[1];

      async.map(fileNames,
        // transform each slug into an object
        function(fileName, done) {
          db.hgetall('file:' + fileName, function(err, s) {
            if(err || s == null) {
              console.log(fileName);
              done(err, null);
              return;
            }

            var u = {
              'fileName': fileName,
              'title': s.title || null,
              'description': s.description || null,
              'time': s.time || null,
              'user': s.user || null,
              'encrypted': isTrue(s.encrypted) || false,
              'isOwner': req.authAs(this.user),
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
              'authorized': req.auth(),
              'title': title,
              'uploads': uploads,
              'count': count,
              'page': page,
              'lastPage': end >= len,
              'showUserColumn': showUserColumn
            });
          }
        }
      );
    }
    else {
      res.render('info', {
        'title': "Database Error",
        'message': "Cannot render listing."
      });
    }
  });
}

module.exports = router;
