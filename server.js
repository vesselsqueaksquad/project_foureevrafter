const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const port = process.env.PORT || 3000;
const root = __dirname;
const sheet = { clients: new Set(), popped: new Set(), bubbles: new Map(), nextBubbleId: 1, gameOverUntil: 0 };

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(root, requested);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocket.Server({ server });

function broadcast(message) {
  for (const client of sheet.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  }
}

function peopleCount() {
  return sheet.clients.size;
}

function spawnBubble() {
  const bubble = {
    id: sheet.nextBubbleId++,
    x: Number((4 + Math.random() * 92).toFixed(2)),
    y: Number((8 + Math.random() * 82).toFixed(2)),
    size: Math.round(38 + Math.random() * 54),
    driftX: Math.round(-12 + Math.random() * 24),
    driftY: Math.round(-16 + Math.random() * 20),
    dangerous: Math.random() < 0.12,
    golden: false,
    expiresAt: Date.now() + 3260,
    poppers: new Set()
  };
  bubble.golden = !bubble.dangerous && Math.random() < (0.08 / 7);
  sheet.bubbles.set(bubble.id, bubble);
  broadcast({ type: 'bubble', ...publicBubble(bubble) });
  setTimeout(() => sheet.bubbles.delete(bubble.id), 3260);
}

function publicBubble(bubble) {
  const { poppers, ...data } = bubble;
  return data;
}

function sendGameOver() {
  const duration = 5000;
  sheet.gameOverUntil = Date.now() + duration;
  broadcast({ type: 'game-over', remaining: duration });
  setTimeout(() => {
    if (Date.now() >= sheet.gameOverUntil) sheet.gameOverUntil = 0;
  }, duration);
}

wss.on('connection', (socket) => {
  sheet.clients.add(socket);
  socket.send(JSON.stringify({
    type: 'state',
    popped: [...sheet.popped],
    bubbles: [...sheet.bubbles.values()].map(publicBubble),
    count: peopleCount(),
    gameOverRemaining: Math.max(0, sheet.gameOverUntil - Date.now())
  }));
  broadcast({ type: 'presence', count: peopleCount() });

  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }

    if (message.type === 'pop' && Number.isInteger(message.id)) {
      if (Date.now() < sheet.gameOverUntil) return;
      const bubble = sheet.bubbles.get(message.id);
      if (!bubble || bubble.expiresAt <= Date.now()) return;
      if (bubble.poppers.has(socket)) return;
      bubble.poppers.add(socket);
      if (bubble.dangerous) return;
      if (bubble.poppers.size >= 2) sendGameOver();
    }
    if (message.type === 'reset') {
      sheet.popped.clear();
      broadcast({ type: 'reset' });
    }
  });

  socket.on('close', () => {
    sheet.clients.delete(socket);
    broadcast({ type: 'presence', count: peopleCount() });
  });
});

server.listen(port, () => console.log(`Pop Together running at http://localhost:${port}`));

setInterval(spawnBubble, 620);
