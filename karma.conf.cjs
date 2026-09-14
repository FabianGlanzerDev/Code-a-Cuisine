const fs = require('node:fs');
const path = require('node:path');
const publicRoot = path.resolve(__dirname, 'public');

/**
 * Serves original project assets, including filenames containing URL-encoded spaces.
 * @param serveFile Karma asset response helper.
 */
function projectAssets(serveFile) {
  return serveProjectAsset.bind(null, serveFile);
}



/**
 * Sends an original asset as binary data without Karma's text-only cache.
 * @param serveFile Karma asset response helper.
 * @param request Incoming local asset request.
 * @param response Outgoing asset response.
 * @param next Next middleware when the URL is not a project asset.
 */
function serveProjectAsset(serveFile, request, response, next) {
  let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (/^\/base\/media\/(Ubuntu-[\w-]+|(?:Quicksand|Mulish)-VariableFont_wght)\.ttf$/.test(pathname)) {
    const font = path.basename(pathname);
    pathname = '/fonts/' + (font.split('-')[0] + '/') + font;
  }
  if (!/^\/(img|fonts|animations)\//.test(pathname)) return next();
  const filename = path.resolve(publicRoot, '.' + pathname);
  if (!filename.startsWith(publicRoot + path.sep) || !fs.existsSync(filename)) return next();
  return serveFile(filename, undefined, response, undefined, undefined, true);
}



projectAssets.$inject = ['serveFile'];

/**
 * Configures local headless tests without changing the application or contacting its APIs.
 * @param config Configuration for this operation.
 */
function configureKarma(config) {
  config.set({ frameworks: ['jasmine'], reporters: ['dots'], browsers: ['ChromeHeadless'],
    plugins: ['karma-*', { 'middleware:project-assets': ['factory', projectAssets] }],
    beforeMiddleware: ['project-assets'] });
}



module.exports = configureKarma;
