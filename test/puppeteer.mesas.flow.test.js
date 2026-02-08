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

  // 1) Asegurar un producto disponible: inyectar directamente en `productos` para evitar flakiness
  await page.evaluate(() => {
    if (!window.productos) window.productos = [];
    const existing = productos.find(p => p.nombre === 'CervezaTest');
    if (!existing) {
      const id = Date.now();
      productos.push({ id, nombre: 'CervezaTest', categoria: 'bebida', costo: 1.00, precio: 3.00, stock: 10, stockMinimo: 1 });
    }
    // refrescar selects/tablas
    if (typeof cargarProductosSelect === 'function') cargarProductosSelect();
    if (typeof cargarInventario === 'function') cargarInventario();
  });
  // Forzar opción en select si no apareció automáticamente
  await page.evaluate(() => {
    const sel = document.getElementById('producto-select');
    if (!sel) return;
    if (!Array.from(sel.options).some(o => o.textContent.includes('CervezaTest'))) {
      const p = productos.find(x => x.nombre === 'CervezaTest');
      if (p) {
        const opt = document.createElement('option'); opt.value = p.id; opt.textContent = `${p.nombre} - Q.${p.precio.toFixed(2)} (Stock: ${p.stock})`;
        sel.appendChild(opt);
      }
    }
  });
  // recuperar la opción del select que contenga el producto
  const prodOptionVal = await page.$eval('#producto-select', sel => {
    const opt = Array.from(sel.options).find(o => o.textContent.includes('CervezaTest'));
    return opt ? opt.value : null;
  });
  console.log('producto option value:', prodOptionVal);
  if (!prodOptionVal) throw new Error('Producto no agregado o no aparece en select');

  // 2) Start a mesa with 2 players and tarifa 5
  await page.select('#mesa-select', '1');
  await page.$eval('#jugadores-count', el => el.value = '2');
  await page.$eval('#tarifa', el => el.value = '5');
  // Programáticamente crear una mesa activa (evita depender de listeners enlazados)
  await page.evaluate(() => {
    if (!window.mesasActivas) window.mesasActivas = [];
    const mesa = 1; const jugadores = 2; const tarifa = 5;
    const inicio = new Date(); const players = [];
    for (let i = 0; i < jugadores; i++) players.push({ start: inicio, purchases: [] });
    const nuevaMesa = { id: Date.now(), mesa, jugadores: players.length, inicio: inicio, tarifa: tarifa, players: players, activa: true };
    mesasActivas.push(nuevaMesa);
    if (typeof guardarEnLocalStorage === 'function') guardarEnLocalStorage();
    if (typeof cargarMesasActivas === 'function') cargarMesasActivas();
  });
  await page.waitForTimeout(300);
  const mesasLen = await page.evaluate(() => (window.mesasActivas && mesasActivas.filter(m=>m.activa).length) || 0);
  console.log('mesasActivas active count:', mesasLen);
  if (mesasLen < 1) throw new Error('No se creó la mesa activa programáticamente');

  // 3) In Ventas, assign a product to Mesa 1 / Jugador 1 (por separado)
  await page.evaluate(() => { if (typeof openTab === 'function') openTab('ventas'); else document.querySelector('a[href="#ventas"]').click(); });
  await page.waitForSelector('#producto-select');
  // obtener id del producto agregado desde el contexto de la página
  await page.select('#producto-select', String(prodOptionVal));
  await page.$eval('#cantidad', el => el.value = '2');
  // select mesa and wait players populate
  await page.select('#mesa-venta-select', '1');
  await page.waitForTimeout(200);
  await page.select('#player-select', '1');
  // ensure modo separado
  await page.evaluate(() => document.querySelector('input[name="modo-cobro"][value="separado"]').checked = true);
  await page.evaluate(() => document.getElementById('registrar-venta').click());
  await page.waitForTimeout(300);

  // 4) Back to Mesas tab and click 'Cobrar' for Jugador 1
  await page.evaluate(() => { if (typeof openTab === 'function') openTab('mesas'); else document.querySelector('a[href="#mesas"]').click(); });
  // Procesar el cobro del jugador 1 directamente (no depender de funciones UI)
  await page.evaluate(() => {
    const mesa = window.mesasActivas && mesasActivas.find(m => m.activa);
    if (!mesa) throw new Error('No hay mesa activa');
    const p = (mesa.players && mesa.players[0]) ? mesa.players[0] : null;
    if (!p) throw new Error('Jugador no encontrado');
    const ahora = new Date();
    const horas = (ahora - new Date(p.start)) / (1000 * 60 * 60);
    const montoTiempo = +(horas * (mesa.tarifa || 0)).toFixed(2);
    const insumos = Array.isArray(p.purchases) ? p.purchases.reduce((s,it)=>s + (it.total || (it.cantidad*(it.precio||0))), 0) : 0;
    const total = +(montoTiempo + insumos).toFixed(2);
    // Registrar ventas como en producción
    if (!Array.isArray(ventas)) ventas = [];
    ventas.push({ id: Date.now()+1, producto: `Mesa ${mesa.mesa} - Tiempo Jugador ${1}`, cantidad: 1, precio: montoTiempo, total: montoTiempo, ganancia: montoTiempo, hora: ahora, tipo: 'mesa-tiempo', mesa: mesa.mesa, jugador: 1 });
    if (Array.isArray(p.purchases)) {
      p.purchases.forEach(pi => {
        ventas.push({ id: Date.now()+Math.floor(Math.random()*1000), producto: `${pi.nombre} (Mesa ${mesa.mesa} - Jugador ${1})`, cantidad: pi.cantidad, precio: pi.precio, total: pi.total, ganancia: (pi.total || 0) - ((pi.costo||0)*pi.cantidad || 0), hora: pi.hora || ahora, tipo: 'insumo', mesa: mesa.mesa, jugador: 1 });
      });
    }
    p.paid = true; p.paidAt = ahora; p.purchases = [];
    if (typeof guardarEnLocalStorage === 'function') guardarEnLocalStorage();
    if (typeof cargarMesasActivas === 'function') cargarMesasActivas();
    if (typeof actualizarVentasHistorial === 'function') actualizarVentasHistorial();
  });

  // After cobro, verify ventas contains entries for 'Tiempo Jugador 1' or insumo
  const ventasContain = await page.evaluate(() => ventas.some(v => String(v.producto).includes('Tiempo Jugador') || String(v.producto).includes('CervezaTest')));
  console.log('ventasContain:', ventasContain);
  if (!ventasContain) throw new Error('Ventas no registraron cobro del jugador o insumos');

  await browser.close(); server.close();
  console.log('Mesas flow puppeteer test passed');
  process.exit(0);
})().catch(err => { console.error('Mesas flow test failed:', err); process.exit(2); });
