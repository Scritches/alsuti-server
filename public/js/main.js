$(function() {
  $("#password").keyup(function(event){
    if(event.keyCode == 13){
      decrypt();
    }
  });

  if(encrypted) {
    $('#decryptThings').show();
  } else {
    renderText($('#content').text());
  }
});

function renderText(content) {
  var splitFile = fileName.split('.');
  var ext = splitFile[splitFile.length-1].toLowerCase();
  var a = $('#downloadButton');
  $('#content').text(content);
  $('code').each(function(i, block) { //lol
    block.className = ext;
    if(ext == 'txt') {
      var guessed = hljs.highlightAuto($('#content').html()); // this is a bit inefficient, will have to find out a way to extract the lang detection without actually doing the hilight
      console.log(guessed);
      if(guessed.r < 75) {
        block.className = 'hljs txt';
      } else {
        hljs.highlightBlock(block);
      }
    } else {
      hljs.highlightBlock(block);
    }
  });
  a.attr('href', 'data:text/plain;utf-8,'+content);
  a.show()
  a.attr('download', fileName);
}

function decrypt() {
  var password = $('#password').val();
  var content = cipherText || $('#content').text();
  var splitFile = fileName.split('.');
  var ext = splitFile[splitFile.length-1].toLowerCase();

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
