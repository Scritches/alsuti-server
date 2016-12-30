var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./auth'),
    sessions = require('./sessions'),
    isTrue = require('../truthiness');

var router = express.Router();

router.get('/invites', auth.required);
router.get('/invites', function(req, res) {
  var db = req.app.get('database'),
      m = db.multi(),
      invitesHash = 'user:' + req.session.user;

  m.hget(userHash, 'inviteQuota');
  m.lrange(userHash + ':invites', 0, -1);

  m.exec(function(err, data) {
    res.render('invites', {
      'session': req.session,
      'quota': data[0],
      'invites': data[1]
    });
  });
});

router.post('/invite', auth.required);
router.post('/invite', function(req, res) {
  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  db.hmget(userHash, ['admin', 'inviteQuota'], function(err, data) {
    var admin = isTrue(data[0]),
        invites = parseInt(data[1]);

    if(admin || invites > 0) {
      var m = db.multi(),
          code = shortid.generate();

      m.lpush(userHash + ':invites', code);
      m.hmset('invite:' + code, {'user': req.session.user, 'persistent': false});

      if(admin == false) {
        m.hset(userHash, 'inviteQuota', invites - 1);
      }

      m.exec(function(err, replies) {
        res.redirect('/invite');
      });
    }
  });
});

router.get('/register/:code', function(req, res) {
  if(req.session.validate()) {
    res.redirect('/');
    return;
  }

  var db = req.app.get('database'),
      m = db.multi(),
      iHash = 'invite:' + req.params.code;

  db.exists(iHash, function(err, data) {
    if(isTrue(data[0])) {
      res.render('register', {
        'inviteUser': user,
        'inviteCode': req.params.code,
      });
    }
    else {
      res.render('info', {
        'title': "Error",
        'error': true,
        'message': "Invalid invitation code."
      });
    }
  });
});

router.post('/register', function(req, res) {
  if(_.has(req.body, 'user') == false ||
     _.has(req.body, 'password') == false ||
     _.has(req.body, 'code') == false)
  {
    res.render('info', {
      'title': "Client Error",
      'message': "Invalid request."
    });
    return;
  }

  var iHash = 'invite:' + req.body.code,
      db = req.app.get('database');

  db.hgetall(iHash, function(err, i) {
    if(!err) {
      if(i != null) {
        // create password hash for account
        bcrypt.hash(req.body.password, null, null, function(err, pHash) {
          var m = db.multi();

          // delete non-persistent user invite codes only
          if(isTrue(i.persistent) == false) {
            m.del(iHash);
            m.ldel('user:' + sender + ':invites', iHash, req.body.code);
          }

          // setup user account and start session
          m.hmset('user:' + req.body.user, ['password', pHash]);
          m.exec(function(err, replies) {
            sessions.start(req, res);
          });
        });
      }
      else {
        res.render('info', {
          'title': "LOL",
          'message': "No."
        });
      }
    }
    else {
      res.render('info', {
        'title': "Database Error",
        'message': "Something went wrong."
      });
    }
  });
});

module.exports = router;
