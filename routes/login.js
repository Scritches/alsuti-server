var express = require('express'),
    auth = require('../auth.js'),
    router = express.Router();

router.get('/login', function(req, res) {
  var returnPath = req.headers.referer || '/private';
  if(req.session.validate()) {
    res.redirect(returnPath);
  } else {
    res.render('login', {
      'title': "Log In",
      'returnPath': returnPath
    });
  }
});

router.post('/login', auth.require);
router.post('/login', auth.startSession);

router.get('/logout', function(req, res) {
  var returnPath = req.headers.referer || '/public';

  if(req.session.validate() == false) {
    res.redirect(returnPath);
    return;
  }

  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  var cookieOptions = {
    'expires': new Date(0), // makes the cookies expire immediately
    'httpOnly': true
  }

  res.cookie('sessionUser', '', cookieOptions);
  res.cookie('sessionKey', '', cookieOptions);

  db.hdel(userHash, ['sessionKey', 'sessionExpiry'], function(err, reply) {
    res.redirect(returnPath);
  });
});

module.exports = router;
