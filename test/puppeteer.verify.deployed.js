const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://salazaroliveros-prog.github.io/billar2/';
  console.log('Opening deployed URL:', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];

  page.on('console', msg => { try { console.log('[page.console]', msg.text()); } catch(e){} });
  page.on('pageerror', err => { console.error('[page.error]', err && err.stack ? err.stack : err); errors.push(String(err)); });
  page.on('dialog', async dialog => { console.log('[dialog]', dialog.message()); await dialog.dismiss(); });

  await page.goto(url, { waitUntil: 'networkidle2' });

  const tabs = await page.$$eval('.nav-tabs a', els => els.map(e => ({ href: e.getAttribute('href'), text: e.innerText.trim() })));
  console.log('Found tabs:', tabs.map(t => t.text).join(', '));

  const results = [];
  for (const t of tabs) {
    const tabName = t.text || t.href || 'unknown';
    try {
      await page.evaluate(h => { const el = document.querySelector(`.nav-tabs a[href="${h}"]`); if (el) el.click(); }, t.href);
      await page.waitForTimeout(400);
      const activeId = await page.evaluate(() => { const at = document.querySelector('.tab-content.active'); return at ? at.id : null; });
      const btns = await page.$$eval('.tab-content.active button, .tab-content.active a[role="button"]', els => els.map(b => ({ id: b.id||null, text: b.innerText.trim().slice(0,40), classes: b.className })));
      results.push({ tab: tabName, activeId, buttons: btns.length });
    } catch (e) {
      results.push({ tab: tabName, error: String(e) });
    }
  }

  console.log('\nDeployed UI Verification Results:');
  results.forEach(r => {
    console.log('Tab:', r.tab, 'activeId:', r.activeId || 'n/a', 'buttonsFound:', r.buttons || 0);
    if (r.error) console.log('  Error:', r.error);
  });

  if (errors.length) {
    console.error('\nPage errors captured:');
    errors.forEach(e => console.error(' -', e));
  }

  await browser.close();

  if (errors.length) { console.error('Deployed UI verification found page errors'); process.exit(2); }
  console.log('Deployed UI verification completed successfully');
  process.exit(0);
})();
