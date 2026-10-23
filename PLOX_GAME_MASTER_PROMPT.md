# MASTER AI PROMPT: GENERATE 1V1 MULTIPLAYER "PLOX" PUZZLE BATTLE GAME
> **Target LLM:** Gemini 4 / Advanced Coding Models  
> **Task:** Generate complete, turnkey code for a real-time multiplayer 1v1 falling-block puzzle game ("Plox", inspired by Plato & classic Columns) on Node.js + Express + Socket.io.

---

## 1. PROJECT CONTEXT & ARCHITECTURE

You are an expert game developer and systems architect. You are adding a new game called **"Plox"** to an existing live multiplayer arcade website deployed on **Render.com**.

### Existing Project Structure:
```
multiplayer-game/
├── package.json          # express (^4.19.2), socket.io (^4.7.5)
├── server.js             # Node.js + Socket.io HTTP server (port process.env.PORT || 3000)
└── public/
    ├── index.html        # Game 1: Block Arena (HTML5 Canvas multiplayer)
    ├── style.css         # Styling for Game 1
    └── game.js           # Client script for Game 1
```

### New Target Files to Implement:
```
multiplayer-game/
├── server.js             # [MODIFY] Add Plox 1v1 matchmaking & socket handlers
└── public/
    ├── index.html        # [MODIFY] Add top arcade navigation bar linking to Plox
    ├── plox.html         # [NEW] Full 1v1 & Solo Plox Battle Arena UI
    ├── plox.css          # [NEW] Dark neon arcade theme & mobile responsiveness
    └── plox.js           # [NEW] Complete Match-3 Columns game engine & socket client
```

---

## 2. EXACT GAME RULES & SPECIFICATIONS ("PLOX")

### A. The Board
* **Dimensions:** 6 columns wide $\times$ 12 rows tall (with 1 hidden row above for spawning).
* **Grid representation:** 2D array `grid[row][col]`, initialized with `null` (empty).
* **Gem Colors:** 5 vibrant colors:
  1. Ruby Red (`#ef4444`)
  2. Sapphire Blue (`#3b82f6`)
  3. Emerald Green (`#10b981`)
  4. Amber Gold (`#f59e0b`)
  5. Amethyst Purple (`#a855f7`)
* **Junk / Garbage Blocks:** Grey Stone (`#64748b`) with cracked texture or skull icon.

### B. Falling Pieces & Movement
* **Piece Structure:** A vertical column of 3 blocks: `[colorTop, colorMid, colorBot]`.
* **Spawn Position:** Center top column (column index 2 or 3), starting above row 0.
* **Controls:**
  * **Rotate / Cycle Colors:** Shifts colors cyclically down the triplet (`[C1, C2, C3]` $\rightarrow$ `[C3, C1, C2]`).
  * **Slide Left / Right:** Moves piece horizontally if adjacent column is unoccupied.
  * **Soft Drop:** Fast drop downward.
  * **Hard Drop:** Instantly drops the triplet to the lowest possible row.
  * **Ghost Piece Preview:** A semi-transparent projection at the bottom showing exact landing location.

### C. Match-3 Engine
* **Condition:** 3 or more contiguous blocks of the same color in any of the 4 axes:
  1. **Horizontal** ($\leftrightarrow$)
  2. **Vertical** ($\updownarrow$)
  3. **Diagonal Down-Right** ($\diagdown$)
  4. **Diagonal Up-Right** ($\diagup$)
* **Resolution Algorithm:**
  1. When a piece locks into place, scan grid for all matching blocks ($\ge 3$).
  2. Mark all matched cells simultaneously.
  3. Clear matched cells with a pop animation and chime sound.
  4. **Apply Gravity:** Any blocks floating above empty spaces fall down until supported.
  5. **Check for Combos:** After gravity settles, run the match scanner again. If new matches form, increment combo counter ($\times 2, \times 3, \times 4\dots$).
  6. Repeat until no more matches form.

### D. 1v1 Multiplayer Garbage Attack System
* When a player triggers combos or matches $\ge 4$ blocks, they generate **Junk Blocks**:
  * 3-Block Match: 0 junk
  * 4-Block Match: 1 junk
  * 5-Block Match: 2 junk
  * Combo $\times 2$: +2 junk
  * Combo $\times 3$: +4 junk
  * Combo $\times 4+$: +6 junk
* **Junk Delivery:**
  * Sent via Socket.io to the opponent's "Incoming Junk Queue" (visible warning meter).
  * When the opponent's current piece locks into place, queued junk blocks fall into random columns from the top.
  * Junk blocks can only be cleared by making a match adjacent to them.

### E. Live Opponent Board Preview
* In 1v1 mode, the screen displays:
  * **Primary Board (Center/Left):** Full interactive 6x12 board with falling piece, ghost piece, score, and next piece preview.
  * **Opponent Board (Right):** Live-synced mini board showing opponent's grid state in real time.

### F. Win / Loss Condition
* If blocks stack up to the top spawn row (row 0), the player loses immediately.
* The opponent is declared the winner with a victory screen.

---

## 3. AUDIO SYSTEM (WEB AUDIO API - ZERO EXTERNAL ASSETS)
Implement procedural 8-bit sound effects using the browser's built-in Web Audio API:
1. `rotateSound`: Short 600Hz blip.
2. `dropSound`: Low 150Hz thump.
3. `popSound`: High-pitched 880Hz chime for single match.
4. `comboSound`: Ascending fanfare with pitch scaling based on combo multiplier ($\times 2, \times 3, \dots$).
5. `junkSiren`: Two-tone alert when incoming garbage is queued.
6. `gameOverSound`: Descending minor chord.
7. `victorySound`: Triumphant ascending triad.
* Include a `🔊 Sound ON / 🔇 Sound OFF` toggle saved in `localStorage`.

---

## 4. MOBILE TOUCH SUPPORT
Include on-screen virtual controls for smartphone players:
* **◀ Left** / **▶ Right**
* **🔄 Rotate Colors**
* **⬇ Soft Drop**
* **⏬ Hard Drop (Instant)**
Ensure `touch-action: manipulation` and prevent double-tap zoom.

---

## 5. COMPLETE CODE IMPLEMENTATION REQUIREMENTS

Please write clean, complete, production-ready code with no placeholders or `// TODO` comments for the following:

### 1. `server.js` Updates:
* Add Plox room matchmaking logic:
  * Queue matching for Quick Match 1v1.
  * Private room code generation (e.g. `PLOX-9876`).
  * Relay `plox:boardUpdate` to opponent.
  * Relay `plox:sendJunk` to opponent.
  * Handle `plox:gameOver` and player disconnect forfeits.

### 2. `public/plox.html`:
* Semantic HTML5 layout with:
  * Lobby modal (Quick Match, Room Code, Solo Practice).
  * Game layout featuring Player Board, Next Piece Box, Score/Combo HUD, Opponent Board, and Incoming Junk Meter.
  * Virtual Touch D-pad.

### 3. `public/plox.css`:
* Modern dark arcade aesthetic (`#090d16` canvas, neon gemstone highlights, glowing combo text, shake animations on block clears).

### 4. `public/plox.js`:
* Complete Columns / Plox match-3 algorithm, recursive gravity settlement, combo chain counter, ghost piece projection, Web Audio synthesizer, and Socket.io event listeners.

### 5. `public/index.html` Update:
* Top header navigation pill to switch between `[🟦 Block Arena]` and `[🧩 Play Plox 1v1]`.
