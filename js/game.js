/**
 * ちびっこギャング 3D大乱闘パズル - 完全自律型ゲームエンジン
 * (ローカル file:// ＆ Web/GitHub Pages 両対応・CORSフリー設計)
 */

(function() {
  'use strict';

  // ==================== 1. 設定＆定数 ====================
  const CONFIG = {
    GRID_ROWS: 7,
    GRID_COLS: 7,

    PIECE_TYPES: {
      COIN: 0,       // 🪙 ゴールドコイン
      CANDY: 1,      // 🍬 スカルルビージェム
      SLINGSHOT: 2,  // 🔫 パチンコ・エメラルド
      SPRAY: 3,      // 🎨 スプレー缶
      DYNAMITE: 4,   // 💣 ミニダイナマイト
    },

    COLORS: {
      0: { color: '#ffc83b', light: '#fff48f', dark: '#b37700', stroke: '#664400' },
      1: { color: '#ff2a7a', light: '#ff85b2', dark: '#b30e4c', stroke: '#660528' },
      2: { color: '#2ecc71', light: '#8ef0b3', dark: '#1e8449', stroke: '#114a29' },
      3: { color: '#00d2ff', light: '#80e5ff', dark: '#008ba3', stroke: '#004d5a' },
      4: { color: '#ff5722', light: '#ff9b7d', dark: '#bf360c', stroke: '#6b1c03' },
      CRATE: { color: '#a07855', light: '#c49e7c', dark: '#5c3a21', stroke: '#3d2314' },
      KEY: { color: '#ffd700', light: '#ffffff', dark: '#b39700', stroke: '#665500' }
    },

    SPECIAL_TYPES: { NONE: 0, ROCKET_H: 1, ROCKET_V: 2, BOMB_AREA: 3, RAINBOW: 4 },
    OBSTACLE_TYPES: { NONE: 0, CRATE: 1, CRATE_HARD: 2, PADLOCK: 3, KEY: 4 },

    SCORE: {
      BASE_MATCH: 100,
      COMBO_MULTIPLIER: 1.5,
      REMAINING_MOVE_BONUS: 300,
    }
  };

  // ==================== 2. オーディオエンジン (Web Audio API) ====================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.bgmPlaying = false;
      this.bgmTimer = null;
      this.bgmStep = 0;
      this.comboNotes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 783.99, 1046.50];
    }

    init() {
      try {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      } catch (e) {}
    }

    toggle() {
      this.enabled = !this.enabled;
      if (!this.enabled) this.stopBGM();
      else this.startBGM();
      return this.enabled;
    }

    playSwap() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(560, t + 0.08);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.08);
      } catch (e) {}
    }

    playLand() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.06);
      } catch (e) {}
    }

    playMatch(combo = 1) {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const noteIdx = Math.min(combo - 1, this.comboNotes.length - 1);
        const freq = this.comboNotes[noteIdx];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.26);
      } catch (e) {}
    }

    playExplode() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, t);
        filter.frequency.exponentialRampToValueAtTime(70, t + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
        noise.stop(t + 0.3);
      } catch (e) {}
    }

    playRainbow() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
          const subT = t + i * 0.04;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, subT);
          gain.gain.setValueAtTime(0.15, subT);
          gain.gain.exponentialRampToValueAtTime(0.01, subT + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(subT);
          osc.stop(subT + 0.15);
        });
      } catch (e) {}
    }

    playSkill() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.28);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.28);
      } catch (e) {}
    }

    playWin() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
          const subT = t + i * 0.12;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, subT);
          gain.gain.setValueAtTime(0.25, subT);
          gain.gain.exponentialRampToValueAtTime(0.01, subT + (i === 3 ? 0.5 : 0.2));
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(subT);
          osc.stop(subT + (i === 3 ? 0.5 : 0.2));
        });
      } catch (e) {}
    }

    playLose() {
      if (!this.enabled || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        [440, 392, 349.23, 293.66].forEach((f, i) => {
          const subT = t + i * 0.16;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, subT);
          gain.gain.setValueAtTime(0.2, subT);
          gain.gain.exponentialRampToValueAtTime(0.01, subT + 0.3);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(subT);
          osc.stop(subT + 0.3);
        });
      } catch (e) {}
    }

    startBGM() {
      if (!this.enabled || this.bgmPlaying) return;
      this.init();
      this.bgmPlaying = true;
      this.bgmStep = 0;

      const bassline = [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 130.81];
      const melody = [440, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25];

      const step = () => {
        if (!this.bgmPlaying || !this.enabled || !this.ctx) return;
        const t = this.ctx.currentTime;
        const bFreq = bassline[this.bgmStep % bassline.length];
        const mFreq = melody[this.bgmStep % melody.length];

        if (bFreq > 0) {
          const bOsc = this.ctx.createOscillator();
          const bGain = this.ctx.createGain();
          bOsc.type = 'triangle';
          bOsc.frequency.setValueAtTime(bFreq, t);
          bGain.gain.setValueAtTime(0.05, t);
          bGain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
          bOsc.connect(bGain);
          bGain.connect(this.ctx.destination);
          bOsc.start(t);
          bOsc.stop(t + 0.16);
        }

        if (mFreq > 0 && this.bgmStep % 2 === 0) {
          const mOsc = this.ctx.createOscillator();
          const mGain = this.ctx.createGain();
          mOsc.type = 'sine';
          mOsc.frequency.setValueAtTime(mFreq, t);
          mGain.gain.setValueAtTime(0.025, t);
          mGain.gain.exponentialRampToValueAtTime(0.005, t + 0.18);
          mOsc.connect(mGain);
          mGain.connect(this.ctx.destination);
          mOsc.start(t);
          mOsc.stop(t + 0.18);
        }

        this.bgmStep++;
        this.bgmTimer = setTimeout(step, 180);
      };
      step();
    }

    stopBGM() {
      this.bgmPlaying = false;
      if (this.bgmTimer) {
        clearTimeout(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  const sound = new SoundEngine();

  // ==================== 3. ローカルストレージ ====================
  const STORAGE_KEY = 'CHIBIKKO_GANG_PUZZLE_DATA_V4';
  class StorageManager {
    constructor() {
      this.data = this.load();
    }
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { unlockedStage: 1, stageStars: {}, stageHighScores: {}, soundEnabled: true };
    }
    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {}
    }
    getUnlockedStage() { return this.data.unlockedStage || 1; }
    getStageStars(id) { return this.data.stageStars[id] || 0; }
    recordStageClear(id, score, stars) {
      if (stars > (this.data.stageStars[id] || 0)) this.data.stageStars[id] = stars;
      if (score > (this.data.stageHighScores[id] || 0)) this.data.stageHighScores[id] = score;
      if (id >= this.data.unlockedStage && id < 12) this.data.unlockedStage = id + 1;
      this.save();
    }
    setSoundEnabled(en) { this.data.soundEnabled = en; this.save(); }
  }
  const storage = new StorageManager();

  // ==================== 4. ステージデータ (全12ステージ) ====================
  const STAGES = [
    { id: 1, title: '路地裏の縄張り', type: 'COLLECT', moves: 20, target: { type: 0, count: 12, text: '🪙 コイン' }, starScores: [1500, 3000, 5000] },
    { id: 2, title: 'ダンボール砦', type: 'OBSTACLE_CRATE', moves: 18, target: { count: 8, text: '📦 ダンボール' }, starScores: [2000, 4000, 6500], initialBoard: [
      { r: 2, c: 2, obstacle: 1 }, { r: 2, c: 4, obstacle: 1 }, { r: 3, c: 3, obstacle: 1 },
      { r: 4, c: 2, obstacle: 1 }, { r: 4, c: 4, obstacle: 1 }, { r: 1, c: 3, obstacle: 1 }, { r: 5, c: 3, obstacle: 1 }
    ]},
    { id: 3, title: '秘密の金庫破り', type: 'KEY_DROP', moves: 22, target: { count: 2, text: '🔑 金の鍵' }, starScores: [2500, 5000, 8000], initialBoard: [
      { r: 0, c: 2, obstacle: 4 }, { r: 0, c: 4, obstacle: 4 }, { r: 3, c: 2, obstacle: 1 }, { r: 3, c: 4, obstacle: 1 }
    ]},
    { id: 4, title: '決戦！店主ボブ', type: 'BOSS', moves: 25, target: { count: 1, text: '👹 ボブ撃破' }, starScores: [3500, 7000, 11000], boss: { name: '頑固店主ボブ', maxHp: 120, attackInterval: 4 } },
    { id: 5, title: 'グラフィティ広場', type: 'COLLECT', moves: 20, target: { type: 3, count: 18, text: '🎨 スプレー' }, starScores: [3000, 6000, 9500] },
    { id: 6, title: '封鎖された倉庫', type: 'UNLOCK', moves: 22, target: { count: 6, text: '🔒 南京錠' }, starScores: [3500, 7000, 11000], initialBoard: [
      { r: 1, c: 1, obstacle: 3 }, { r: 1, c: 5, obstacle: 3 }, { r: 3, c: 3, obstacle: 3 }, { r: 5, c: 1, obstacle: 3 }, { r: 5, c: 5, obstacle: 3 }
    ]},
    { id: 7, title: '重装甲ダンボール', type: 'OBSTACLE_CRATE', moves: 24, target: { count: 8, text: '📦 強化木箱' }, starScores: [4000, 8000, 13000], initialBoard: [
      { r: 2, c: 2, obstacle: 2 }, { r: 2, c: 4, obstacle: 2 }, { r: 4, c: 2, obstacle: 2 }, { r: 4, c: 4, obstacle: 2 }, { r: 3, c: 3, obstacle: 2 }
    ]},
    { id: 8, title: '追撃！警備主任', type: 'BOSS', moves: 26, target: { count: 1, text: '👮 マックス撃破' }, starScores: [5000, 9500, 15000], boss: { name: '警備主任マックス', maxHp: 180, attackInterval: 3 } },
    { id: 9, title: 'トリプル・金庫', type: 'KEY_DROP', moves: 24, target: { count: 3, text: '🔑 金の鍵' }, starScores: [4500, 9000, 14000], initialBoard: [
      { r: 0, c: 1, obstacle: 4 }, { r: 0, c: 3, obstacle: 4 }, { r: 0, c: 5, obstacle: 4 }
    ]},
    { id: 10, title: 'ダウンタウン包囲', type: 'MIXED', moves: 24, target: { count: 6, text: '🔒/📦 障害物' }, starScores: [5500, 11000, 17000], initialBoard: [
      { r: 1, c: 3, obstacle: 2 }, { r: 3, c: 1, obstacle: 3 }, { r: 3, c: 5, obstacle: 3 }, { r: 5, c: 3, obstacle: 2 }
    ]},
    { id: 11, title: 'キャンディラッシュ', type: 'COLLECT', moves: 20, target: { type: 1, count: 25, text: '🍬 スカルジェム' }, starScores: [6000, 12000, 18000] },
    { id: 12, title: '頂上決戦！総帥', type: 'BOSS', moves: 28, target: { count: 1, text: '👑 ジャック撃破' }, starScores: [8000, 15000, 24000], boss: { name: 'ライバル総帥ジャック', maxHp: 260, attackInterval: 3 } }
  ];

  // ==================== 5. キャラクター定義 ====================
  const CHARACTERS = [
    { id: 'leo', name: 'レオ', title: 'スナイパー', color: '#ff6b35', maxSp: 100, skillName: 'パチンコ・スナイプ' },
    { id: 'gori', name: 'ゴリ', title: 'パワー', color: '#ffc83b', maxSp: 110, skillName: 'メガトン・ハンマー' },
    { id: 'emma', name: 'エマ', title: '策士', color: '#9b51e0', maxSp: 90, skillName: 'カラー・ケミストリー' },
    { id: 'hayato', name: 'ハヤト', title: 'スピード', color: '#00d2ff', maxSp: 100, skillName: 'タイム・トリック' }
  ];

  // ==================== 6. ピースクラス ====================
  class Piece {
    constructor(r, c, type, special = 0, obstacle = 0) {
      this.row = r;
      this.col = c;
      this.type = type;
      this.special = special;
      this.obstacle = obstacle;
      this.hp = obstacle === 2 ? 2 : 1;

      this.animX = c;
      this.animY = r;
      this.scale = 1.0;
      this.targetScale = 1.0;
      this.isEliminated = false;
      this.rot = Math.random() * Math.PI * 2;
    }

    update(dt) {
      const dx = this.col - this.animX;
      const dy = this.row - this.animY;
      if (Math.abs(dx) > 0.01) this.animX += dx * 16 * dt; else this.animX = this.col;
      if (Math.abs(dy) > 0.01) this.animY += dy * 20 * dt; else this.animY = this.row;

      const ds = this.targetScale - this.scale;
      this.scale += ds * 14 * dt;
      this.rot += 0.8 * dt;

      if (this.isEliminated) {
        this.scale = Math.max(0, this.scale - 6 * dt);
      }
    }
  }

  // ==================== 7. パーティクルシステム ====================
  class Particle {
    constructor(x, y, vx, vy, color, size, life) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.color = color; this.size = size; this.life = life; this.maxLife = life;
    }
    update(dt) {
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vy += 400 * dt; this.life -= dt;
    }
    render(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (this.life / this.maxLife), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ==================== 8. 盤面＆ゲームエンジン ====================
  class Board {
    constructor() {
      this.grid = [];
      this.rows = 7;
      this.cols = 7;
      this.isAnimating = false;
      this.combo = 0;
      this.particles = [];
      this.floatingTexts = [];
    }

    init(stageData) {
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        this.grid[r] = [];
        for (let c = 0; c < this.cols; c++) {
          let type;
          do {
            type = Math.floor(Math.random() * 5);
          } while (
            (c >= 2 && this.grid[r][c - 1]?.type === type && this.grid[r][c - 2]?.type === type) ||
            (r >= 2 && this.grid[r - 1][c]?.type === type && this.grid[r - 2][c]?.type === type)
          );
          this.grid[r][c] = new Piece(r, c, type);
        }
      }

      if (stageData.initialBoard) {
        stageData.initialBoard.forEach(item => {
          if (item.r < this.rows && item.c < this.cols) {
            const p = this.grid[item.r][item.c];
            p.obstacle = item.obstacle;
            if (item.obstacle === 2) p.hp = 2;
          }
        });
      }

      this.combo = 0;
      this.particles = [];
      this.floatingTexts = [];
      this.ensureMoves();
    }

    emitParticles(x, y, color, count = 12) {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 200;
        this.particles.push(new Particle(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd - 60, color, 4 + Math.random() * 4, 0.4));
      }
    }

    addText(txt, x, y, color = '#ffc83b', size = 24) {
      this.floatingTexts.push({ text: txt, x, y, color, size, life: 0.8, maxLife: 0.8 });
    }

    async trySwap(r1, c1, r2, c2, onMatch) {
      if (this.isAnimating) return false;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;

      const p1 = this.grid[r1][c1];
      const p2 = this.grid[r2][c2];
      if (!p1 || !p2 || p1.obstacle || p2.obstacle) return false;

      this.isAnimating = true;
      sound.playSwap();

      this.swap(r1, c1, r2, c2);
      await this.wait(180);

      if (p1.special !== 0 || p2.special !== 0) {
        const used = await this.handleSpecial(r1, c1, r2, c2, onMatch);
        if (used) {
          await this.cascade(onMatch);
          this.isAnimating = false;
          return true;
        }
      }

      const matches = this.findMatches();
      if (matches.length > 0) {
        this.combo = 1;
        await this.resolve(matches, onMatch);
        await this.cascade(onMatch);
        this.isAnimating = false;
        return true;
      } else {
        sound.playSwap();
        this.swap(r1, c1, r2, c2);
        await this.wait(180);
        this.isAnimating = false;
        return false;
      }
    }

    swap(r1, c1, r2, c2) {
      const p1 = this.grid[r1][c1];
      const p2 = this.grid[r2][c2];
      p1.row = r2; p1.col = c2;
      p2.row = r1; p2.col = c1;
      this.grid[r1][c1] = p2;
      this.grid[r2][c2] = p1;
    }

    async handleSpecial(r1, c1, r2, c2, onMatch) {
      const p1 = this.grid[r1][c1];
      const p2 = this.grid[r2][c2];

      if (p1.special === CONFIG.SPECIAL_TYPES.RAINBOW || p2.special === CONFIG.SPECIAL_TYPES.RAINBOW) {
        const rainbow = p1.special === CONFIG.SPECIAL_TYPES.RAINBOW ? p1 : p2;
        const other = rainbow === p1 ? p2 : p1;
        const tColor = other.type;

        sound.playRainbow();
        rainbow.isEliminated = true;

        const elim = [];
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const p = this.grid[r][c];
            if (p && !p.isEliminated && p.type === tColor && !p.obstacle) {
              p.isEliminated = true;
              elim.push(p);
            }
          }
        }
        if (onMatch) onMatch({ count: elim.length + 1, type: tColor, combo: 1 });
        await this.wait(250);
        return true;
      }

      if (p1.special !== 0 && p2.special !== 0) {
        sound.playExplode();
        p1.isEliminated = true;
        p2.isEliminated = true;
        const elim = [];
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (Math.abs(r - r1) <= 1 || Math.abs(c - c1) <= 1) {
              const p = this.grid[r][c];
              if (p && !p.isEliminated) { p.isEliminated = true; elim.push(p); }
            }
          }
        }
        if (onMatch) onMatch({ count: elim.length, combo: 1 });
        await this.wait(250);
        return true;
      }
      return false;
    }

    findMatches() {
      const sets = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols - 2; c++) {
          const p = this.grid[r][c];
          if (!p || p.isEliminated || p.obstacle) continue;
          let len = 1;
          while (c + len < this.cols && this.grid[r][c + len]?.type === p.type && !this.grid[r][c + len]?.isEliminated && !this.grid[r][c + len]?.obstacle) len++;
          if (len >= 3) {
            const g = [];
            for (let k = 0; k < len; k++) g.push(this.grid[r][c + k]);
            sets.push({ pieces: g, dir: 'H', len, type: p.type });
            c += len - 1;
          }
        }
      }
      for (let c = 0; c < this.cols; c++) {
        for (let r = 0; r < this.rows - 2; r++) {
          const p = this.grid[r][c];
          if (!p || p.isEliminated || p.obstacle) continue;
          let len = 1;
          while (r + len < this.rows && this.grid[r + len][c]?.type === p.type && !this.grid[r + len][c]?.isEliminated && !this.grid[r + len][c]?.obstacle) len++;
          if (len >= 3) {
            const g = [];
            for (let k = 0; k < len; k++) g.push(this.grid[r + k][c]);
            sets.push({ pieces: g, dir: 'V', len, type: p.type });
            r += len - 1;
          }
        }
      }
      return sets;
    }

    async resolve(matches, onMatch) {
      const elimMap = new Map();
      let specialCreated = null;

      sound.playMatch(this.combo);

      matches.forEach(g => {
        if (g.len >= 5) {
          const mid = g.pieces[Math.floor(g.pieces.length / 2)];
          specialCreated = { row: mid.row, col: mid.col, special: CONFIG.SPECIAL_TYPES.RAINBOW, type: g.type };
        } else if (g.len === 4) {
          const mid = g.pieces[1];
          specialCreated = { row: mid.row, col: mid.col, special: g.dir === 'H' ? CONFIG.SPECIAL_TYPES.ROCKET_H : CONFIG.SPECIAL_TYPES.ROCKET_V, type: g.type };
        }
        g.pieces.forEach(p => elimMap.set(`${p.row},${p.col}`, p));
      });

      let typeCounts = {};
      elimMap.forEach(p => {
        p.isEliminated = true;
        typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
        this.triggerSpecial(p);
        this.damageObstacles(p.row, p.col);
      });

      if (this.combo >= 3) {
        this.addText(`${this.combo} COMBO!`, 185, 185, this.combo >= 5 ? '#ff2a7a' : '#ffc83b', 28);
      }

      if (onMatch) onMatch({ count: elimMap.size, typeCounts, combo: this.combo });
      await this.wait(200);

      if (specialCreated) {
        const p = this.grid[specialCreated.row][specialCreated.col];
        if (p) {
          p.isEliminated = false;
          p.scale = 1.4;
          p.targetScale = 1.0;
          p.special = specialCreated.special;
          p.type = specialCreated.type;
        }
      }
    }

    triggerSpecial(p) {
      if (p.special === CONFIG.SPECIAL_TYPES.ROCKET_H) {
        sound.playExplode();
        for (let c = 0; c < this.cols; c++) {
          const target = this.grid[p.row][c];
          if (target && !target.isEliminated) { target.isEliminated = true; this.damageObstacles(target.row, target.col); }
        }
      } else if (p.special === CONFIG.SPECIAL_TYPES.ROCKET_V) {
        sound.playExplode();
        for (let r = 0; r < this.rows; r++) {
          const target = this.grid[r][p.col];
          if (target && !target.isEliminated) { target.isEliminated = true; this.damageObstacles(target.row, target.col); }
        }
      } else if (p.special === CONFIG.SPECIAL_TYPES.BOMB_AREA) {
        sound.playExplode();
        for (let r = Math.max(0, p.row - 1); r <= Math.min(this.rows - 1, p.row + 1); r++) {
          for (let c = Math.max(0, p.col - 1); c <= Math.min(this.cols - 1, p.col + 1); c++) {
            const target = this.grid[r][c];
            if (target && !target.isEliminated) { target.isEliminated = true; this.damageObstacles(target.row, target.col); }
          }
        }
      }
    }

    damageObstacles(r, c) {
      const nbs = [{ r: r-1, c }, { r: r+1, c }, { r, c: c-1 }, { r, c: c+1 }];
      nbs.forEach(n => {
        if (n.r >= 0 && n.r < this.rows && n.c >= 0 && n.c < this.cols) {
          const p = this.grid[n.r][n.c];
          if (p && (p.obstacle === 1 || p.obstacle === 2)) {
            p.hp--;
            if (p.hp <= 0) p.isEliminated = true;
          }
        }
      });
    }

    async cascade(onMatch) {
      let hasMatches = true;
      while (hasMatches) {
        await this.applyGravity();
        await this.wait(180);
        this.checkKeyGoal(onMatch);

        const m = this.findMatches();
        if (m.length > 0) {
          this.combo++;
          await this.resolve(m, onMatch);
          hasMatches = true;
        } else {
          hasMatches = false;
        }
      }
      this.ensureMoves();
    }

    async applyGravity() {
      let dropped = false;
      for (let c = 0; c < this.cols; c++) {
        let emptyRow = this.rows - 1;
        for (let r = this.rows - 1; r >= 0; r--) {
          const p = this.grid[r][c];
          if (p && !p.isEliminated) {
            if (r !== emptyRow) {
              this.grid[emptyRow][c] = p;
              this.grid[r][c] = null;
              p.row = emptyRow;
              dropped = true;
            }
            emptyRow--;
          } else if (p && p.isEliminated) {
            this.grid[r][c] = null;
          }
        }

        let offset = 1;
        for (let r = emptyRow; r >= 0; r--) {
          const randType = Math.floor(Math.random() * 5);
          const newP = new Piece(r, c, randType);
          newP.animY = -offset;
          this.grid[r][c] = newP;
          offset++;
          dropped = true;
        }
      }
      if (dropped) sound.playLand();
    }

    checkKeyGoal(onMatch) {
      for (let c = 0; c < this.cols; c++) {
        const p = this.grid[this.rows - 1][c];
        if (p && p.obstacle === 4 && !p.isEliminated) {
          p.isEliminated = true;
          sound.playWin();
          this.addText('🔑 KEY GET!!', 185, 185, '#ffd700', 30);
          if (onMatch) onMatch({ keyCollected: true });
        }
      }
    }

    ensureMoves() {
      if (!this.hasMoves()) {
        sound.playRainbow();
        this.shuffle();
      }
    }

    hasMoves() {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (c < this.cols - 1 && this.checkSwap(r, c, r, c + 1)) return true;
          if (r < this.rows - 1 && this.checkSwap(r, c, r + 1, c)) return true;
        }
      }
      return false;
    }

    checkSwap(r1, c1, r2, c2) {
      const p1 = this.grid[r1][c1];
      const p2 = this.grid[r2][c2];
      if (!p1 || !p2 || p1.obstacle || p2.obstacle) return false;
      if (p1.special !== 0 || p2.special !== 0) return true;

      this.grid[r1][c1] = p2;
      this.grid[r2][c2] = p1;
      const m = this.findMatches();
      this.grid[r1][c1] = p1;
      this.grid[r2][c2] = p2;
      return m.length > 0;
    }

    shuffle() {
      const types = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (p && !p.obstacle) types.push(p.type);
        }
      }
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
      let idx = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (p && !p.obstacle) {
            p.type = types[idx++];
            p.scale = 0.2;
            p.targetScale = 1.0;
          }
        }
      }
    }

    executeSkill(charId, onMatch) {
      if (charId === 'leo') {
        const cands = [];
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.grid[r][c] && !this.grid[r][c].isEliminated) cands.push(this.grid[r][c]);
          }
        }
        for (let i = 0; i < 3 && cands.length > 0; i++) {
          const p = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
          p.isEliminated = true;
          this.damageObstacles(p.row, p.col);
        }
        sound.playExplode();
      } else if (charId === 'gori') {
        for (let r = this.rows - 2; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const p = this.grid[r][c];
            if (p && !p.isEliminated) p.isEliminated = true;
          }
        }
        sound.playExplode();
      } else if (charId === 'emma') {
        const counts = [0,0,0,0,0];
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const p = this.grid[r][c];
            if (p && !p.obstacle && !p.isEliminated) counts[p.type]++;
          }
        }
        const maxType = counts.indexOf(Math.max(...counts));
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const p = this.grid[r][c];
            if (p && p.type === maxType && !p.obstacle && !p.isEliminated) {
              p.special = CONFIG.SPECIAL_TYPES.BOMB_AREA;
              p.scale = 1.4;
              p.targetScale = 1.0;
            }
          }
        }
        sound.playRainbow();
      } else if (charId === 'hayato') {
        this.shuffle();
        sound.playWin();
      }
      this.cascade(onMatch);
    }

    update(dt) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = this.grid[r][c];
          if (p) p.update(dt);
        }
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update(dt);
        if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        this.floatingTexts[i].life -= dt;
        this.floatingTexts[i].y -= 40 * dt;
        if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
      }
    }

    render(ctx, width, height) {
      ctx.clearRect(0, 0, width, height);

      const cellSize = width / 7;
      const r = cellSize * 0.42;

      // 盤面背景グリッド
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          const isAlt = (row + col) % 2 === 0;
          ctx.fillStyle = isAlt ? 'rgba(32, 26, 54, 0.7)' : 'rgba(20, 16, 36, 0.7)';
          ctx.beginPath();
          ctx.roundRect(col * cellSize + 2, row * cellSize + 2, cellSize - 4, cellSize - 4, 8);
          ctx.fill();
        }
      }

      // ピース描画 (立体PBR調ベクター)
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          const p = this.grid[row][col];
          if (!p || p.scale <= 0.01) continue;

          const px = p.animX * cellSize + cellSize / 2;
          const py = p.animY * cellSize + cellSize / 2;

          ctx.save();
          ctx.translate(px, py);
          ctx.scale(p.scale, p.scale);

          // 木箱
          if (p.obstacle === 1 || p.obstacle === 2) {
            ctx.fillStyle = p.obstacle === 2 ? '#5c3a21' : '#a07855';
            ctx.strokeStyle = '#3d2314';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(-r, -r, r * 2, r * 2, 6);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(-r + 3, -r + 3); ctx.lineTo(r - 3, r - 3);
            ctx.moveTo(r - 3, -r + 3); ctx.lineTo(-r + 3, r - 3);
            ctx.strokeStyle = '#3d2314';
            ctx.lineWidth = 1.8;
            ctx.stroke();

            if (p.obstacle === 2 && p.hp === 2) {
              ctx.fillStyle = '#fff';
              ctx.font = '900 14px sans-serif';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText('2', 0, 0);
            }
            ctx.restore();
            continue;
          }

          // 鍵
          if (p.obstacle === 4) {
            ctx.fillStyle = '#ffd700';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -r * 0.3, r * 0.35, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#141124';
            ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(-r * 0.1, -r * 0.1, r * 0.2, r * 0.6);
            ctx.fillRect(0, r * 0.2, r * 0.25, r * 0.1);
            ctx.restore();
            continue;
          }

          // レインボー
          if (p.special === CONFIG.SPECIAL_TYPES.RAINBOW) {
            const colors = ['#ff2a7a', '#ff9800', '#ffeb3b', '#4caf50', '#00d2ff', '#9c27b0'];
            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
            const w = (r * 2) / colors.length;
            colors.forEach((c, idx) => {
              ctx.fillStyle = c; ctx.fillRect(-r + idx * w, -r, w, r * 2);
            });
            ctx.restore();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.9}px Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🌈', 0, 0);
            ctx.restore();
            continue;
          }

          // 通常ピース
          const colorTheme = CONFIG.COLORS[p.type] || CONFIG.COLORS[0];
          
          // 影
          ctx.beginPath();
          ctx.arc(0, 3, r, 0, Math.PI * 2);
          ctx.fillStyle = colorTheme.dark;
          ctx.fill();

          // グラデーション
          const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
          grad.addColorStop(0, colorTheme.light);
          grad.addColorStop(0.6, colorTheme.color);
          grad.addColorStop(1, colorTheme.dark);

          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          switch (p.type) {
            case 0: ctx.fillStyle = '#663c00'; ctx.font = `900 ${r * 1.0}px Arial`; ctx.fillText('★', 0, 1); break;
            case 1: ctx.font = `900 ${r * 0.85}px Arial`; ctx.fillText('💎', 0, 0); break;
            case 2: ctx.font = `900 ${r * 0.85}px Arial`; ctx.fillText('🎯', 0, 0); break;
            case 3: ctx.font = `900 ${r * 0.85}px Arial`; ctx.fillText('🎨', 0, 0); break;
            case 4: ctx.font = `900 ${r * 0.85}px Arial`; ctx.fillText('⚡', 0, 1); break;
          }

          if (p.special === CONFIG.SPECIAL_TYPES.ROCKET_H) {
            ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.8}px Arial`; ctx.fillText('↔', 0, 0);
          } else if (p.special === CONFIG.SPECIAL_TYPES.ROCKET_V) {
            ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.8}px Arial`; ctx.fillText('↕', 0, 0);
          } else if (p.special === CONFIG.SPECIAL_TYPES.BOMB_AREA) {
            ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2.5;
            ctx.strokeRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
          }

          if (p.obstacle === 3) {
            ctx.fillStyle = 'rgba(20,16,36,0.75)';
            ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffc83b'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.3, Math.PI, 0); ctx.stroke();
            ctx.fillStyle = '#ffc83b'; ctx.fillRect(-r * 0.3, -r * 0.1, r * 0.6, r * 0.45);
          }

          ctx.restore();
        }
      }

      // パーティクル
      this.particles.forEach(pt => pt.render(ctx));

      // テキスト
      this.floatingTexts.forEach(ft => {
        ctx.save();
        ctx.font = `900 ${ft.size}px 'Bangers', 'M PLUS Rounded 1c', sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#0d0b17';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      });
    }

    wait(ms) { return new Promise(res => setTimeout(res, ms)); }
  }

  // ==================== 9. メインゲームアプリケーション ====================
  class GameApp {
    constructor() {
      this.canvas = document.getElementById('puzzle-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.container = document.getElementById('three-container');

      this.board = new Board();
      this.selectedCharIdx = 0;
      this.currentSp = 0;

      this.currentStageId = 1;
      this.currentStageData = null;
      this.score = 0;
      this.movesLeft = 0;
      this.targetProgress = 0;
      this.maxCombo = 0;
      this.gameState = 'TITLE';

      this.dragStart = null;
      this.lastTime = performance.now();

      this.initEvents();
      this.initTitleHero();
      this.resizeCanvas();
      this.startLoop();
    }

    get currentChar() { return CHARACTERS[this.selectedCharIdx]; }

    initEvents() {
      window.addEventListener('resize', () => this.resizeCanvas());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resizeCanvas(), 100));

      // タイトル画面
      document.getElementById('btn-start-game').addEventListener('click', (e) => {
        e.preventDefault();
        sound.init();
        sound.playMatch(1);
        sound.startBGM();
        this.openStageSelect();
      });

      document.getElementById('btn-sound-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        sound.init();
        const en = sound.toggle();
        storage.setSoundEnabled(en);
        document.getElementById('sound-btn-text').textContent = en ? '🔊 サウンド: ON' : '🔇 サウンド: OFF';
      });

      // ステージマップ戻る
      document.getElementById('btn-stage-back').addEventListener('click', (e) => {
        e.preventDefault();
        this.showScreen('screen-title');
        this.gameState = 'TITLE';
      });

      // ポーズ
      document.getElementById('btn-game-pause').addEventListener('click', () => this.showModal('modal-pause'));
      document.getElementById('btn-pause-resume').addEventListener('click', () => this.hideModals());
      document.getElementById('btn-pause-sound').addEventListener('click', () => sound.toggle());
      document.getElementById('btn-pause-map').addEventListener('click', () => { this.hideModals(); this.openStageSelect(); });

      // リザルト
      document.getElementById('btn-clear-map').addEventListener('click', () => { this.hideModals(); this.openStageSelect(); });
      document.getElementById('btn-clear-next').addEventListener('click', () => {
        this.hideModals();
        if (this.currentStageId < STAGES.length) this.startStage(this.currentStageId + 1);
        else this.openStageSelect();
      });
      document.getElementById('btn-gameover-map').addEventListener('click', () => { this.hideModals(); this.openStageSelect(); });
      document.getElementById('btn-gameover-retry').addEventListener('click', () => {
        this.hideModals();
        this.startStage(this.currentStageId);
      });

      // スキル＆キャラ切り替え
      document.getElementById('btn-skill-action').addEventListener('click', () => this.triggerSkill());
      document.getElementById('btn-char-avatar').addEventListener('click', () => {
        if (this.currentSp < this.currentChar.maxSp) {
          this.selectedCharIdx = (this.selectedCharIdx + 1) % 4;
          this.updateCharDisplay();
        } else {
          this.triggerSkill();
        }
      });

      // ステージグリッドのイベント委譲 (Event Delegation)
      const stageContainer = document.getElementById('stage-grid-container');
      const handleStagePick = (e) => {
        const card = e.target.closest('.stage-card');
        if (card && !card.classList.contains('locked')) {
          const stageId = parseInt(card.getAttribute('data-stage'), 10);
          if (stageId) {
            sound.init();
            sound.playMatch(1);
            this.startStage(stageId);
          }
        }
      };

      stageContainer.addEventListener('click', handleStagePick);
      stageContainer.addEventListener('touchend', handleStagePick);

      // パズル操作 (タッチ＆マウス)
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scale = this.canvas.width / rect.width;
        return {
          x: (clientX - rect.left) * scale,
          y: (clientY - rect.top) * scale,
          rawX: clientX,
          rawY: clientY
        };
      };

      const onStart = (e) => {
        if (e.cancelable) e.preventDefault();
        if (this.gameState !== 'PLAYING' || this.board.isAnimating) return;
        const p = getPos(e);
        const cellSize = this.canvas.width / 7;
        const col = Math.floor(p.x / cellSize);
        const row = Math.floor(p.y / cellSize);
        if (row >= 0 && row < 7 && col >= 0 && col < 7) {
          this.dragStart = { row, col, x: p.rawX, y: p.rawY };
          if (this.board.grid[row][col]) this.board.grid[row][col].scale = 1.2;
        }
      };

      const onMove = async (e) => {
        if (e.cancelable) e.preventDefault();
        if (!this.dragStart || this.gameState !== 'PLAYING' || this.board.isAnimating) return;
        const p = getPos(e);
        const dx = p.rawX - this.dragStart.x;
        const dy = p.rawY - this.dragStart.y;
        const threshold = 16;

        if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
          let tr = this.dragStart.row;
          let tc = this.dragStart.col;
          if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
          else tr += dy > 0 ? 1 : -1;

          const r1 = this.dragStart.row;
          const c1 = this.dragStart.col;
          this.dragStart = null;

          if (tr >= 0 && tr < 7 && tc >= 0 && tc < 7) {
            await this.executeMove(r1, c1, tr, tc);
          }
        }
      };

      const onEnd = () => {
        if (this.dragStart && this.board.grid[this.dragStart.row]?.[this.dragStart.col]) {
          this.board.grid[this.dragStart.row][this.dragStart.col].scale = 1.0;
        }
        this.dragStart = null;
      };

      this.canvas.addEventListener('pointerdown', onStart, { passive: false });
      this.canvas.addEventListener('pointermove', onMove, { passive: false });
      this.canvas.addEventListener('pointerup', onEnd, { passive: false });
      this.canvas.addEventListener('touchstart', onStart, { passive: false });
      this.canvas.addEventListener('touchmove', onMove, { passive: false });
      this.canvas.addEventListener('touchend', onEnd, { passive: false });
    }

    resizeCanvas() {
      const rect = this.container.getBoundingClientRect();
      const size = Math.min(rect.width || 360, rect.height || 360, 400);
      if (size > 40) {
        this.canvas.width = size;
        this.canvas.height = size;
      }
    }

    showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const sc = document.getElementById(id);
      if (sc) sc.classList.add('active');
    }

    showModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.add('active');
    }

    hideModals() {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }

    openStageSelect() {
      this.gameState = 'STAGE_SELECT';
      this.renderStageMap();
      this.showScreen('screen-stage-select');
    }

    renderStageMap() {
      const container = document.getElementById('stage-grid-container');
      container.innerHTML = '';
      const unlocked = storage.getUnlockedStage();

      STAGES.forEach(st => {
        const isLocked = st.id > unlocked;
        const isActive = st.id === unlocked;
        const stars = storage.getStageStars(st.id);

        const card = document.createElement('div');
        card.className = `stage-card ${isLocked ? 'locked' : ''} ${isActive ? 'active-stage' : ''} ${st.type === 'BOSS' ? 'boss' : ''}`;
        card.setAttribute('data-stage', st.id);

        const starsHtml = [1, 2, 3].map(i => `<span class="${i <= stars ? 'star-filled' : ''}">★</span>`).join('');
        card.innerHTML = `
          <div class="stage-number">${st.id}</div>
          <div class="stage-type-badge">${st.type === 'BOSS' ? '👑 BOSS' : st.title}</div>
          <div class="stage-stars">${starsHtml}</div>
        `;

        if (!isLocked) {
          card.onclick = (e) => {
            e.stopPropagation();
            sound.init();
            sound.playMatch(1);
            this.startStage(st.id);
          };
        }

        container.appendChild(card);
      });
    }

    startStage(id) {
      this.currentStageId = id;
      const st = JSON.parse(JSON.stringify(STAGES.find(s => s.id === id) || STAGES[0]));
      if (st.boss) st.boss.hp = st.boss.maxHp;
      this.currentStageData = st;

      this.score = 0;
      this.movesLeft = st.moves;
      this.targetProgress = 0;
      this.maxCombo = 0;
      this.currentSp = 0;
      this.gameState = 'PLAYING';

      this.board.init(st);
      this.updateCharDisplay();
      this.updateHUD();

      this.showScreen('screen-game');
      this.resizeCanvas();
      this.board.render(this.ctx, this.canvas.width, this.canvas.height);

      setTimeout(() => {
        this.resizeCanvas();
        this.board.render(this.ctx, this.canvas.width, this.canvas.height);
      }, 40);
    }

    async executeMove(r1, c1, r2, c2) {
      const ok = await this.board.trySwap(r1, c1, r2, c2, (info) => this.onMatch(info));
      if (ok) {
        this.movesLeft--;
        this.currentSp = Math.min(this.currentChar.maxSp, this.currentSp + 20);
        this.updateCharDisplay();

        if (this.currentStageData.type === 'BOSS' && this.currentStageData.boss && this.currentStageData.boss.hp > 0) {
          if (this.movesLeft % this.currentStageData.boss.attackInterval === 0) {
            this.bossAttack();
          }
        }

        this.updateHUD();
        this.checkOutcome();
      }
    }

    onMatch(info) {
      const count = info.count || 3;
      const combo = info.combo || 1;
      this.maxCombo = Math.max(this.maxCombo, combo);

      this.score += Math.floor(count * CONFIG.SCORE.BASE_MATCH * Math.pow(CONFIG.SCORE.COMBO_MULTIPLIER, combo - 1));

      if (this.currentStageData.type === 'COLLECT' && info.typeCounts) {
        if (info.typeCounts[this.currentStageData.target.type]) {
          this.targetProgress += info.typeCounts[this.currentStageData.target.type];
        }
      } else if (this.currentStageData.type === 'KEY_DROP' && info.keyCollected) {
        this.targetProgress += 1;
      } else if (this.currentStageData.type === 'BOSS' && this.currentStageData.boss) {
        const dmg = count * 3 * combo;
        this.currentStageData.boss.hp = Math.max(0, this.currentStageData.boss.hp - dmg);
        if (this.currentStageData.boss.hp <= 0) this.targetProgress = 1;
      } else if (this.currentStageData.type === 'OBSTACLE_CRATE' || this.currentStageData.type === 'UNLOCK' || this.currentStageData.type === 'MIXED') {
        this.targetProgress += 1;
      }

      this.updateHUD();
    }

    bossAttack() {
      sound.playExplode();
      const r = Math.floor(Math.random() * 7);
      const c = Math.floor(Math.random() * 7);
      const p = this.board.grid[r][c];
      if (p) {
        p.obstacle = 1;
        p.hp = 1;
        p.scale = 1.3;
      }
    }

    triggerSkill() {
      if (this.currentSp < this.currentChar.maxSp || this.board.isAnimating || this.gameState !== 'PLAYING') return;

      sound.playSkill();
      const cutin = document.getElementById('skill-cutin-layer');
      document.getElementById('cutin-char-name').textContent = this.currentChar.name;
      document.getElementById('cutin-skill-name').textContent = `${this.currentChar.skillName} 発動！！`;
      cutin.classList.add('active');
      setTimeout(() => cutin.classList.remove('active'), 1200);

      if (this.currentChar.id === 'hayato') this.movesLeft += 3;
      this.currentSp = 0;
      this.updateCharDisplay();

      setTimeout(() => {
        this.board.executeSkill(this.currentChar.id, (info) => this.onMatch(info));
        this.updateHUD();
        this.checkOutcome();
      }, 600);
    }

    updateHUD() {
      document.getElementById('label-score').textContent = this.score.toLocaleString();
      document.getElementById('label-moves').textContent = this.movesLeft;
      document.getElementById('label-stage-num').textContent = this.currentStageId;

      const targetBox = document.getElementById('target-items-box');
      targetBox.innerHTML = `
        <div class="target-item">
          <span>${this.currentStageData.target.text}:</span>
          <span style="color: ${this.targetProgress >= this.currentStageData.target.count ? '#2ecc71' : '#ffc83b'}">
            ${Math.min(this.targetProgress, this.currentStageData.target.count)} / ${this.currentStageData.target.count}
          </span>
        </div>
      `;

      const bossBanner = document.getElementById('boss-banner');
      if (this.currentStageData.type === 'BOSS' && this.currentStageData.boss) {
        bossBanner.classList.add('active');
        const hp = Math.max(0, this.currentStageData.boss.hp);
        const max = this.currentStageData.boss.maxHp;
        document.getElementById('boss-name-text').textContent = `👹 ${this.currentStageData.boss.name}`;
        document.getElementById('boss-hp-text').textContent = `${hp} / ${max}`;
        document.getElementById('boss-hp-fill').style.width = `${(hp / max) * 100}%`;
      } else {
        bossBanner.classList.remove('active');
      }
    }

    updateCharDisplay() {
      const char = this.currentChar;
      document.getElementById('char-name-label').textContent = `${char.name} (${char.title})`;
      const pct = Math.min(100, Math.floor((this.currentSp / char.maxSp) * 100));
      document.getElementById('sp-fill').style.width = `${pct}%`;
      document.getElementById('sp-val-label').textContent = `${pct}%`;

      const ready = this.currentSp >= char.maxSp;
      const avatarBtn = document.getElementById('btn-char-avatar');
      const skillBtn = document.getElementById('btn-skill-action');

      if (ready) {
        avatarBtn.classList.add('ready');
        skillBtn.classList.add('show');
      } else {
        avatarBtn.classList.remove('ready');
        skillBtn.classList.remove('show');
      }

      // アバターアイコン描画
      const canvas = document.getElementById('char-avatar-canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 48, 48);
      ctx.beginPath(); ctx.arc(24, 24, 22, 0, Math.PI * 2); ctx.fillStyle = char.color; ctx.fill();
      ctx.beginPath(); ctx.arc(24, 26, 14, 0, Math.PI * 2); ctx.fillStyle = '#ffdfba'; ctx.fill();
      ctx.fillStyle = '#12101e';
      ctx.beginPath(); ctx.arc(20, 25, 2.5, 0, Math.PI * 2); ctx.arc(28, 25, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    checkOutcome() {
      if (this.targetProgress >= this.currentStageData.target.count) {
        this.gameState = 'STAGE_CLEAR';
        sound.playWin();
        const bonus = this.movesLeft * CONFIG.SCORE.REMAINING_MOVE_BONUS;
        this.score += bonus;

        let stars = 1;
        if (this.score >= this.currentStageData.starScores[2]) stars = 3;
        else if (this.score >= this.currentStageData.starScores[1]) stars = 2;

        storage.recordStageClear(this.currentStageId, this.score, stars);

        setTimeout(() => {
          document.getElementById('modal-clear-score').textContent = this.score.toLocaleString();
          document.getElementById('modal-clear-bonus').textContent = `+${bonus.toLocaleString()}`;
          document.getElementById('modal-clear-combo').textContent = `${this.maxCombo} Combo!`;
          document.getElementById('modal-clear-stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? 'star-filled' : ''}">★</span>`).join('');
          this.showModal('modal-clear');
        }, 600);
      } else if (this.movesLeft <= 0) {
        this.gameState = 'GAME_OVER';
        sound.playLose();
        setTimeout(() => {
          document.getElementById('modal-gameover-score').textContent = this.score.toLocaleString();
          this.showModal('modal-gameover');
        }, 600);
      }
    }

    // ==================== タイトル画面の美麗ボスVSちびっこギャングイラスト ====================
    initTitleHero() {
      const canvas = document.getElementById('title-hero-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let t = 0;

      const loop = () => {
        t += 0.035;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const floatY = Math.sin(t) * 5;

        // 背景のネオン爆発・グラフィティオーラ
        const bgGrad = ctx.createRadialGradient(w/2, h/2, 20, w/2, h/2, 140);
        bgGrad.addColorStop(0, 'rgba(255, 42, 122, 0.35)');
        bgGrad.addColorStop(0.5, 'rgba(155, 81, 224, 0.2)');
        bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // --- 1. 右側：巨大ボス（総帥ジャック） ---
        const bx = 205;
        const by = 110 + floatY * 0.5;

        // ボスの黒ジャケット＆巨大な肩幅
        ctx.fillStyle = '#1c162e';
        ctx.beginPath();
        ctx.roundRect(bx - 45, by - 20, 95, 110, 18);
        ctx.fill();
        ctx.strokeStyle = '#ff2a7a';
        ctx.lineWidth = 3;
        ctx.stroke();

        // ボスのゴールドネックレス
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bx + 2, by + 20, 24, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // ボスの顔 (厳つい輪郭)
        ctx.fillStyle = '#e8b896';
        ctx.beginPath();
        ctx.roundRect(bx - 32, by - 65, 64, 65, 12);
        ctx.fill();

        // ボスのリーゼントヘア
        ctx.fillStyle = '#ff2a7a';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by - 75, 38, 22, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // ボスのサングラス
        ctx.fillStyle = '#110d1f';
        ctx.beginPath();
        ctx.roundRect(bx - 28, by - 48, 56, 18, 5);
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();

        // サングラスの反射光
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - 20, by - 44); ctx.lineTo(bx - 8, by - 34);
        ctx.moveTo(bx + 6, by - 44); ctx.lineTo(bx + 18, by - 34);
        ctx.stroke();

        // ボスの不敵な笑み＆葉巻
        ctx.strokeStyle = '#4a1525';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(bx + 2, by - 20, 14, 0.1, Math.PI * 0.9);
        ctx.stroke();

        // 葉巻の煙
        ctx.fillStyle = '#9b51e0';
        ctx.fillRect(bx + 16, by - 22, 14, 4);
        ctx.fillStyle = '#ff5722';
        ctx.fillRect(bx + 28, by - 23, 4, 6);

        // --- 2. VS ロゴバッジ ---
        ctx.save();
        ctx.translate(145, 105);
        ctx.rotate(-0.2);
        ctx.font = '900 24px "Bangers", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#ff2a7a';
        ctx.lineWidth = 4;
        ctx.strokeText('VS', 0, 0);
        ctx.fillText('VS', 0, 0);
        ctx.restore();

        // --- 3. 左側：ちびっこギャング（レオ） ---
        const lx = 80;
        const ly = 125 - floatY;

        // レオの体
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.roundRect(lx - 22, ly - 10, 44, 55, 14);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // レオの顔
        ctx.fillStyle = '#ffdfba';
        ctx.beginPath();
        ctx.arc(lx, ly - 28, 25, 0, Math.PI * 2);
        ctx.fill();

        // レオのキャップ帽
        ctx.fillStyle = '#00d2ff';
        ctx.beginPath();
        ctx.arc(lx, ly - 36, 24, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(lx - 26, ly - 37, 54, 6);

        // 目
        ctx.fillStyle = '#12101e';
        ctx.beginPath();
        ctx.arc(lx - 7, ly - 28, 3.5, 0, Math.PI * 2);
        ctx.arc(lx + 7, ly - 28, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // ニヤリ口
        ctx.strokeStyle = '#12101e';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(lx, ly - 20, 8, 0.1, Math.PI * 0.9);
        ctx.stroke();

        // パチンコを構える腕＆光るゴールド弾
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(lx + 20, ly - 18, 6, 22);
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(lx + 24, ly - 22, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        requestAnimationFrame(loop);
      };
      loop();
    }

    startLoop() {
      const loop = (timestamp) => {
        const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        if (this.gameState === 'PLAYING') {
          this.board.update(dt);
          this.board.render(this.ctx, this.canvas.width, this.canvas.height);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.gameApp = new GameApp();
  });
})();
