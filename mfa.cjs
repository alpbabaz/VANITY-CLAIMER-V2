const fs = require('fs');
const tls = require('tls');
const http2 = require('http2');
const { Buffer } = require('buffer');

const TOKEN ="token";
const PASSWORD ="şifre"

const HEADERS = {
  'user-agent': '0',
  'content-type': 'application/json',
  'x-super-properties': 'eyJicm93c2VyIjoiRmlyZWZveCIsImJyb3dzZXJfdXNlcl9hZ2VudCI6IkZpcmVmb3gifQ=='
};

class MFAClient {
  constructor() {
    this.session = null;
    this.connectPromise = null;
    this.createSession();
  }

  createSession() {
    this.connectPromise = new Promise((resolve) => {
      this.session = http2.connect('https://canary.discord.com', {
        secureContext: tls.createSecureContext({
          ciphers: 'ECDHE-RSA-AES128-GCM-SHA256'
        })
      });

      this.session.on('connect', resolve);
      this.session.on('close', () => setTimeout(() => this.createSession(), 3000));
      this.session.on('error', () => {});
    });
  }

  async wait() {
    if (this.connectPromise) await this.connectPromise;
  }

  request(method, path, headers, body) {
    return new Promise((resolve) => {
      const req = this.session.request({
        ':method': method,
        ':path': path,
        ':authority': 'canary.discord.com',
        ...HEADERS,
        ...headers
      });

      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.end(body);
    });
  }

  async get(token, password) {
    await this.wait();
    const auth = { Authorization: token };

    const r1 = await this.request(
      'PATCH', '/api/guilds/0/vanity-url',
      auth,
      JSON.stringify({ code: '' })
    );

    const j1 = JSON.parse(r1);
    if (j1.code !== 60003 || !j1.mfa?.ticket) return null;

    const r2 = await this.request(
      'POST', '/api/mfa/finish',
      auth,
      JSON.stringify({
        ticket: j1.mfa.ticket,
        mfa_type: 'password',
        data: password
      })
    );

    const j2 = JSON.parse(r2);
    return j2.token || null;
  }
}

function time() {
  return new Date().toLocaleTimeString('tr-TR', { hour12: false });
}

function saveToken(token) {
  fs.writeFileSync('mfa.txt', token.trim(), 'utf8');
  console.log(`[${time()}] mfa aldim`);
}

async function main() {
  const mfaClient = new MFAClient();

  async function refresh() {
    const token = await mfaClient.get(TOKEN, PASSWORD);
    if (token) saveToken(token);
  }

  await refresh();
  setInterval(refresh, 300000);
}

main();