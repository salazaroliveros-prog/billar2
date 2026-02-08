# App_finanzas_Billar_2026 — Instrucciones de uso y pruebas

Este repositorio contiene la aplicación de control de mesas y ventas (frontend estático) y pruebas automatizadas con Puppeteer.

Contenido relevante:
- `index.html` — la aplicación principal (HTML + JS embebido).
- `test/` — scripts de prueba y utilidades:
  - `puppeteer.test.js` — test principal (CDN/icon fallback, iniciar mesa, etc.).
  - `puppeteer.handlers.test.js` — tests de handlers/funcionalidades (inventario, proyección, export).
  - `puppeteer.mesas.flow.test.js` — nuevo test que recorre el flujo: crear producto, iniciar mesa, asignar insumo a jugador y cobrar.
  - `static-server.js` — servidor estático simple para servir la app localmente (puede usarse con `npm run serve`).

Requisitos
- Node.js 18+ (probado en Windows). 
- Conexión a Internet no es necesaria para los tests (los tests inyectan productos cuando hace falta).

Instalación

```bash
npm install
```

Comandos útiles

- Iniciar servidor estático (sirve `index.html` desde el root):

```bash
npm run serve
# por defecto escucha en http://localhost:8080
# para usar otro puerto:
PORT=3000 npm run serve
```

- Ejecutar pruebas Puppeteer individuales

```bash
# test principal (ya existente)
npm run test:puppeteer

# handlers
npm run test:puppeteer:handlers

# flujo mesas (nuevo)
npm run test:puppeteer:mesas-flow
```

- Ejecutar un flujo CI simplificado

```bash
npm run test:ci
```

- Ejecutar todos los tests Puppeteer en cadena

```bash
npm run test:puppeteer:all
```

Notas y troubleshooting

- Si las pruebas fallan por permisos o falta de Chrome/Chromium, instale las dependencias de `puppeteer` o use una instalación de Chromium/Chrome compatible. En Windows es recomendable ejecutar desde PowerShell con permisos normales.
- Si observa errores relacionados con `headless` puede forzar el nuevo headless de Chrome ajustando `puppeteer.launch({ headless: 'new' })` en los scripts de prueba.
- Los tests usan servidores estáticos simples definidos en `test/*.js`; si necesita servir desde otro host/puerto use `npm run serve` y ajuste la URL en los tests si fuera necesario.
- Para depuración, ejecute el test directamente (por ejemplo `node test/puppeteer.mesas.flow.test.js`) y lea la salida que muestra el flujo y los `console.log` desde la página.

Cambios recientes (resumen)
- Se añadió la UI para cobrar por jugador, manejo de insumos por jugador y por mesa.
- Se agregó el modal de cobro individual y la lógica para registrar ventas por tiempo e insumos.
- Se agregó un test Puppeteer detallado para validar el flujo de mesas y cobros por jugador.
- Se añadieron scripts npm `serve`, `test:ci`, `test:puppeteer:mesas-flow` y `test:puppeteer:all`.
 
Se añadió un workflow de GitHub Actions en `.github/workflows/puppeteer-ci.yml` que ejecuta los tests Puppeteer y sube logs.
El workflow incluye cache de dependencias y genera un reporte JUnit (XML) por job. Los artifacts (logs y XML) quedan disponibles en la página del run.
