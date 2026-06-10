'use strict';

// ============================================================
// 文字照合（ぇ と え など表記ゆれを許容）
// ============================================================
function charsMatch(typed, expected) {
  if (typed === expected) return true;
  if (expected === 'ぇ' && typed === 'え') return true; // ぇ は え でも正解
  return false;
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

// 単語データを準備
Object.values(MISSIONS).forEach(m => {
  m.wordData = m.words.map(label => ({ label }));
});

// コンボ回復など（ミッション中の爽快感）
const TIME_CONFIG = {
  charRecover: 0.35,
  perfectRecover: 1.2,
  comboRecoverBonus: 0.06,
  missPenalty: 0.5,
};

// ============================================================
// ローマ字入力（PC向け・日本語IMEなしでもプレイ可能）
// ============================================================
const ROMAJI_MAP = {
  'kya':'きゃ','kyu':'きゅ','kyo':'きょ','gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ',
  'sha':'しゃ','shu':'しゅ','sho':'しょ','ja':'じゃ','ju':'じゅ','jo':'じょ',
  'cha':'ちゃ','chu':'ちゅ','cho':'ちょ','nya':'にゃ','nyu':'にゅ','nyo':'にょ',
  'hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ','bya':'びゃ','byu':'びゅ','byo':'びょ',
  'pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ','mya':'みゃ','myu':'みゅ','myo':'みょ',
  'rya':'りゃ','ryu':'りゅ','ryo':'りょ',
  'shi':'し','chi':'ち','tsu':'つ','fu':'ふ',
  'ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご',
  'za':'ざ','ji':'じ','zu':'ず','ze':'ぜ','zo':'ぞ',
  'da':'だ','de':'で','do':'ど',
  'ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ',
  'pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ',
  'ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ',
  'sa':'さ','su':'す','se':'せ','so':'そ',
  'ta':'た','te':'て','to':'と',
  'na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の',
  'ha':'は','hi':'ひ','he':'へ','ho':'ほ',
  'ma':'ま','mi':'み','mu':'む','me':'め','mo':'も',
  'ya':'や','yu':'ゆ','yo':'よ',
  'ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ',
  'wa':'わ','wo':'を',
  'a':'あ','i':'い','u':'う','e':'え','o':'お',
  'n':'ん','-':'ー',
};
const ROMAJI_KEYS = Object.keys(ROMAJI_MAP).sort((a, b) => b.length - a.length);
let romajiBuffer = '';
let isComposing = false;

function feedRomaji(ch) {
  // 促音（っ）：同じ子音が連続したら「っ」を出力
  if ('bcdfghjkmnpqrstvwxyz'.includes(ch) && romajiBuffer.endsWith(ch)) {
    processChar('っ');
    romajiBuffer = romajiBuffer.slice(0, -1);
  }
  romajiBuffer += ch;
  flushRomaji();
}

function flushRomaji() {
  let changed = true;
  while (changed && romajiBuffer.length > 0) {
    changed = false;
    for (const key of ROMAJI_KEYS) {
      if (romajiBuffer.startsWith(key)) {
        const out = ROMAJI_MAP[key];
        if (out.length === 1) processChar(out);
        else { for (const c of out) processChar(c); }
        romajiBuffer = romajiBuffer.slice(key.length);
        changed = true;
        break;
      }
    }
    // 「ん」の特殊処理：n + 母音以外で確定
    if (!changed && romajiBuffer === 'nn') {
      processChar('ん');
      romajiBuffer = 'n';
      changed = true;
    } else if (!changed && romajiBuffer.startsWith('n') && romajiBuffer.length >= 2) {
      const next = romajiBuffer[1];
      if (!'aiueoy'.includes(next)) {
        processChar('ん');
        romajiBuffer = romajiBuffer.slice(1);
        changed = true;
      }
    }
  }
}

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
  typingInput:      document.getElementById('typingInput'),
  wordTapArea:      document.getElementById('wordTapArea'),
  typingHint:       document.getElementById('typingHint'),
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
  if (name !== 'game') blurTypingInput();
}

