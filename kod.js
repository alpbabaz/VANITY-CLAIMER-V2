import http2 from 'http2';
import WebSocket from 'ws';
import fs from 'fs';
import { connect } from 'net';
import { connect as tlsConnect } from 'tls';

const TOKEN = 'token';
const GUILD_ID = 'sw id';
const SESSIONS = 2;

let mfa = '', sniped = false;
const targets = new Map();
const sockets = new Array(SESSIONS).fill(null);

const B = Buffer.from;
const NOOP = () => {};

const U_BUF = B('"t":"GUILD_UPDATE"');
const R_BUF = B('"t":"READY"');
const H_BUF = B('"op":10');
const HB_REQ = B('"op":1,');
const ID_KEY = B('"id":"');
const VANITY_KEY = B('"vanity_url_code":"');

const IDENTIFY = `{"op":2,"d":{"token":"${TOKEN}","intents":1,"properties":{"os":"Windows","browser":"Chrome"}}}`;
const HEARTBEAT = '{"op":1,"d":null}';

const buildReq = c => ({
    headers: {
        ':method': 'PATCH',
        ':authority': 'canary.discord.com',
        ':path': `/api/v10/guilds/${GUILD_ID}/vanity-url`,
        'authorization': TOKEN,
        'x-discord-mfa-authorization': mfa,
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36',
        'x-super-properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEzMi4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTMyIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVsZWFzZV9jaGFubmVsIjoic3RhYmxlIiwiY2xpZW50X2J1aWxkX251bWJlciI6MzQ1Njc4fQ=='
    },
    body: `{"code":"${c}"}`
});

const loadMfa = () => {
    try {
        const f = fs.readFileSync('mfa.txt', 'utf8').trim();
        if (f && f !== mfa) { 
            mfa = f; 
            for (const t of targets.values()) t.req = buildReq(t.c); 
        }
    } catch {}
};
loadMfa();
fs.watchFile('mfa.txt', { interval: 1000 }, loadMfa);

const createClient = i => {
    if (sockets[i]) {
        if (!sockets[i].destroyed) sockets[i].destroy();
        sockets[i] = null;
    }

    const client = http2.connect('https://canary.discord.com', {
        settings: {
            enablePush: false,
            initialWindowSize: 2147483647,
            maxConcurrentStreams: 4294967295
        },
        peerMaxConcurrentStreams: 4294967295,
        maxSessionMemory: 8388608,
        createConnection: () => {
            const socket = connect({
                host: '162.159.135.232',
                port: 443,
                noDelay: true,
                keepAlive: true
            });
            socket.setNoDelay(true);
            return tlsConnect({
                socket,
                servername: 'canary.discord.com',
                ALPNProtocols: ['h2'],
                rejectUnauthorized: false
            });
        }
    });
    
    client.on('connect', () => {
        sockets[i] = client;
        const req = client.request({ ':method': 'OPTIONS', ':path': '/' });
        req.on('data', NOOP);
        req.on('error', NOOP);
        req.end();
    });

    const reconnect = () => {
        if (sockets[i] === client) sockets[i] = null;
        if (!client.destroyed) client.destroy();
        setTimeout(() => createClient(i), 100);
    };

    client.on('close', reconnect);
    client.on('error', reconnect);
    client.on('goaway', reconnect);
};
for (let i = 0; i < SESSIONS; i++) createClient(i);

setInterval(() => { 
    for (let i = 0; i < SESSIONS; i++) {
        const s = sockets[i];
        if (s && !s.closed && !s.destroyed) {
            try { s.ping(null, NOOP); } catch { s.destroy(); }
        }
    }
}, 15000);

const connectGw = () => {
    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json', {
        perMessageDeflate: false,
        rejectUnauthorized: false,
        skipUTF8Validation: true,
        followRedirects: false
    });

    console.log("ölünüzü dirinizi hergün birinizi");
    if (ws._socket) {
        ws._socket.setNoDelay(true);
        ws._socket.setKeepAlive(true, 0);
        ws._socket.setTimeout(0);
    }
    let isReconnecting = false;

    const reconnect = () => {
        if (isReconnecting) return;
        isReconnecting = true;
        ws.terminate();
        setTimeout(connectGw, 100);
    };

    ws.on('message', d => {
        if (d.includes(U_BUF)) {
            const idIdx = d.indexOf(ID_KEY);
            if (idIdx === -1) return;
            const endId = d.indexOf(34, idIdx + 6);
            if (endId === -1) return;
            
            const id = d.toString('utf8', idIdx + 6, endId);
            const t = targets.get(id);
            if (!t) return;

            const vIdx = d.indexOf(VANITY_KEY);
            let vanityMatch = false;
            
            if (vIdx !== -1) {
                const endV = d.indexOf(34, vIdx + 19);
                if (endV !== -1) vanityMatch = d.subarray(vIdx + 19, endV).equals(t.cBuf);
            }

            if (!vanityMatch) {
                for (let j = 0; j < SESSIONS; j++) {
                    const s = sockets[j];
                    if (s && !s.closed && !s.destroyed) {
                        try {
                            const req = s.request(t.req.headers);
                            req.end(t.req.body);
                            req.on('response', headers => {
                                let data = '';
                                req.on('data', chunk => data += chunk);
                                req.on('end', () => console.log(`Result for ${t.c} [${headers[':status']}]: ${data}`));
                            });
                            req.on('error', NOOP);
                        } catch {}
                    }
                }
                if (!sniped) sniped = true;
            }
        } else if (d.includes(R_BUF)) {
            targets.clear();
            const guilds = JSON.parse(d).d.guilds;
            if (guilds) {
                for (let i = 0; i < guilds.length; i++) {
                    const g = guilds[i];
                    if (g.vanity_url_code) {
                        targets.set(g.id, { 
                            c: g.vanity_url_code, 
                            cBuf: B(g.vanity_url_code), 
                            req: buildReq(g.vanity_url_code) 
                        });
                        console.log(`\x1b[37m{ server: '\x1b[32m${g.id}\x1b[37m', vanity: '\x1b[32m${g.vanity_url_code}\x1b[37m' },\x1b[0m`);
                    }
                }
            }
        } else if (d.includes(H_BUF)) {
            ws.send(IDENTIFY);
            ws.send(HEARTBEAT);
        } else if (d.includes(HB_REQ)) {
            ws.send(HEARTBEAT);
        }
    });

    ws.on('close', reconnect);
    ws.on('error', reconnect);
    ws.on('unexpected-response', reconnect);
};
connectGw();