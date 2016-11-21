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
      $('#decryption').show();
    }
  } else {
    renderText($('#content').text());
  }

  loadOptions();
  toggleLineNumbers();
});

function renderText(content) {
  var splitFile = fileName.split('.'),
      ext = splitFile[splitFile.length-1].toLowerCase();

  $('#content').text(content);
  $('code').each(function(i, block) {
    block.className = ext;
    if(ext == 'txt' || ext == 'log') {
      block.className = 'hljs txt';
    } else {
      hljs.highlightBlock(block);
    }
  });

  var a = $('#downloadLink');
  a.attr('href', 'data:text/plain;utf-8,'+content);
  a.attr('download', fileName);
  a.show();

  $('#lineNumbersLabel').show();
}

function toggleLineNumbers() {
  if($('#lineNumbersCheckbox').prop('checked')) {
    // disable line wrapping
    $('pre').css('word-wrap', 'normal');
    $('pre').css('white-space', '');

    // add line numbers
    $('code').each(function(i, block) {
      hljs.lineNumbersBlock(block);
    });
  }
  else {
    // remove line numbers
    $('code.hljs-line-numbers').remove();

    // re-enable line wrapping
    wsAttrs = [ 'pre-wrap', '-moz-pre-wrap', '-pre-wrap', '-o-pre-wrap' ];
    $('pre').css('word-wrap', 'break-word');
    for(var i=0; i < wsAttrs.length; ++i) {
      $('pre').css('white-space', wsAttrs[i]);
      if ($('pre').css('whitespace') == wsAttrs[i])
        break;
    }
  }
}

function saveOptions() {
  Cookies.set('lineNumbers', $('#lineNumbersCheckbox').prop('checked'),
              { expires: 365, path: '/' });
}

function loadOptions() {
  var lineNumbers = Cookies.get('lineNumbers');
  $('#lineNumbersCheckbox').prop('checked', lineNumbers == 'true');
}

function decrypt(pass) {
  $('#decryptionStatus').text = 'Decrypting..';
  $('#decryptionStatus').show();

  var password = $('#password').val(),
      content = cipherText || $('#content').text(),
      splitFile = fileName.split('.'),
      ext = splitFile[splitFile.length-1].toLowerCase();

  if(pass) {
    password = pass;
  }

  var plain = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);

  $('#decryptionStatus').hide();

  if([ 'jpg', 'png', 'gif', 'jpeg' ].indexOf(ext) !== -1) { // todo: split this out
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
    a.attr('download', fileName);
    a.show()
  }
  else if(ext == 'pdf') {
    var a = $('#downloadButton');
    var image = btoa(plain)

    $('#content').hide();

    a.attr('href', 'data:application/'+ ext +';base64,' + image);
    a.attr('download', fileName);
    a.show();
  }
  else {
    renderText(plain);
  }

  $('#decryption').hide();
}
