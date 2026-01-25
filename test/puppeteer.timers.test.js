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
  page.on('dialog', async dialog => { console.log('[dialog]', dialog.message()); await dialog.accept(); });

  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Ensure iniciar-mesa exists and click to start a mesa with default players
  await page.waitForSelector('#iniciar-mesa');
  await page.evaluate(() => document.getElementById('iniciar-mesa').click());
  await page.waitForTimeout(200);

  // Read players array and their start timestamps (debugging dump)
  const mesasJson = await page.evaluate(() => JSON.stringify(mesasActivas));
  console.log('mesasActivas JSON:', mesasJson);
  const p0 = await page.evaluate(() => {
    const m = (mesasActivas && mesasActivas[0]) || null;
    return m && m.players && m.players[0] ? (Date.parse(m.players[0].start) || null) : null;
  });
  if (!p0) { console.error('No player 0 start found'); await browser.close(); server.close(); process.exit(2); }

  // Wait then add a player
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    // click the add-player button in the first mesa row
    const btn = document.querySelector('#mesas-table-body tr td button.btn-primary');
    if (btn) btn.click();
  });
  await page.waitForTimeout(200);

  const p1 = await page.evaluate(() => {
    const m = (mesasActivas && mesasActivas[0]) || null;
    return m && m.players && m.players[1] ? Date.parse(m.players[1].start) : null;
  });
  if (!p1) { console.error('No player 1 start found'); await browser.close(); server.close(); process.exit(2); }

  // Add a third player after a short delay
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = document.querySelector('#mesas-table-body tr td button.btn-primary');
    if (btn) btn.click();
  });
  await page.waitForTimeout(200);

  const p2 = await page.evaluate(() => {
    const m = (mesasActivas && mesasActivas[0]) || null;
    return m && m.players && m.players[2] ? Date.parse(m.players[2].start) : null;
  });
  if (!p2) { console.error('No player 2 start found'); await browser.close(); server.close(); process.exit(2); }

  console.log('Player starts:', p0, p1, p2);

  // Validate chronological order
  const ok = (new Date(p0).getTime() <= new Date(p1).getTime()) && (new Date(p1).getTime() <= new Date(p2).getTime());
  if (!ok) {
    console.error('Player start timestamps are not in chronological order');
    await browser.close(); server.close();
    process.exit(2);
  }

  // Finalize the mesa to exercise finalizar path
  await page.waitForSelector('#mesas-table-body tr td button.btn-warning');
  await page.evaluate(() => document.querySelector('#mesas-table-body tr td button.btn-warning').click());
  await page.waitForTimeout(200);

  await browser.close();
  server.close();

  console.log('Timers test passed');
  process.exit(0);
})().catch(err => { console.error('Timers test failed:', err); process.exit(2); });