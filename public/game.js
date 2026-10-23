// Client Game Script
const socket = io();

// DOM Elements
const joinModal = document.getElementById('joinModal');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');
const colorButtons = document.querySelectorAll('.color-btn');
const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const gameContainer = document.getElementById('gameContainer');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const playerCountBadge = document.getElementById('playerCountBadge');
const myScoreDisplay = document.getElementById('myScoreDisplay');
const pingDisplay = document.getElementById('pingDisplay');
const leaderboardList = document.getElementById('leaderboardList');
const notificationBanner = document.getElementById('notificationBanner');

const chatFeed = document.getElementById('chatFeed');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const emoteButtons = document.querySelectorAll('.emote-btn');

// State
let myId = null;
let selectedColor = '#38bdf8';
let serverPlayers = {};
let renderPlayers = {};
let serverFoods = [];
let hasJoined = false;
let previousScore = 0;

// ==========================================
// 8-BIT RETRO AUDIO SYNTHESIZER (Web Audio API)
// ==========================================
let audioCtx = null;
let isSoundMuted = localStorage.getItem('blockArena_soundMuted') === 'true';

// Update sound toggle button visual
function updateSoundButtonUI() {
  if (soundToggleBtn) {
    soundToggleBtn.textContent = isSoundMuted ? '🔇 Sound OFF' : '🔊 Sound ON';
    soundToggleBtn.classList.toggle('muted', isSoundMuted);
  }
}
updateSoundButtonUI();

if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    initAudio();
    isSoundMuted = !isSoundMuted;
    localStorage.setItem('blockArena_soundMuted', isSoundMuted);
    updateSoundButtonUI();
    if (!isSoundMuted) playClickSound();
  });
}

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 8-bit Gem Pickup Chime (high arpeggio chime)
function playGemSound() {
  if (isSoundMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.setValueAtTime(880, now + 0.07); // A5

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

// Player Join Chime (rising welcoming chord)
function playJoinSound() {
  if (isSoundMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.06);

    gain.gain.setValueAtTime(0.12, now + idx * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + idx * 0.06);
    osc.stop(now + idx * 0.06 + 0.22);
  });
}

// Chat Pop Sound
function playChatSound() {
  if (isSoundMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(750, now + 0.06);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

// Soft UI Click Sound
function playClickSound() {
  if (isSoundMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

// ==========================================
// REMEMBER NICKNAME & COLOR FEATURE
// ==========================================
const savedRemember = localStorage.getItem('blockArena_remember');
const savedName = localStorage.getItem('blockArena_name');
const savedColor = localStorage.getItem('blockArena_color');

if (savedRemember === 'false') {
  if (rememberMeCheckbox) rememberMeCheckbox.checked = false;
} else {
  // Pre-fill saved name if user enabled remember
  if (savedName && nicknameInput) {
    nicknameInput.value = savedName;
  }
  // Pre-select saved color if present
  if (savedColor) {
    selectedColor = savedColor;
    colorButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.color === savedColor);
    });
  }
}

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// Color selection
colorButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    initAudio();
    playClickSound();
    colorButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedColor = btn.dataset.color;
  });
});

// Join Game action
function performJoin() {
  initAudio();
  playClickSound();

  const name = nicknameInput.value.trim() || 'Player';

  // Apply remember setting based on checkbox option
  if (rememberMeCheckbox && rememberMeCheckbox.checked) {
    localStorage.setItem('blockArena_remember', 'true');
    localStorage.setItem('blockArena_name', name);
    localStorage.setItem('blockArena_color', selectedColor);
  } else {
    localStorage.setItem('blockArena_remember', 'false');
    localStorage.removeItem('blockArena_name');
    localStorage.removeItem('blockArena_color');
  }

  socket.emit('join', {
    name: name,
    color: selectedColor,
  });
}

joinBtn.addEventListener('click', performJoin);
nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performJoin();
});

// Socket Acknowledge
socket.on('joined', (data) => {
  myId = data.selfId;
  hasJoined = true;
  joinModal.classList.add('hidden');
  gameContainer.classList.remove('hidden');
});

// Real-Time Game State from Server
socket.on('gameState', (data) => {
  serverPlayers = data.players || {};
  serverFoods = data.foods || [];

  // Update Player count
  const count = Object.keys(serverPlayers).length;
  playerCountBadge.textContent = `👤 ${count} Online`;

  // Update own score & play gem chime on point increase
  if (myId && serverPlayers[myId]) {
    const currentScore = serverPlayers[myId].score;
    if (currentScore > previousScore) {
      playGemSound();
      previousScore = currentScore;
    }
    myScoreDisplay.textContent = currentScore;
  }

  // Update Leaderboard
  updateLeaderboard();
});

// System Notifications (Join / Leave)
socket.on('playerNotification', (data) => {
  if (data && data.type === 'join') {
    playJoinSound();
  }
  showNotification(data.text);
});

function showNotification(text) {
  notificationBanner.textContent = text;
  notificationBanner.classList.add('show');
  setTimeout(() => {
    notificationBanner.classList.remove('show');
  }, 3500);
}

