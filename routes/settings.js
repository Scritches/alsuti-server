var _ = require('underscore'),
    bcrypt = require('bcrypt-nodejs'),
    express = require('express'),
    shortid = require('shortid');

var auth = require('../auth.js'),
    config = require('../config.js'),
    isTrue = require('../truthiness.js');

var router = express.Router();

router.get('/settings', auth.require);
router.get('/settings', function(req, res) {
  var db = req.app.get('database'),
      m = db.multi(),
      userHash = 'user:' + req.session.user;

  m.hget(userHash, 'inviteQuota');
  m.lrange(userHash + ':invites', 0, -1);

  m.exec(function(err, data) {
    var fileUploader = req.app.get('fileUploader');

    var env = {
      'inviteQuota': parseInt(data[0]),
      'inviteCodes': data[1]
    };

    if(req.apiRequest) {
      res.api(false, env);
    }
    else {
      if(_.has(req.query, 'state')) {
        env.state = parseInt(req.query.state);
      }

      res.render('settings', env);
    }
  });
});

router.post('/admin/globals/set', auth.require);
router.post('/admin/globals/set', function(req, res) {
  if(req.session.admin == false) {
    if(req.apiRequest) {
      res.apiMessage(true, "You can't do that.");
    }
    else {
      res.render('info', {
        'error': true,
        'title': "You can't do that.",
        'message': "Nice try, though.",
        'returnPath': '/public',
        'redirect': 5
      });
    }

    return;
  }

  var pasteSizeLimit = null,
      fileSizeLimit = null;

  if(_.has(req.body, 'pasteSizeLimit')) {
    pasteSizeLimit = req.body.pasteSizeLimit;
  }
  if(_.has(req.body, 'fileSizeLimit')) {
    fileSizeLimit = req.body.fileSizeLimit;
  }

  config.setUploadLimits(req.app, pasteSizeLimit, fileSizeLimit);

  if(req.apiRequest) {
    res.apiMessage(false, "Settings saved.");
  } else {
    res.redirect('/settings?state=3');
  }
});

router.post('/password/set', auth.require);
router.post('/password/set', function(req, res) {
  if(_.has(req.body, 'password') == false) {
    if(req.apiRequest) {
      res.apiMessage(true, "Invalid request.");
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
                res.apiMessage(false, "Password changed.");
              }
              else {
                res.render('info', {
                  'title': "Password changed.",
                  'message': "You will be redirected shortly.",
                  'returnPath': '/settings',
                  'redirect': 5
                });
              }
            });
          });
        }
        else {
          if(req.apiRequest) {
            res.apiMessage(true, "Confirmation password does not match.");
          } else {
            res.redirect('/settings?state=2');
          }
        }
      }
      else {
        if(req.apiRequest) {
          res.apiMessage(true, "Incorrect password.");
        } else {
          res.redirect('/settings?state=1');
        }
      }
    });
  });
});

router.post('/invite/new', auth.require);
router.post('/invite/new', function(req, res) {
  var db = req.app.get('database'),
      userHash = 'user:' + req.session.user;

  db.hmget(userHash, ['admin', 'inviteQuota'], function(err, data) {
    var admin = isTrue(data[0]);

    var inviteQuota;
    if(data[1] != null) {
      inviteQuota = parseInt(data[1]);
    } else {
      inviteQuota = config.default_invite_quota;
    }

    if(admin || inviteQuota > 0) {
      var m = db.multi(),
          code = shortid.generate(),
          iHash = 'invite:' + code;

      m.lpush(userHash + ':invites', code);
      m.hmset(iHash, ['sender', req.session.user]);

      if(admin == false) {
        m.hset(userHash, 'inviteQuota', inviteQuota - 1);
      }

      m.exec(function(err, replies) {
        if(req.apiRequest) {
          res.api(false, {
            'inviteCode': code,
            'inviteQuota': inviteQuota
          });
        }
        else {
          res.redirect(req.headers.referer || '/settings');
        }
      });
    }
  });
});

router.get('/invite/delete/:code', auth.require);
router.get('/invite/delete/:code', function(req, res) {
  var db = req.app.get('database'),
      iHash = 'invite:' + req.params.code;

  db.hget(iHash, 'sender', function(err, sender) {
    if(!err && sender == req.session.user) {
      var senderHash = 'user:' + sender;
      db.hgetall(senderHash, function(err, sender) {
        var m = db.multi();

        m.del(iHash);
        m.lrem(senderHash + ':invites', 1, req.params.code);
        if(isTrue(sender.admin) == false) {
          m.hset(senderHash, 'inviteQuota', parseInt(sender.inviteQuota) + 1);
        }

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
        res.apiMessage(true, "Invalid request.");
      } else {
        res.render('info', {
          'error': true,
          'title': "Error",
          'message': "Invalid request."
        });
      }
    }
  });
});

module.exports = router;
