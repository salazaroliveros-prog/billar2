PWA build & deploy notes

1) Generar iconos (Windows PowerShell, requiere ImageMagick `magick`):

```powershell
# desde la carpeta del proyecto
powershell -ExecutionPolicy Bypass -File .\generate-icons.ps1
```

2) Verificar `manifest.json` (ya incluido) y que `index.html` enlaza `manifest.json` y `sw.js`.

3) Servir localmente para pruebas (Chrome permite instalación desde localhost):

```powershell
# Python
python -m http.server 8000
# o con node
npx http-server -p 8000
```

4) Despliegue en GitHub Pages:
- Subir todo el repo al GitHub.
- En repo settings -> Pages, seleccionar rama `main` (o `gh-pages`) y carpeta `/ (root)`.
- GitHub Pages sirve por HTTPS; la PWA podrá instalarse en producción.

5) Notas sobre Service Worker:
- `sw.js` incluido implementa caché básico. Para producción, mejorar estrategia (cache versioning y actualizar recursos dinámicamente).

6) Comprobaciones tras desplegar:
- Abrir URL pública (https://<user>.github.io/<repo>)
- DevTools -> Application: comprobar `manifest`, `Service Worker`, iconos y que la opción "Install" aparece.

Si prefieres, puedo:
- crear un workflow GitHub Actions para automatizar generación de iconos y deploy a `gh-pages` (requiere tu confirmación),
- o generar los iconos aquí si subes `logo_principal.png` de mayor resolución si el actual no es suficiente.
