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

// ==========================================
// ⚙️ BACKEND FEATURE TOGGLES (ON / OFF SWITCHES)
// ==========================================
// When TRUE: Blocks a user from opening 2 tabs in the same browser, and blocks duplicate names.
// When FALSE: Anyone can open multiple tabs (great for testing).
let PREVENT_MULTI_LOGIN = process.env.PREVENT_MULTI_LOGIN === 'true'; // Default: false
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Admin secret passcode

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

// ============================================================================
// PLOX 1v1 MULTIPLAYER SERVER STATE
// ============================================================================
const ploxQueue = []; // Array of { socketId, name }
const ploxRooms = new Map(); // roomId -> { id, players: [{ id, name, role }], status, code }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function handlePloxPlayerLeave(leavingSocket, roomId) {
  const room = ploxRooms.get(roomId);
  if (!room) return;

  leavingSocket.leave(roomId);
  if (room.status === 'playing') {
    const remaining = room.players.find(p => p.id !== leavingSocket.id);
    if (remaining) {
      io.to(roomId).emit('plox:gameOver', {
        winnerId: remaining.id,
        winnerName: remaining.name,
        reason: 'Opponent disconnected'
      });
    }
  }
  ploxRooms.delete(roomId);
}

io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket connected: ${socket.id}`);

  // When a player joins with their nickname and chosen color
  socket.on('join', (data) => {
    const rawName = (data && data.name) ? String(data.name).trim() : 'Player';
    const cleanName = rawName.substring(0, 15) || 'Guest';
    const playerColor = (data && data.color) ? String(data.color) : '#38bdf8';
    const deviceId = (data && data.deviceId) ? String(data.deviceId) : null;

    // Optional Check: Prevent multiple logins / tabs if feature is toggled ON
    if (PREVENT_MULTI_LOGIN) {
      // 1. Check if same browser device is already active in the game
      if (deviceId) {
        const isAlreadyPlaying = Object.values(players).some((p) => p.deviceId === deviceId);
        if (isAlreadyPlaying) {
          socket.emit('joinError', {
            message: '⚠️ Multi-tab is blocked: You already have this game running in another tab!',
          });
          return;
        }
      }

      // 2. Check if nickname is already taken by someone else
      const isNameTaken = Object.values(players).some(
        (p) => p.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (isNameTaken) {
        socket.emit('joinError', {
          message: `⚠️ The name "${cleanName}" is already taken! Please choose another name.`,
        });
        return;
      }
    }

    players[socket.id] = {
      id: socket.id,
      deviceId: deviceId,
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

    // Secret Admin Toggle Command: /admin toggle-multi
    // Allows you to turn Multi-Tab Blocking ON or OFF live in 1 second!
    if (text.toLowerCase().startsWith('/admin')) {
      const parts = text.split(' ');
      const command = parts[1] || '';
      const pass = parts[2] || '';

      // Check if command is toggle-multi (accepts "/admin toggle-multi" or with password)
      if (command.toLowerCase() === 'toggle-multi') {
        PREVENT_MULTI_LOGIN = !PREVENT_MULTI_LOGIN;
        console.log(`[CONFIG] PREVENT_MULTI_LOGIN is now: ${PREVENT_MULTI_LOGIN}`);
        
        io.emit('chatMessage', {
          sender: '🛡️ SERVER ADMIN',
          color: '#facc15',
          text: `Rule updated: Multi-tab login is now ${PREVENT_MULTI_LOGIN ? 'BLOCKED 🚫' : 'ALLOWED ✅'}!`,
          timestamp: Date.now(),
        });
        return;
      }
    }

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

  // ==========================================================================
  // PLOX 1v1 SOCKET EVENT HANDLERS
  // ==========================================================================
  // 1. Quick Match Queue
  socket.on('plox:joinQueue', ({ name }) => {
    const cleanName = (name || 'Player').trim().slice(0, 16) || 'Player';

    // Remove if already in queue
    const existingIdx = ploxQueue.findIndex((p) => p.socketId === socket.id);
    if (existingIdx !== -1) ploxQueue.splice(existingIdx, 1);

    if (ploxQueue.length > 0) {
      const opponent = ploxQueue.shift();
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);

      if (!opponentSocket) {
        ploxQueue.push({ socketId: socket.id, name: cleanName });
        socket.emit('plox:queueStatus', { status: 'searching' });
        return;
      }

      const roomId = `plox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const roomData = {
        id: roomId,
        code: null,
        status: 'playing',
        players: [
          { id: opponent.socketId, name: opponent.name, role: 'p1' },
          { id: socket.id, name: cleanName, role: 'p2' },
        ],
      };

      ploxRooms.set(roomId, roomData);
      opponentSocket.join(roomId);
      socket.join(roomId);

      opponentSocket.emit('plox:matchFound', {
        roomId,
        opponentName: cleanName,
        role: 'p1',
      });

      socket.emit('plox:matchFound', {
        roomId,
        opponentName: opponent.name,
        role: 'p2',
      });
    } else {
      ploxQueue.push({ socketId: socket.id, name: cleanName });
      socket.emit('plox:queueStatus', { status: 'searching' });
    }
  });

  socket.on('plox:leaveQueue', () => {
    const idx = ploxQueue.findIndex((p) => p.socketId === socket.id);
    if (idx !== -1) ploxQueue.splice(idx, 1);
    socket.emit('plox:queueStatus', { status: 'idle' });
  });

  // 2. Private Room Creation & Joining
  socket.on('plox:createPrivate', ({ name }) => {
    const cleanName = (name || 'Player').trim().slice(0, 16) || 'Player';
    let code = generateRoomCode();
    while ([...ploxRooms.values()].some((r) => r.code === code)) {
      code = generateRoomCode();
    }

    const roomId = `plox_priv_${code}`;
    ploxRooms.set(roomId, {
      id: roomId,
      code,
      status: 'waiting',
      players: [{ id: socket.id, name: cleanName, role: 'p1' }],
    });

    socket.join(roomId);
    socket.emit('plox:privateCreated', { roomId, code });
  });

  socket.on('plox:joinPrivate', ({ name, code }) => {
    const cleanName = (name || 'Player').trim().slice(0, 16) || 'Player';
    const cleanCode = (code || '').trim().toUpperCase();
    const room = [...ploxRooms.values()].find((r) => r.code === cleanCode && r.status === 'waiting');

    if (!room) {
      socket.emit('plox:error', { message: 'Room not found or already full.' });
      return;
    }

    if (room.players[0].id === socket.id) {
      socket.emit('plox:error', { message: 'You are already in this room.' });
      return;
    }

    const host = room.players[0];
    const hostSocket = io.sockets.sockets.get(host.id);
    if (!hostSocket) {
      ploxRooms.delete(room.id);
      socket.emit('plox:error', { message: 'Host disconnected.' });
      return;
    }

    room.players.push({ id: socket.id, name: cleanName, role: 'p2' });
    room.status = 'playing';
    socket.join(room.id);

    hostSocket.emit('plox:matchFound', {
      roomId: room.id,
      opponentName: cleanName,
      role: 'p1',
    });

    socket.emit('plox:matchFound', {
      roomId: room.id,
      opponentName: host.name,
      role: 'p2',
    });
  });

  // 3. Real-Time Gameplay Relays
  socket.on('plox:boardSync', ({ roomId, grid, score, combo, pendingJunk, currentPiece }) => {
    if (!roomId || !ploxRooms.has(roomId)) return;
    socket.to(roomId).emit('plox:boardSync', {
      grid,
      score,
      combo,
      pendingJunk,
      currentPiece,
    });
  });

  socket.on('plox:sendJunk', ({ roomId, count }) => {
    if (!roomId || !ploxRooms.has(roomId)) return;
    const validCount = Math.min(Math.max(parseInt(count, 10) || 0, 1), 18);
    socket.to(roomId).emit('plox:sendJunk', { count: validCount });
  });

  socket.on('plox:gameOver', ({ roomId, loserId }) => {
    if (!roomId || !ploxRooms.has(roomId)) return;
    const room = ploxRooms.get(roomId);
    if (room.status === 'ended') return;
    room.status = 'ended';

    const winner = room.players.find((p) => p.id !== (loserId || socket.id));
    const winnerId = winner ? winner.id : null;

    io.to(roomId).emit('plox:gameOver', {
      winnerId,
      winnerName: winner ? winner.name : 'Opponent',
    });

    ploxRooms.delete(roomId);
  });

  socket.on('plox:leaveRoom', ({ roomId }) => {
    handlePloxPlayerLeave(socket, roomId);
  });

  // Handle player disconnect (Block Arena & Plox)
  socket.on('disconnect', () => {
    // 1. Block Arena disconnect cleanup
    const player = players[socket.id];
    if (player) {
      console.log(`[LEAVE] ${player.name} left. (Remaining: ${Object.keys(players).length - 1})`);
      io.emit('playerNotification', {
        type: 'leave',
        text: `🔴 ${player.name} left the game`,
      });
      delete players[socket.id];
    }

    // 2. Plox queue & room disconnect cleanup
    const qIdx = ploxQueue.findIndex((p) => p.socketId === socket.id);
    if (qIdx !== -1) ploxQueue.splice(qIdx, 1);

    for (const [roomId, room] of ploxRooms.entries()) {
      if (room.players.some((p) => p.id === socket.id)) {
        handlePloxPlayerLeave(socket, roomId);
      }
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
