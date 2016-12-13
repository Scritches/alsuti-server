(function (w) {
	'use strict';

	if(typeof w.hljs === 'undefined') {
		console.error('highlight.js not detected!');
	} else {
		w.hljs.initLineNumbersOnLoad = initLineNumbersOnLoad;
		w.hljs.lineNumbersBlock = lineNumbersBlock;
	}

	function initLineNumbersOnLoad() {
		if(document.readyState === 'complete') {
			documentReady();
		} else {
			w.addEventListener('DOMContentLoaded', documentReady);
		}
	}

	function documentReady () {
		try {
			var blocks = document.querySelectorAll('code.hljs');
			for(var i in blocks) {
				if(blocks.hasOwnProperty(i)) {
					lineNumbersBlock(blocks[i]);
				}
			}
		}
		catch(e) {
			console.error('LineNumbers error: ', e);
		}
	}

	function lineNumbersBlock(element) {
		if(typeof element !== 'object')
		  return;

		var parent = element.parentNode,
		    lines = getCountLines(parent.textContent);

		var l = '';
		for(var i=0; i < lines; ++i) {
			l += (i+1) + '\n';
		}

		var lp = document.createElement('code');
		lp.className = 'hljs hljs-line-numbers';
		lp.style.float = 'left';
    lp.style.textAlign = 'right';
		lp.style.userSelect = 'none';
		lp.style.whiteSpace = 'pre';
	  lp.textContent = l;

		parent.insertBefore(lp, element);
	}

	function getCountLines(text) {
		if(text.length === 0)
		  return 0;

		var regExp = /\r\n|\r|\n/g;
		var lines = text.match(regExp);
		lines = lines ? lines.length : 0;
		if(!text[text.length - 1].match(regExp)) {
			lines += 1;
		}

		return lines;
	}
}(window));
