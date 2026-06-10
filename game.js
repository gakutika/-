'use strict';

// ============================================================
// フリックキーボード定義
// ============================================================
const KEYBOARD_LAYOUT = [
  [
    { base: 'あ', flicks: { left: 'い', up: 'う', right: 'え', down: 'お' } },
    { base: 'か', flicks: { left: 'き', up: 'く', right: 'け', down: 'こ' } },
    { base: 'さ', flicks: { left: 'し', up: 'す', right: 'せ', down: 'そ' } },
    { base: 'た', flicks: { left: 'ち', up: 'つ', right: 'て', down: 'と' } },
    { base: 'な', flicks: { left: 'に', up: 'ぬ', right: 'ね', down: 'の' } },
  ],
  [
    { base: 'は', flicks: { left: 'ひ', up: 'ふ', right: 'へ', down: 'ほ' } },
    { base: 'ま', flicks: { left: 'み', up: 'む', right: 'め', down: 'も' } },
    { base: 'や', flicks: { left: '（', up: 'ゆ', right: '）', down: 'よ' } },
    { base: 'ら', flicks: { left: 'り', up: 'る', right: 'れ', down: 'ろ' } },
    { base: 'わ', flicks: { left: 'を', up: 'ん', right: 'ー', down: '゛' } },
  ],
  [
    { base: 'ゃ', flicks: null },
    { base: 'ゅ', flicks: null },
    { base: 'ょ', flicks: null },
    { base: '゜', flicks: null },
    { base: '゛', flicks: null },
  ],
];

const CHAR_DECOMPOSE = {
  'が': ['か','゛'], 'ぎ': ['き','゛'], 'ぐ': ['く','゛'], 'げ': ['け','゛'], 'ご': ['こ','゛'],
  'ざ': ['さ','゛'], 'じ': ['し','゛'], 'ず': ['す','゛'], 'ぜ': ['せ','゛'], 'ぞ': ['そ','゛'],
  'だ': ['た','゛'], 'ぢ': ['ち','゛'], 'づ': ['つ','゛'], 'で': ['て','゛'], 'ど': ['と','゛'],
  'ば': ['は','゛'], 'び': ['ひ','゛'], 'ぶ': ['ふ','゛'], 'べ': ['へ','゛'], 'ぼ': ['ほ','゛'],
  'ぱ': ['は','゜'], 'ぴ': ['ひ','゜'], 'ぷ': ['ふ','゜'], 'ぺ': ['へ','゜'], 'ぽ': ['ほ','゜'],
  'っ': ['つ','つ'],
};

function expandStrokes(label) {
  const strokes = [];
  for (const ch of label) {
    if (CHAR_DECOMPOSE[ch]) strokes.push(...CHAR_DECOMPOSE[ch]);
    else strokes.push(ch);
  }
  return strokes;
}

// ============================================================
// ミッション（難易度）設定
// ============================================================
const MISSIONS = {
  easy: {
    id: 'easy',
    label: 'EASY MODE / 初級',
    timeLimit: 40,
    quota: 1000,
    words: ['すまほ', 'ばずる', 'ねっと', 'がち', 'それな', 'ろぐいん', 'あぷり', 'ばぐ'],
  },
  normal: {
    id: 'normal',
    label: 'NORMAL MODE / 中級',
    timeLimit: 45,
    quota: 3000,
    words: ['いんすた', 'ついったー', 'どがはしん', 'てくのろじー', 'さいばー', 'がじぇっと'],
  },
  hard: {
    id: 'hard',
    label: 'HARD MODE / 上級',
    timeLimit: 50,
    quota: 5000,
    words: ['ぷろぐらみんぐ', 'じんこうちのう', 'いんたーねっと', 'せきゅりてぃ', 'あくせすしゅうちゅう'],
  },
};

// キーボードにない文字がある単語の打鍵上書き（ぇ → え など）
const WORD_STROKE_OVERRIDES = {
  'がじぇっと': expandStrokes('がじえっと'),
};

