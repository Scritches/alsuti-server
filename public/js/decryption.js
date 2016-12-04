decryptError = false;
decryptErrorColour = "#FF4040"

$(function() {
  loadOptions();

  var pEntry = $("#passwordEntry");
  pEntry.keyup(function(event) {
    if(event.keyCode == 13) {
      decrypt();
    }
    else if(decryptError) {
      window.setTimeout(function() {
        pEntry.css('color', 'unset');
        pEntry.css('font-weight', 'normal');
        decryptError = false;
      }, 750);
    }
  });

  if(encrypted) {
    if(window.location.hash) {
      decrypt(window.location.hash.substr(1));
    }
  } else {
    renderText($('#content').text());
  }
});

function saveOptions() {
  Cookies.set('lineNumbers', $('#lineNumbersCheckbox').prop('checked'),
              { expires: 365, path: '/' });
}

function loadOptions() {
  var lineNumbers = Cookies.get('lineNumbers');
  $('#lineNumbersCheckbox').prop('checked', lineNumbers == 'true');
}

function toggleLineNumbers() {
  pre = $('pre');
  if($('#lineNumbersCheckbox').prop('checked')) {
    // disable line wrapping
    pre.css('word-wrap', 'normal');
    pre.css('white-space', '');

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
    pre.css('word-wrap', 'break-word');
    for(var i=0; i < wsAttrs.length; ++i) {
      pre.css('white-space', wsAttrs[i]);
      if (pre.css('whitespace') == wsAttrs[i])
        break;
    }
  }
}

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

  toggleLineNumbers();

  var a = $('#downloadLink');
  a.attr('href', 'data:text/plain;utf-8,' + content);
  a.attr('download', fileName);
  a.show();

  $('#lineNumbersLabel').show();
}

function decrypt(hashPassword) {
  var dButton = $('#decryptButton'),
      pEntry = $('#passwordEntry'),
      content = $('#content');

  function notifyWrongPassword() {
    decryptError = true;
    dButton.text = dButtonOldText;
    pEntryOldBackground = pEntry.css('background-color');
    pEntry.css('color', decryptErrorColour);
    pEntry.css('font-weight', 'bold');
  }

  var password;
  if(hashPassword) {
    password = hashPassword;
    pEntry.val(window.location.hash.substr(1));
  }
  else {
    password = pEntry.val();
  }

  var content = cipherText || content.text(),
      splitFile = fileName.split('.'),
      ext = splitFile[splitFile.length-1].toLowerCase(),
      dButtonOldText = dButton.text();

  dButton.text = "Decrypting..";

  var plain;
  try {
    plain = CryptoJS.AES.decrypt(content, password).toString(CryptoJS.enc.Utf8);
    if(!plain) {
      notifyWrongPassword();
      return;
    }
  }
  catch(err) {
    notifyWrongPassword();
    return;
  }

  $('#decryption').hide();

  if([ 'jpg', 'png', 'gif', 'jpeg' ].indexOf(ext) !== -1) { // todo: split this out
    content.hide();

    var imageData;
    if(!plain.match(/^YW5kcm9pZHN1Y2tz/)) {
      imageData = btoa(plain);
    } else {
      imageData = plain.replace(/^YW5kcm9pZHN1Y2tz/,'');
    }

    var image = $('image'),
        dLink = $('#downloadLink');

    image.attr('src', 'data:image/' + ext +';base64,' + imageData);
    image.show();

    dLink.attr('href', 'data:image/'+ ext +';base64,' + imageData);
    dLink.attr('download', fileName);
    dLink.show()
  }
  else if(ext == 'pdf') {
    content.hide();

    var dLink = $('#downloadLink'),
        imageData = btoa(plain);

    dLink.attr('href', 'data:application/' + ext + ';base64,' + imageData);
    dLink.attr('download', fileName);
    dLink.show();
  }
  else {
    renderText(plain);
  }
}
