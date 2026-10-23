(() => {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const COLS = 6;
  const ROWS = 13; // Row 0 is hidden spawn ceiling; Rows 1..12 are visible
  const VISIBLE_ROWS = 12;
  const CELL_SIZE = 48; // 6 * 48 = 288px width, 12 * 48 = 576px height
  const OPP_CELL_SIZE = 30; // 6 * 30 = 180px width, 12 * 30 = 360px height

  const GEMS = [
    { id: 'ruby', color: '#ef4444', highlight: '#fca5a5', border: '#991b1b', shape: 'diamond' },
    { id: 'sapphire', color: '#3b82f6', highlight: '#93c5fd', border: '#1e40af', shape: 'circle' },
    { id: 'emerald', color: '#10b981', highlight: '#6ee7b7', border: '#065f46', shape: 'octagon' },
    { id: 'amber', color: '#f59e0b', highlight: '#fde68a', border: '#92400e', shape: 'triangle' },
    { id: 'amethyst', color: '#a855f7', highlight: '#d8b4fe', border: '#581c87', shape: 'star' }
  ];

  const JUNK_GEM = {
    id: 'junk',
    color: '#64748b',
    highlight: '#94a3b8',
    border: '#334155',
    shape: 'junk'
  };

  const DIRECTIONS = [
    { dr: 0, dc: 1 },  // Horizontal
    { dr: 1, dc: 0 },  // Vertical
    { dr: 1, dc: 1 },  // Diagonal Down-Right (\)
    { dr: -1, dc: 1 }  // Diagonal Up-Right (/)
  ];

  // ==========================================================================
  // 2. WEB AUDIO SYNTHESIZER (8-BIT BGM & RETRO SFX)
  // ==========================================================================
  class PloxAudioEngine {
    constructor() {
      this.ctx = null;
      this.musicEnabled = true;
      this.sfxEnabled = true;
      this.isPlayingBgm = false;
      this.dangerMode = false;
      this.stepIndex = 0;
      this.bgmTimer = null;

      // Upbeat minor-key arcade arpeggio sequence (MIDI frequencies)
      this.melodyNotes = [
        220.00, 261.63, 329.63, 440.00, 392.00, 329.63, 293.66, 261.63,
        246.94, 293.66, 349.23, 493.88, 440.00, 349.23, 329.63, 246.94
      ];
      this.bassNotes = [
        110.00, 110.00, 130.81, 130.81, 146.83, 146.83, 123.47, 130.81
      ];
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type, duration, gainVal = 0.08, slideFreq = null) {
      if (!this.sfxEnabled || !this.ctx) return;
      this.init();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, now + duration);
      }

      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    sfxMove() {
      this.playTone(300, 'triangle', 0.045, 0.06, 360);
    }

    sfxRotate() {
      this.playTone(480, 'sine', 0.065, 0.08, 680);
    }

    sfxLock() {
      this.playTone(150, 'square', 0.08, 0.07, 90);
    }

    sfxHardDrop() {
      this.playTone(240, 'sawtooth', 0.12, 0.09, 75);
    }

    sfxMatch(chainLevel) {
      const baseFreq = 330 * Math.pow(1.15, Math.min(chainLevel, 8));
      this.playTone(baseFreq, 'square', 0.14, 0.09, baseFreq * 1.35);
      setTimeout(() => {
        this.playTone(baseFreq * 1.5, 'triangle', 0.18, 0.09, baseFreq * 2);
      }, 65);
    }

    sfxJunkDrop() {
      this.playTone(115, 'sawtooth', 0.22, 0.12, 55);
    }

    sfxVictory() {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((n, idx) => {
        setTimeout(() => this.playTone(n, 'square', 0.18, 0.1), idx * 110);
      });
    }

    sfxGameOver() {
      const notes = [392.00, 349.23, 311.13, 261.63];
      notes.forEach((n, idx) => {
        setTimeout(() => this.playTone(n, 'sawtooth', 0.24, 0.1), idx * 140);
      });
    }

    startBgm() {
      this.init();
      this.isPlayingBgm = true;
      if (this.bgmTimer) clearTimeout(this.bgmTimer);
      this.scheduleNextStep();
    }

    stopBgm() {
      this.isPlayingBgm = false;
      if (this.bgmTimer) {
        clearTimeout(this.bgmTimer);
        this.bgmTimer = null;
      }
    }

    scheduleNextStep() {
      if (!this.isPlayingBgm) return;

      if (this.musicEnabled && this.ctx && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        const melFreq = this.melodyNotes[this.stepIndex % this.melodyNotes.length];
        const bassFreq = this.bassNotes[Math.floor(this.stepIndex / 2) % this.bassNotes.length];
        const pitchShift = this.dangerMode ? 1.12 : 1.0;

        // Lead square wave
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(melFreq * pitchShift, now);
        gain1.gain.setValueAtTime(0.032, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.14);

        // Bass triangle wave on even steps
        if (this.stepIndex % 2 === 0) {
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(bassFreq * pitchShift, now);
          gain2.gain.setValueAtTime(0.05, now);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc2.connect(gain2);
          gain2.connect(this.ctx.destination);
          osc2.start(now);
          osc2.stop(now + 0.23);
        }

        this.stepIndex++;
      }

      const tempoMs = this.dangerMode ? 125 : 175;
      this.bgmTimer = setTimeout(() => this.scheduleNextStep(), tempoMs);
    }
  }

  const audio = new PloxAudioEngine();

  // ==========================================================================
  // 3. DOM ELEMENTS & STATE
  // ==========================================================================
  const playerCanvas = document.getElementById('playerCanvas');
  const playerCtx = playerCanvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx = nextCanvas.getContext('2d');
  const opponentCanvas = document.getElementById('opponentCanvas');
  const oppCtx = opponentCanvas.getContext('2d');

  const scoreEl = document.getElementById('playerScore');
  const levelEl = document.getElementById('playerLevel');
  const chainEl = document.getElementById('playerChain');
  const junkTrayEl = document.getElementById('playerJunkTray');
  const boardWrapperEl = document.getElementById('playerBoardWrapper');
  const comboBannerEl = document.getElementById('comboBanner');
  const countdownOverlayEl = document.getElementById('countdownOverlay');
  const countdownTextEl = document.getElementById('countdownText');

  const localPlayerNameEl = document.getElementById('localPlayerName');
  const opponentNameEl = document.getElementById('opponentName');
  const matchBadgeEl = document.getElementById('matchBadge');
  const soloOverlayMsgEl = document.getElementById('soloOverlayMsg');
  const opponentJunkCountEl = document.getElementById('opponentJunkCount');
  const opponentScoreEl = document.getElementById('opponentScore');
  const opponentComboEl = document.getElementById('opponentCombo');

  const lobbyModal = document.getElementById('lobbyModal');
  const gameOverModal = document.getElementById('gameOverModal');
  const playerNameInput = document.getElementById('playerNameInput');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const lobbyStatusBox = document.getElementById('lobbyStatusBox');
  const lobbyStatusText = document.getElementById('lobbyStatusText');
  const lobbyErrorMsg = document.getElementById('lobbyErrorMsg');

  // Pre-fill pilot handle from URL params or shared portal localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const sharedPilot = urlParams.get('name') || localStorage.getItem('arcade_pilot_name') || localStorage.getItem('blockArena_name');
  if (sharedPilot && playerNameInput) {
    playerNameInput.value = sharedPilot;
  }

  const btnMusicToggle = document.getElementById('btnMusicToggle');
  const btnSfxToggle = document.getElementById('btnSfxToggle');

  // Socket connection
  const socket = typeof io !== 'undefined' ? io() : null;

  // Game State
  let gameMode = 'solo'; // 'solo' | 'multi'
  let currentRoomId = null;
  let isRunning = false;
  let isResolving = false; // True while popping/cascading matches
  let grid = createEmptyGrid();
  let currentPiece = null;
  let nextColors = [];

  let score = 0;
  let level = 1;
  let linesCleared = 0;
  let currentChain = 0;
  let maxChain = 0;
  let pendingJunk = 0;

  let dropCounter = 0;
  let lastFrameTime = 0;
  let lastSyncTime = 0;
  let popAnimations = []; // { r, c, color, alpha, radius }

  // Opponent live state
  let opponentState = {
    grid: createEmptyGrid(),
    score: 0,
    combo: 0,
    pendingJunk: 0,
    currentPiece: null
  };

  // ==========================================================================
  // 4. GRID & PIECE HELPERS
  // ==========================================================================
  function createEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomGemColor() {
    const idx = Math.floor(Math.random() * GEMS.length);
    return GEMS[idx].color;
  }

  function generateTriplet() {
    return [randomGemColor(), randomGemColor(), randomGemColor()];
  }

  function getGemMeta(colorHex) {
    if (colorHex === JUNK_GEM.color) return JUNK_GEM;
    return GEMS.find(g => g.color === colorHex) || GEMS[0];
  }

  function spawnNextPiece() {
    if (nextColors.length === 0) {
      nextColors = generateTriplet();
    }

    currentPiece = {
      col: 2,
      row: 0, // Bottom block starts at row 0, middle at -1, top at -2
      colors: [...nextColors] // [top, middle, bottom]
    };

    nextColors = generateTriplet();
    drawNextPiece();

    // Check immediate collision at spawn
    if (!canMoveTo(currentPiece.col, currentPiece.row + 1) && grid[1][currentPiece.col] !== null) {
      triggerLocalTopOut();
    }
  }

  function canMoveTo(targetCol, targetBottomRow) {
    if (targetCol < 0 || targetCol >= COLS) return false;
    if (targetBottomRow >= ROWS) return false;

    // Check all 3 vertical blocks of the triplet (bottom = r, mid = r-1, top = r-2)
    for (let i = 0; i < 3; i++) {
      const r = targetBottomRow - i;
      if (r >= 0 && r < ROWS) {
        if (grid[r][targetCol] !== null) return false;
      }
    }
    return true;
  }

  function getGhostBottomRow() {
    if (!currentPiece) return 0;
    let testRow = currentPiece.row;
    while (canMoveTo(currentPiece.col, testRow + 1)) {
      testRow++;
    }
    return testRow;
  }

  // ==========================================================================
  // 5. PLAYER MOVEMENT & ROTATION
  // ==========================================================================
  function moveHorizontal(dir) {
    if (!isRunning || isResolving || !currentPiece) return;
    const nextCol = currentPiece.col + dir;
    if (canMoveTo(nextCol, currentPiece.row)) {
      currentPiece.col = nextCol;
      audio.sfxMove();
    }
  }

  function rotateTriplet() {
    if (!isRunning || isResolving || !currentPiece) return;
    // Cycle colors downward: [Top, Middle, Bottom] -> [Bottom, Top, Middle]
    const [top, mid, bot] = currentPiece.colors;
    currentPiece.colors = [bot, top, mid];
    audio.sfxRotate();
  }

  function softDrop() {
    if (!isRunning || isResolving || !currentPiece) return;
    if (canMoveTo(currentPiece.col, currentPiece.row + 1)) {
      currentPiece.row++;
      score += 1;
      updateHud();
      dropCounter = 0;
    } else {
      lockPieceAndResolve();
    }
  }

  function hardDrop() {
    if (!isRunning || isResolving || !currentPiece) return;
    const ghostRow = getGhostBottomRow();
    const cellsDropped = Math.max(0, ghostRow - currentPiece.row);
    currentPiece.row = ghostRow;
    score += cellsDropped * 2;
    updateHud();
    audio.sfxHardDrop();
    lockPieceAndResolve();
  }

  // ==========================================================================
  // 6. MATCH-3 CASCADE ENGINE & JUNK PHYSICS
  // ==========================================================================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function lockPieceAndResolve() {
    if (!currentPiece || isResolving) return;
    isResolving = true;

    const { col, row, colors } = currentPiece;
    // colors[2] is bottom, colors[1] is middle, colors[0] is top
    const positions = [
      { r: row, color: colors[2] },
      { r: row - 1, color: colors[1] },
      { r: row - 2, color: colors[0] }
    ];

    for (const pos of positions) {
      if (pos.r >= 0 && pos.r < ROWS) {
        grid[pos.r][col] = pos.color;
      }
    }

    currentPiece = null;
    audio.sfxLock();

    // Cascade loop
    let chainCount = 0;
    let totalAttackJunk = 0;

    while (true) {
      const matchedCoords = findMatchesOnBoard();
      if (matchedCoords.length === 0) break;

      chainCount++;
      currentChain = chainCount;
      if (chainCount > maxChain) maxChain = chainCount;

      // Calculate score & junk attack
      const clearedCount = matchedCoords.length;
      linesCleared += clearedCount;
      level = Math.min(15, 1 + Math.floor(linesCleared / 18));

      const chainMultiplier = Math.pow(2, chainCount - 1);
      score += clearedCount * 50 * chainMultiplier;

      // Junk calculation: Combos x2+ or single clears >= 4 gems generate junk
      let stepJunk = 0;
      if (chainCount >= 2) stepJunk += chainCount;
      if (clearedCount >= 4) stepJunk += Math.floor((clearedCount - 2) / 2);
      totalAttackJunk += stepJunk;

      audio.sfxMatch(chainCount);
      if (chainCount >= 2 || clearedCount >= 4) {
        showComboCallout(chainCount, stepJunk);
      }
      updateHud();

      // Animate matched gems popping
      popAnimations = matchedCoords.map(({ r, c }) => ({
        r,
        c,
        color: grid[r][c] || '#ffffff',
        progress: 0
      }));

      await animatePopEffect(210);
      popAnimations = [];

      // Clear matched cells
      for (const { r, c } of matchedCoords) {
        grid[r][c] = null;
      }

      // Apply column gravity
      applyBoardGravity();
      broadcastBoardSnapshot();

      await sleep(140);
    }

    // Send accumulated junk to opponent (or offset own pending junk first)
    if (totalAttackJunk > 0 && gameMode === 'multi' && currentRoomId) {
      if (pendingJunk > 0) {
        const canceled = Math.min(pendingJunk, totalAttackJunk);
        pendingJunk -= canceled;
        totalAttackJunk -= canceled;
        renderJunkTray();
      }
      if (totalAttackJunk > 0 && socket) {
        socket.emit('plox:sendJunk', { roomId: currentRoomId, count: totalAttackJunk });
      }
    }

    // Drop incoming pending junk onto our board if any remains
    if (pendingJunk > 0) {
      await dropPendingJunkBlocks();
    }

    currentChain = 0;
    updateHud();
    checkDangerState();

    // Check top-out condition (Row 0 ceiling occupied)
    if (isTopRowBreached()) {
      isResolving = false;
      triggerLocalTopOut();
      return;
    }

    isResolving = false;
    spawnNextPiece();
    broadcastBoardSnapshot();
  }

  function findMatchesOnBoard() {
    const matchedSet = new Set();

    for (let r = 1; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = grid[r][c];
        // Junk blocks do not match with each other; they only clear via adjacent gem pops
        if (!color || color === JUNK_GEM.color) continue;

        for (const { dr, dc } of DIRECTIONS) {
          const line = [{ r, c }];
          let nr = r + dr;
          let nc = c + dc;

          while (
            nr >= 1 &&
            nr < ROWS &&
            nc >= 0 &&
            nc < COLS &&
            grid[nr][nc] === color
          ) {
            line.push({ r: nr, c: nc });
            nr += dr;
            nc += dc;
          }

          if (line.length >= 3) {
            for (const cell of line) {
              matchedSet.add(`${cell.r},${cell.c}`);
              // Also shatter orthogonal adjacent grey junk blocks
              const neighbors = [
                { r: cell.r - 1, c: cell.c },
                { r: cell.r + 1, c: cell.c },
                { r: cell.r, c: cell.c - 1 },
                { r: cell.r, c: cell.c + 1 }
              ];
              for (const nb of neighbors) {
                if (
                  nb.r >= 1 &&
                  nb.r < ROWS &&
                  nb.c >= 0 &&
                  nb.c < COLS &&
                  grid[nb.r][nb.c] === JUNK_GEM.color
                ) {
                  matchedSet.add(`${nb.r},${nb.c}`);
                }
              }
            }
          }
        }
      }
    }

    return Array.from(matchedSet).map(str => {
      const [r, c] = str.split(',').map(Number);
      return { r, c };
    });
  }

  function applyBoardGravity() {
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] !== null) {
          const temp = grid[r][c];
          grid[r][c] = null;
          grid[writeRow][c] = temp;
          writeRow--;
        }
      }
    }
  }

  async function dropPendingJunkBlocks() {
    const toDrop = Math.min(pendingJunk, 12); // Cap per-turn drop at 2 rows (12 blocks)
    pendingJunk -= toDrop;
    renderJunkTray();

    const colsOrder = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < toDrop; i++) {
      // Shuffle columns each full row
      if (i % COLS === 0) {
        colsOrder.sort(() => Math.random() - 0.5);
      }
      const targetCol = colsOrder[i % COLS];
      // Place at top of column and let gravity pull it down
      if (grid[0][targetCol] === null) {
        grid[0][targetCol] = JUNK_GEM.color;
        applyBoardGravity();
      }
    }

    audio.sfxJunkDrop();
    triggerBoardShake();
    await sleep(160);
  }

  function isTopRowBreached() {
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c] !== null) return true;
    }
    return false;
  }

  function checkDangerState() {
    let highestOccupiedRow = ROWS;
    for (let r = 1; r < ROWS; r++) {
      if (grid[r].some(cell => cell !== null)) {
        highestOccupiedRow = r;
        break;
      }
    }
    const inDanger = highestOccupiedRow <= 3;
    audio.dangerMode = inDanger;
    boardWrapperEl.classList.toggle('danger-state', inDanger);
  }

  // ==========================================================================
  // 7. VISUAL RENDERING & ANIMATIONS
  // ==========================================================================
  function animatePopEffect(durationMs) {
    return new Promise(resolve => {
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / durationMs);
        popAnimations.forEach(p => { p.progress = t; });
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  function drawGemCell(ctx, x, y, size, colorHex, alpha = 1) {
    const meta = getGemMeta(colorHex);
    const pad = Math.max(2, Math.floor(size * 0.08));
    const inner = size - pad * 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer bevel base
    ctx.fillStyle = meta.border;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, inner, inner, 6);
    ctx.fill();

    // Main gem body
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.roundRect(x + pad + 2, y + pad + 2, inner - 4, inner - 4, 5);
    ctx.fill();

    // Inner geometric facet symbol for colorblind accessibility & arcade polish
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = inner * 0.25;

    ctx.fillStyle = meta.highlight;
    ctx.beginPath();

    if (meta.shape === 'diamond') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
    } else if (meta.shape === 'circle') {
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    } else if (meta.shape === 'triangle') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.8);
      ctx.lineTo(cx - r, cy + r * 0.8);
      ctx.closePath();
    } else if (meta.shape === 'octagon') {
      ctx.rect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
    } else if (meta.shape === 'star') {
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * r;
        const sy = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
    } else if (meta.shape === 'junk') {
      // Cross bolt pattern for Junk block
      ctx.arc(cx - r * 0.5, cy - r * 0.5, 2, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.5, cy - r * 0.5, 2, 0, Math.PI * 2);
      ctx.arc(cx - r * 0.5, cy + r * 0.5, 2, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.5, cy + r * 0.5, 2, 0, Math.PI * 2);
    }
    ctx.fill();

    // Top-left specular shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + pad + 4, y + pad + 4, inner * 0.35, 3);

    ctx.restore();
  }

  function renderPlayerBoard() {
    playerCtx.clearRect(0, 0, playerCanvas.width, playerCanvas.height);

    // Subtle background grid lines
    playerCtx.strokeStyle = 'rgba(46, 59, 110, 0.28)';
    playerCtx.lineWidth = 1;
    for (let r = 0; r <= VISIBLE_ROWS; r++) {
      playerCtx.beginPath();
      playerCtx.moveTo(0, r * CELL_SIZE);
      playerCtx.lineTo(COLS * CELL_SIZE, r * CELL_SIZE);
      playerCtx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      playerCtx.beginPath();
      playerCtx.moveTo(c * CELL_SIZE, 0);
      playerCtx.lineTo(c * CELL_SIZE, VISIBLE_ROWS * CELL_SIZE);
      playerCtx.stroke();
    }

    // Draw locked blocks (Rows 1..12 map to visual rows 0..11)
    for (let r = 1; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = grid[r][c];
        if (!color) continue;
        const vx = c * CELL_SIZE;
        const vy = (r - 1) * CELL_SIZE;
        drawGemCell(playerCtx, vx, vy, CELL_SIZE, color, 1);
      }
    }

    // Draw Ghost Piece Projection & Active Falling Piece
    if (currentPiece && !isResolving) {
      const ghostBottom = getGhostBottomRow();
      if (ghostBottom > currentPiece.row) {
        for (let i = 0; i < 3; i++) {
          const gr = ghostBottom - i;
          if (gr >= 1 && gr < ROWS) {
            const gx = currentPiece.col * CELL_SIZE;
            const gy = (gr - 1) * CELL_SIZE;
            const color = currentPiece.colors[2 - i];
            drawGemCell(playerCtx, gx, gy, CELL_SIZE, color, 0.22);

            playerCtx.strokeStyle = color;
            playerCtx.lineWidth = 1.5;
            playerCtx.strokeRect(gx + 4, gy + 4, CELL_SIZE - 8, CELL_SIZE - 8);
          }
        }
      }

      // Draw Active Piece
      for (let i = 0; i < 3; i++) {
        const pr = currentPiece.row - i;
        if (pr >= 1 && pr < ROWS) {
          const px = currentPiece.col * CELL_SIZE;
          const py = (pr - 1) * CELL_SIZE;
          drawGemCell(playerCtx, px, py, CELL_SIZE, currentPiece.colors[2 - i], 1);
        }
      }
    }

    // Draw Pop Animations
    for (const pop of popAnimations) {
      if (pop.r < 1) continue;
      const cx = pop.c * CELL_SIZE + CELL_SIZE / 2;
      const cy = (pop.r - 1) * CELL_SIZE + CELL_SIZE / 2;
      const radius = (CELL_SIZE * 0.3) + pop.progress * (CELL_SIZE * 0.45);

      playerCtx.save();
      playerCtx.strokeStyle = '#ffffff';
      playerCtx.lineWidth = 3 * (1 - pop.progress);
      playerCtx.beginPath();
      playerCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      playerCtx.stroke();
      playerCtx.restore();
    }
  }

  function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const previewSize = 40;
    const offsetX = (nextCanvas.width - previewSize) / 2;
    const offsetY = 12;

    for (let i = 0; i < 3; i++) {
      drawGemCell(nextCtx, offsetX, offsetY + i * previewSize, previewSize, nextColors[i], 1);
    }
  }

  function renderOpponentBoard() {
    oppCtx.clearRect(0, 0, opponentCanvas.width, opponentCanvas.height);

    // Grid lines
    oppCtx.strokeStyle = 'rgba(46, 59, 110, 0.22)';
    oppCtx.lineWidth = 1;
    for (let r = 0; r <= VISIBLE_ROWS; r++) {
      oppCtx.beginPath();
      oppCtx.moveTo(0, r * OPP_CELL_SIZE);
      oppCtx.lineTo(COLS * OPP_CELL_SIZE, r * OPP_CELL_SIZE);
      oppCtx.stroke();
    }

    const oppGrid = opponentState.grid;
    if (!oppGrid) return;

    for (let r = 1; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = oppGrid[r] && oppGrid[r][c];
        if (!color) continue;
        drawGemCell(
          oppCtx,
          c * OPP_CELL_SIZE,
          (r - 1) * OPP_CELL_SIZE,
          OPP_CELL_SIZE,
          color,
          1
        );
      }
    }

    if (opponentState.currentPiece) {
      const { col, row, colors } = opponentState.currentPiece;
      for (let i = 0; i < 3; i++) {
        const pr = row - i;
        if (pr >= 1 && pr < ROWS) {
          drawGemCell(
            oppCtx,
            col * OPP_CELL_SIZE,
            (pr - 1) * OPP_CELL_SIZE,
            OPP_CELL_SIZE,
            colors[2 - i],
            0.9
          );
        }
      }
    }
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    levelEl.textContent = level;
    chainEl.textContent = `${currentChain}x`;
  }

  function renderJunkTray() {
    junkTrayEl.innerHTML = '';
    let rem = pendingJunk;
    while (rem >= 6) {
      const mega = document.createElement('div');
      mega.className = 'junk-icon mega';
      mega.textContent = '6';
      junkTrayEl.appendChild(mega);
      rem -= 6;
    }
    for (let i = 0; i < rem; i++) {
      const icon = document.createElement('div');
      icon.className = 'junk-icon';
      junkTrayEl.appendChild(icon);
    }
  }

  function showComboCallout(chain, junkSent) {
    comboBannerEl.classList.remove('hidden');
    // Force animation reflow
    void comboBannerEl.offsetWidth;
    if (junkSent > 0 && gameMode === 'multi') {
      comboBannerEl.textContent = `CHAIN x${chain}! (+${junkSent} JUNK)`;
    } else {
      comboBannerEl.textContent = `CHAIN x${chain}!`;
    }
    setTimeout(() => {
      comboBannerEl.classList.add('hidden');
    }, 850);
  }

  function triggerBoardShake() {
    boardWrapperEl.classList.remove('shake');
    void boardWrapperEl.offsetWidth;
    boardWrapperEl.classList.add('shake');
  }

  // ==========================================================================
  // 8. MAIN GAME LOOP & LIFECYCLE
  // ==========================================================================
  function getFallIntervalMs() {
    return Math.max(140, 820 - (level - 1) * 52);
  }

  function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (isRunning && !isResolving && currentPiece) {
      dropCounter += dt;
      if (dropCounter >= getFallIntervalMs()) {
        dropCounter = 0;
        if (canMoveTo(currentPiece.col, currentPiece.row + 1)) {
          currentPiece.row++;
        } else {
          lockPieceAndResolve();
        }
      }
    }

    // 10Hz Live Board Sync in Multiplayer
    if (isRunning && gameMode === 'multi' && currentRoomId && timestamp - lastSyncTime >= 100) {
      lastSyncTime = timestamp;
      broadcastBoardSnapshot();
    }

    renderPlayerBoard();
    if (gameMode === 'multi') {
      renderOpponentBoard();
    }

    requestAnimationFrame(gameLoop);
  }

  function broadcastBoardSnapshot() {
    if (gameMode !== 'multi' || !currentRoomId || !socket) return;
    socket.emit('plox:boardSync', {
      roomId: currentRoomId,
      grid,
      score,
      combo: currentChain,
      pendingJunk,
      currentPiece
    });
  }

  function resetGameState() {
    grid = createEmptyGrid();
    currentPiece = null;
    nextColors = generateTriplet();
    score = 0;
    level = 1;
    linesCleared = 0;
    currentChain = 0;
    maxChain = 0;
    pendingJunk = 0;
    isResolving = false;
    audio.dangerMode = false;
    boardWrapperEl.classList.remove('danger-state');

    opponentState = {
      grid: createEmptyGrid(),
      score: 0,
      combo: 0,
      pendingJunk: 0,
      currentPiece: null
    };

    opponentScoreEl.textContent = '0';
    opponentComboEl.textContent = '0x';
    opponentJunkCountEl.textContent = '0';
    updateHud();
    renderJunkTray();
    drawNextPiece();
  }

  async function startMatchWithCountdown() {
    lobbyModal.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    resetGameState();

    countdownOverlayEl.classList.remove('hidden');
    for (let c = 3; c >= 1; c--) {
      countdownTextEl.textContent = String(c);
      audio.playTone(440, 'sine', 0.12, 0.08);
      await sleep(750);
    }
    countdownTextEl.textContent = 'GO!';
    audio.playTone(880, 'square', 0.2, 0.1);
    await sleep(450);
    countdownOverlayEl.classList.add('hidden');

    spawnNextPiece();
    isRunning = true;
    dropCounter = 0;
    lastFrameTime = performance.now();
    audio.startBgm();
  }

  function triggerLocalTopOut() {
    isRunning = false;
    audio.stopBgm();

    if (gameMode === 'multi' && currentRoomId && socket) {
      socket.emit('plox:gameOver', {
        roomId: currentRoomId,
        loserId: socket.id
      });
    } else {
      showGameOverModal(false, 'Game Over! The gems reached the ceiling.');
    }
  }

  function showGameOverModal(didWin, subtitleText) {
    isRunning = false;
    audio.stopBgm();
    if (didWin) {
      audio.sfxVictory();
    } else {
      audio.sfxGameOver();
    }

    const resultTitle = document.getElementById('resultTitle');
    const resultSubtitle = document.getElementById('resultSubtitle');
    document.getElementById('finalScoreVal').textContent = score.toLocaleString();
    document.getElementById('finalMaxChainVal').textContent = `${maxChain}x`;

    if (gameMode === 'solo') {
      resultTitle.textContent = 'RUN COMPLETE';
      resultTitle.style.color = '#00f2fe';
    } else if (didWin) {
      resultTitle.textContent = 'VICTORY! 🏆';
      resultTitle.style.color = '#10b981';
    } else {
      resultTitle.textContent = 'DEFEAT 💀';
      resultTitle.style.color = '#f43f5e';
    }

    resultSubtitle.textContent = subtitleText;
    gameOverModal.classList.remove('hidden');
  }

  // ==========================================================================
  // 9. SOCKET.IO MULTIPLAYER HANDLERS
  // ==========================================================================
  if (socket) {
    socket.on('plox:queueStatus', ({ status }) => {
      if (status === 'searching') {
        lobbyStatusBox.classList.remove('hidden');
        lobbyStatusText.textContent = 'Searching for a 1v1 opponent...';
      } else {
        lobbyStatusBox.classList.add('hidden');
      }
    });

    socket.on('plox:privateCreated', ({ roomId, code }) => {
      currentRoomId = roomId;
      lobbyStatusBox.classList.remove('hidden');
      lobbyStatusText.innerHTML = `Room Code: <strong style="color:#00f2fe;font-size:1.2rem;letter-spacing:2px;">${code}</strong><br/>Share with your opponent!`;
    });

    socket.on('plox:matchFound', ({ roomId, opponentName }) => {
      gameMode = 'multi';
      currentRoomId = roomId;
      lobbyStatusBox.classList.add('hidden');
      lobbyErrorMsg.classList.add('hidden');

      const myName = (playerNameInput.value || 'Player').trim();
      localPlayerNameEl.textContent = myName.toUpperCase();
      opponentNameEl.textContent = (opponentName || 'OPPONENT').toUpperCase();
      matchBadgeEl.textContent = '1v1 LIVE';
      soloOverlayMsgEl.classList.add('hidden');

      startMatchWithCountdown();
    });

    socket.on('plox:boardSync', data => {
      opponentState = data;
      opponentScoreEl.textContent = (data.score || 0).toLocaleString();
      opponentComboEl.textContent = `${data.combo || 0}x`;
      opponentJunkCountEl.textContent = String(data.pendingJunk || 0);
    });

    socket.on('plox:sendJunk', ({ count }) => {
      if (!isRunning) return;
      pendingJunk += count;
      renderJunkTray();
      triggerBoardShake();
      audio.sfxJunkDrop();
    });

    socket.on('plox:gameOver', ({ winnerId, winnerName, reason }) => {
      const didWin = socket.id === winnerId;
      const msg = reason
        ? `${reason} — ${winnerName} wins!`
        : didWin
          ? 'You overwhelmed your opponent with gem chains!'
          : `${winnerName} topped out your board!`;
      currentRoomId = null;
      showGameOverModal(didWin, msg);
    });

    socket.on('plox:error', ({ message }) => {
      lobbyErrorMsg.textContent = message;
      lobbyErrorMsg.classList.remove('hidden');
    });
  }

  // ==========================================================================
  // 10. UI CONTROLS, KEYBOARD & TOUCH BINDINGS
  // ==========================================================================
  window.addEventListener('keydown', e => {
    if (!isRunning) return;

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        moveHorizontal(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        moveHorizontal(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyZ':
        e.preventDefault();
        rotateTriplet();
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        softDrop();
        break;
      case 'Space':
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  // Mobile Touch Controls
  document.getElementById('touchLeft').addEventListener('click', () => moveHorizontal(-1));
  document.getElementById('touchRight').addEventListener('click', () => moveHorizontal(1));
  document.getElementById('touchDown').addEventListener('click', () => softDrop());
  document.getElementById('touchRotate').addEventListener('click', () => rotateTriplet());
  document.getElementById('touchDrop').addEventListener('click', () => hardDrop());

  // Audio Toggles
  btnMusicToggle.addEventListener('click', () => {
    audio.init();
    audio.musicEnabled = !audio.musicEnabled;
    btnMusicToggle.classList.toggle('active', audio.musicEnabled);
    btnMusicToggle.textContent = audio.musicEnabled ? '🎵 Music ON' : '🎵 Music OFF';
  });

  btnSfxToggle.addEventListener('click', () => {
    audio.init();
    audio.sfxEnabled = !audio.sfxEnabled;
    btnSfxToggle.classList.toggle('active', audio.sfxEnabled);
    btnSfxToggle.textContent = audio.sfxEnabled ? '🔊 SFX ON' : '🔊 SFX OFF';
  });

  // Lobby Buttons
  document.getElementById('btnStartSolo').addEventListener('click', () => {
    audio.init();
    gameMode = 'solo';
    currentRoomId = null;
    const myName = (playerNameInput.value || 'Player').trim();
    localPlayerNameEl.textContent = myName.toUpperCase();
    opponentNameEl.textContent = 'SOLO PRACTICE';
    matchBadgeEl.textContent = 'SOLO';
    soloOverlayMsgEl.classList.remove('hidden');
    startMatchWithCountdown();
  });

  document.getElementById('btnQuickMatch').addEventListener('click', () => {
    audio.init();
    lobbyErrorMsg.classList.add('hidden');
    if (!socket) return;
    socket.emit('plox:joinQueue', { name: playerNameInput.value });
  });

  document.getElementById('btnCreatePrivate').addEventListener('click', () => {
    audio.init();
    lobbyErrorMsg.classList.add('hidden');
    if (!socket) return;
    socket.emit('plox:createPrivate', { name: playerNameInput.value });
  });

  document.getElementById('btnJoinPrivate').addEventListener('click', () => {
    audio.init();
    lobbyErrorMsg.classList.add('hidden');
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!code) {
      lobbyErrorMsg.textContent = 'Please enter a 5-character room code.';
      lobbyErrorMsg.classList.remove('hidden');
      return;
    }
    if (!socket) return;
    socket.emit('plox:joinPrivate', { name: playerNameInput.value, code });
  });

  document.getElementById('btnCancelMatch').addEventListener('click', () => {
    if (socket) {
      socket.emit('plox:leaveQueue');
      if (currentRoomId) {
        socket.emit('plox:leaveRoom', { roomId: currentRoomId });
        currentRoomId = null;
      }
    }
    lobbyStatusBox.classList.add('hidden');
  });

  document.getElementById('btnMenuReturn').addEventListener('click', () => {
    isRunning = false;
    audio.stopBgm();
    if (socket && currentRoomId) {
      socket.emit('plox:leaveRoom', { roomId: currentRoomId });
      currentRoomId = null;
    }
    lobbyStatusBox.classList.add('hidden');
    gameOverModal.classList.add('hidden');
    lobbyModal.classList.remove('hidden');
  });

  document.getElementById('btnPlayAgain').addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    if (gameMode === 'solo') {
      startMatchWithCountdown();
    } else {
      lobbyModal.classList.remove('hidden');
      if (socket) {
        socket.emit('plox:joinQueue', { name: playerNameInput.value });
      }
    }
  });

  document.getElementById('btnBackToLobby').addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    lobbyModal.classList.remove('hidden');
  });

  // Start rendering loop
  requestAnimationFrame(gameLoop);
})();
