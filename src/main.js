// Extracted JS from index.html — combined entrypoint
// Pendientes module
(function(win, doc){
    const storageKey = 'pendientes';
    let pendientes = [];

    function q(id){ return doc.getElementById(id); }

    function load() {
        const raw = localStorage.getItem(storageKey);
        pendientes = raw ? JSON.parse(raw).map(p => ({...p, fecha: new Date(p.fecha)})) : [];
    }

    function save(){
        localStorage.setItem(storageKey, JSON.stringify(pendientes));
    }

    function diasDesde(fecha){ return Math.floor((new Date() - new Date(fecha)) / (1000*60*60*24)); }

    function renderResumen(){
        const activos = pendientes.filter(p => p.estado === 'pendiente');
        const total = activos.reduce((s,p)=>s+p.total,0);
        q('total-pendiente') && (q('total-pendiente').textContent = `Q. ${total.toFixed(2)}`);
        q('count-pendientes') && (q('count-pendientes').textContent = activos.length);
        q('finanzas-pendientes') && (q('finanzas-pendientes').textContent = `Q. ${total.toFixed(2)}`);
        if(activos.length>0){
            const prom = Math.round(activos.reduce((s,p)=>s+diasDesde(p.fecha),0)/activos.length);
            q('promedio-dias') && (q('promedio-dias').textContent = prom);
        } else q('promedio-dias') && (q('promedio-dias').textContent = '0');
        const clientes = [...new Set(activos.map(p=>p.cliente))];
        q('count-clientes') && (q('count-clientes').textContent = clientes.length);
        q('pendientes-count') && (q('pendientes-count').textContent = `${activos.length} ventas pendientes`);
    }

    function renderTabla(){
        const tbody = q('pendientes-completo-body');
        if(!tbody) return;
        tbody.innerHTML = '';
        const activos = pendientes.filter(p => p.estado === 'pendiente');
        activos.forEach(p => {
            const dias = diasDesde(p.fecha);
            const productosTexto = p.productos.map(i=>`${i.cantidad}x ${i.nombre}`).join(', ');
            const tr = doc.createElement('tr');
            tr.innerHTML = `
                <td>${p.cliente || 'Cliente no registrado'}</td>
                <td>${p.telefono || 'N/A'}</td>
                <td>${productosTexto}</td>
                <td>Q. ${p.total.toFixed(2)}</td>
                <td>${new Date(p.fecha).toLocaleDateString()}</td>
                <td>${dias}</td>
                <td><span class="status-pending">Pendiente</span></td>
                <td>
                    <button class="btn btn-success btn-sm" data-cobrar="${p.id}"><i class="fas fa-money-bill-wave"></i></button>
                    <button class="btn btn-danger btn-sm" data-eliminar="${p.id}" style="margin-left: 5px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function abrirModalPago(id){
        const p = pendientes.find(x=>x.id===id); if(!p) return alert('Venta no encontrada.');
        q('modal-cliente').value = p.cliente;
        q('modal-total').value = p.total;
        q('modal-monto').value = p.total;
        q('modal-monto').max = p.total;
        q('modal-notas').value = p.notas || '';
        win.openModal && win.openModal('modal-pago');
        q('registrar-pago-btn').dataset.currentId = id;
    }

    function registrarPago(){
        const id = parseInt(q('registrar-pago-btn').dataset.currentId);
        const monto = parseFloat(q('modal-monto').value)||0;
        const metodo = q('modal-metodo').value;
        if(monto<=0) return alert('Ingrese un monto válido.');
        const idx = pendientes.findIndex(p=>p.id===id); if(idx===-1) return alert('Venta no encontrada.');
        const p = pendientes[idx];
        if(monto>=p.total){
            p.estado='pagado'; p.metodo=metodo; p.notas = (p.notas||'') + ' | Pago completo';
            if(Array.isArray(win.ventas)) win.ventas.push(p);
            pendientes.splice(idx,1);
        } else {
            p.total = +(p.total - monto).toFixed(2);
            p.notas = (p.notas||'') + ` | Pago parcial Q.${monto.toFixed(2)} el ${new Date().toLocaleDateString()}`;
            if(Array.isArray(win.ventas)) win.ventas.push({...p, id: Date.now(), total: monto, estado:'pagado'});
        }
        save();
        win.closeModal && win.closeModal('modal-pago');
        renderResumen(); renderTabla();
        alert(`Pago registrado por Q.${monto.toFixed(2)}`);
    }

    function eliminarPendiente(id){
        if(!confirm('¿Eliminar esta venta pendiente?')) return;
        const idx = pendientes.findIndex(p=>p.id===id); if(idx===-1) return;
        pendientes.splice(idx,1); save(); renderResumen(); renderTabla();
    }

    function abrirNuevoCredito(){
        const select = q('nuevo-producto');
        if(select){
            select.innerHTML = '<option value="">Seleccione un producto</option>';
            if(Array.isArray(win.productos)){
                win.productos.forEach(prod=>{
                    const opt = doc.createElement('option'); opt.value = prod.id; opt.textContent = `${prod.nombre} - Q.${prod.precio.toFixed(2)} (Stock: ${prod.stock})`;
                    select.appendChild(opt);
                });
            }
        }
        const fecha = new Date(); fecha.setDate(fecha.getDate()+30);
        q('nuevo-fecha') && (q('nuevo-fecha').value = fecha.toISOString().split('T')[0]);
        win.openModal && win.openModal('modal-nuevo-credito');
    }

    function guardarNuevoCredito(){
        const cliente = q('nuevo-cliente').value.trim(); if(!cliente) return alert('Ingrese nombre del cliente');
        const telefono = q('nuevo-telefono').value.trim();
        const productoId = parseInt(q('nuevo-producto').value); const cantidad = parseInt(q('nuevo-cantidad').value)||1;
        if(!productoId) return alert('Seleccione un producto');
        const prod = Array.isArray(win.productos) ? win.productos.find(p=>p.id===productoId) : null;
        if(!prod) return alert('Producto no encontrado');
        if(prod.stock < cantidad) return alert(`Stock insuficiente. Solo ${prod.stock} disponibles.`);
        const total = +(cantidad * prod.precio).toFixed(2);
        const nuevo = { id: Date.now(), cliente, telefono, productos: [{id: prod.id, nombre: prod.nombre, cantidad, precio: prod.precio}], total, fecha: new Date(), estado:'pendiente', notas: `Vence: ${q('nuevo-fecha').value}` };
        pendientes.push(nuevo);
        if(Array.isArray(win.productos)){
            const idx = win.productos.findIndex(p=>p.id===prod.id);
            if(idx!==-1) win.productos[idx].stock -= cantidad;
        }
        save(); win.closeModal && win.closeModal('modal-nuevo-credito'); renderResumen(); renderTabla(); alert(`Crédito registrado para ${cliente} por Q.${total.toFixed(2)}`);
    }

    if(typeof win.openModal !== 'function'){
        win.openModal = function(id){ const el = q(id); if(el) el.style.display='flex'; };
    }
    if(typeof win.closeModal !== 'function'){
        win.closeModal = function(id){ const el = q(id); if(el) el.style.display='none'; };
    }

    function setup(){
        load(); renderResumen(); renderTabla();
        doc.addEventListener('click', function(e){
            const cobrar = e.target.closest('[data-cobrar]');
            if(cobrar){ abrirModalPago(parseInt(cobrar.getAttribute('data-cobrar'))); }
            const eliminar = e.target.closest('[data-eliminar]');
            if(eliminar){ eliminarPendiente(parseInt(eliminar.getAttribute('data-eliminar'))); }
            const closeBtn = e.target.closest('[data-close-modal]');
            if(closeBtn){ win.closeModal && win.closeModal(closeBtn.getAttribute('data-close-modal')); }
        });

        q('buscar-pendientes') && q('buscar-pendientes').addEventListener('click', function(){ renderTabla(); });
        q('nuevo-credito-btn') && q('nuevo-credito-btn').addEventListener('click', abrirNuevoCredito);
        q('registrar-pago-btn') && q('registrar-pago-btn').addEventListener('click', registrarPago);
        q('guardar-nuevo-credito-btn') && q('guardar-nuevo-credito-btn').addEventListener('click', guardarNuevoCredito);
        const navPend = doc.querySelector('.nav-tabs a[href="#pendientes"]');
        if(navPend) navPend.addEventListener('click', function(e){ e.preventDefault(); if(typeof win.openTab==='function') win.openTab('pendientes'); else location.hash='#pendientes'; });
    }

    win.pendientesModule = { setup, load, pendientes };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', setup); else setup();
})(window, document);

// Global app script (variables, initialization and functions)
let mesasActivas = [];
let productos = [];
let ventas = [];
let inventario = [];
let registroMesas = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentDate = new Date();
    document.getElementById('current-date').textContent = currentDate.toLocaleDateString('es-GT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    inicializarDatos();
    setupNavigation();
    setupEventListeners();
    cargarMesasActivas();
    cargarRegistroMesas();
    if (!window.mesasRefreshInterval) window.mesasRefreshInterval = setInterval(cargarMesasActivas, 1000);
    cargarInventario();
    cargarProductosSelect();
    inicializarGraficos();
    cargarRegistroMesas();
    cargarResumenMesasPorDia();
});

document.addEventListener('DOMContentLoaded', function(){
    const filBtn = document.getElementById('filtrar-registro');
    if (filBtn) filBtn.addEventListener('click', function(e){ e.preventDefault(); cargarRegistroMesas(); cargarResumenMesasPorDia(); });
    const expBtn = document.getElementById('export-registro-csv');
    if (expBtn) expBtn.addEventListener('click', function(e){ e.preventDefault(); exportRegistroMesasCSV(); });
});

function inicializarDatos() {
    try { cargarDesdeLocalStorage(); } catch (e) { console.warn('Error cargando desde localStorage en inicializarDatos:', e); }
    if (!Array.isArray(mesasActivas)) mesasActivas = [];
    if (!Array.isArray(productos)) productos = [];
    if (!Array.isArray(ventas)) ventas = [];
    try {
        localStorage.setItem('pendientes', JSON.stringify([]));
        if (window.pendientesModule && typeof window.pendientesModule.load === 'function') {
            window.pendientesModule.load();
            if (typeof window.pendientesModule.setup === 'function') window.pendientesModule.setup();
        }
    } catch (e) { console.warn('No se pudo asegurar pendientes en localStorage:', e); }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-tabs a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(item => item.classList.remove('active'));
            this.classList.add('active');
            const tabContents = document.querySelectorAll('.tab-content'); tabContents.forEach(content => content.classList.remove('active'));
            const targetTab = this.getAttribute('href'); document.querySelector(targetTab).classList.add('active');
        });
    });
}

function openTab(tabId) {
    const navLinks = document.querySelectorAll('.nav-tabs a'); navLinks.forEach(item => item.classList.remove('active'));
    const tabContents = document.querySelectorAll('.tab-content'); tabContents.forEach(content => content.classList.remove('active'));
    document.querySelector(`a[href="#${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function setupEventListeners() {
    const iniciarBtn = document.getElementById('iniciar-mesa');
    if(iniciarBtn) iniciarBtn.addEventListener('click', function() {
        const mesa = parseInt(document.getElementById('mesa-select').value);
        const jugadores = parseInt(document.getElementById('jugadores-count').value);
        const tarifa = parseFloat(document.getElementById('tarifa').value) || 0;
        const mesaExistente = mesasActivas.find(m => m.mesa === mesa && m.activa);
        if (mesaExistente) { alert(`La mesa ${mesa} ya está activa. Detenga el juego actual antes de iniciar uno nuevo.`); return; }
        const inicioAhora = new Date(); const players = [];
        for (let i = 0; i < jugadores; i++) players.push({ start: inicioAhora, purchases: [] });
        const nuevaMesa = { id: Date.now(), mesa: mesa, jugadores: players.length, inicio: inicioAhora, tarifa: tarifa, players: players, activa: true };
        mesasActivas.push(nuevaMesa); guardarEnLocalStorage(); cargarMesasActivas(); alert(`Juego iniciado en la Mesa ${mesa} con ${nuevaMesa.jugadores} jugadores. Tarifa: Q.${tarifa} por hora por jugador.`);
    });

    const detenerBtn = document.getElementById('detener-mesa');
    if(detenerBtn) detenerBtn.addEventListener('click', function() {
        const mesa = parseInt(document.getElementById('mesa-select').value);
        const mesaIndex = mesasActivas.findIndex(m => m.mesa === mesa && m.activa);
        if (mesaIndex === -1) { alert(`No hay juego activo en la Mesa ${mesa}.`); return; }
        const mesaActiva = mesasActivas[mesaIndex];
        const tiempoTranscurrido = (new Date() - mesaActiva.inicio) / (1000 * 60 * 60);
        const total = tiempoTranscurrido * mesaActiva.tarifa * mesaActiva.jugadores;
        alert(`Juego finalizado en la Mesa ${mesa}.\nTiempo: ${tiempoTranscurrido.toFixed(2)} horas\nJugadores: ${mesaActiva.jugadores}\nTotal a pagar: Q.${total.toFixed(2)}`);
        mesasActivas[mesaIndex].activa = false;
        const fecha = new Date(); const tiempoHoras = tiempoTranscurrido;
        const registro = { id: Date.now(), fecha: fecha, mesa: mesaActiva.mesa, jugadores: mesaActiva.jugadores || (mesaActiva.players ? mesaActiva.players.length : 0), tiempoHoras: tiempoHoras, tarifaPorJugador: mesaActiva.tarifa || 0, total: total, players: Array.isArray(mesaActiva.players) ? mesaActiva.players.map(p => ({ start: p.start })) : [], estado: 'finalizada' };
        registroMesas.push(registro);
        ventas.push({ id: Date.now()+1, producto: `Mesa ${mesaActiva.mesa}`, cantidad: 1, precio: total, total: total, ganancia: total, hora: fecha, tipo: 'mesa' });
        guardarEnLocalStorage(); cargarMesasActivas(); cargarRegistroMesas(); cargarInventario(); actualizarVentasHistorial();
    });

    document.getElementById('registrar-venta') && document.getElementById('registrar-venta').addEventListener('click', function() {
        const productoSelect = document.getElementById('producto-select');
        const productoId = parseInt(productoSelect.value);
        const cantidad = parseInt(document.getElementById('cantidad').value);
        if (!productoId || cantidad < 1) { alert('Por favor, seleccione un producto y una cantidad válida.'); return; }
        const producto = productos.find(p => p.id === productoId);
        if (!producto) { alert('Producto no encontrado.'); return; }
        if (producto.stock < cantidad) { alert(`Stock insuficiente. Solo hay ${producto.stock} unidades disponibles.`); return; }
        const total = cantidad * producto.precio; const ganancia = cantidad * (producto.precio - producto.costo);
        const mesaVal = document.getElementById('mesa-venta-select').value; const playerVal = document.getElementById('player-select').value;
        const modo = document.querySelector('input[name="modo-cobro"]:checked') ? document.querySelector('input[name="modo-cobro"]:checked').value : 'separado';
        const ventaCredito = document.getElementById('venta-credito') && document.getElementById('venta-credito').checked;
        if (ventaCredito) {
            const selectNuevo = document.getElementById('nuevo-producto'); selectNuevo.innerHTML = ''; const opt = document.createElement('option'); opt.value = producto.id; opt.textContent = `${producto.nombre} - Q.${producto.precio.toFixed(2)}`; selectNuevo.appendChild(opt);
            document.getElementById('nuevo-cantidad').value = cantidad; document.getElementById('nuevo-total').value = total.toFixed(2); window.openModal && window.openModal('modal-nuevo-credito'); return;
        }
        if (mesaVal) {
            const mesaNum = parseInt(mesaVal); const mesaActiva = mesasActivas.find(m => m.mesa === mesaNum && m.activa);
            if (!mesaActiva) { alert(`La Mesa ${mesaNum} no está activa. Inicie la mesa antes de asignar insumos.`); return; }
            const item = { id: Date.now(), productoId: producto.id, nombre: producto.nombre, cantidad, precio: producto.precio, total, costo: producto.costo, hora: new Date() };
            if (modo === 'separado' && playerVal) {
                const pIdx = parseInt(playerVal) - 1; if (!Array.isArray(mesaActiva.players)) mesaActiva.players = []; if (!mesaActiva.players[pIdx]) return alert('Jugador no encontrado en la mesa.'); if (!Array.isArray(mesaActiva.players[pIdx].purchases)) mesaActiva.players[pIdx].purchases = [];
                mesaActiva.players[pIdx].purchases.push(item);
                ventas.push({ id: Date.now()+1, producto: `${producto.nombre} (Mesa ${mesaNum} - Jugador ${pIdx+1})`, cantidad, precio: producto.precio, total, ganancia, hora: new Date(), tipo: 'insumo', mesa: mesaNum, jugador: pIdx+1 });
            } else {
                if (!Array.isArray(mesaActiva.purchases)) mesaActiva.purchases = [];
                mesaActiva.purchases.push(item);
                ventas.push({ id: Date.now()+2, producto: `${producto.nombre} (Mesa ${mesaNum})`, cantidad, precio: producto.precio, total, ganancia, hora: new Date(), tipo: 'insumo-mesa', mesa: mesaNum });
            }
            producto.stock -= cantidad; guardarEnLocalStorage(); cargarInventario(); cargarMesasActivas(); actualizarVentasHistorial(); alert(`Insumo agregado a Mesa ${mesaNum}: ${cantidad} x ${producto.nombre} -> Q.${total.toFixed(2)}`);
            document.getElementById('cantidad').value = 1; document.getElementById('total-venta').value = ''; document.getElementById('ganancia').value = ''; return;
        }
        const nuevaVenta = { id: Date.now(), producto: producto.nombre, cantidad: cantidad, precio: producto.precio, total: total, ganancia: ganancia, hora: new Date() };
        ventas.push(nuevaVenta); producto.stock -= cantidad; guardarEnLocalStorage(); cargarInventario(); actualizarVentasHistorial(); alert(`Venta registrada: ${cantidad} x ${producto.nombre}\nTotal: Q.${total.toFixed(2)}\nGanancia: Q.${ganancia.toFixed(2)}`);
        document.getElementById('cantidad').value = 1; document.getElementById('total-venta').value = ''; document.getElementById('ganancia').value = '';
    });
}

function cobrarJugador(mesaId, playerIndex) { /* defined earlier, kept for compatibility */ }

// Service worker
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then(() => console.log('Service Worker registrado')).catch(err => console.warn('Service Worker fallo:', err)); }

// Font Awesome fallback
(function(){
    function faLoaded(){
        try{ const test = document.createElement('i'); test.className = 'fas fa-check'; test.style.display = 'none'; document.body.appendChild(test); const content = window.getComputedStyle(test, '::before').content; document.body.removeChild(test); return content && content !== 'none' && content !== '""' && content !== '""'; }catch(e){return false;}
    }
    function replaceIcons(){ const selector = '.logo i, .nav-tabs i, button i, .card-title i, .btn i, .form-container i'; const icons = Array.from(document.querySelectorAll(selector)); icons.forEach(i => { if (i.tagName.toLowerCase() !== 'i') return; const img = document.createElement('img'); if (i.closest('.logo') || i.closest('.logo-container')) { img.src = 'header-logo.png'; img.className = 'local-header-logo'; } else { img.src = 'icon-192.png'; img.className = 'local-icon'; } img.alt = 'icon'; i.replaceWith(img); }); }
    document.addEventListener('DOMContentLoaded', function(){ if(!faLoaded()) replaceIcons(); });
})();

// expose globals for tests
window.mesasActivas = mesasActivas;
window.productos = productos;
window.ventas = ventas;
window.registroMesas = registroMesas;
