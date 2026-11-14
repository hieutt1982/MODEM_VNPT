const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const UPSTREAM = 'https://api-onebss.vnpt.vn';
const MODEM_TOKEN_KEY = 'FVcLoGQybQAkTn3qR1WcEVAiLCOHxwEp';
const MODEM_TOKEN_ID = 'SDK_TECH';

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.txt':'text/plain; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.ico':'image/x-icon'
};

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body quá lớn'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function requestUpstream(method, targetPath, headers={}, body=null) {
  return new Promise((resolve, reject) => {
    const u = new URL(UPSTREAM + targetPath);
    const h = {
      'Accept': headers.accept || 'application/json',
      'User-Agent': 'Dart/3.10 (dart:io)',
      ...headers,
      'Host': u.host
    };
    delete h.host;
    delete h.Host;

    if (body != null) {
      h['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: h,
      timeout: 45000
    }, r => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', c => data += c);
      r.on('end', () => resolve({
        status: r.statusCode || 500,
        headers: r.headers,
        text: data
      }));
    });

    req.on('timeout', () => req.destroy(new Error('Upstream timeout')));
    req.on('error', reject);

    if (body != null) req.write(body);
    req.end();
  });
}

async function proxyJson(req, res, targetPath, extraHeaders={}) {
  try {
    const body = await readBody(req);
    const headers = {
      'content-type': req.headers['content-type'] || 'application/json',
      ...extraHeaders
    };
    const r = await requestUpstream(req.method, targetPath, headers, body || null);
    let parsed;
    try { parsed = JSON.parse(r.text); } catch { parsed = r.text; }
    send(res, r.status, parsed);
  } catch (e) {
    send(res, 502, { error: 'UPSTREAM_ERROR', message: e.message });
  }
}

async function proxyGet(req, res, targetPath, headers={}) {
  try {
    const r = await requestUpstream('GET', targetPath, headers, null);
    let parsed;
    try { parsed = JSON.parse(r.text); } catch { parsed = { errorMessage: r.text }; }
    send(res, r.status, parsed);
  } catch (e) {
    send(res, 502, { error: 'UPSTREAM_ERROR', message: e.message });
  }
}

function modemHeaders() {
  return {
    'accept': 'application/json',
    'content-type': 'application/json',
    'token-key': MODEM_TOKEN_KEY,
    'token-id': MODEM_TOKEN_ID
  };
}

async function routeApi(req, res, url) {
  const p = url.pathname;

  // OneBSS login step 1
  if (p === '/api/auth/step1' && req.method === 'POST') {
    return proxyJson(req, res,
      '/quantri/user/xacthuc_tapdoan_v2',
      {'User-Agent':'Dart/3.10 (dart:io)'});
  }

  // OneBSS OTP/token
  if (p === '/api/auth/step2' && req.method === 'POST') {
    return proxyJson(req, res,
      '/quantri/oauth/token',
      {'User-Agent':'Dart/3.10 (dart:io)'});
  }

  // Login audit log. This replaces google.script.run.nhat_ky().
  if (p === '/api/log-login' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const data = JSON.parse(raw || '{}');
      const line = JSON.stringify({
        time: new Date().toISOString(),
        app: data.app || 'MODEM',
        username: data.username || ''
      }) + '\n';
      fs.appendFileSync(path.join(__dirname, 'login_log.jsonl'), line, 'utf8');
      return send(res, 200, {ok:true});
    } catch (e) {
      return send(res, 400, {ok:false, message:e.message});
    }
  }

  // Modem GET:
  // browser: /api/modem/getDeviceInfo?serialNumber=...
  // server:  https://api-onebss.vnpt.vn/esbx/onelink/getDeviceInfo?...
  if (p.startsWith('/api/modem/') && req.method === 'GET') {
    const sub = p.slice('/api/modem'.length);
    const qs = url.search || '';
    return proxyGet(req, res, '/esbx/onelink' + sub + qs, modemHeaders());
  }

  // Modem POST deviceConfig
  if (p === '/api/modem/deviceConfig' && req.method === 'POST') {
    return proxyJson(req, res, '/esbx/onelink/deviceConfig', modemHeaders());
  }

  // Thi công lookup: browser supplies Authorization/app-secret generated by existing JS.
  if (p === '/api/thicong/dsVatTuThiCong' && req.method === 'POST') {
    const auth = req.headers.authorization || '';
    const selected = req.headers.selectedmenuid || '11226';
    const appSecret = req.headers['app-secret'] || '';
    const qs = url.search || '';
    return proxyJson(req, res,
      '/app-thicong/thiCong/traCuuThiCong/dsVatTuThiCong' + qs,
      {
        'accept':'application/json',
        'content-type':'application/json',
        'authorization':auth,
        'selectedmenuid':selected,
        'app-secret':appSecret
      });
  }

  return false;
}

function serveFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/')) {
      const handled = await routeApi(req, res, url);
      if (handled !== false) return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, {error:'METHOD_NOT_ALLOWED'});
    }

    let filePath;
    if (url.pathname === '/' || url.pathname === '/index.html') {
      filePath = path.join(__dirname, 'index.html');
    } else if (url.pathname === '/main.js') {
      filePath = path.join(__dirname, 'main.js');
    } else {
      const clean = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      // Only serve local files; prevent ../ traversal.
      const candidate = path.resolve(__dirname, clean);
      if (!candidate.startsWith(path.resolve(__dirname) + path.sep)) {
        return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
      }
      filePath = candidate;
    }

    serveFile(res, filePath);
  } catch (e) {
    send(res, 500, {error:'SERVER_ERROR', message:e.message});
  }
});

// When embedded by NS_MULTI, launcher.js owns the public HTTP port.
// When run directly, OneLink keeps its original standalone behaviour.
if (!process.env.NS_EMBED) {
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('==============================================');
    console.log(' OneLink Config Modem - Node.js / Android');
    console.log(` http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
    console.log(` LAN: http://<IP-Android>:${PORT}`);
    console.log('==============================================');
  });
}

module.exports = { server };
