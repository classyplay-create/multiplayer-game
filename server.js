const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3000;
const MAP_WIDTH = 900;
const MAP_HEIGHT = 600;
const PLAYER_SIZE = 30;
const FOOD_COUNT = 30;

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Game State
const players = {};
let foods = [];

function createFood(id) {
  return {
    id: id !== undefined ? id : Math.random().toString(36).substring(2, 9),
    x: Math.floor(Math.random() * (MAP_WIDTH - 60)) + 30,
    y: Math.floor(Math.random() * (MAP_HEIGHT - 60)) + 30,
    size: 10,
    color: ['#facc15', '#38bdf8', '#4ade80', '#f43f5e', '#a855f7'][Math.floor(Math.random() * 5)],
  };
}

// Initialize food items
for (let i = 0; i < FOOD_COUNT; i++) {
  foods.push(createFood(i));
}

io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket connected: ${socket.id}`);

  // When a player joins with their nickname and chosen color
  socket.on('join', (data) => {
    const rawName = (data && data.name) ? String(data.name).trim() : 'Player';
    const cleanName = rawName.substring(0, 15) || 'Guest';
    const playerColor = (data && data.color) ? String(data.color) : '#38bdf8';

    players[socket.id] = {
      id: socket.id,
      name: cleanName,
      color: playerColor,
      x: Math.floor(Math.random() * (MAP_WIDTH - 100)) + 50,
      y: Math.floor(Math.random() * (MAP_HEIGHT - 100)) + 50,
      size: PLAYER_SIZE,
      score: 0,
      keys: { up: false, down: false, left: false, right: false },
    };

    console.log(`[JOIN] ${cleanName} entered the arena! (Total players: ${Object.keys(players).length})`);

    // Acknowledge join to the sender
    socket.emit('joined', {
      selfId: socket.id,
      map: { width: MAP_WIDTH, height: MAP_HEIGHT },
    });

    // Notify all players about the newcomer
    io.emit('playerNotification', {
      type: 'join',
      text: `🟢 ${cleanName} joined the game`,
    });
  });

  // Handle directional input state from client
  socket.on('input', (keys) => {
    if (players[socket.id] && keys) {
      players[socket.id].keys = {
        up: Boolean(keys.up),
        down: Boolean(keys.down),
        left: Boolean(keys.left),
        right: Boolean(keys.right),
      };
    }
  });

  // Handle chat & reaction emojis
  socket.on('chat', (messageData) => {
    const player = players[socket.id];
    if (!player) return;

    const text = String(messageData && messageData.text ? messageData.text : '').trim().substring(0, 80);
    if (!text) return;

    io.emit('chatMessage', {
      sender: player.name,
      color: player.color,
      text: text,
      timestamp: Date.now(),
    });
  });

  // Ping test
  socket.on('pingCheck', (clientTimestamp) => {
    socket.emit('pongCheck', clientTimestamp);
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    const player = players[socket.id];
    if (player) {
      console.log(`[LEAVE] ${player.name} left. (Remaining: ${Object.keys(players).length - 1})`);
      io.emit('playerNotification', {
        type: 'leave',
        text: `🔴 ${player.name} left the game`,
      });
      delete players[socket.id];
    }
  });
});

// Server Game Loop (30 Ticks / sec)
const TICK_RATE = 30;
const SPEED = 5;

setInterval(() => {
  // Update each player's position
  for (const id in players) {
    const p = players[id];
    if (!p) continue;

    if (p.keys.up) p.y -= SPEED;
    if (p.keys.down) p.y += SPEED;
    if (p.keys.left) p.x -= SPEED;
    if (p.keys.right) p.x += SPEED;

    // Arena boundary clamp
    const half = p.size / 2;
    if (p.x < half) p.x = half;
    if (p.x > MAP_WIDTH - half) p.x = MAP_WIDTH - half;
    if (p.y < half) p.y = half;
    if (p.y > MAP_HEIGHT - half) p.y = MAP_HEIGHT - half;

    // Check collision with collectible foods
    for (let i = 0; i < foods.length; i++) {
      const food = foods[i];
      const dist = Math.hypot(p.x - food.x, p.y - food.y);
      if (dist < half + food.size) {
        p.score += 10;
        // Respawn food item in new position
        foods[i] = createFood(food.id);
      }
    }
  }

  // Broadcast world snapshot to all connected clients
  io.emit('gameState', {
    players,
    foods,
  });
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Multiplayer Game Server is running!`);
  console.log(`👉 Open http://localhost:${PORT} in your browser`);
  console.log(`===============================================`);
});