// Chat Messages
socket.on('chatMessage', (msg) => {
  playChatSound();
  const item = document.createElement('div');
  item.className = 'chat-msg';
  item.innerHTML = `<span class="sender" style="color: ${msg.color}">${escapeHtml(msg.sender)}:</span><span>${escapeHtml(msg.text)}</span>`;
  chatFeed.appendChild(item);
  chatFeed.scrollTop = chatFeed.scrollHeight;
});

// Send Chat Form
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text) {
    socket.emit('chat', { text });
    chatInput.value = '';
  }
});

// Quick Emotes
emoteButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    initAudio();
    playClickSound();
    const emoji = btn.dataset.emoji;
    socket.emit('chat', { text: emoji });
  });
});

// Leaderboard Display
function updateLeaderboard() {
  const sorted = Object.values(serverPlayers).sort((a, b) => b.score - a.score);
  leaderboardList.innerHTML = '';

  sorted.slice(0, 10).forEach((p, index) => {
    const li = document.createElement('li');
    li.className = `leaderboard-item ${p.id === myId ? 'self' : ''}`;
    li.innerHTML = `
      <div class="player-info">
        <span>#${index + 1}</span>
        <span class="color-dot" style="background-color: ${p.color};"></span>
        <span>${escapeHtml(p.name)}</span>
      </div>
      <span class="player-score">${p.score}</span>
    `;
    leaderboardList.appendChild(li);
  });
}

// Helper: Escape HTML to prevent injection
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Input Handlers (Keyboard)
function handleKey(code, isPressed) {
  let changed = false;
  if (code === 'KeyW' || code === 'ArrowUp') {
    if (keys.up !== isPressed) { keys.up = isPressed; changed = true; }
  }
  if (code === 'KeyS' || code === 'ArrowDown') {
    if (keys.down !== isPressed) { keys.down = isPressed; changed = true; }
  }
  if (code === 'KeyA' || code === 'ArrowLeft') {
    if (keys.left !== isPressed) { keys.left = isPressed; changed = true; }
  }
  if (code === 'KeyD' || code === 'ArrowRight') {
    if (keys.right !== isPressed) { keys.right = isPressed; changed = true; }
  }

  if (changed && hasJoined) {
    socket.emit('input', keys);
  }
}

window.addEventListener('keydown', (e) => {
  if (document.activeElement === chatInput) return; // don't move when typing chat
  handleKey(e.code, true);
});

window.addEventListener('keyup', (e) => {
  handleKey(e.code, false);
});

// Mobile Virtual D-Pad
const dButtons = document.querySelectorAll('.d-btn');
dButtons.forEach((btn) => {
  const dir = btn.dataset.key;
  const startAction = (e) => {
    e.preventDefault();
    keys[dir] = true;
    socket.emit('input', keys);
  };
  const endAction = (e) => {
    e.preventDefault();
    keys[dir] = false;
    socket.emit('input', keys);
  };

  btn.addEventListener('touchstart', startAction, { passive: false });
  btn.addEventListener('touchend', endAction, { passive: false });
  btn.addEventListener('mousedown', startAction);
  btn.addEventListener('mouseup', endAction);
  btn.addEventListener('mouseleave', endAction);
});

// Ping calculation
setInterval(() => {
  if (hasJoined) {
    socket.emit('pingCheck', Date.now());
  }
}, 3000);

socket.on('pongCheck', (sentTime) => {
  const ping = Date.now() - sentTime;
  pingDisplay.textContent = `📶 ${ping} ms`;
});

// Smooth Client-Side Render Loop (60 FPS with Linear Interpolation)
function render() {
  requestAnimationFrame(render);

  // Clear Canvas
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Arena Grid Lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw Collectible Food Items
  serverFoods.forEach((food) => {
    ctx.fillStyle = food.color;
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
    ctx.fill();

    // Subtle outer glow
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Interpolate and Draw Players
  for (const id in serverPlayers) {
    const target = serverPlayers[id];

    // Initialize render position if new
    if (!renderPlayers[id]) {
      renderPlayers[id] = { x: target.x, y: target.y };
    }

    // Smooth Lerp (0.35 factor for responsiveness)
    renderPlayers[id].x += (target.x - renderPlayers[id].x) * 0.35;
    renderPlayers[id].y += (target.y - renderPlayers[id].y) * 0.35;

    const rx = renderPlayers[id].x;
    const ry = renderPlayers[id].y;
    const size = target.size;

    // Draw Player Block (Rounded rectangle)
    ctx.fillStyle = target.color;
    drawRoundedRect(ctx, rx - size / 2, ry - size / 2, size, size, 8);

    // Self indicator glow
    if (id === myId) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      drawRoundedRectStroke(ctx, rx - size / 2, ry - size / 2, size, size, 8);
    }

    // Cute Player Face Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx - 5, ry - 3, 3, 0, Math.PI * 2);
    ctx.arc(rx + 5, ry - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(rx - 5, ry - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(rx + 5, ry - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw Nickname Label above player
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.name, rx, ry - size / 2 - 8);
  }

  // Clean up disconnected players from render cache
  for (const id in renderPlayers) {
    if (!serverPlayers[id]) {
      delete renderPlayers[id];
    }
  }
}

// Helper to draw rounded rectangle fill
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// Helper to draw rounded rectangle stroke
function drawRoundedRectStroke(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.stroke();
}

// Start render loop
render();
