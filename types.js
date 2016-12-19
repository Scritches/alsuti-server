// file extension/mimetype helpers

mimeMap = {
  'image': {
    'gif': ['gif'],
    'jpeg': ['jpg', 'jpeg', 'jpe'],
    'png': ['png'],
    'svg+xml': ['svg', 'svgz'],
    'webp': ['webp']
  },
  'audio': {
    'wav': ['wav'],
    'wave': ['wav'],
    'mpeg': ['mpga', 'mp2a', 'mp3', 'm2a', 'm3a'],
    'mp4': ['m4a', 'mp4a'],
    'mp3': ['mp3'],
    'ogg': ['oga'],
    'webm': ['weba'],
    'x-aac': ['aac']
  },
  'video': {
    'ogg': ['ogv'],
    'webm': ['webm'],
    'h261': ['h261'],
    'h263': ['h263'],
    'h264': ['h264'],
    'mj2': ['mj2', 'mjp2'],
    'mp2t': ['ts'],
    'mp4': ['mp4', 'mp4v', 'mpg4'],
    'mpeg': ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
    'x-matroska': ['mkv', 'mk3d', 'mks']
  }
};

function fileExtension(str) {
  var em = str.match(/(?:\.)([a-z0-9]{1,5})$/i);
  return em != null ? em[1] : null;
}

function urlExtension(url) {
  var em = url.match(/(?:\.)([a-z0-9]{1,5})(?:\?\S+)?$/i);
  return em != null && em.length == 2 ? em[1] : null;
}

function getExtension(mimeType) {
  var cmp = mimeType.split(';')[0].split('/'),
      gt = cmp[0],
      ft = cmp[1];
  if(gt in mimeMap && ft in mimeMap[gt]) {
    return mimeMap[gt][ft][0];
  }
}

function getMimeType(ext) {
  for(var gt in mimeMap) {
    for(var ft in mimeMap[gt]) {
      if(mimeMap[gt][ft].indexOf(ext) != -1) {
        return gt + '/' + ft;
      }
    }
  }

  return null;
}

function isImage(ext) {
  return ['bmp', 'gif', 'jpg', 'jpeg',
          'jpe', 'png', 'svg', 'svgz',
          'webp'].indexOf(ext) != -1;
}

function isAudio(ext) {
  return ['oga',  'spx',  'mp3',  'm4a',
          'mp4a', 'mpga', 'mp2',  'mp2a',
          'm2a',  'm3a',  'weba', 'aac',
          'aif',  'aiff', 'aifc', 'wav',
          'flac', 'mka',  'm3u',  'wax',
          'wma',  'pya',  'ra',   'xm'].indexOf(ext) != -1;
}

function isVideo(ext) {
  return ['h261', 'h263', 'h264', 'mp4',
          'mp4v', 'mpg4', 'mpeg', 'mpg',
          'mpe',  'm1v',  'm2v',  'qt',
          'mov',  'webm', 'm4v',  'mkv',
          'mk3d', 'mks',  'vob',  'wmv',
          'avi'].indexOf(ext) != -1;
}

// binary hueristics

binaryThreshold = 15;

function isBinary(data, threshold) {
  var nSusp = 0,
      nMax = Math.min(2048, data.length);

  for(var i=0; i < nMax; ++i) {
    var c = data[i];
    if(c == 0) {
      console.log('isBinary(): null byte found; definitely binary');
      return true;
    }
    else if((c <= 31 && c != 10 && c != 13) || c == 127) {
      ++nSusp;
    }
  }

  var percSusp = (nSusp / nMax) * 100,
      result = percSusp >= threshold;

  console.log("isBinary(): " + percSusp + "% suspicious; " + (result ? "likely binary" : "plain text"));
  return result;
}

module.exports = {
  'fileExtension': fileExtension,
  'urlExtension': urlExtension,
  'getMimeType': getMimeType,
  'getExtension': getExtension,
  'isImage': isImage,
  'isAudio': isAudio,
  'isVideo': isVideo,
  'isBinary': isBinary
}
