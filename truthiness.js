function isTrue(value){
  if(typeof(value) == 'string'){
    value = value.toLowerCase();
  }
  switch(value) {
    case true:
    case 1:
    case 'true':
    case '1':
    case 'yes':
    case 'on':
        return true;
    default: 
        return false;
  }
}

module.exports = isTrue;
