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

  console.log('Starting local deep verifier at', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  const shotsDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });

  page.on('console', msg => { try { console.log('[page.console]', msg.text()); } catch(e){} });
  page.on('pageerror', err => { console.error('[page.error]', err && err.stack ? err.stack : err); errors.push(String(err)); });
  page.on('dialog', async dialog => { console.log('[dialog]', dialog.message()); await dialog.dismiss(); });

  await page.goto(url, { waitUntil: 'networkidle2' });

  const tabs = await page.$$eval('.nav-tabs a', els => els.map(e => ({ href: e.getAttribute('href'), text: e.innerText.trim() })));
  console.log('Found tabs:', tabs.map(t => t.text).join(', '));

  for (const t of tabs) {
    const safeName = (t.text||'tab').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    console.log('\n-- Processing tab:', t.text);
    try {
      await page.evaluate(h => { const el = document.querySelector(`.nav-tabs a[href="${h}"]`); if (el) el.click(); }, t.href);
      await page.waitForTimeout(500);

      // take screenshot of the active area
      const activeHandle = await page.$('.tab-content.active');
      if (activeHandle) {
        const shotPath = path.join(shotsDir, `${safeName}.png`);
        await activeHandle.screenshot({ path: shotPath });
        console.log('Saved screenshot:', shotPath);
      } else {
        const fullPath = path.join(shotsDir, `${safeName}_full.png`);
        await page.screenshot({ path: fullPath, fullPage: true });
        console.log('Saved full-page screenshot (no active area):', fullPath);
      }

      // try clicking first non-danger button and fill simple inputs if present
      const buttons = await page.$$('.tab-content.active button, .tab-content.active a[role="button"]');
      let clicked = 0;
      for (const b of buttons) {
        const cls = await (await b.getProperty('className')).jsonValue();
        const text = (await (await b.getProperty('innerText')).jsonValue() || '').trim().toLowerCase();
        if (cls && cls.includes('btn-danger')) continue;
        if (text.includes('eliminar') || text.includes('borrar') || text.includes('delete')) continue;
        try {
          await b.click({ delay: 50 });
          await page.waitForTimeout(300);
          clicked++;
          // after click, attempt to fill first input inside active content if any
          const input = await page.$('.tab-content.active input[type="number"], .tab-content.active input[type="text"], .tab-content.active textarea, .tab-content.active select');
          if (input) {
            try {
              await input.focus();
              await page.keyboard.type('1');
              await page.waitForTimeout(200);
            } catch(e) { /* ignore */ }
          }
          break; // only one click per tab to avoid destructive flows
        } catch (e) {
          console.warn('Click error in tab', t.text, String(e));
        }
      }
      console.log('Buttons clicked in tab:', clicked);
    } catch (e) {
      console.error('Error processing tab', t.text, String(e));
    }
  }

  if (errors.length) {
    console.error('\nPage errors captured during deep checks:');
    errors.forEach(e => console.error(' -', e));
  }

  await browser.close();
  server.close();

  if (errors.length) { console.error('Deep local UI verification found page errors'); process.exit(2); }
  console.log('\nDeep local UI verification completed successfully');
  process.exit(0);
})();
