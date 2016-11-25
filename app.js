var _ = require('underscore')._,
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    device = require('express-device'),
    express = require('express'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    logger = require('morgan'),
    multer = require('multer'),
    path = require('path'),
    process = require('process'),
    sys = require('sys');

if(!_.has(process.env, 'ALSUTI_INSTANCE')) {
  console.log('You must set the ALSUTI_INSTANCE environment variable');
  process.exit(1);
}

var app = express();

// make api key and endpoint accessible from handlers
app.set('external_path', process.env.ALSUTI_ENDPOINT);

// view engine setup
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
try {
  fs.accessSync(faviconPath, fs.F_OK);
  app.use(favicon(faviconPath));
}
catch(e) {
  console.log("Note: no favicon found");
}

//app.use(logger('dev'));
app.use(device.capture({'parseUserAgent': true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false, limit: '500mb' }));
app.use(multer());
//app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// set up primary routes
app.use('/', require('./routes/listings.js'));
//app.use('/', require('./routes/users.js'));
app.use('/', require('./routes/files.js'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler; prints stacktrace
if(app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler; no stacktraces
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
