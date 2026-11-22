const { chromium } = require('playwright'); const { setupRoutes } = require('./harness');
const path = require('path');
const dir = '/home/user/automatic-eureka/docs/maquettes';
const pages = (process.argv[2] || 'index,app-recherche,app-pipeline').split(',');
const accents = (process.argv[3] || 'orange,bleu').split(',');
const full = process.argv[4] === 'full';
const vps = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
(async () => {
  const b = await chromium.launch(); let errs = 0;
  for (const pg of pages) for (const ac of accents) for (const [vn, vp] of Object.entries(vps)) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); await setupRoutes(p);
    const msgs = [];
    p.on('console', m => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', e => msgs.push('pageerror: ' + e.message));
    p.on('requestfailed', r => msgs.push('requestfailed: ' + r.url()));
    await p.goto('file://' + path.join(dir, pg + '.html') + '?accent=' + ac);
    await p.waitForTimeout(pg === 'index' ? 8000 : 4000);
    const out = path.join(dir, 'captures', `${pg}-${ac}-${vn}${full ? '-pleine-page' : ''}.png`);
    await p.screenshot({ path: out, fullPage: full });
    console.log(path.basename(out), msgs.length ? msgs : 'OK'); errs += msgs.length;
    await ctx.close();
  }
  await b.close(); process.exit(errs ? 1 : 0);
})();
