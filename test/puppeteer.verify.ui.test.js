const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const filePath = path.join(rootDir, urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.statusCode = 404; res.end('Not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.json':'application/json', '.ico':'image/x-icon' };
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
      res.end(data);
    });
  });
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = createStaticServer(root);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const url = `http://localhost:${port}/`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const results = [];
  const errors = [];

  page.on('console', msg => { try { console.log('[page.console]', msg.text()); } catch(e){} });
  page.on('pageerror', err => { console.error('[page.error]', err && err.stack ? err.stack : err); errors.push(String(err)); });
  page.on('dialog', async dialog => { console.log('[dialog]', dialog.message()); await dialog.dismiss(); });

  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // collect nav tabs
  const tabs = await page.$$eval('.nav-tabs a', els => els.map(e => ({ href: e.getAttribute('href'), text: e.innerText.trim() })));
  console.log('Found tabs:', tabs.map(t=>t.text).join(', '));

  for (const t of tabs) {
    const tabName = t.text || t.href || 'unknown';
    try {
      // click the nav link
      await page.evaluate(h => { const el = document.querySelector(`.nav-tabs a[href="${h}"]`); if (el) el.click(); }, t.href);
      await page.waitForTimeout(300);
      // find active tab content
      const activeId = await page.evaluate(() => { const at = document.querySelector('.tab-content.active'); return at ? at.id : null; });
      // list actionable buttons inside active tab
      const btns = await page.$$eval('.tab-content.active button, .tab-content.active a[role="button"]', els => els.map(b => ({ id: b.id||null, text: b.innerText.trim().slice(0,40), classes: b.className })));
      const btnResults = [];
      for (const b of btns) {
        // skip obviously destructive buttons
        const lower = (b.text||'').toLowerCase();
        if (b.classes && b.classes.includes('btn-danger')) { btnResults.push({button:b, status:'skipped-danger'}); continue; }
        if (lower.includes('eliminar') || lower.includes('borrar') || lower.includes('delete')) { btnResults.push({button:b, status:'skipped-danger'}); continue; }
        // attempt click
        try {
          await page.evaluate(txt => {
            const node = Array.from(document.querySelectorAll('.tab-content.active button, .tab-content.active a[role="button"]')).find(n => (n.innerText||'').trim().slice(0,40) === txt);
            if (node) node.click();
          }, b.text);
          await page.waitForTimeout(200);
          btnResults.push({button:b, status:'clicked'});
        } catch (e) {
          btnResults.push({button:b, status:'error', error: String(e)});
        }
      }
      results.push({ tab: tabName, activeId, buttons: btnResults });
    } catch (e) {
      results.push({ tab: tabName, error: String(e) });
    }
  }

  console.log('\nUI Verification Results:');
  results.forEach(r => {
    console.log('Tab:', r.tab, 'activeId:', r.activeId || 'n/a');
    if (r.buttons) r.buttons.forEach(b => console.log(' -', b.button.text || b.button.id || '<no-text>', b.status, b.error? b.error : ''));
    if (r.error) console.log('  Error:', r.error);
  });

  if (errors.length) {
    console.error('\nPage errors captured:');
    errors.forEach(e => console.error(' -', e));
  }

  await browser.close();
  server.close();

  // exit non-zero if any clicked produced page errors
  if (errors.length) { console.error('UI verification found page errors'); process.exit(2); }
  console.log('UI verification completed successfully');
  process.exit(0);
})().catch(err => { console.error('UI verification failed:', err); process.exit(3); });
