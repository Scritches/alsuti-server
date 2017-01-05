function onPaste(ev) {
  var eCheckbox = $('#encryptCheckbox');
  if(eCheckbox.prop('checked') == false) {
    return true;
  }

  var password = $('input#password').val();
  if(password.length == 0) {
    ev.preventDefault();
    return false;
  }

  var content = $('textarea#content'),
      plainText = content.val(),
      cipherText = CryptoJS.AES.encrypt(plainText, password);

  content.val(cipherText);
  return true;
}

function togglePasswordEntry() {
  var pEntry = $('input#password');
  if($('#encryptCheckbox').prop('checked')) {
    pEntry.attr('disabled', false);
    pEntry.focus();
  } else {
    pEntry.attr('disabled', true);
  }
}
