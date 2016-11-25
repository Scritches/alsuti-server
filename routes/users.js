var bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    router = express.Router();

router.get('/register/:code', function(req, res) {
});

router.post('/register/:code', function(req, res) {
});

router.get('/login', function(req, res) {
  res.render('login');
});

router.post('/login', function(req, res) {
  var db = req.app.locals.db,
      userHash = 'user:' + req.body.user;

  db.hget(userHash, 'password', function(err, pHash) {
    if(err || pHash == null) {
      res.render('login', { 'error': "No such user." });
      return;
    }

    bcrypt.compare(req.body.password, function(err, result) {
      if(err || result) {
        res.render('error', {
          'title': "Error",
          'message': "Authentication failed.",
          'retryAuth': true
        });

        return;
      }

      var backURL=req.header('Referer') || '/public' + req.body.user;
      res.redirect(backURL);
    });
  });
});

module.exports = router;
