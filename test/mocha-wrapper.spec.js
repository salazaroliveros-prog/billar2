const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runScript(scriptPath, outName, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const node = process.execPath;
    const child = spawn(node, [scriptPath], { env: process.env });
    const logDir = path.resolve(__dirname, '..', 'reports', 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `${outName}.log`);
    const ws = fs.createWriteStream(logFile);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
      ws.end();
      reject(new Error(`${outName} timed out after ${timeout}ms`));
    }, timeout);

    child.stdout.on('data', d => { ws.write(d); });
    child.stderr.on('data', d => { ws.write(d); });
    child.on('error', err => {
      clearTimeout(timer); ws.end(); reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer); ws.end();
      if (timedOut) return;
      resolve({ code, log: logFile });
    });
  });
}

describe('Puppeteer scripts (wrapper)', function() {
  this.timeout(240000);

  it('should run puppeteer.test.js', async function() {
    const res = await runScript(path.resolve(__dirname, 'puppeteer.test.js'), 'puppeteer');
    assert.strictEqual(res.code, 0, `puppeteer.test.js failed (see ${res.log})`);
  });

  it('should run puppeteer.handlers.test.js', async function() {
    const res = await runScript(path.resolve(__dirname, 'puppeteer.handlers.test.js'), 'handlers');
    assert.strictEqual(res.code, 0, `puppeteer.handlers.test.js failed (see ${res.log})`);
  });

  it('should run puppeteer.mesas.flow.test.js', async function() {
    const res = await runScript(path.resolve(__dirname, 'puppeteer.mesas.flow.test.js'), 'mesas-flow');
    assert.strictEqual(res.code, 0, `puppeteer.mesas.flow.test.js failed (see ${res.log})`);
  });
});
