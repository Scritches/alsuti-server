var redis = require('redis'),
    fs = require('fs');

var db = redis.createClient();
db.select(1);

fs.readdir('../files', function(err, files) {
  files.forEach(function(file) {
     db.hgetall('file:' + file, function(err, u) {
       console.log(u);
       if(u != null && u.public == 'false') {
          db.zadd('user:speeddefrost:private', u.time, file);
       }
     });
  });
});

dq.quit();


