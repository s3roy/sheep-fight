/**
 * Host-authoritative Surge WebSocket server.
 *
 *   npm run surge:server
 *   UI: http://localhost:5210/surge.html  (vite) → connects to :5211
 */
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { SurgeRoom } from '../src/surge/server/room';
import type { SurgeClientMsg } from '../src/surge/server/protocol';

const PORT = Number(process.env.SURGE_PORT ?? 5211);

type Sock = WebSocket & { playerId?: string };

const sockets = new Map<string, Sock>();

const room = new SurgeRoom({
  broadcast(msg) {
    const raw = JSON.stringify(msg);
    for (const ws of sockets.values()) {
      if (ws.readyState === ws.OPEN) ws.send(raw);
    }
  },
  send(playerId, msg) {
    const ws = sockets.get(playerId);
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  },
});

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...room.publicState() }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Surge WS server — connect via WebSocket\n');
});

const wss = new WebSocketServer({ server: http });

wss.on('connection', (ws: Sock) => {
  ws.on('message', (data) => {
    let msg: SurgeClientMsg;
    try {
      msg = JSON.parse(String(data)) as SurgeClientMsg;
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Bad JSON' }));
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (msg.type === 'hello') {
      if (ws.playerId) return;
      const p = room.join(msg.name);
      ws.playerId = p.id;
      sockets.set(p.id, ws);
      ws.send(
        JSON.stringify({
          type: 'welcome',
          playerId: p.id,
          balance: p.balance,
          state: room.publicState(),
        }),
      );
      return;
    }

    if (!ws.playerId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Say hello first' }));
      return;
    }

    if (msg.type === 'bet') {
      const r = room.placeBet(ws.playerId, Number(msg.stake), msg.autoAt ?? null);
      if (!r.ok) {
        ws.send(JSON.stringify({ type: 'bet_reject', reason: r.reason }));
      }
      return;
    }

    if (msg.type === 'cashout') {
      const r = room.cashout(ws.playerId);
      if (!r.ok) {
        ws.send(JSON.stringify({ type: 'cashout_reject', reason: r.reason }));
      }
      return;
    }
  });

  ws.on('close', () => {
    if (ws.playerId) {
      room.leave(ws.playerId);
      sockets.delete(ws.playerId);
    }
  });
});

room.start();
http.listen(PORT, () => {
  console.log(`[surge] WS listening on ws://127.0.0.1:${PORT}`);
});
