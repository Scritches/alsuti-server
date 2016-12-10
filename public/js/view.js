decryptError = false;
decryptErrorColour = "#FF2020"

function fileExtension(fileName) {
  return fileName.match(/\.[a-z0-9]+$/i)[0].substr(1) || null;
}

function isImage(ext) {
  return ['gif', 'jpg', 'jpeg',
          'png', 'svg', 'bmp', 'ico'].indexOf(ext) != -1;
}

$(function() {
  var pEntry = $('#passwordEntry'),
      dButton = $('#decryptButton');

  loadOptions();

  if(encrypted) {
    pEntry.focus();
    if(window.location.hash) {
      pEntry.val(window.location.hash.substr(1));
      decrypt();
    }
  }
  else {
    renderText(null, fileExtension(fileName));
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13 && decryptError == false && pEntry.val().length > 0) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    if(decryptError) {
      window.setTimeout(function() {
        decryptError = false;
        pEntry.css('color', 'unset');
        pEntry.css('font-weight', 'normal');
        dButton.attr('disabled', false);
      }, 750);
    }
  });
});

function saveOptions() {
  Cookies.set('lineNumbers', $('#lineNumbersCheckbox').prop('checked') ? 'on' : 'off',
              { expires: 365, path: '/' });
}

function loadOptions() {
  var lineNumbersState = Cookies.get('lineNumbers') == 'on';
  $('#lineNumbersCheckbox').prop('checked', lineNumbersState);
}

function toggleLineNumbers() {
  pre = $('pre');
  if($('#lineNumbersCheckbox').prop('checked')) {
    // disable line wrapping
    pre.css('white-space', 'pre');
    // add line numbers
    $('code').each(function(i, block) {
      hljs.lineNumbersBlock(block);
    });
  }
  else {
    // remove line numbers
    $('code.hljs-line-numbers').each(function(i, block) {
      $(block).remove();
    });
    // re-enable line wrapping
    pre.css('white-space', 'pre-wrap');
  }
}

function decrypt() {
  var pEntry = $('#passwordEntry'),
      password = pEntry.val(),
      ext = fileExtension(fileName);

  function tryDecrypt() {
    try {
      return CryptoJS.AES.decrypt(cipherText, password).toString(CryptoJS.enc.Utf8);
    } catch(err) {
      return null;
    }
  }

  var decrypted = tryDecrypt();
  if(decrypted == null) {
    decryptError = true;
    pEntry.css('color', decryptErrorColour)
    pEntry.css('font-weight', 'bold');
    $('#decryptButton').attr('disabled', true);
    return;
  }

  $('#decryption').remove();

  if(isImage(ext)) {
    renderImage(decrypted, ext);
  } else {
    renderText(decrypted, ext);
  }
}

function renderImage(data, ext) {
  if(!data.match(/^YW5kcm9pZHN1Y2tz/)) {
    data = btoa(data);
  } else {
    data = data.replace(/^YW5kcm9pZHN1Y2tz/,'');
  }

  var dLink = $('#downloadLink'),
      image = $('#image');

  image.attr('src', 'data:image/' + ext +';base64,' + data);
  image.show();

  dLink.attr('href', 'data:image/'+ ext +';base64,' + data);
  dLink.show();
}

function renderText(decryptedText, ext) {
  if(decryptedText != null) {
    var content = $('#content');
    content.text(decryptedText);
    content.show();

    var dLink = $('#downloadLink');
    dLink.attr('href', 'data:text/plain;utf-8,' + content.text());

    $('#lineNumbers').show();
  }

  $('code').each(function(i, block) {
    block.className = ext;
    if(ext == 'txt' || ext == 'log') {
      block.className = 'hljs txt';
    } else {
      hljs.highlightBlock(block);
    }
  });

  toggleLineNumbers();
}