// 単語データを打鍵シーケンス付きで準備
Object.values(MISSIONS).forEach(m => {
  m.wordData = m.words.map(label => ({
    label,
    strokes: WORD_STROKE_OVERRIDES[label] || expandStrokes(label),
  }));
});

// コンボ回復など（ミッション中の爽快感）
const TIME_CONFIG = {
  charRecover: 0.35,
  perfectRecover: 1.2,
  comboRecoverBonus: 0.06,
  missPenalty: 0.5,
};

const FLICK_THRESHOLD = 18;

// ============================================================
// エージェント・ランク（称号）S〜D ※難易度ごとのスコア基準
// ============================================================
const RANK_THRESHOLDS = {
  easy:   { s: 1700, a: 1300, b: 1000, c: 650  },
  normal: { s: 5000, a: 3800, b: 3000, c: 2000 },
  hard:   { s: 8200, a: 6200, b: 5000, c: 3500 },
};

const RANK_DEFS = [
  { letter: 'S', cls: 'rank-s' },
  { letter: 'A', cls: 'rank-a' },
  { letter: 'B', cls: 'rank-b' },
  { letter: 'C', cls: 'rank-c' },
  { letter: 'D', cls: 'rank-d' },
];

// スコアと難易度からランクを判定
function getRank(score, missionId = 'normal') {
  const t = RANK_THRESHOLDS[missionId] || RANK_THRESHOLDS.normal;
  let letter = 'D';
  if (score >= t.s) letter = 'S';
  else if (score >= t.a) letter = 'A';
  else if (score >= t.b) letter = 'B';
  else if (score >= t.c) letter = 'C';
  const def = RANK_DEFS.find(r => r.letter === letter);
  return { letter, label: `${letter} RANK`, cls: def.cls };
}

// リザルト画面のランク表示を更新
function renderResultRank(rankInfo) {
  els.resultRank.className = `result-rank rank-display ${rankInfo.cls}`;
  document.getElementById('resultRankLetter').textContent = rankInfo.letter;
}

// ランキング用の小さなグレードバッジHTML
function gradeBadgeHtml(letter, cls) {
  return `<span class="lb-grade ${cls}">${letter}</span>`;
}

// ============================================================
// ローカルランキング（localStorage）
// ============================================================
const LB_STORAGE_KEY = 'cyberflick_leaderboard_v1';
const DEFAULT_AGENT_NAME = 'ななしのエージェント';

// 近未来ライバルNPCの初期データ（難易度ごとの基準スコアに合わせた数値）
const LB_SEED_DATA = {
  easy: [
    { name: 'CyberX',     score: 1850, isNpc: true },
    { name: 'NeoNeo',     score: 1620, isNpc: true },
    { name: 'ZeroByte',   score: 1480, isNpc: true },
    { name: 'Glitch_99',  score: 1320, isNpc: true },
    { name: 'PixelNova',  score: 1180, isNpc: true },
    { name: 'NetRunner',  score: 1050, isNpc: true },
    { name: 'DataStream', score: 980,  isNpc: true },
    { name: 'GhostType',  score: 870,  isNpc: true },
  ],
  normal: [
    { name: 'CyberX',     score: 5200, isNpc: true },
    { name: 'NeoNeo',     score: 4650, isNpc: true },
    { name: 'ZeroByte',   score: 4100, isNpc: true },
    { name: 'Glitch_99',  score: 3800, isNpc: true },
    { name: 'PixelNova',  score: 3500, isNpc: true },
    { name: 'NetRunner',  score: 3200, isNpc: true },
    { name: 'DataStream', score: 2900, isNpc: true },
    { name: 'GhostType',  score: 2600, isNpc: true },
  ],
  hard: [
    { name: 'CyberX',     score: 8500, isNpc: true },
    { name: 'NeoNeo',     score: 7800, isNpc: true },
    { name: 'ZeroByte',   score: 7200, isNpc: true },
    { name: 'Glitch_99',  score: 6800, isNpc: true },
    { name: 'PixelNova',  score: 6200, isNpc: true },
    { name: 'NetRunner',  score: 5800, isNpc: true },
    { name: 'DataStream', score: 5400, isNpc: true },
    { name: 'GhostType',  score: 5100, isNpc: true },
  ],
};

