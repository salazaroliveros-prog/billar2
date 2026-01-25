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

  // Add a product to edit later
  await page.waitForSelector('#producto-nombre');
  await page.evaluate(() => {
    // Use neutral but valid test values (no sensitive demo names)
    document.getElementById('producto-nombre').value = 'Prod_Temp';
    document.getElementById('categoria').value = 'otro';
    document.getElementById('costo-compra').value = '1.00';
    document.getElementById('precio-venta-inv').value = '2.00';
    document.getElementById('stock').value = '5';
    document.getElementById('stock-minimo').value = '1';
    // dispatch input/change events
    ['producto-nombre','costo-compra','precio-venta-inv','stock','stock-minimo'].forEach(id => {
      const el = document.getElementById(id); if (el) el.dispatchEvent(new Event('input')); });
    document.getElementById('categoria').dispatchEvent(new Event('change'));
  });
  await page.waitForSelector('#agregar-producto');
  await page.evaluate(() => document.getElementById('agregar-producto').click());
  await page.waitForTimeout(200);

  // Verify product added
  const prodCount = await page.evaluate(() => productos.length);
  console.log('productos length after add:', prodCount);
  if (prodCount < 1) throw new Error('Producto no agregado');

  // Edit the first product: call editarProducto via evaluate
  await page.evaluate(() => editarProducto(productos[0].id));
  await page.waitForTimeout(200);
  // change name and update
  await page.evaluate(() => document.getElementById('producto-nombre').value = 'Prod_TempUpdated');
  await page.waitForSelector('#actualizar-producto');
  await page.evaluate(() => document.getElementById('actualizar-producto').click());
  await page.waitForTimeout(200);
  const updatedName = await page.evaluate(() => productos[0].nombre);
  console.log('updatedName:', updatedName);
  if (updatedName !== 'Prod_TempUpdated') throw new Error('Producto no actualizado');

  // Test calcular proyeccion (use valid non-zero inputs so projection runs)
  await page.evaluate(() => { document.getElementById('gastos-fijos').value = '1000'; document.getElementById('margen-deseado').value = '10'; });
  await page.waitForSelector('#calcular-proyeccion');
  await page.evaluate(() => document.getElementById('calcular-proyeccion').click());
  await page.waitForTimeout(200);
  const proyText = await page.$eval('#proyeccion-result', el => el.innerText);
  console.log('proyeccion text:', proyText);
  if (!proyText.includes('Ventas necesarias')) throw new Error('Proyección no mostrada');

  // Test generar reporte sets lastExported
  await page.waitForSelector('#generar-reporte');
  await page.evaluate(() => document.getElementById('generar-reporte').click());
  await page.waitForTimeout(200);
  const lastExported1 = await page.evaluate(() => window.lastExported);
  console.log('lastExported after generar-reporte:', lastExported1);
  if (lastExported1 !== 'reporte-ventas') throw new Error('Generar reporte failed');

  // Test exportar-excel and exportar-pdf
  await page.waitForSelector('#exportar-excel');
  await page.evaluate(() => document.getElementById('exportar-excel').click());
  await page.waitForTimeout(200);
  const lastExported2 = await page.evaluate(() => window.lastExported);
  console.log('lastExported after exportar-excel:', lastExported2);
  if (lastExported2 !== 'inventario-csv') throw new Error('Exportar excel failed');

  await page.waitForSelector('#exportar-pdf');
  await page.evaluate(() => document.getElementById('exportar-pdf').click());
  await page.waitForTimeout(200);
  const lastExported3 = await page.evaluate(() => window.lastExported);
  console.log('lastExported after exportar-pdf:', lastExported3);
  if (lastExported3 !== 'inventario-pdf-sim') throw new Error('Exportar pdf failed');

  await browser.close();
  server.close();

  console.log('Handlers puppeteer tests passed');
  process.exit(0);
})().catch(err => { console.error('Puppeteer handlers test failed:', err); process.exit(2); });
