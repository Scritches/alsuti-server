var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    shortid = require('shortid'),
    auth = require('./auth.js'),
    isTrue = require('../truthiness.js');

var router = express.Router();

router.get('/settings', auth.required);
router.get('/settings', function(req, res) {
  var db = req.app.get('database'),
      m = db.multi(),
      userHash = 'user:' + req.session.user;

  m.hget(userHash, 'inviteQuota');
  m.lrange(userHash + ':invites', 0, -1);

  m.exec(function(err, data) {
    var env = {
      'quota': parseInt(data[0]),
      'invites': data[1]
    };

    if(_.has(req.query, 'state')) {
      env.state = parseInt(req.query.state);
    }

    res.render('settings', env);
  });
});

router.post('/password/set', auth.required);
router.post('/password/set', function(req, res) {
  if(_.has(req.body, 'password') == false) {
    if(req.apiRequest) {
      res.api(true, {'message': "Invalid request."});
    }
    else {
      res.render('info', {
        'error': true,
        'title': "Client Error",
        'message': "Invalid request."
      });
    }
  }

  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  db.hget(userHash, 'password', function(err, pHash) {
    bcrypt.compare(req.body.password, pHash, function(err, result) {
      if(result) {
        if(req.body.newPassword == req.body.confirmNewPassword) {
          bcrypt.hash(req.body.newPassword, null, null, function(err, pHash) {
            db.hset(userHash, 'password', pHash, function(err) {
              if(req.apiRequest) {
                res.api(false, {'message': "Password changed."});
              }
              else {
                res.redirect('/settings?state=3');
              }
            });
          });
        }
        else {
          if(req.apiRequest) {
            res.api(true, {'message': "Confirmation password does not match."});
          }
          res.redirect('/settings?state=2');
        }
      }
      else {
        res.redirect('/settings?state=1');
      }
    });
  });
});

router.post('/invites/new', auth.required);
router.post('/invites/new', function(req, res) {
  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  db.hmget(userHash, ['admin', 'inviteQuota'], function(err, data) {
    var admin = isTrue(data[0]),
        invites = parseInt(data[1]);

    if(admin || invites > 0) {
      var m = db.multi(),
          code = shortid.generate(),
          iHash = 'invite:' + code;

      m.lpush(userHash + ':invites', code);
      m.hmset(iHash, ['sender', req.session.user]);

      if(admin == false) {
        m.hset(userHash, 'inviteQuota', invites - 1);
      }

      m.exec(function(err, replies) {
        if(req.apiRequest) {
          res.json(false, {'code': code});
        } else {
          res.redirect('/settings');
        }
      });
    }
  });
});

router.get('/invites/delete/:code', auth.required);
router.get('/invites/delete/:code', function(req, res) {
  var db = req.app.get('database'),
      iHash = 'invite:' + req.params.code;

  db.hget(iHash, 'sender', function(err, sender) {
    if(!err) {
      if(sender == req.session.user) {
        var senderHash = 'user:' + sender;
        db.hmget(senderHash, 'inviteQuota', function(err, quota) {
          var m = db.multi();

          if(!err) {
            m.hset(senderHash, 'inviteQuota', parseInt(quota) + 1);
          } else {
            m.hset(senderHash, 'inviteQuota', 20);
          }

          m.lrem(senderHash + ':invites', 1, req.params.code);
          m.del(iHash);

          m.exec(function(err, replies) {
            if(req.apiRequest) {
              res.json(false, {
                'message': "Invite code deleted."
              });
            }
            else {
              res.redirect('/settings');
            }
          });
        });
      }
      else {
        if(req.apiRequest) {
          res.json(true, {
            'message': "No."
          });
        }
        else {
          res.render('info', {
            'title': "LOL",
            'message': "No."
          });
        }
      }
    }
    else {
      // no such invite
      if(req.apiRequest) {
        res.json(true, {'message':"Invalid invite code."});
      } else {
        res.render('info', {
          'error': true,
          'title': "Error",
          'message': "Invalid invite code."
        });
      }
    }
  });
});

module.exports = router;
