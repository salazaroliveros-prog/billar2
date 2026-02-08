const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.json':'application/json', '.ico':'image/x-icon' };
  return types[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(root, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', contentType(filePath));
    res.end(data);
  });
});

server.listen(port, () => console.log(`Static server running at http://localhost:${port}/ (root: ${root})`));

// Clean shutdown on signals
['SIGINT','SIGTERM'].forEach(sig => process.on(sig, () => { server.close(() => process.exit(0)); }));
