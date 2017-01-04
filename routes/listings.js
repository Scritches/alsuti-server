var _ = require('underscore'),
    async = require('async'),
    express = require('express'),
    auth = require('./auth'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/private', auth.required);
router.get('/private', function(req, res) {
  renderListing(req, res, 'user:' + req.session.user + ':private',
                'Private', 'private');
});

router.get('/public', function(req, res) {
  renderListing(req, res, 'public', 'Public', 'public');
});

router.get('/user/:user', function(req, res) {
  var db = req.app.get('database');
  db.exists('user:' + req.params.user, function(err, exists) {
    if(exists) {
      renderListing(req, res, 'user:' + req.params.user + ':public',
                    req.params.user, 'userPublic');
    }
    else {
      if(req.apiRequest) {
        res.api(true, {'message': "No such user."});
      }
      else {
        res.render('info', {
          'title': "Error",
          'message': "No such user.",
        });
      }
    }
  });
});

function renderListing(req, res, zHash, title, listingType) {
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
      count = _.has(req.query, 'count') ? Math.min(parseInt(req.query.count), 50) : 15;

  var m = db.multi(),
      start = count * (page - 1),
      end = (start + count) - 1;

  m.zcount(zHash, '-inf', '+inf');
  m.zrevrange(zHash, start, end);

  m.exec(function(err, replies) {
    if(!err) {
      var nTotal = parseInt(replies[0]),
          fileNames = replies[1];

      async.map(fileNames,
        // transform each slug into an object
        function(fileName, done) {
          db.hgetall('file:' + fileName, function(err, s) {
            if(err || s == null) {
              console.log("no metadata found for " + fileName);
              done(err, {'fileName': fileName});
              return;
            }

            var u = {
              'fileName': fileName,
              'title': s.title || null,
              'description': s.description || null,
              'time': s.time || null,
              'user': s.user || null,
              'encrypted': _.has(s, 'encrypted') && isTrue(s.encrypted)
            };

            done(err, u);
          });
        },
        // render when all slugs are transformed
        function(err, uploads) {
          if(req.apiRequest) {
            res.api(false, {
              'uploads': uploads,
              'start': start,
              'end': Math.min(end, nTotal),
              'nTotal': nTotal,
              'page': page,
              'lastPage': end >= (nTotal - 1)
            });
          } else {
            res.render('listing', {
              'session': req.session,
              'title': title,
              'uploads': uploads,
              'start': start + 1,
              'end': Math.min(end + 1, nTotal),
              'nTotal': nTotal,
              'count': count,
              'page': page,
              'lastPage': end >= (nTotal - 1),
              'listingType': listingType
            });
          }
        }
      );
    }
    else {
      if(req.apiRequest) {
        res.api(true, {'message': "Database error."});
      } else {
        res.render('info', {
          'title': "Database Error",
          'message': "Cannot render listing."
        });
      }
    }
  });
}

module.exports = router;