function openSettings() {
  blurTypingInput();
  els.screenSettings.classList.remove('hidden');
}

function closeSettings() {
  els.screenSettings.classList.add('hidden');
  if (state.isPaused && state.isPlaying) resumeGame();
}

// ============================================================
// OS標準キーボード入力
// ============================================================
function focusTypingInput() {
  if (!state.isPlaying || state.isPaused || !els.typingInput) return;
  els.typingInput.value = '';
  romajiBuffer = '';
  setTimeout(() => {
    els.typingInput.focus({ preventScroll: true });
    if (els.typingHint) els.typingHint.classList.add('typing-hint--active');
  }, 80);
}

function blurTypingInput() {
  els.typingInput?.blur();
  if (els.typingHint) els.typingHint.classList.remove('typing-hint--active');
}

function handleTextInput(text) {
  for (const ch of text) {
    // ひらがな・長音記号のみ受け付け
    if (/[\u3040-\u309F\u30FC]/.test(ch)) processChar(ch);
  }
}

function initTypingInput() {
  const input = els.typingInput;
  if (!input) return;

  input.addEventListener('compositionstart', () => { isComposing = true; });
  input.addEventListener('compositionend', (e) => {
    isComposing = false;
    handleTextInput(e.data || '');
    input.value = '';
  });

  input.addEventListener('input', () => {
    if (isComposing) return;
    handleTextInput(input.value);
    input.value = '';
  });

  // 画面タップでキーボードを起動
  els.wordTapArea?.addEventListener('click', () => focusTypingInput());
  els.wordTapArea?.addEventListener('touchstart', (e) => {
    if (e.target.closest('#btnPause')) return;
    focusTypingInput();
  }, { passive: true });

  // PC：ローマ字入力（日本語IMEオフ時）
  document.addEventListener('keydown', (e) => {
    if (!state.isPlaying || state.isPaused || isComposing) return;
    if (screens.game?.classList.contains('hidden')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement === els.agentName) return;

    if (e.key.length === 1 && /[a-z\-]/i.test(e.key)) {
      e.preventDefault();
      feedRomaji(e.key.toLowerCase());
    }
  });
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
// 入力・スコア（ひらがな1文字ずつ判定）
// ============================================================
function processChar(char) {
  if (!state.isPlaying || state.isPaused || !state.currentWord) return;

  const label = state.currentWord.label;
  const expected = label[state.inputIndex];

  if (charsMatch(char, expected)) {
    state.inputHistory.push(char);
    state.inputIndex++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += 100 * getComboMultiplier();
    recoverTime(TIME_CONFIG.charRecover + (getComboMultiplier() - 1) * TIME_CONFIG.comboRecoverBonus);
    updateWordDisplay();
    updateHUD();
    if (state.inputIndex >= label.length) onWordComplete();
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
  romajiBuffer = '';
  if (els.typingInput) els.typingInput.value = '';
  updateWordDisplay();
  focusTypingInput();
}

function updateWordDisplay() {
  if (!state.currentWord) return;
  const label = state.currentWord.label;
  const idx = state.inputIndex;

  els.targetWord.innerHTML = '';
  for (let i = 0; i < label.length; i++) {
    const span = document.createElement('span');
    if (i < idx)           span.className = 'char-done';
    else if (i === idx)    span.className = 'char-current';
    else if (i === idx + 1) span.className = 'char-next';
    else                   span.className = 'char-pending';
    span.textContent = label[i];
    els.targetWord.appendChild(span);
  }
  els.inputDisplay.textContent = label.slice(0, idx);
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
  blurTypingInput();
  openSettings();
}

function resumeGame() {
  state.isPaused = false;
  focusTypingInput();
}

// ============================================================
// ゲーム終了・リザルト
// ============================================================
function endGame() {
  state.isPlaying = false;
  clearInterval(state.timerId);
  blurTypingInput();
  romajiBuffer = '';
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
  focusTypingInput();
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
initTypingInput();
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
