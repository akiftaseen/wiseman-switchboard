import { request } from 'node:http';
import { duplexPair } from 'node:stream';

// Exercise Node's real HTTP parser and Express without binding a public or local port.
export function send(server, path, { method = 'GET', body, contentType = 'application/json', extraHeaders = {} } = {}) {
  const [client, peer] = duplexPair();
  server.emit('connection', peer);
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    if (payload !== undefined) {
      headers['Content-Type'] = contentType;
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = request({ path, method, headers, createConnection: () => client }, async res => {
      try {
        const chunks = [];
        for await (const chunk of res) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString();
        const data = res.headers['content-type']?.includes('application/json') ? JSON.parse(text) : text;
        resolve({ status: res.statusCode, headers: res.headers, data });
      } catch (error) { reject(error); }
      finally { client.destroy(); peer.destroy(); }
    });
    req.on('error', reject);
    req.end(payload);
  });
}
