const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const umd = fs.readFileSync(path.join(__dirname, 'motion-umd.js'), 'utf8');
const names = ['animate','stagger','inView','hover','press','scroll','spring','delay'];
const esm = umd + '\n' + names.map(n => `export const ${n} = globalThis.Motion.${n};`).join('\n');
const cache = {};
async function setupRoutes(page) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/motion/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: esm, headers: {'access-control-allow-origin':'*'} }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => {
    const url = r.request().url();
    if (!cache[url]) cache[url] = execFileSync('curl', ['-s', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36', url], { maxBuffer: 1e8 });
    const ct = url.includes('gstatic') ? 'font/woff2' : 'text/css';
    return r.fulfill({ status: 200, contentType: ct, body: cache[url], headers: {'access-control-allow-origin':'*'} });
  });
}
module.exports = { setupRoutes };
