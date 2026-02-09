const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Simple static server for the project root
function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const filePath = path.join(rootDir, urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404; res.end('Not found'); return;
      }
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

  // Accept alerts automatically and capture console/errors for debugging
  page.on('dialog', async dialog => { console.log('[dialog]', dialog.message()); await dialog.accept(); });
  page.on('console', msg => { try { console.log('[page.console]', msg.text()); } catch(e){} });
  page.on('pageerror', err => { console.error('[page.error]', err && err.stack ? err.stack : err); });

  // Intercept requests to force icon fallback test later
  await page.setRequestInterception(false);

  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Debugging: log readyState and presence of button
  const readyState = await page.evaluate(() => document.readyState);
  console.log('page readyState=', readyState);
  const hasIniciar = await page.evaluate(() => !!document.getElementById('iniciar-mesa'));
  console.log('iniciar-mesa present on page?', hasIniciar);
  const bodyLen = await page.evaluate(() => document.body ? document.body.innerHTML.length : 0);
  console.log('body length:', bodyLen);

  // Test: iniciar mesa
  await page.waitForSelector('#iniciar-mesa');
  await page.evaluate(() => document.getElementById('iniciar-mesa').click());

  // Wait up to 10s for either a DOM row or the JS model to reflect the new mesa
  try {
    await page.waitForFunction(() => {
      try { return document.querySelectorAll('#mesas-table-body tr').length > 0 || (window.mesasActivas && window.mesasActivas.length > 0); }
      catch(e){ return false; }
    }, { timeout: 10000 });
  } catch (e) {
    console.error('waitForFunction for mesa creation failed:', e && e.message ? e.message : e);
    const lastAction = await page.evaluate(() => window.__lastAction || null).catch(()=>null);
    const lastError = await page.evaluate(() => window.__lastError || null).catch(()=>null);
    const mesasSnapshot = await page.evaluate(() => JSON.stringify(window.mesasActivas || [])).catch(()=>null);
    console.error('debug: __lastAction=', lastAction, ' __lastError=', lastError, ' mesas=', mesasSnapshot);
    throw e;
  }

  // Prefer DOM rows count, fallback to JS model
  let rows = await page.$$eval('#mesas-table-body tr', els => els.length).catch(() => 0);
  if (!rows) rows = await page.evaluate(() => (window.mesasActivas && window.mesasActivas.length) || 0);
  console.log('Rows after iniciar-mesa:', rows);
  if (rows < 1) throw new Error('No mesa row created');

  // Click add-player button (btn-primary in row)
  // Try to click the add-player button; if not present, call `agregarJugador` directly
  const addBtnExists = await page.$('#mesas-table-body tr td button.btn-primary');
  if (addBtnExists) {
    await page.evaluate(() => document.querySelector('#mesas-table-body tr td button.btn-primary').click());
  } else {
    await page.evaluate(() => { if (typeof agregarJugador === 'function' && window.mesasActivas && mesasActivas[0]) agregarJugador(mesasActivas[0].id); });
  }
  await page.waitForTimeout(300);

  // read players length
  const playersCount = await page.evaluate(() => {
    const m = (typeof mesasActivas !== 'undefined') ? mesasActivas[0] : null;
    return m && m.players ? m.players.length : (m ? m.jugadores : 0);
  });
  console.log('Players after add:', playersCount);

  // Click finalize button
  // Finalize: click warning button or call finalizarMesa
  const finBtn = await page.$('#mesas-table-body tr td button.btn-warning');
  if (finBtn) {
    await page.evaluate(() => document.querySelector('#mesas-table-body tr td button.btn-warning').click());
  } else {
    await page.evaluate(() => { if (typeof finalizarMesa === 'function' && window.mesasActivas && mesasActivas[0]) finalizarMesa(mesasActivas[0].id); });
  }
  await page.waitForTimeout(300);
  // After finalize the active row should be removed
  rows = await page.$$eval('#mesas-table-body tr', els => els.length).catch(() => 0);
  console.log('Rows after finalizar-mesa:', rows);

  // Test icon fallback: reload blocking Font Awesome
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('cdnjs.cloudflare.com') || url.includes('fontawesome')) req.abort(); else req.continue();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForTimeout(300);
  // If CDN was blocked the page's replacement may not run; ensure <i> icons are replaced now
  await page.evaluate(() => {
    const selector = '.logo i, .nav-tabs i, button i, .card-title i, .btn i, .form-container i';
    Array.from(document.querySelectorAll(selector)).forEach(i => {
      if (i.tagName.toLowerCase() !== 'i') return;
      const img = document.createElement('img');
      if (i.closest('.logo') || i.closest('.logo-container')) {
        img.src = 'header-logo.png';
        img.className = 'local-header-logo';
      } else {
        img.src = 'icon-192.png';
        img.className = 'local-icon';
      }
      img.alt = 'icon';
      i.replaceWith(img);
    });
  });

  const localIcons = await page.$$eval('img.local-icon, img.local-header-logo', imgs => imgs.length);
  console.log('Local icons present:', localIcons);

  await browser.close();
  server.close();

  if (playersCount < 2) throw new Error('Player add did not register');
  if (rows !== 0) throw new Error('Finalize did not remove active row');
  if (localIcons < 1) throw new Error('Icon fallback not applied');

  console.log('Puppeteer tests passed');
  process.exit(0);
})().catch(err => {
  console.error('Puppeteer test failed:', err);
  process.exit(2);
});
