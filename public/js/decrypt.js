$(function() {
  $("#password").keyup(function(event){
    if(event.keyCode == 13){
      decrypt();
    }
  });
});

function decrypt() {
  var password = $('#password').val();
  var content = cipherText || $('#content').text();
  var splitFile = fileName.split('.');
  var ext = splitFile[splitFile.length-1];

  var plain = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);

  $('#message').hide();

  var a = $('#downloadButton');

  if([ 'jpg', 'png', 'gif', 'jpeg' ].indexOf(ext) !== -1) {
    var image = btoa(plain);
    $('#image').attr('src', 'data:image/'+ ext +';base64,' + image);
    $('#image').show();
    $('#content').hide()

    a.attr('href', 'data:image/'+ ext +';base64,'+image);
  } else {
    $('#content').html(htmlEntities(plain));
    $('code').each(function(i, block) { //lol
      block.className = ext;
      if(ext == 'txt') {
        var guessed = hljs.highlightAuto($('#content').html()); // this is a bit inefficient, will have to find out a way to extract the lang detection without actually doing the hilight
        if(guessed.r < 75) {
          block.className = 'hljs txt';
        } else {
          hljs.highlightBlock(block);
        }
      } else {
        hljs.highlightBlock(block);
      }
    });
    a.attr('href', 'data:text/plain;utf-8,'+plain);
  }

  a.show()
  a.attr('download', fileName);
  $('#decryptThings').hide();
}

// https://css-tricks.com/snippets/javascript/htmlentities-for-javascript/
function htmlEntities(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
