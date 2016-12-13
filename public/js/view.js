decryptError = true;
decryptErrorColour = "#C02020"
decryptErrorTimeout = null;

function setDecryptError() {
  clearTimeout(decryptErrorTimeout);

  decryptError = true;
  decryptErrorTimeout = null;

  $('#passwordEntry').css('color', decryptErrorColour);
}

function clearDecryptError() {
  $('#passwordEntry').css('color', 'unset');
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
  else if(isImage == false) {
    renderText(null);
  }

  pEntry.keyup(function(event) {
    if(event.keyCode == 13) {
      decrypt();
    }
  });

  pEntry.on('input', function() {
    $('#decryptButton').attr('disabled', pEntry.val().length == 0);
    if(decryptError) {
      decryptError = false;
      decryptErrorTimeout = window.setTimeout(clearDecryptError, 800);
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

  saveOptions();
}

function copyToClipboard() {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($('#content').text()).select();
  document.execCommand("copy");
  $temp.remove();
}

function decrypt() {
  var password = $('#passwordEntry').val();
  if(password.length == 0) {
    return;
  }

  function tryDecrypt() {
    try {
      return CryptoJS.AES.decrypt(cipherText, password).toString(CryptoJS.enc.Utf8);
    }
    catch(err) {
      return null;
    }
  }

  var decrypted = tryDecrypt();
  if(!decrypted) {
    setDecryptError();
    return;
  }

  $('#decryption').remove();

  if(isImage) {
    renderImage(decrypted);
  } else {
    renderText(decrypted);
  }
}

function renderImage(data) {
  if(!data.match(/^YW5kcm9pZHN1Y2tz/)) {
    data = btoa(data);
  } else {
    data = data.replace(/^YW5kcm9pZHN1Y2tz/,'');
  }

  $('#downloadLink').attr('href', 'data:image/'+ fileExt +';base64,' + data);
  $('#downloadLink').show();

  $('img#content').attr('src', 'data:image/' + fileExt +';base64,' + data);
  $('#imageContainer').show();
}

function renderText(data) {
  if(data != null) {
    if(fileExt == 'txt' || fileExt == 'log') {
      $('#downloadLink').attr('href', 'data:text/plain;utf-8,' + data);
    } else {
      $('#downloadLink').attr('href', 'data:application/' + fileExt + ';binary,' + data);
    }

    $('#downloadLink').show();

    $('code#content').text(data);
    $('#textContainer').show();
  }

  $('#textTools').show();

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
