const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = new URL(process.argv[2] || 'https://fabian-glanzer.developerakademie.net/code-a-cuisine/');
const routes = [...fs.readFileSync('src/app/app.routes.ts', 'utf8').matchAll(/path: '([^']*)'/g)]
  .map(/** Uses a harmless missing ID to verify server routing only. @param match Route declaration. */ match => match[1].replace(':id', 'deployment-route-check'))
  .filter(/** Excludes the Angular wildcard. @param route Route path. */ route => route !== '**');

/** Reads one public resource without calling n8n or changing production state.
 * @param route Path relative to the deployed base URL.
 */
async function read(route) {
  const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(20000) });
  const body = Buffer.from(await response.arrayBuffer());
  return { route, status: response.status, server: response.headers.get('server'), type: response.headers.get('content-type'), body };
}



/** Verifies the static entry document and assets; hash routing itself requires a browser. */
async function checkRoutes() {
  const result = await read('');
  const valid = result.status === 200 && result.body.toString().includes('<base href="/code-a-cuisine/">');
  console.log(JSON.stringify({ route: '', status: result.status, server: result.server, valid }));
  if (!valid) process.exitCode = 1;
  console.log(JSON.stringify({ browserCheckRequired: routes.map(/** Lists browser-only fragment destinations. */ route => new URL('#/' + route, base).href), note: 'HTTP does not send URL fragments; these routes require real browser navigation and reload tests.' }));
  for (const route of ['media/deployment-missing.ttf', 'img/deployment-missing.svg', 'deployment-missing.js']) {
    const result = await read(route);
    console.log(JSON.stringify({ route, status: result.status, missingAsset: true }));
    if (result.status !== 404 || result.body.toString().includes('<app-root')) process.exitCode = 1;
  }
  return result.body.toString();
}



/** Verifies emitted scripts/styles and referenced font binaries resolve below the deployed base.
 * @param html Deployed index document.
 */
async function checkAssets(html) {
  const paths = [...html.matchAll(/(?:src|href)="([^"<>]+\.(?:css|js))"/g)].map(/** Extracts asset URLs. @param match HTML attribute. */ match => match[1]);
  const assets = await Promise.all(paths.map(read));
  for (const asset of assets) assert(asset.status === 200 && !asset.body.toString().trimStart().startsWith('<'), 'Invalid build asset: ' + asset.route);
  const css = assets.filter(/** Finds stylesheets. @param asset Downloaded asset. */ asset => asset.route.endsWith('.css'));
  for (const style of css) for (const match of style.body.toString().matchAll(/url\(["']?([^"')]+\.ttf)["']?\)/g)) {
    const font = await read(new URL(match[1], new URL(style.route, base)));
    const valid = font.status === 200 && font.body.length > 4 && font.body.readUInt32BE(0) === 65536;
    console.log(JSON.stringify({ font: String(font.route), status: font.status, validFont: valid }));
    if (!valid) process.exitCode = 1;
  }
}



checkRoutes().then(checkAssets).catch(/** Reports a failed read without dumping response headers. @param error Failure. */ error => { console.error(error.message); process.exitCode = 1; });