let lbViewMission = 'easy';
let lbHighlightDate = null; // 送信直後の自分の行をハイライト

function initLeaderboard() {
  if (localStorage.getItem(LB_STORAGE_KEY)) return;
  const data = {
    easy:   LB_SEED_DATA.easy.map(e => ({ ...e })),
    normal: LB_SEED_DATA.normal.map(e => ({ ...e })),
    hard:   LB_SEED_DATA.hard.map(e => ({ ...e })),
  };
  localStorage.setItem(LB_STORAGE_KEY, JSON.stringify(data));
}

function loadLeaderboard() {
  initLeaderboard();
  return JSON.parse(localStorage.getItem(LB_STORAGE_KEY));
}

function saveLeaderboard(data) {
  localStorage.setItem(LB_STORAGE_KEY, JSON.stringify(data));
}

function submitToLeaderboard(missionId, agentName, score, meta = {}) {
  const data = loadLeaderboard();
  const entry = {
    name: (agentName || '').trim() || DEFAULT_AGENT_NAME,
    score,
    isNpc: false,
    date: Date.now(),
    achievement: meta.achievement || 0,
    agentRank: meta.agentRank || 'D',
  };
  data[missionId].push(entry);
  data[missionId].sort((a, b) => b.score - a.score);
  data[missionId] = data[missionId].slice(0, 10);
  saveLeaderboard(data);

  const rank = data[missionId].findIndex(e => e.date === entry.date) + 1;
  return { entry, rank };
}

