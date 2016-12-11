decryptError = false;
decryptErrorColour = "#FF2020"

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
  else if (isImage == false) {
    renderText(null);
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
  var code = $('code');
  if($('#lineNumbersCheckbox').prop('checked')) {
    // disable line wrapping
    code.css('white-space', 'pre');
    code.css('overflow-wrap', '');

    // add line numbers
    code.each(function(i, block) {
      hljs.lineNumbersBlock(block);
    });
  }
  else {
    // remove line numbers
    $('code.hljs-line-numbers').each(function(i, block) {
      $(block).remove();
    });
    // re-enable line wrapping
    code.css('white-space', 'pre-wrap');
    code.css('overflow-wrap', 'break-word');
  }
}

function decrypt() {
  var pEntry = $('#passwordEntry'),
      password = pEntry.val();

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
  render(decrypted);
}

function render(data) {
  if(isImage) {
    renderImage(data);
  } else {
    renderText(data);
  }
}

function renderImage(data) {
  if(!data.match(/^YW5kcm9pZHN1Y2tz/)) {
    data = btoa(data);
  } else {
    data = data.replace(/^YW5kcm9pZHN1Y2tz/,'');
  }

  var dLink = $('#downloadLink'),
      image = $('#image');

  dLink.attr('href', 'data:image/'+ fileExt +';base64,' + data);
  image.attr('src', 'data:image/' + fileExt +';base64,' + data);
  image.show();
}

function renderText(data) {
  if(data != null) {
    var content = $('#content'),
        dLink = $('#downloadLink');

    content.text(data);
    content.show();

    if(fileExt == 'txt' || fileExt == 'log') {
      dLink.attr('href', 'data:text/plain;utf-8,' + data);
    } else {
      dLink.attr('href', 'data:application/' + fileExt + ';binary,' + data);
    }

    $('#lineNumbers').show();
  }

  $('code').each(function(i, block) {
    block.className = fileExt;
    if(fileExt == 'txt' || fileExt == 'log' || fileExt == null) {
      block.className = 'hljs txt';
    } else {
      hljs.highlightBlock(block);
    }
  });

  toggleLineNumbers();
}
