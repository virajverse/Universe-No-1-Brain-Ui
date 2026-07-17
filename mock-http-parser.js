try {
  process.binding('http_parser');
} catch (e) {
  try {
    const httpParserJs = require('http-parser-js');
    const originalBinding = process.binding;
    process.binding = function(name) {
      if (name === 'http_parser') {
        return { HTTPParser: httpParserJs.HTTPParser };
      }
      return originalBinding.apply(this, arguments);
    };
    console.log('[http-parser-js-mock] Successfully mocked process.binding("http_parser")');
  } catch (err) {
    console.error('[http-parser-js-mock] Failed to load http-parser-js. Make sure to run "npm install http-parser-js".');
  }
}