function renderLeaderboard(missionId) {
  lbViewMission = missionId;
  const data = loadLeaderboard();
  const list = data[missionId] || [];

  // タブのアクティブ切替
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.classList.toggle('lb-tab--active', tab.dataset.lb === missionId);
  });

  const tbody = document.getElementById('lbTableBody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="lb-empty">NO DATA</td></tr>';
    return;
  }

  list.forEach((entry, i) => {
    const pos = i + 1;
    const tr = document.createElement('tr');
    let rowCls = 'lb-row';
    if (pos === 1) rowCls += ' lb-row--gold';
    else if (pos === 2) rowCls += ' lb-row--silver';
    else if (pos === 3) rowCls += ' lb-row--bronze';
    if (!entry.isNpc && entry.date === lbHighlightDate) rowCls += ' lb-row--player';
    tr.className = rowCls;

    const grade = getRank(entry.score, missionId);
    const posLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    tr.innerHTML = `
      <td class="lb-rank">${posLabel}</td>
      <td class="lb-grade-cell">${gradeBadgeHtml(grade.letter, grade.cls)}</td>
      <td class="lb-name">${escapeHtml(entry.name)}${!entry.isNpc && entry.date === lbHighlightDate ? ' <span class="lb-you">YOU</span>' : ''}</td>
      <td class="lb-score">${entry.score.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  // 送信直後のヒント表示
  const hint = document.getElementById('lbPlayerHint');
  if (lbHighlightDate) {
    const playerEntry = list.find(e => e.date === lbHighlightDate);
    if (playerEntry) {
      const r = list.indexOf(playerEntry) + 1;
      hint.textContent = `★ ランクイン！ ${r}位 / ${playerEntry.score.toLocaleString()} pt`;
      hint.classList.add('lb-hint--active');
    } else {
      hint.textContent = '※ スコアがトップ10圏外のためランクインできませんでした';
      hint.classList.remove('lb-hint--active');
    }
  } else {
    hint.textContent = '';
    hint.classList.remove('lb-hint--active');
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showLeaderboard(missionId) {
  renderLeaderboard(missionId || state.mission?.id || 'easy');
  showScreen('leaderboard');
}

// ============================================================
// 効果音・BGM
// ============================================================
const AUDIO_URLS = {
  perfect:  'https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3',
  miss:     'https://www.myinstants.com/media/sounds/error_CDOxCYm.mp3',
  gameOver: 'https://www.myinstants.com/media/sounds/denied.mp3',
  bgm:      'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
};

const audio = {
  perfect: null, miss: null, gameOver: null, bgm: null,
  enabled: true, unlocked: false,
  bgmVolume: 0.15, seVolume: 0.6,
};

function createAudio(src) {
  const a = new Audio(src);
  a.preload = 'auto';
  return a;
}

function initAudio() {
  audio.perfect  = createAudio(AUDIO_URLS.perfect);
  audio.miss     = createAudio(AUDIO_URLS.miss);
  audio.gameOver = createAudio(AUDIO_URLS.gameOver);
  audio.bgm      = createAudio(AUDIO_URLS.bgm);
  audio.bgm.loop = true;
  applyVolumes();
}

function applyVolumes() {
  if (audio.bgm)      audio.bgm.volume = audio.bgmVolume;
  if (audio.perfect)  audio.perfect.volume = audio.seVolume;
  if (audio.miss)     audio.miss.volume = audio.seVolume;
  if (audio.gameOver) audio.gameOver.volume = audio.seVolume;
}

async function unlockAudio() {
  if (audio.unlocked) return;
  for (const a of [audio.perfect, audio.miss, audio.gameOver, audio.bgm]) {
    if (!a) continue;
    try {
      a.muted = true;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    } catch { a.muted = false; }
  }
  audio.unlocked = true;
}

function playSE(name) {
  if (!audio.unlocked) return;
  const t = audio[name];
  if (!t) return;
  const se = t.cloneNode();
  se.volume = audio.seVolume;
  se.play().catch(() => {});
}

function startBGM() {
  if (!audio.unlocked) return;
  audio.bgm.currentTime = 0;
  audio.bgm.play().catch(() => {});
}

function stopBGM() {
  if (audio.bgm) { audio.bgm.pause(); audio.bgm.currentTime = 0; }
}

// ============================================================
// ゲーム状態
// ============================================================
const state = {
  mission: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  wordsCleared: 0,
  timeLeft: 40,
  maxTime: 40,
  currentWord: null,
  inputIndex: 0,
  inputHistory: [],
  isPlaying: false,
  isPaused: false,
  timerId: null,
};

// ============================================================
// DOM
// ============================================================
const screens = {
  home:        document.getElementById('screenHome'),
  mission:     document.getElementById('screenMission'),
  game:        document.getElementById('screenGame'),
  result:      document.getElementById('screenResult'),
  leaderboard: document.getElementById('screenLeaderboard'),
};

const els = {
  score:            document.getElementById('score'),
  combo:            document.getElementById('combo'),
  comboMultiplier:  document.getElementById('comboMultiplier'),
  achievementHud:   document.getElementById('achievementHud'),
  timerFill:        document.getElementById('timerFill'),
  targetWord:       document.getElementById('targetWord'),
  inputDisplay:     document.getElementById('inputDisplay'),
  effectOverlay:    document.getElementById('effectOverlay'),
  flickKeyboard:    document.getElementById('flickKeyboard'),
  missionLabel:     document.getElementById('missionLabel'),
  resultMissionLabel: document.getElementById('resultMissionLabel'),
  resultStatus:     document.getElementById('resultStatus'),
  resultAchievement:document.getElementById('resultAchievement'),
  resultScore:      document.getElementById('resultScore'),
  resultRank:         document.getElementById('resultRank'),
  resultDetail:     document.getElementById('resultDetail'),
  agentName:        document.getElementById('agentName'),
  screenSettings:   document.getElementById('screenSettings'),
  bgmVolume:        document.getElementById('bgmVolume'),
  seVolume:         document.getElementById('seVolume'),
  bgmVolumeVal:     document.getElementById('bgmVolumeVal'),
  seVolumeVal:      document.getElementById('seVolumeVal'),
};

// ============================================================
// 画面遷移
// ============================================================
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.classList.toggle('hidden', key !== name);
  });
}

function openSettings() {
  els.screenSettings.classList.remove('hidden');
}

function closeSettings() {
  els.screenSettings.classList.add('hidden');
  if (state.isPaused && state.isPlaying) resumeGame();
}

// ============================================================
// 達成率・ノルマ
// ============================================================
function getQuota() {
  return state.mission ? state.mission.quota : 1000;
}

function getAchievementPct() {
  const quota = getQuota();
  return quota > 0 ? Math.round((state.score / quota) * 100) : 0;
}

function recoverTime(amount) {
  state.timeLeft = Math.min(state.maxTime, state.timeLeft + amount);
}

// ============================================================
// キーボード
// ============================================================
function buildKeyboard() {
  els.flickKeyboard.innerHTML = '';
  KEYBOARD_LAYOUT.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    row.forEach(k => rowEl.appendChild(createFlickKey(k)));
    els.flickKeyboard.appendChild(rowEl);
  });
}

function createFlickKey(keyData) {
  const key = document.createElement('div');
  key.className = 'flick-key';
  const center = document.createElement('span');
  center.className = 'key-center';
  center.textContent = keyData.base;
  key.appendChild(center);

  if (keyData.flicks) {
    const guide = document.createElement('div');
    guide.className = 'flick-guide';
    ['up','down','left','right'].forEach(dir => {
      const span = document.createElement('span');
      span.className = `flick-dir ${dir}`;
      span.dataset.dir = dir;
      span.textContent = keyData.flicks[dir];
      guide.appendChild(span);
    });
    key.appendChild(guide);
    const indicator = document.createElement('div');
    indicator.className = 'flick-indicator';
    key.appendChild(indicator);
  } else {
    key.classList.add('flick-key--modifier');
  }

  attachPointerEvents(key, keyData);
  return key;
}

function attachPointerEvents(keyEl, keyData) {
  let startX = 0, startY = 0, currentDir = null, isActive = false;

  keyEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    keyEl.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    currentDir = null; isActive = true;
    keyEl.classList.add('is-active');
    clearDirHighlights(keyEl);
  });

  keyEl.addEventListener('pointermove', e => {
    if (!isActive || !keyData.flicks) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.hypot(dx, dy) < FLICK_THRESHOLD) {
      currentDir = null;
      keyEl.classList.remove('is-flicking');
      clearDirHighlights(keyEl);
      return;
    }
    currentDir = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
    keyEl.classList.add('is-flicking');
    highlightDir(keyEl, currentDir);
    const ind = keyEl.querySelector('.flick-indicator');
    if (ind) {
      const r = keyEl.getBoundingClientRect();
      ind.style.left = `${e.clientX - r.left - 4}px`;
      ind.style.top  = `${e.clientY - r.top  - 4}px`;
    }
  });

  const onRelease = () => {
    if (!isActive) return;
    isActive = false;
    keyEl.classList.remove('is-active', 'is-flicking');
    clearDirHighlights(keyEl);
    const char = (keyData.flicks && currentDir) ? keyData.flicks[currentDir] : keyData.base;
    onCharInput(char);
    currentDir = null;
  };
  keyEl.addEventListener('pointerup', onRelease);
  keyEl.addEventListener('pointercancel', onRelease);
}

function highlightDir(keyEl, dir) {
  clearDirHighlights(keyEl);
  keyEl.querySelector(`.flick-dir[data-dir="${dir}"]`)?.classList.add('highlighted');
}

function clearDirHighlights(keyEl) {
  keyEl.querySelectorAll('.flick-dir').forEach(s => s.classList.remove('highlighted'));
}

// ============================================================
// 入力・スコア
// ============================================================
function onCharInput(char) {
  if (!state.isPlaying || state.isPaused || !state.currentWord) return;

  const expected = state.currentWord.strokes[state.inputIndex];

  if (char === expected) {
    state.inputHistory.push(char);
    state.inputIndex++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += 100 * getComboMultiplier();
    recoverTime(TIME_CONFIG.charRecover + (getComboMultiplier() - 1) * TIME_CONFIG.comboRecoverBonus);
    updateWordDisplay();
    updateHUD();
    if (state.inputIndex >= state.currentWord.strokes.length) onWordComplete();
  } else {
    showEffect('MISS!', 'show-miss');
    playSE('miss');
    state.combo = 0;
    state.timeLeft = Math.max(0, state.timeLeft - TIME_CONFIG.missPenalty);
    updateHUD();
  }
}

function getComboMultiplier() {
  if (state.combo >= 30) return 4;
  if (state.combo >= 20) return 3;
  if (state.combo >= 10) return 2;
  return 1;
}

function onWordComplete() {
  showEffect('Perfect!', 'show-perfect');
  playSE('perfect');
  state.wordsCleared++;
  state.score += 300 * getComboMultiplier();
  recoverTime(TIME_CONFIG.perfectRecover);
  updateHUD();
  setTimeout(() => loadNextWord(), 500);
}

function pickWord() {
  const pool = state.mission.wordData;
  let next, tries = 0;
  do {
    next = pool[Math.floor(Math.random() * pool.length)];
    tries++;
  } while (next.label === state.currentWord?.label && tries < 10);
  return next;
}

function loadNextWord() {
  state.currentWord = pickWord();
  state.inputIndex = 0;
  state.inputHistory = [];
  updateWordDisplay();
}

function buildCharMap(label) {
  const map = [];
  let pos = 0;
  for (const ch of label) {
    const s = CHAR_DECOMPOSE[ch] || [ch];
    map.push({ char: ch, start: pos, end: pos + s.length });
    pos += s.length;
  }
  return map;
}

function updateWordDisplay() {
  if (!state.currentWord) return;
  const label = state.currentWord.label;
  const idx = state.inputIndex;
  const charMap = buildCharMap(label);
  const activeIdx = charMap.findIndex(c => idx >= c.start && idx < c.end);

  els.targetWord.innerHTML = '';
  charMap.forEach((c, i) => {
    const span = document.createElement('span');
    if (idx >= c.end)             span.className = 'char-done';
    else if (i === activeIdx)     span.className = 'char-current';
    else if (i === activeIdx + 1) span.className = 'char-next';
    else                          span.className = 'char-pending';
    span.textContent = c.char;
    els.targetWord.appendChild(span);
  });
  els.inputDisplay.textContent = state.inputHistory.join('');
}

function updateHUD() {
  els.score.textContent = state.score.toLocaleString();
  els.combo.textContent = state.combo;
  const mult = getComboMultiplier();
  els.comboMultiplier.textContent = mult > 1 ? `${mult}x` : '';

  const pct = getAchievementPct();
  els.achievementHud.textContent = `${pct}%`;
  els.achievementHud.classList.toggle('achievement-clear', pct >= 100);

  const timePct = (state.timeLeft / state.maxTime) * 100;
  els.timerFill.style.width = `${Math.max(0, timePct)}%`;
  els.timerFill.classList.toggle('warning', timePct < 30);
  els.timerFill.classList.toggle('critical', timePct < 15);
}

function showEffect(text, className) {
  els.effectOverlay.textContent = text;
  els.effectOverlay.className = 'effect-overlay ' + className;
  setTimeout(() => {
    els.effectOverlay.className = 'effect-overlay';
    els.effectOverlay.textContent = '';
  }, 900);
}

// ============================================================
// タイマー・一時停止
// ============================================================
function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.isPlaying || state.isPaused) return;
    state.timeLeft -= 0.1;
    updateHUD();
    if (state.timeLeft <= 0) { state.timeLeft = 0; endGame(); }
  }, 100);
}

function pauseGame() {
  if (!state.isPlaying) return;
  state.isPaused = true;
  openSettings();
}

function resumeGame() {
  state.isPaused = false;
}

// ============================================================
// ゲーム終了・リザルト
// ============================================================
function endGame() {
  state.isPlaying = false;
  clearInterval(state.timerId);
  stopBGM();
  playSE('gameOver');

  const pct = getAchievementPct();
  const cleared = pct >= 100;
  const rank = getRank(state.score, state.mission.id);

  els.resultMissionLabel.textContent = state.mission.label;
  els.resultStatus.textContent = cleared ? 'MISSION CLEAR' : 'MISSION FAILED';
  els.resultStatus.className = 'result-status ' + (cleared ? 'status-clear' : 'status-failed');
  els.resultAchievement.textContent = `${pct}%`;
  els.resultScore.textContent = `${state.score.toLocaleString()} pt`;
  renderResultRank(rank);
  els.resultDetail.textContent =
    `最大コンボ ${state.maxCombo} / クリア単語 ${state.wordsCleared} / ノルマ ${getQuota().toLocaleString()}pt`;

  // エージェント名入力欄をリセット
  if (els.agentName) els.agentName.value = '';

  setTimeout(() => showScreen('result'), 800);
}

function handleSubmitScore() {
  if (!state.mission) return;

  const agentName = els.agentName?.value || '';
  const pct = getAchievementPct();
  const rankInfo = getRank(state.score, state.mission.id);

  const { entry } = submitToLeaderboard(state.mission.id, agentName, state.score, {
    achievement: pct,
    agentRank: rankInfo.letter,
  });

  lbHighlightDate = entry.date;
  playSE('perfect');
  showLeaderboard(state.mission.id);
}

async function startMission(missionId) {
  await unlockAudio();
  const mission = MISSIONS[missionId];
  if (!mission) return;

  state.mission = mission;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.wordsCleared = 0;
  state.maxTime = mission.timeLimit;
  state.timeLeft = mission.timeLimit;
  state.isPlaying = true;
  state.isPaused = false;

  els.missionLabel.textContent = mission.label;
  showScreen('game');
  loadNextWord();
  updateHUD();
  startTimer();
  startBGM();
}

// ============================================================
// 設定スライダー
// ============================================================
function initSettings() {
  els.bgmVolume.value = Math.round(audio.bgmVolume * 100);
  els.seVolume.value  = Math.round(audio.seVolume * 100);
  els.bgmVolumeVal.textContent = `${els.bgmVolume.value}%`;
  els.seVolumeVal.textContent  = `${els.seVolume.value}%`;

  els.bgmVolume.addEventListener('input', () => {
    audio.bgmVolume = els.bgmVolume.value / 100;
    els.bgmVolumeVal.textContent = `${els.bgmVolume.value}%`;
    applyVolumes();
  });

  els.seVolume.addEventListener('input', () => {
    audio.seVolume = els.seVolume.value / 100;
    els.seVolumeVal.textContent = `${els.seVolume.value}%`;
    applyVolumes();
    playSE('perfect');
  });
}

// ============================================================
// 初期化・イベント
// ============================================================
initAudio();
initLeaderboard();
buildKeyboard();
initSettings();
showScreen('home');

document.getElementById('btnStartMission').addEventListener('click', async () => {
  await unlockAudio();
  showScreen('mission');
});

document.getElementById('btnLeaderboard').addEventListener('click', () => {
  lbHighlightDate = null;
  showLeaderboard('easy');
});

document.getElementById('btnSettingsHome').addEventListener('click', async () => {
  await unlockAudio();
  openSettings();
});

document.getElementById('btnBackHome').addEventListener('click', () => showScreen('home'));

document.getElementById('btnLbBack').addEventListener('click', () => {
  lbHighlightDate = null;
  showScreen('home');
});

document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', () => renderLeaderboard(tab.dataset.lb));
});

document.getElementById('btnSubmitScore').addEventListener('click', handleSubmitScore);

document.querySelectorAll('.mission-btn').forEach(btn => {
  btn.addEventListener('click', () => startMission(btn.dataset.mission));
});

document.getElementById('btnPause').addEventListener('click', () => pauseGame());

document.getElementById('btnCloseSettings').addEventListener('click', () => closeSettings());

document.getElementById('btnRetry').addEventListener('click', async () => {
  await unlockAudio();
  showScreen('mission');
});

document.getElementById('btnResultHome').addEventListener('click', () => showScreen('home'));

document.addEventListener('contextmenu', e => e.preventDefault());
