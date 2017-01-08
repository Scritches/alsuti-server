function onPaste(ev) {
  var eCheckbox = $('#encryptCheckbox');
  if(eCheckbox.prop('checked') == false) {
    return true;
  }

  var plainText = $('textarea#content').val(),
      password = $('input#password').val();

  if(plainText.length == 0 || password.length == 0) {
    ev.preventDefault();
    return false;
  }

  content.val(CryptoJS.AES.encrypt(plainText, password));
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
