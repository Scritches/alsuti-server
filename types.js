// file extension/mimetype helpers

mimeMap = {
  'image': {
    'gif': ['gif'],
    'jpeg': ['jpg', 'jpeg', 'jpe', 'jfif'],
    'png': ['png'],
    'svg+xml': ['svg', 'svgz'],
    'webp': ['webp'],
    'bmp': ['bmp'],
    'tiff': ['.tif', '.tiff'],
    'x-icon': ['.ico'],
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
    'ogg': ['ogv', 'ogg'],
    'webm': ['webm'],
    'h261': ['h261'],
    'h263': ['h263'],
    'h264': ['h264'],
    'mj2': ['mj2', 'mjp2'],
    'mp2t': ['ts'],
    'mp4': ['mp4', 'mp4v', 'mpg4'],
    'mpeg': ['mpeg', 'mpg', 'mpe', 'm1v', 'm2v'],
    'x-matroska': ['mkv', 'mk3d', 'mks']
  },
  'text': {
    'plain': ['txt', 'log'],
    'markdown': ['md'],
    'html': ['html', 'htm'],
    'c': ['c', 'h'],
    'cpp': ['cc', 'cpp', 'cxx', 'C', 'c++', 'hh', 'hpp', 'hxx', 'h++'],
    'sh': ['sh'],
    'javascript': ['js'],
    'python': ['py'],
    'ruby': ['rb'],
    'rust': ['rs'],
    'perl': ['pl'],
    'go': ['go'],
    'java': ['java', 'class'],
    'groovy': ['groovy']
  },
  'application': {
    'octet-stream': ['bin', 'exe', 'so', 'o', 'obj', 'a'],
    'zip': ['.zip']
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

  return null;
}

function getMimeType(ext) {
  for(var gt in mimeMap) {
    for(var ft in mimeMap[gt]) {
      if(mimeMap[gt][ft].indexOf(ext) != -1) {
        return [gt, ft];
      }
    }
  }

  return null;
}

function isImage(ext) {
  for(var ft in mimeMap['image']) {
    if(mimeMap['image'][ft].indexOf(ext) != -1)
      return true;
  }

  return false;
}

function isAudio(ext) {
  for(var ft in mimeMap['audio']) {
    if(mimeMap['audio'][ft].indexOf(ext) != -1)
      return true;
  }

  return false;
}

function isVideo(ext) {
  for(var ft in mimeMap['video']) {
    if(mimeMap['video'][ft].indexOf(ext) != -1)
      return true;
  }

  return false;
}

function isText(ext) {
  for(var ft in mimeMap['text']) {
    if(mimeMap['text'][ft].indexOf(ext) != -1)
      return true;
  }

  return false;
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
  'mimeMap': mimeMap,
  'fileExtension': fileExtension,
  'urlExtension': urlExtension,
  'getMimeType': getMimeType,
  'getExtension': getExtension,
  'isImage': isImage,
  'isAudio': isAudio,
  'isVideo': isVideo,
  'isText': isText,
  'isBinary': isBinary
}
