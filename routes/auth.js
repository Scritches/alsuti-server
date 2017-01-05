function authRequired(req, res, next) {
  if(req.session.status == 0) {
    next();
  }
  else if(req.session.status == 1) {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, {'message': "Session expired."});
    } else {
      res.render('login', {
        'error': "Session expired.",
        'returnPath': req.path
      });
    }
  }
  else if(req.session.status == 2) {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, {'message': "Invalid user/password."});
    }
    else {
      res.render('login', {
        'error': "Invalid user/password.",
        'returnPath': req.body.returnPath
      });
    }
  }
  else {
    res.status(401);
    if(req.apiRequest) {
      res.api(true, {'message': "Authentication required."});
    }
    else {
      var env = {
        'error': "Authentication required.",
        'returnPath': req.path
      };

      if(env.returnPath == '/login') {
        env.returnPath = '/private';
      } else {
        env.returnPath = req.headers.referer || '/private';
      }

      res.render('login', env);
    }
  }
}

module.exports.required = authRequired;
