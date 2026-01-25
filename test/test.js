const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const vcon = new VirtualConsole();
vcon.sendTo(console);

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost',
  virtualConsole: vcon,
  beforeParse(window) {
    // prevent modal alerts/confirm blocking
    window.alert = (...args) => { console.log('[alert]', ...args); };
    window.confirm = (...args) => { console.log('[confirm]', ...args); return true; };
    // simple tab opener fallback
    window.openTab = (id) => { console.log('openTab', id); };
    // stub service worker registration to avoid errors in jsdom
    window.navigator.serviceWorker = { register: () => Promise.resolve() };
    // stub canvas getContext to avoid Chart.js errors
    if (typeof window.HTMLCanvasElement !== 'undefined') {
      window.HTMLCanvasElement.prototype.getContext = function() { return {}; };
    }
    // stub getComputedStyle used by icon detection
    window.getComputedStyle = window.getComputedStyle || (() => ({ content: 'ok' }));
  }
});

function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

(async function run(){
  // wait for scripts to load and DOMContentLoaded
  await wait(500);

  const { document, window } = dom.window;

  console.log('Starting tests...');

  try{
    // Clear localStorage
    window.localStorage.clear();

    // Ensure functions exist (wait a short time for scripts to attach globals)
    const ensureFn = async (name, timeoutMs = 1500) => {
      const start = Date.now();
      while(Date.now() - start < timeoutMs){
        if(typeof window[name] === 'function') return true;
        await wait(50);
      }
      return false;
    };

    if(!await ensureFn('guardarEnLocalStorage')) throw new Error('guardarEnLocalStorage missing');
    if(!await ensureFn('cargarDesdeLocalStorage')) throw new Error('cargarDesdeLocalStorage missing');

    // Simulate clicking iniciar-mesa
    const initBtn = document.getElementById('iniciar-mesa');
    if(!initBtn) throw new Error('iniciar-mesa button not found');
    initBtn.click();
    await wait(200);

    const mesasNow = window.eval('mesasActivas');
    console.log('mesasActivas after iniciar:', mesasNow && mesasNow.length);
    if(!(mesasNow && mesasNow.length)) throw new Error('No mesa started');

    const mesaId = mesasNow[0].id;

    // Add a player
    if(typeof window.agregarJugador !== 'function') throw new Error('agregarJugador missing');
    window.agregarJugador(mesaId);
    await wait(100);
    const mesasAfterAdd = window.eval('mesasActivas');
    console.log('players count after agregarJugador:', mesasAfterAdd[0].players.length);

    // Finalize mesa
    if(typeof window.finalizarMesa !== 'function') throw new Error('finalizarMesa missing');
    window.finalizarMesa(mesaId);
    await wait(100);

    const mesasAfterFinal = window.eval('mesasActivas');
    console.log('Mesa finalized, active flag:', mesasAfterFinal[0].activa);

    // Test pendientes module availability
    if(window.pendientesModule && typeof window.pendientesModule.load === 'function'){
      window.pendientesModule.load();
      console.log('pendientesModule loaded, count:', (window.pendientesModule.pendientes||[]).length);
    }

    // Test saving/loading to localStorage
    window.guardarEnLocalStorage();
    // push via eval so top-level lexical variable is modified
    window.eval("mesasActivas.push({ id: 99999, mesa: 99, jugadores: 1, inicio: new Date(), tarifa: 0, players: [{start: new Date()}], activa: false })");
    window.guardarEnLocalStorage();
    window.eval('mesasActivas = []');
    window.cargarDesdeLocalStorage();
    const mesasLoaded = window.eval('mesasActivas');
    console.log('mesasActivas after save/load:', mesasLoaded.length);

    console.log('All tests completed without throwing errors.');
    process.exit(0);
  }catch(err){
    console.error('Test failed:', err);
    process.exit(2);
  }
})();
