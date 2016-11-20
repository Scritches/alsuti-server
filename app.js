var _ = require('underscore')._,
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    express = require('express'),
    favicon = require('serve-favicon'),
    fs = require('fs'),
    device = require('express-device'),
    logger = require('morgan'),
    multer = require('multer'),
    path = require('path'),
    process = require('process'),
    sys = require('sys');

if(!_.has(process.env, 'ALSUTI_API_KEY')) {
  console.log('You must set the ALSUTI_API_KEY environment variable');
  process.exit(1);
}
if(!_.has(process.env, 'ALSUTI_ENDPOINT')) {
  console.log('You must set the ALSUTI_ENDPOINT environment variable');
  process.exit(1);
}

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// use favicon if it exists
var faviconPath = __dirname + '/public/favicon.ico';
fs.access(faviconPath, fs.F_OK, function(err) {
  if(!err) {
    app.use(favicon(faviconPath));
  }
});

// make api key and endpoint accessible from handlers
app.set('api_key', process.env.ALSUTI_API_KEY);
app.set('external_path', process.env.ALSUTI_ENDPOINT);

// required for listing template
app.locals.moment = require('moment');

app.use(logger('dev'));
app.use(device.capture({'parseUserAgent':true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false, limit: '500mb' }));
app.use(multer());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// set up primary routes
app.use('/', require('./routes/index'));

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
