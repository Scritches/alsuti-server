var express = require('express'),
    shortid = require('shortid'),
    requireAuth = require('./userauth');

var router = express.Router();

router.get('/login', function(req, res) {
  res.render('login', {
      'title': "Alsuti Login"
  });
});

router.post('/login', requireAuth);
router.post('/login', function(req, res) {
  var db = req.app.get('database');
      userHash = 'user:' + req.sessionUser,
      sessionKey = shortid.generate(),
      sessionExpiry = Date.now() + req.app.get('sessionAge');

  // store sessionKey in database
  db.hmset(userHash, ['sessionKey', sessionKey, 'sessionExpiry', sessionExpiry],
  function(err, reply) {
    if(!err) {
      var cookieOptions = {
        maxAge: req.app.get('cookieAge'),
        httpOnly: true
      };

      // set session cookies
      res.cookie('sessionUser', req.sessionUser, cookieOptions);
      res.cookie('sessionKey', sessionKey, cookieOptions);

      // redirect
      var backURL = req.headers['Referer'] || '/';
      res.redirect(backURL);
    }
    else {
      res.render('error', {
        'msg': "Database error"
      });
    }
  });
});

router.get('/logout', function(req, res) {
  var redirPath = req.cookes['Referer'] || '/';
  if(_.has(req.cookies, 'sessionUser') == false) {
    res.redirect(redirPath);
    return;
  }

  var db = req.app.get('database'),
      userHash = 'user:' + req.cookies['sessionUser'];

  db.hdel(userHash, 'sessionKey', 'sessionExpiry');
  res.redirect(redirPath);
});

router.get('/register/:code', function(req, res) {
  // TODO
  res.render('register');
});

router.post('/register/:code', function(req, res) {
  // TODO
  res.redirect('/');
});

module.exports = router;
