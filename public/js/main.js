$(function() {
  $("#password").keyup(function(event){
    if(event.keyCode == 13){
      decrypt();
    }
  });

  if(encrypted) {
    if(window.location.hash) {
      decrypt(window.location.hash.substr(1));
    } else {
      $('#decryptThings').show();
    }
  } else {
    renderText($('#content').text());
  }
});

function renderText(content) {
  var splitFile = fileName.split('.'),
      ext = splitFile[splitFile.length-1].toLowerCase(),
      a = $('#downloadButton');

  $('#content').text(content);
  $('code').each(function(i, block) { //lol
    block.className = ext;
    if(ext == 'txt' || ext == 'log') {
      block.className = 'hljs txt';
    } else {
      hljs.highlightBlock(block);
    }
  });
  a.attr('href', 'data:text/plain;utf-8,'+content);
  a.show()
  a.attr('download', fileName);
}

function decrypt(pass) {
  var password = $('#password').val(),
      content = cipherText || $('#content').text(),
      splitFile = fileName.split('.'),
      ext = splitFile[splitFile.length-1].toLowerCase();

  if(pass) {
    password = pass;
  }

  var plain = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);

  $('#message').hide();

  if([ 'jpg', 'png', 'gif', 'jpeg' ].indexOf(ext) !== -1) { //todo: split this out
    var a = $('#downloadButton');
    var image;
    if(!plain.match(/^YW5kcm9pZHN1Y2tz/)) {
      image = btoa(plain);
    } else {
      image = plain.replace(/^YW5kcm9pZHN1Y2tz/,'');
    }
    $('#image').attr('src', 'data:image/'+ ext +';base64,' + image);
    $('#image').show();
    $('#content').hide();
    a.attr('href', 'data:image/'+ ext +';base64,' + image);
    a.show()
    a.attr('download', fileName);
  } else if(ext == 'pdf') {
    var a = $('#downloadButton');
    var image = btoa(plain)

    $('#content').hide();

    a.attr('href', 'data:application/'+ ext +';base64,' + image);
    a.show()
    a.attr('download', fileName);
  } else {
    renderText(plain);
  }

  $('#decryptThings').hide();
}

// https://css-tricks.com/snippets/javascript/htmlentities-for-javascript/
function htmlEntities(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
