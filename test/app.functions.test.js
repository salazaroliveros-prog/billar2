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
  page.on('console', msg => { try { console.log('[page.console]', msg.text()); } catch(e){} });
  page.on('pageerror', err => { console.error('[page.error]', err && err.stack ? err.stack : err); });

  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  try {
    // Test: iniciar mesa
    await page.evaluate(() => { if (window.openTab) window.openTab('mesas'); });
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => window.mesasActivas.length);
    await page.evaluate(() => { document.getElementById('mesa-select').value = '1'; document.getElementById('jugadores-count').value = '2'; document.getElementById('tarifa').value = '5'; window.iniciarMesa(); });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.mesasActivas.length);
    console.log('Mesas before/after:', before, after);
    if (after !== before + 1) throw new Error('iniciarMesa did not add a mesa');

    const mesaId = await page.evaluate(() => window.mesasActivas[window.mesasActivas.length-1].id);
    await page.evaluate(id => window.agregarJugador(id), mesaId);
    await page.waitForTimeout(200);
    const players = await page.evaluate(id => { const m = window.mesasActivas.find(x=>x.id===id); return m ? (m.players?m.players.length:m.jugadores) : null; }, mesaId);
    console.log('Players after add:', players);
    if (players < 2) throw new Error('agregarJugador failed');

    await page.evaluate(id => window.finalizarMesa(id), mesaId);
    await page.waitForTimeout(200);
    const afterFinal = await page.evaluate(() => window.mesasActivas.length);
    console.log('Mesas after finalizar:', afterFinal);

    // Test: inventario add
    const prodBefore = await page.evaluate(() => window.productos.length);
    await page.evaluate(() => { document.getElementById('producto-nombre').value = 'TestProd'; document.getElementById('categoria').value = 'snack'; document.getElementById('costo-compra').value = '5'; document.getElementById('precio-venta-inv').value = '10'; document.getElementById('stock').value = '10'; window.agregarProducto(); });
    await page.waitForTimeout(200);
    const prodAfter = await page.evaluate(() => window.productos.length);
    console.log('Productos before/after:', prodBefore, prodAfter);
    if (prodAfter !== prodBefore + 1) throw new Error('agregarProducto failed');

    // Test: calcular proyeccion
    await page.evaluate(() => { document.getElementById('gastos-fijos').value = '1000'; document.getElementById('margen-deseado').value = '20'; window.calcularProyeccion(); });
    await page.waitForTimeout(200);
    const proye = await page.evaluate(() => document.getElementById('proyeccion-result') ? document.getElementById('proyeccion-result').innerText : null);
    console.log('Proyeccion result:', proye);
    if (!proye || !proye.includes('Ventas necesarias')) throw new Error('calcularProyeccion failed');

    // Test: exports
    await page.evaluate(() => window.generarReporte());
    const lastExport = await page.evaluate(() => window.lastExported);
    if (lastExport !== 'reporte-ventas') throw new Error('generarReporte failed');

    await page.evaluate(() => window.exportarExcel());
    const lastExport2 = await page.evaluate(() => window.lastExported);
    if (lastExport2 !== 'inventario-csv') throw new Error('exportarExcel failed');

    await page.evaluate(() => window.exportarPDF());
    const lastExport3 = await page.evaluate(() => window.lastExported);
    if (lastExport3 !== 'inventario-pdf-sim') throw new Error('exportarPDF failed');

    console.log('All function tests passed');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    await browser.close();
    server.close();
    process.exit(2);
  }

})().catch(err => { console.error('Test runner failed', err); process.exit(3); });
