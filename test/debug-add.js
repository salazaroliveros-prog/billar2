const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
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
  console.log('Opening', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('[PAGE]', m.text()));
  page.on('pageerror', err => console.log('[PAGEERROR]', err && err.message));
  page.on('dialog', async dialog => { console.log('[dialog]', dialog.message()); await dialog.accept(); });
  await page.goto(url, { waitUntil: 'networkidle2' });
  console.log('Page loaded. Checking elements...');
  const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script[src]')).map(s=>s.src));
  console.log('scripts loaded:', scripts.join(' | '));
  const hasNombre = await page.$('#producto-nombre') !== null;
  console.log('has producto-nombre?', hasNombre);
  const hasAgregar = await page.$('#agregar-producto') !== null;
  console.log('has agregar-producto?', hasAgregar);
  const tipoGlobalAgregar = await page.evaluate(() => typeof window.agregarProducto);
  const tipoDirectAgregar = await page.evaluate(() => typeof agregarProducto).catch(()=> 'err');
  console.log('typeof window.agregarProducto:', tipoGlobalAgregar, 'typeof agregarProducto:', tipoDirectAgregar);
  console.log('Clicking agregar-producto');
  await page.evaluate(() => {
    document.getElementById('producto-nombre').value = 'Prod_Temp_Debug';
    document.getElementById('categoria').value = 'otro';
    document.getElementById('costo-compra').value = '1.00';
    document.getElementById('precio-venta-inv').value = '2.00';
    document.getElementById('stock').value = '5';
    document.getElementById('stock-minimo').value = '1';
  });
  await page.evaluate(() => document.getElementById('agregar-producto').click());
  console.log('Clicked, waiting 500ms...');
  await page.waitForTimeout(500);
  const prodLen = await page.evaluate(() => (window.productos||[]).length);
  console.log('productos length now:', prodLen);
  const lastAction = await page.evaluate(() => window.__lastAction);
  console.log('__lastAction:', lastAction);
  const lastError = await page.evaluate(() => window.__lastError);
  console.log('__lastError:', lastError);
  await browser.close(); server.close(); process.exit(0);
})().catch(err=>{ console.error(err); process.exit(2); });