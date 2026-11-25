'use strict';

/* ============================================================
   ХОЙКА-ПАРОДИЯ: ГРИМАНИЯ 1936
   Пошаговая гекс-стратегия с шутками про grand strategy.
   ============================================================ */

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const TAU = Math.PI * 2;
const SQ3 = Math.sqrt(3);
const HEX = 40;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

let W = 800, H = 600, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (game) computeCamera();
}
window.addEventListener('resize', resize);

/* ---------------- звук ---------------- */
let actx = null, muted = false;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(freq, dur, type, vol, slide) {
  if (muted) return;
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol || 0.04, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SND = {
  click: () => beep(520, 0.06, 'square', 0.025, 360),
  good: () => beep(480, 0.12, 'triangle', 0.04, 720),
  bad: () => beep(180, 0.18, 'sawtooth', 0.05, 90),
  war: () => { beep(120, 0.5, 'sawtooth', 0.055, 60); beep(240, 0.3, 'square', 0.03, 120); },
  capture: () => { beep(330, 0.14, 'triangle', 0.045, 500); beep(500, 0.16, 'triangle', 0.035, 740); },
};

/* ---------------- данные ---------------- */
const C_DEFS = [
  { key: 'G', name: 'Гримания', color: '#78808f', aggr: 0.9, pp: 60, equip: 320, mp: 180000, divs: 10 },
  { key: 'F', name: 'Франкия', color: '#4f74a8', aggr: 0.35, pp: 40, equip: 200, mp: 110000, divs: 5 },
  { key: 'E', name: 'Иберика', color: '#bf8f42', aggr: 0.25, pp: 35, equip: 130, mp: 70000, divs: 3 },
  { key: 'I', name: 'Италика', color: '#5c9a66', aggr: 0.6, pp: 45, equip: 170, mp: 85000, divs: 4 },
  { key: 'B', name: 'Балканика', color: '#8a6ab8', aggr: 0.5, pp: 35, equip: 150, mp: 75000, divs: 4 },
  { key: 'R', name: 'Советикум', color: '#b04a3f', aggr: 1.0, pp: 50, equip: 420, mp: 280000, divs: 8 },
  { key: 'S', name: 'Скандинавикум', color: '#4d9a9a', aggr: 0.2, pp: 30, equip: 120, mp: 45000, divs: 2 },
  { key: 'C', name: 'Швейцарикум', color: '#d6c58f', aggr: 0.0, pp: 70, equip: 260, mp: 35000, divs: 6 },
];
const CID = {}; C_DEFS.forEach((c, i) => { c.id = i; CID[c.key] = i; });
const PLAYER = CID.G;

const TERRAIN = {
  plains: { name: 'Равнины', def: 1.0, icon: 'plains' },
  forest: { name: 'Леса', def: 1.25, icon: 'forest' },
  mountain: { name: 'Горы', def: 1.75, icon: 'mountain' },
  city: { name: 'Город', def: 1.4, icon: 'city' },
};

const MAP_ASCII = [
  '......SSS....',
  '....SSSS.....',
  '..FF..GGG.RRR',
  '.FFFF.GGG.RRR',
  '..FFFGGGGGRRR',
  '...FFGGGCGRRR',
  '...FFGGGG.RRR',
  '..EEE.III.BBR',
  '.EEEE.IIIBBBB',
  '...EE..II.BB.',
];

const NAMES = {
  G: ['Берлинчик', 'Гамбургер', 'Мюнхенвальд', 'Сосискен', 'Танкоград', 'Штутгарт-на-шее',
    'Дрезден-2', 'Кёльнский Собор', 'Пиволюбск', 'Автобан-Сити', 'Фольксвагенбург', 'Кринжштадт',
    'Октоберфест', 'Бранденбургские Ворота', 'Рур-на-всё', 'Ганновер-склад', 'Лейпциг-Ярмарка',
    'Нюрнберг-Сувенир', 'Пруссия-Ретро'],
  F: ['Париж-сюр-Мер', 'Круассан', 'Бордо-Вино', 'Нормандия-Десант', 'Лион-ла-Соссис',
    'Марсель-Порт', 'Тулуза-Багет', 'Страсбург-Спор', 'Шампань-Пробка', 'Бретань-Креп',
    'Ницца-Пляж', 'Орлеан-Дева', 'Эльзас-Спора'],
  E: ['Мадрид-на-Солнце', 'Барселона-Отдельно', 'Португалия-Младшая', 'Коррида-Арена',
    'Севилья-Апельсин', 'Валенсия-Паэлья', 'Бильбао-Сталь', 'Гранада-Альгамбра', 'Лиссабон-Фаду'],
  I: ['Рим-не-за-один-день', 'Пицца-Наполи', 'Милан-под-Санкциями', 'Венеция-Тонет',
    'Флоренция-Уффици', 'Турин-Фиат', 'Сицилия-Мафия', 'Генуя-Порт'],
  B: ['Белград-на-Порохе', 'Загреб-Кто', 'Сараево-Спички', 'Скопье-Не-Важно',
    'Любляна-Дракон', 'Подгорица-Пляж', 'Босния-Туман', 'Косово-Поле'],
  R: ['Москва-Сити', 'Ленинград-на-Диване', 'Сталинград-2', 'Гулаг-на-Волге', 'Сибирь (далеко)',
    'Товарищград', 'Колхоз-Центральный', 'Киев-Котлета', 'Минск-Трактор', 'Одесса-Юмор',
    'Свердловск-Завод', 'Волгоград-Волга', 'Архангельск-Лёд', 'Владивосток (ещё дальше)',
    'Совхоз-Победа', 'Пятилетка-Сити'],
  S: ['Стокгольм-Синдром', 'Осло-Фьорд', 'Копенгаген-Картошка', 'Хельсинки-Сауна',
    'Юлляс-Лыжи', 'Берген-Дождь', 'Мальмё-Мост'],
  C: ['Швейцария (не трогать)'],
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
  'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function dateText(day) {
  const d = new Date(Date.UTC(1936, 0, 1 + day));
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}
function fmt(n) {
  n = Math.floor(n);
  if (Math.abs(n) >= 1000) {
    const t = n / 1000;
    return (t >= 100 ? Math.round(t) : t.toFixed(t >= 10 ? 0 : 1).replace('.0', '')) + ' тыс.';
  }
  return String(n);
}

/* ---------------- карта ---------------- */
let tiles = [];
let tileByCR = new Map();
const CR = (c, r) => c + ',' + r;

function neighborsCR(c, r) {
  if (r % 2 === 0) {
    return [[c + 1, r], [c - 1, r], [c, r - 1], [c - 1, r - 1], [c, r + 1], [c - 1, r + 1]];
  }
  return [[c + 1, r], [c - 1, r], [c + 1, r - 1], [c, r - 1], [c + 1, r + 1], [c, r + 1]];
}

function buildMap() {
  tiles = [];
  tileByCR.clear();
  const used = {};
  MAP_ASCII.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const def = C_DEFS[CID[ch]];
      const idx = used[ch] || 0;
      used[ch] = idx + 1;
      const t = {
        id: tiles.length, c, r, key: ch, owner: def.id,
        name: (NAMES[ch] || [])[idx] || ('Провинция ' + (idx + 1)),
        divs: {}, factories: 0, capital: false, terrain: 'plains',
        x: (c + (r % 2) * 0.5) * SQ3 * HEX + SQ3 * HEX * 0.5,
        y: r * 1.5 * HEX + HEX,
      };
      tiles.push(t);
      tileByCR.set(CR(c, r), t);
    }
  });

  for (const t of tiles) {
    t.nb = neighborsCR(t.c, t.r).map(([c, r]) => tileByCR.get(CR(c, r))).filter(Boolean);
    if (t.key === 'B' || t.key === 'C') t.terrain = 'mountain';
    else if (t.key === 'S') t.terrain = 'forest';
    else {
      const roll = Math.random();
      t.terrain = roll < 0.26 ? 'forest' : roll < 0.34 ? 'mountain' : 'plains';
    }
    if (Math.random() < 0.18) t.factories = 1;
    if (t.terrain === 'city') t.factories = Math.max(t.factories, 1);
  }

  // столицы — ближайшая к центру страны провинция
  for (const def of C_DEFS) {
    const own = tiles.filter((t) => t.owner === def.id);
    if (!own.length) continue;
    const cx = own.reduce((s, t) => s + t.x, 0) / own.length;
    const cy = own.reduce((s, t) => s + t.y, 0) / own.length;
    own.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    own[0].capital = true;
    own[0].terrain = 'city';
    own[0].factories = 3;
    own.forEach((t, i) => {
      if (i > 0 && i % 5 === 2) { t.terrain = 'city'; t.factories = Math.max(t.factories, 1); }
    });
  }
}

const byId = (id) => tiles[id];
const countryOf = (t) => game.countries[t.owner];
const playerC = () => game.countries[PLAYER];
const me = () => playerC();
const tilesOf = (cid) => tiles.filter((t) => t.owner === cid);
const atWar = (a, b) => game.wars.has(a < b ? a + ':' + b : b + ':' + a);

/* ---------------- ввод и камера ---------------- */
const mouse = { x: 0, y: 0, wx: 0, wy: 0, hover: null, down: false, dragged: false, sx: 0, sy: 0 };
const cam = { zoom: 1, panX: 0, panY: 0, base: 1, cx: 0, cy: 0, mx: 0, my: 0 };

function mapBounds() {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const t of tiles) {
    minX = Math.min(minX, t.x - HEX); maxX = Math.max(maxX, t.x + HEX);
    minY = Math.min(minY, t.y - HEX); maxY = Math.max(maxY, t.y + HEX);
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

function computeCamera() {
  const b = mapBounds();
  const sideW = W > 760 ? 350 : 0;
  const availW = Math.max(320, W - sideW - 50);
  const availH = Math.max(260, H - 165);
  cam.base = Math.min(availW / b.w, availH / b.h) * 0.95;
  cam.base = clamp(cam.base, 0.35, 2.2);
  cam.cx = (W - sideW) / 2;
  cam.cy = 70 + (H - 70 - 70) / 2;
  cam.mx = (b.minX + b.maxX) / 2;
  cam.my = (b.minY + b.maxY) / 2;
}

function effScale() { return cam.base * cam.zoom; }

function worldToScreen(x, y) {
  const s = effScale();
  return {
    x: cam.cx + cam.panX + (x - cam.mx) * s,
    y: cam.cy + cam.panY + (y - cam.my) * s,
  };
}
function screenToWorld(x, y) {
  const s = effScale();
  return {
    x: (x - cam.cx - cam.panX) / s + cam.mx,
    y: (y - cam.cy - cam.panY) / s + cam.my,
  };
}
function clampPan() {
  const b = mapBounds();
  const s = effScale();
  const maxX = Math.max(120, (b.w * s) / 2 - 120);
  const maxY = Math.max(120, (b.h * s) / 2 - 100);
  cam.panX = clamp(cam.panX, -maxX, maxX);
  cam.panY = clamp(cam.panY, -maxY, maxY);
}

/* ============================================================
   СОСТОЯНИЕ ПАРТИИ
   ============================================================ */
let game = null;

function distributeDivisions(c, n) {
  const own = tilesOf(c.id);
  if (!own.length) return;
  const cap = own.find((t) => t.capital) || own[0];
  const border = own.filter((t) => t !== cap && t.nb.some((nb) => nb.owner !== c.id));
  const pool = border.length ? border : [cap];
  const capShare = Math.max(1, Math.round(n * 0.4));
  cap.divs[c.id] = capShare;
  let left = n - capShare;
  let i = 0;
  while (left > 0) {
    const t = pool[i % pool.length];
    t.divs[c.id] = (t.divs[c.id] || 0) + 1;
    left--; i++;
  }
}

function newGame() {
  buildMap();
  const countries = C_DEFS.map((def) => ({
    ...def,
    equipment: def.equip,
    manpower: def.mp,
    eliminated: false,
    nextWarDay: randi(50, 120),
    nextAttackDay: randi(4, 12),
    pacts: new Map(),
    completed: new Set(),
    bonus: { atk: 0, def: 0, capture: 0, prod: 0 },
  }));
  game = {
    day: 0, speed: 1, acc: 0, running: true, modal: false, over: false,
    countries, wars: new Set(), battles: [],
    selected: null, target: null, focus: null,
    tension: 0, log: [], nextEventDay: randi(18, 30),
    battleId: 1, startTiles: tiles.length,
  };
  for (const c of countries) distributeDivisions(c, c.divs);
  log('Мир замер. Пахнет пивом и порохом.');
  log('Выберите свою провинцию на карте.');
  computeCamera();
  updateHUD();
  renderLog();
  renderTilePanel();
}

function log(text) {
  game.log.unshift({ day: game.day, text });
  if (game.log.length > 60) game.log.pop();
  renderLog();
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function playerDivs() {
  let s = 0;
  for (const t of tiles) s += t.divs[PLAYER] || 0;
  return s;
}
function playerFactories() {
  return tilesOf(PLAYER).reduce((s, t) => s + t.factories, 0);
}

function updateHUD() {
  if (!game) return;
  const p = me();
  $('playerFlag').style.background = p.color;
  $('playerName').textContent = p.name;
  $('dateLabel').textContent = dateText(game.day);
  $('statPP').textContent = Math.floor(p.pp);
  $('statFactories').textContent = playerFactories();
  $('statManpower').textContent = fmt(p.manpower);
  $('statEquip').textContent = fmt(p.equipment);
  $('statDivs').textContent = Math.ceil(playerDivs());
  $('statProv').textContent = tilesOf(PLAYER).length;
  $('tensionFill').style.width = clamp(game.tension, 0, 100) + '%';
}

function renderLog() {
  const el = $('logList');
  if (!el || !game) return;
  const short = (day) => dateText(day).split(' ').slice(0, 2).join(' ');
  el.innerHTML = game.log.slice(0, 14).map((l) =>
    `<div><b>${short(l.day)}</b>${l.text}</div>`).join('');
}

/* ---------------- действия игрока ---------------- */
function recruit(t) {
  const p = me();
  const costE = 50, costM = 10000;
  if (p.equipment < costE) { toast('Мало снаряжения — заводы работают, но не настолько'); SND.bad(); return; }
  if (p.manpower < costM) { toast('Люди кончились. Даже патриоты.'); SND.bad(); return; }
  p.equipment -= costE;
  p.manpower -= costM;
  t.divs[PLAYER] = (t.divs[PLAYER] || 0) + 1;
  log(`Новая дивизия расквартирована в ${t.name}.`);
  SND.good();
  updateHUD(); renderTilePanel();
}

function buildFactory(t) {
  const p = me();
  const costE = 180, costPP = 20;
  if (p.equipment < costE) { toast('Заводы из воздуха не строятся (нужно 180 снаряж.)'); SND.bad(); return; }
  if (p.pp < costPP) { toast('Не хватает политической власти'); SND.bad(); return; }
  p.equipment -= costE;
  p.pp -= costPP;
  t.factories += 1;
  log(`В ${t.name} построен завод. Дым — признак прогресса.`);
  SND.good();
  updateHUD(); renderTilePanel();
}

function declareWar(a, b, silent) {
  if (a === b || atWar(a, b)) return false;
  const ca = game.countries[a], cb = game.countries[b];
  if (ca.eliminated || cb.eliminated) return false;
  game.wars.add(a < b ? a + ':' + b : b + ':' + a);
  game.tension = Math.min(100, game.tension + 4);
  ca.pacts.delete(b); cb.pacts.delete(a);
  for (const t of tiles) {
    if (t.owner === a) t.divs[b] = 0;
  }
  log(`⚔ ${ca.name} объявила войну ${cb.name}. Мировая напряжённость растёт.`);
  if (!silent) {
    SND.war();
    if (b === PLAYER) toast('Война! Это уже личное.');
    else if (a === PLAYER) toast('Война объявлена. Оправдание: «они косо посмотрели».');
  }
  updateHUD();
  return true;
}

function playerDeclareWar(cid) {
  const p = me();
  const target = game.countries[cid];
  if (!target || target.eliminated) return;
  if (target.pacts.has(PLAYER) && target.pacts.get(PLAYER) > game.day) {
    toast('Пакт о ненападении ещё действует. Неудобно.'); SND.bad(); return;
  }
  if (!tilesOf(PLAYER).some((t) => t.nb.some((nb) => nb.owner === cid))) {
    toast('Нет общей границы. Сначала до кого-нибудь дойдите.'); SND.bad(); return;
  }
  const cost = 50;
  if (p.pp < cost) { toast('Оправдание войны стоит 50 полит. власти'); SND.bad(); return; }
  p.pp -= cost;
  declareWar(PLAYER, cid);
  updateHUD(); renderTilePanel();
  closeModal();
}

function makePact(cid) {
  const p = me();
  const target = game.countries[cid];
  if (!target || target.eliminated) return;
  const cost = 30;
  if (p.pp < cost) { toast('Пакт стоит 30 полит. власти'); SND.bad(); return; }
  if (atWar(PLAYER, cid)) { toast('Во время войны пакты не подписывают'); SND.bad(); return; }
  p.pp -= cost;
  const until = game.day + 120;
  p.pacts.set(cid, until);
  target.pacts.set(PLAYER, until);
  log(`🤝 Подписан пакт о ненападении с ${target.name}. Бумага всё стерпит.`);
  SND.good(); updateHUD(); openDiplo();
}

/* ---------------- фокусы ---------------- */
const FOCUSES = [
  {
    id: 'putsch', name: 'Пивной путч: Реванш', days: 25, req: [],
    desc: '+40 полит. власти. Пиво за счёт заведения.',
    apply() { me().pp += 40; },
  },
  {
    id: 'autobahn', name: 'Автобаны', days: 35, req: ['putsch'],
    desc: '+2 завода в столице. Скорость важнее направления.',
    apply() {
      const cap = tilesOf(PLAYER).find((t) => t.capital);
      if (cap) cap.factories += 2;
    },
  },
  {
    id: 'tanks', name: 'Танки из фанеры', days: 35, req: ['autobahn'],
    desc: '+20% силы атаки. Главное — громко.',
    apply() { me().bonus.atk += 0.2; },
  },
  {
    id: 'blitz', name: 'Блицкриг по расписанию', days: 40, req: ['tanks'],
    desc: '+30% скорости захвата провинций.',
    apply() { me().bonus.capture += 0.3; },
  },
  {
    id: 'annex', name: 'Аншлюс по-дружески', days: 30, req: ['putsch'],
    desc: 'Присоединяет соседнюю нейтральную провинцию. Швейцария против, но кто её спросит.',
    apply() { annexNeutral(); },
  },
  {
    id: 'total', name: 'Тотальная война', days: 50, req: ['blitz'],
    desc: '+35% производства снаряжения. Экономика наконец-то работает.',
    apply() { me().bonus.prod += 0.35; },
  },
];

function focusState(f) {
  const p = me();
  if (p.completed.has(f.id)) return 'done';
  if (game.focus && game.focus.id === f.id) return 'active';
  if (f.req.some((r) => !p.completed.has(r))) return 'locked';
  return 'available';
}

function startFocus(id) {
  const f = FOCUSES.find((x) => x.id === id);
  if (!f) return;
  if (game.focus) { toast('Сначала завершите текущий фокус'); SND.bad(); return; }
  if (focusState(f) !== 'available') { toast('Фокус недоступен: нужны предпосылки'); SND.bad(); return; }
  game.focus = { id, day: 0 };
  log(`📌 Начат фокус «${f.name}».`);
  SND.click();
  openFocus();
}

function tickFocus() {
  if (!game.focus) return;
  const f = FOCUSES.find((x) => x.id === game.focus.id);
  if (!f) { game.focus = null; return; }
  game.focus.day++;
  if (game.focus.day >= f.days) {
    f.apply();
    me().completed.add(f.id);
    log(`✅ Фокус «${f.name}» завершён.`);
    toast('Фокус завершён: ' + f.name);
    SND.good();
    game.focus = null;
    updateHUD(); renderTilePanel();
  }
}

function annexNeutral() {
  const p = me();
  const cand = [];
  for (const t of tilesOf(PLAYER)) {
    for (const nb of t.nb) {
      if (nb.owner === CID.C && !atWar(PLAYER, CID.C)) cand.push(nb);
    }
  }
  if (cand.length) {
    const t = cand[0];
    t.divs = {};
    t.owner = PLAYER;
    log(`🇨🇭 ${t.name} присоединена по-дружески. Банки переехали.`);
    toast('Аншлюс прошёл успешно');
    game.tension = Math.min(100, game.tension + 2);
  } else {
    const cap = tilesOf(PLAYER).find((t) => t.capital) || tilesOf(PLAYER)[0];
    if (cap) cap.divs[PLAYER] = (cap.divs[PLAYER] || 0) + 2;
    log('Швейцарии рядом не оказалось — выдали два комплекта формы.');
  }
}

/* ---------------- события ---------------- */
function give(o) {
  const p = me();
  if (o.pp) p.pp = Math.max(0, p.pp + o.pp);
  if (o.equip) p.equipment = Math.max(0, p.equipment + o.equip);
  if (o.mp) p.manpower = Math.max(0, p.manpower + o.mp);
  if (o.tension) game.tension = clamp(game.tension + o.tension, 0, 100);
  if (o.divs) {
    const t = game.selected && game.selected.owner === PLAYER ? game.selected :
      tilesOf(PLAYER).find((x) => x.capital) || tilesOf(PLAYER)[0];
    if (t) t.divs[PLAYER] = (t.divs[PLAYER] || 0) + o.divs;
  }
  updateHUD(); renderTilePanel();
}

const EVENTS = [
  {
    title: 'Пивной путч в баре «У Ганса»',
    text: 'Ваши сторонники захватили бар и требуют признать это историческим событием. Бармен требует оплатить разбитую посуду.',
    choices: [
      { label: 'Поддержать (+25 ПП, −10 снаряж.)', apply() { give({ pp: 25, equip: -10 }); } },
      { label: 'Выпить и забыть (+8 ПП)', apply() { give({ pp: 8 }); } },
    ],
  },
  {
    title: 'Генерал просит новые танки',
    text: 'Генерал утверждает, что на старых танках даже до фронта не доехать. На карте он уже нарисовал стрелки.',
    choices: [
      { label: 'Выдать снаряжение (−60 снаряж., +1 дивизия)', apply() { give({ equip: -60, divs: 1 }); } },
      { label: 'Выдать карту (+10 ПП)', apply() { give({ pp: 10 }); } },
    ],
  },
  {
    title: 'Забастовка на заводе сосисок',
    text: 'Рабочие требуют сосисок в столовой. Пресса называет это «кризисом национального масштаба».',
    choices: [
      { label: 'Поднять пайки (−30 снаряж., +18 ПП)', apply() { give({ equip: -30, pp: 18 }); } },
      { label: 'Пригрозить штрафами (+30 снаряж., −10 ПП)', apply() { give({ equip: 30, pp: -10 }); } },
    ],
  },
  {
    title: 'Разведка поймала фотографа',
    text: 'Иностранный турист фотографировал ваш новый завод. Говорит, что «просто любит трубы».',
    choices: [
      { label: 'Забрать плёнку (+12 ПП)', apply() { give({ pp: 12 }); } },
      { label: 'Завербовать (+1 дивизия)', apply() { give({ divs: 1 }); } },
    ],
  },
  {
    title: 'Советники предлагают Швейцарию',
    text: '«Там же банки!» — говорят советники. Швейцария говорит, что у неё 6 дивизий и очень высокие горы.',
    choices: [
      { label: 'Объявить войну Швейцарии', apply() { declareWar(PLAYER, CID.C); } },
      { label: 'Они же нейтральны (+15 ПП)', apply() { give({ pp: 15 }); } },
    ],
  },
  {
    title: 'Парад победы без победы',
    text: 'Генеральный штаб хочет провести парад. Повод не важен, важна трибуна.',
    choices: [
      { label: 'Провести (+12 ПП, +2 напряжённости)', apply() { give({ pp: 12, tension: 2 }); } },
      { label: 'Отменить (+25 снаряж.)', apply() { give({ equip: 25 }); } },
    ],
  },
];

let modalOpen = false;

function openModal(html) {
  $('modal').innerHTML = html;
  $('modalWrap').classList.remove('hidden');
  game.modal = true;
}
function closeModal() {
  $('modalWrap').classList.add('hidden');
  $('modal').innerHTML = '';
  if (game) game.modal = false;
}

function triggerEvent() {
  const ev = pick(EVENTS);
  const opts = ev.choices.map((c, i) =>
    `<button class="btn${i === 0 ? ' primary' : ''}" data-choice="${i}">${c.label}</button>`).join('');
  openModal(`<div class="modal-card">
    <div class="kicker">Срочное донесение · ${dateText(game.day)}</div>
    <h2>${ev.title}</h2>
    <p>${ev.text}</p>
    ${opts}
  </div>`);
  $('modal').querySelectorAll('[data-choice]').forEach((b) => {
    b.onclick = () => {
      const ch = ev.choices[+b.dataset.choice];
      ch.apply();
      closeModal();
      game.nextEventDay = game.day + randi(22, 40);
      renderTilePanel();
    };
  });
}

/* ============================================================
   ВОЙНА
   ============================================================ */
function battleAt(fromId, toId) {
  return game.battles.find((b) => b.from === fromId && b.to === toId);
}
function battlesOnTile(tid) {
  return game.battles.filter((b) => b.to === tid || b.from === tid);
}

function startBattle(fromT, toT) {
  if (!fromT || !toT) return false;
  if (fromT.owner === toT.owner) return false;
  if (!atWar(fromT.owner, toT.owner)) return false;
  if ((fromT.divs[fromT.owner] || 0) < 0.5) return false;
  if (battleAt(fromT.id, toT.id)) return false;
  if (toT.nb.indexOf(fromT) === -1) return false;
  game.battles.push({
    id: game.battleId++, from: fromT.id, to: toT.id,
    atk: fromT.owner, def: toT.owner, progress: 0, days: 0,
  });
  if (fromT.owner === PLAYER) {
    log(`⚔ Наступление: ${fromT.name} → ${toT.name}.`);
    SND.war();
  } else if (toT.owner === PLAYER) {
    log(`🛡 ${game.countries[fromT.owner].name} атакует ${toT.name}!`);
    SND.bad();
  }
  return true;
}

function updateBattles() {
  for (const b of game.battles.slice()) {
    const ft = byId(b.from), tt = byId(b.to);
    if (!ft || !tt || ft.owner !== b.atk || tt.owner !== b.def) {
      game.battles = game.battles.filter((x) => x !== b);
      continue;
    }
    const atkDivs = ft.divs[b.atk] || 0;
    const realDef = tt.divs[b.def] || 0;

    if (atkDivs < 0.2) {
      game.battles = game.battles.filter((x) => x !== b);
      if (b.atk === PLAYER) log('Наступление захлебнулось: дивизий не осталось.');
      continue;
    }

    // ополчение: даже пустая провинция не сдаётся за один день
    const defDivs = Math.max(realDef, 0.4);

    const terr = TERRAIN[tt.terrain].def * (tt.capital ? 1.35 : 1);
    const atkBonus = 1 + (b.atk === PLAYER ? me().bonus.atk : 0);
    const capBonus = b.atk === PLAYER ? 1 + me().bonus.capture : 1;
    const atkPow = atkDivs * atkBonus * rand(0.85, 1.15);
    const defPow = defDivs * terr * rand(0.85, 1.15);
    const delta = (atkPow - defPow * 0.95) * 6 * capBonus;

    b.progress = clamp(b.progress + delta, 0, 100);
    b.days++;

    const aLoss = Math.min(atkDivs - 0.05, defPow * 0.014 * rand(0.7, 1.3));
    const dLoss = Math.min(Math.max(0, realDef - 0.05), atkPow * 0.034 * rand(0.7, 1.3));
    ft.divs[b.atk] = Math.max(0, atkDivs - aLoss);
    if (realDef > 0.05) tt.divs[b.def] = Math.max(0, realDef - dLoss);
    game.tension = Math.min(100, game.tension + 0.02);

    if (b.progress >= 100) {
      captureTile(tt, b.atk, ft);
      game.battles = game.battles.filter((x) => x !== b);
    }
  }
}

function captureTile(tt, atkId, ft) {
  const defId = tt.owner;
  if (defId === atkId) return;
  const defDivs = tt.divs[defId] || 0;

  let retreated = false;
  if (defDivs > 0.05) {
    const ref = tt.nb.filter((n) => n.owner === defId);
    if (ref.length) {
      ref.sort((a, b) => (b.divs[defId] || 0) - (a.divs[defId] || 0));
      const dest = ref[0];
      dest.divs[defId] = (dest.divs[defId] || 0) + defDivs;
      retreated = true;
    }
  }

  const atkDivs = ft.divs[atkId] || 0;
  const moved = Math.min(atkDivs, Math.max(0.35, atkDivs * 0.6));
  ft.divs[atkId] = Math.max(0, atkDivs - moved);
  if (ft.divs[atkId] < 0.05) delete ft.divs[atkId];

  tt.divs = {};
  tt.owner = atkId;
  if (moved > 0.05) tt.divs[atkId] = moved;

  log(`${atkId === PLAYER ? '🏴' : '🏳'} ${game.countries[atkId].name} заняла ${tt.name}.` +
    (defDivs > 0 ? (retreated ? ' Противник отступил.' : ' Гарнизон уничтожен.') : ''));
  SND.capture();

  game.battles = game.battles.filter((b) => b.to !== tt.id && b.from !== tt.id);
  if (tt.capital) capitulate(defId, atkId);
  checkEnd();
}

function capitulate(defId, winnerId) {
  const d = game.countries[defId], w = game.countries[winnerId];
  if (!d || !w || d.eliminated) return;
  d.eliminated = true;
  for (const t of tiles) {
    if (t.owner === defId) { t.owner = winnerId; t.divs = {}; }
  }
  game.battles = game.battles.filter((b) => b.atk !== defId && b.def !== defId);
  game.tension = Math.min(100, game.tension + 5);
  log(`💀 ${d.name} капитулировала! ${w.name} забирает всё.`);
  toast(d.name + ' капитулировала');
  if (defId === PLAYER) {
    endGame(false, 'Столица пала. Историки будут жестоки.');
  }
  updateHUD(); renderTilePanel();
}

function checkEnd() {
  if (game.over) return;
  const own = tilesOf(PLAYER).length;
  if (own === 0) { endGame(false, 'От страны осталась только память и пивные кружки.'); return; }
  if (own / game.startTiles >= 0.55) {
    endGame(true, 'Больше половины континента — ваше. Поздравляем, вы победили в этой пародии.');
  }
}

function endGame(win, reason) {
  if (game.over) return;
  game.over = true;
  game.running = false;
  SND[win ? 'good' : 'bad']();
  const p = me();
  openModal(`<div class="modal-card">
    <div class="big-flag" style="background:${p.color}"></div>
    <div class="kicker">${win ? 'Операция завершена' : 'Государственный переворот'}</div>
    <div class="end-title ${win ? 'win' : 'lose'}">${win ? 'МИРОВОЕ ГОСПОДСТВО' : 'КРАХ РЕЖИМА'}</div>
    <p>${reason}</p>
    <div class="stats-row">
      <div><b>${tilesOf(PLAYER).length}</b><span>провинций</span></div>
      <div><b>${Math.ceil(playerDivs())}</b><span>дивизий</span></div>
      <div><b>${playerFactories()}</b><span>заводов</span></div>
      <div><b>${dateText(game.day)}</b><span>дата</span></div>
    </div>
    <button class="btn primary" data-act="restart">Начать заново</button>
  </div>`);
  $('modal').querySelector('[data-act="restart"]').onclick = () => location.reload();
}

function totalDivs(cid) {
  let s = 0;
  for (const t of tiles) s += t.divs[cid] || 0;
  return s;
}

function maxArmy(cid) {
  return Math.round(6 + tilesOf(cid).length * 1.3);
}

function strength(cid) {
  const c = game.countries[cid];
  if (!c || c.eliminated) return -999;
  const own = tilesOf(cid);
  return totalDivs(cid) + own.reduce((s, t) => s + t.factories, 0) * 0.45 + own.length * 0.25;
}

/* ============================================================
   ИИ
   ============================================================ */
function aiTurn() {
  for (const c of game.countries) {
    if (c.id === PLAYER || c.eliminated) continue;

    // война
    if (game.day >= c.nextWarDay) {
      c.nextWarDay = game.day + randi(40, 95);
      const alreadyWar = game.countries.some((x) => !x.eliminated && x.id !== c.id && atWar(c.id, x.id));
      if (!alreadyWar) {
        const neigh = new Set();
        for (const t of tilesOf(c.id)) {
          for (const nb of t.nb) {
            if (nb.owner !== c.id && nb.owner !== CID.C) neigh.add(nb.owner);
          }
        }
        const targets = [...neigh].filter((id) => {
          const cc = game.countries[id];
          if (cc.eliminated) return false;
          if (cc.pacts.get(c.id) > game.day) return false;
          return strength(id) < strength(c.id) * 1.08;
        });
        if (targets.length) {
          targets.sort((a, b) => strength(a) - strength(b));
          const victim = targets[0];
          let chance = c.aggr * (0.55 + game.tension / 150);
          if (victim === PLAYER && game.day < 180) chance *= 0.38;
          if (Math.random() < chance) declareWar(c.id, victim);
        }
      }
    }

    // производство дивизий
    if (c.equipment > 150 && c.manpower > 15000 &&
      totalDivs(c.id) < maxArmy(c.id) && Math.random() < 0.1) {
      const own = tilesOf(c.id);
      const border = own.filter((t) => t.nb.some((nb) => nb.owner !== c.id && atWar(c.id, nb.owner)));
      const target = border.length ? pick(border) : (own.find((t) => t.capital) || own[0]);
      if (target) {
        c.equipment -= 50; c.manpower -= 10000;
        target.divs[c.id] = (target.divs[c.id] || 0) + 1;
      }
    }

    // наступления: ИИ не спамит новыми фронтами каждый день
    const myBattles = game.battles.filter((b) => b.atk === c.id).length;
    if (myBattles >= 2 || game.day < c.nextAttackDay) continue;
    const pairs = [];
    for (const t of tilesOf(c.id)) {
      const divs = t.divs[c.id] || 0;
      if (divs < 1) continue;
      for (const nb of t.nb) {
        if (nb.owner === c.id || !atWar(c.id, nb.owner)) continue;
        if (battleAt(t.id, nb.id)) continue;
        const defDivs = nb.divs[nb.owner] || 0.5;
        const score = divs / (defDivs * TERRAIN[nb.terrain].def + 0.2);
        pairs.push({ t, nb, score });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    let launched = 0;
    for (const p of pairs) {
      if (launched >= 1 || myBattles + launched >= 2) break;
      if (p.score < 1.35) break;
      if (Math.random() < 0.55 && startBattle(p.t, p.nb)) {
        launched++;
        c.nextAttackDay = game.day + randi(3, 6);
      }
    }
  }
}

/* ============================================================
   ХОД ВРЕМЕНИ
   ============================================================ */
function advanceDay() {
  if (!game || game.over) return;
  game.day++;

  updateBattles();

  for (const c of game.countries) {
    if (c.eliminated) continue;
    const own = tilesOf(c.id);
    let prod = own.reduce((s, t) => s + t.factories, 0) * 1.55;
    if (c.id === PLAYER) prod *= 1 + c.bonus.prod;
    const upkeep = totalDivs(c.id) * 0.55;
    c.equipment = Math.max(0, c.equipment + prod - upkeep);
    c.manpower += 350 + own.length * 140;
    c.pp += 0.85 + own.length * 0.02;
  }

  tickFocus();
  aiTurn();

  if (!game.modal && game.day >= game.nextEventDay) {
    game.nextEventDay = game.day + randi(22, 40);
    triggerEvent();
  }

  checkEnd();
  updateHUD();
  if (game.selected || game.target) renderTilePanel();
  if (game.day % 5 === 0) renderLog();
}

/* ============================================================
   ИНТЕРФЕЙС
   ============================================================ */
function divText(v) {
  if (!v || v < 0.05) return '—';
  return v >= 9.95 ? String(Math.round(v)) : v.toFixed(1).replace('.0', '');
}

function renderTilePanel() {
  const el = $('tilePanel');
  if (!el || !game) return;
  const t = game.selected;

  if (!t) {
    el.innerHTML = `<div class="panel-title">Провинция</div>
      <div style="padding:14px">
        <p class="hint">Кликните по гексу, чтобы посмотреть провинцию.<br><br>
        Своя провинция: набор дивизий и заводы.<br>
        Своя, затем соседняя чужая: кнопка атаки.<br>
        <b>ПКМ</b> по соседней своей — перебросить войска.<br><br>
        В каждой провинции есть <b>ополчение</b>, поэтому пустые гексы не сдаются за один день.</p>
      </div>`;
    return;
  }

  const c = game.countries[t.owner];
  const divs = t.divs[t.owner] || 0;
  const src = game.source;
  const isPlayer = t.owner === PLAYER;
  const defMult = TERRAIN[t.terrain].def * (t.capital ? 1.35 : 1);
  let html = `<div class="ptitle">
    <span class="dot" style="background:${c.color}"></span>
    <div><h2>${t.name}</h2>
    <div class="muted">${c.name} · ${TERRAIN[t.terrain].name}${t.capital ? ' · столица' : ''}</div></div>
  </div>`;

  html += `<div class="kv">
    <div><span>Дивизий</span><b>${divText(divs)}</b></div>
    <div><span>Заводов</span><b>${t.factories}</b></div>
    <div><span>Оборона</span><b>×${defMult.toFixed(2)}</b></div>
  </div>`;

  if (isPlayer) {
    const p = me();
    html += `<button class="btn primary" data-act="recruit" ${p.equipment < 50 || p.manpower < 10000 ? 'disabled' : ''}>
      Набрать дивизию <span class="cost">50 снаряж. · 10 тыс.</span></button>`;
    html += `<button class="btn" data-act="factory" ${p.equipment < 180 || p.pp < 20 ? 'disabled' : ''}>
      Построить завод <span class="cost">180 · 20 ПП</span></button>`;
    html += `<div class="hint"><b>ПКМ</b> по соседней своей провинции — перебросить 1 дивизию,
      <b>Shift+ПКМ</b> — все. Выберите свою провинцию и кликните чужую соседнюю, чтобы атаковать.</div>`;
  } else {
    html += `<div style="margin-top:8px;font-size:11px;letter-spacing:.08em">
      ${atWar(PLAYER, t.owner) ? '<span class="status-war">ВОЙНА</span>' : '<span class="status-peace">МИР</span>'}</div>`;
    html += `<div class="hint">Гарнизон: ${divText(divs)} див. + ополчение 0.4.<br>
      Для штурма нужно больше дивизий, чем даёт оборона противника.</div>`;
  }

  const battles = battlesOnTile(t.id);
  if (battles.length) {
    for (const b of battles) {
      const dir = b.atk === PLAYER ? 'Наше наступление' : (b.def === PLAYER ? 'Мы обороняемся' : 'Бой без нас');
      html += `<div class="battle-tag">⚔ ${dir} · ${Math.round(b.progress)}% · ${b.days} дн.</div>`;
    }
  }

  if (src && !isPlayer) {
    html += `<div style="border-top:1px solid #3d3c26;margin-top:10px;padding-top:10px">
      <div class="muted">Из <b style="color:#e9e3cd">${src.name}</b> · ${divText(src.divs[PLAYER] || 0)} див.</div>`;
    if (!atWar(PLAYER, t.owner)) {
      html += `<button class="btn danger" data-act="war" data-cid="${t.owner}">
        Объявить войну <span class="cost">50 ПП</span></button>`;
    } else if ((src.divs[PLAYER] || 0) < 0.5) {
      html += `<button class="btn" disabled>Атаковать <span class="cost">нет дивизий</span></button>`;
    } else if (battleAt(src.id, t.id)) {
      html += `<button class="btn" disabled>Бой уже идёт…</button>`;
    } else {
      html += `<button class="btn danger" data-act="attack" data-from="${src.id}" data-to="${t.id}">
        ⚔ Атаковать <span class="cost">${divText(src.divs[PLAYER])} против ${divText(Math.max(divs, 0.4))} · ×${defMult.toFixed(2)}</span></button>`;
    }
    html += `</div>`;
  } else if (!isPlayer) {
    html += `<div class="hint">Выберите свою соседнюю провинцию, чтобы перейти в наступление.</div>`;
  }

  el.innerHTML = html;

  el.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'recruit') recruit(t);
      else if (act === 'factory') buildFactory(t);
      else if (act === 'war') playerDeclareWar(+b.dataset.cid);
      else if (act === 'attack') {
        const from = byId(+b.dataset.from), to = byId(+b.dataset.to);
        if (from && to && startBattle(from, to)) {
          toast('Наступление началось. Генералы уже рисуют стрелки.');
          renderTilePanel();
        }
      }
    };
  });
}

function renderSpeed() {
  document.querySelectorAll('.speed button').forEach((b) => {
    b.classList.toggle('active', +b.dataset.speed === game.speed);
  });
}

function setSpeed(n) {
  game.speed = n;
  renderSpeed();
  SND.click();
}

function openFocus() {
  const p = me();
  const items = FOCUSES.map((f) => {
    const st = focusState(f);
    let stateHtml = '';
    if (st === 'done') stateHtml = '<span style="color:#9db56b">Выполнено</span>';
    else if (st === 'active') stateHtml = `<span>${game.focus.day} / ${f.days} дн.</span>`;
    else stateHtml = `<span>${f.days} дн.</span>`;

    let extra = '';
    if (st === 'active') {
      extra = `<div class="progress"><i style="width:${(game.focus.day / f.days) * 100}%"></i></div>`;
    } else if (st === 'available') {
      extra = game.focus
        ? `<button class="btn" disabled>Сначала завершите текущий фокус</button>`
        : `<button class="btn primary" data-focus="${f.id}">Начать фокус</button>`;
    } else if (st === 'locked') {
      extra = `<div class="hint">Требуется: ${f.req.map((r) => (FOCUSES.find((x) => x.id === r) || {}).name).join(', ')}</div>`;
    }
    return `<div class="focus ${st}">
      <div class="f-head"><b>${f.name}</b>${stateHtml}</div>
      <p>${f.desc}</p>${extra}
    </div>`;
  }).join('');

  openModal(`<div class="modal-card wide">
    <div class="kicker">Национальные фокусы · ${dateText(game.day)}</div>
    <h2>Древо развития</h2>
    <p>Один фокус за раз. Время идёт, пока вы читаете это.</p>
    <div class="focus-list">${items}</div>
    <button class="btn ghost" data-close>Закрыть</button>
  </div>`);

  $('modal').querySelectorAll('[data-focus]').forEach((b) => {
    b.onclick = () => startFocus(b.dataset.focus);
  });
  $('modal').querySelector('[data-close]').onclick = closeModal;
}

function openDiplo() {
  const rows = game.countries
    .filter((c) => c.id !== PLAYER)
    .map((c) => {
      const own = tilesOf(c.id);
      const war = atWar(PLAYER, c.id);
      const pactDay = c.pacts.get(PLAYER) || 0;
      const pact = !war && pactDay > game.day;
      const divs = own.reduce((s, t) => s + (t.divs[c.id] || 0), 0);
      let status = war ? '<span class="status-war">ВОЙНА</span>'
        : pact ? `<span class="status-peace">ПАКТ до ${dateText(pactDay).replace(' 1936', '')}</span>`
          : '<span class="status-peace">МИР</span>';
      let actions = '';
      if (!c.eliminated && !war) {
        if (pact) {
          actions += `<button class="btn" disabled>Пакт действует</button>`;
        } else {
          actions += `<button class="btn danger" data-war="${c.id}">Война · 50 ПП</button>`;
          actions += `<button class="btn" data-pact="${c.id}">Пакт · 30 ПП</button>`;
        }
      }
      return `<tr class="${c.eliminated ? 'dead' : ''}">
        <td><div class="flagrow"><i style="background:${c.color}"></i>${c.name}</div></td>
        <td>${divText(divs)} див. · ${own.length} пров.</td>
        <td>${c.eliminated ? '<span class="muted">пала</span>' : status}</td>
        <td style="text-align:right">${actions}</td>
      </tr>`;
    }).join('');

  const p = me();
  openModal(`<div class="modal-card wide">
    <div class="kicker">Министерство иностранных дел · ${dateText(game.day)}</div>
    <h2>Дипломатия</h2>
    <p>Полит. власть: <b>${Math.floor(p.pp)}</b>. Оправдание войны — это просто бумажка, но без неё никак.</p>
    <table class="diplo">
      <tr><th>Страна</th><th>Силы</th><th>Статус</th><th></th></tr>
      ${rows}
    </table>
    <p class="hint">Воевать можно только с соседями. Мирного договора не существует — только капитуляция.</p>
    <button class="btn ghost" data-close>Закрыть</button>
  </div>`);

  $('modal').querySelectorAll('[data-war]').forEach((b) => {
    b.onclick = () => playerDeclareWar(+b.dataset.war);
  });
  $('modal').querySelectorAll('[data-pact]').forEach((b) => {
    b.onclick = () => makePact(+b.dataset.pact);
  });
  $('modal').querySelector('[data-close]').onclick = closeModal;
}

function openHelp(welcome) {
  openModal(`<div class="modal-card">
    <div class="kicker">${welcome ? 'Добро пожаловать в 1936-й' : 'Краткий курс молодого диктатора'}</div>
    <h2>${welcome ? 'Гримания превыше всего' : 'Как играть'}</h2>
    <p><b>Цель:</b> захватить 55% провинций континента. Проигрыш — падение столицы.</p>
    <p><b>Экономика:</b> заводы дают снаряжение, население даёт людей, провинции — полит. власть.
    Дивизия стоит 50 снаряжения и 10 тыс. человек.</p>
    <p><b>Война:</b> выберите свою провинцию, затем соседнюю чужую — появится кнопка атаки.
    Объявлять войну можно только соседям, стоит 50 ПП. Дивизии обороняются сами,
    а в каждой провинции есть ещё и ополчение — с наскока её не взять.</p>
    <p><b>Тактика:</b> соберите 5–10 дивизий в одном приграничном гексе (Shift+ПКМ перебрасывает все)
    и бейте туда, где оборона слабее. Взятие столицы заставляет страну капитулировать целиком.</p>
    <p><b>Фокусы</b> (F) дают бонусы и шутки. <b>Дипломатия</b> (D) — войны и пакты.
    <b>ПКМ</b> по своей соседней провинции перебрасывает войска. Колесо мыши — зум, перетаскивание — карта.</p>
    <p class="hint">Пробел — пауза, 1/2/3 — скорость. Игра сохраняется только в вашей памяти.</p>
    <button class="btn primary" data-close>${welcome ? 'В бой!' : 'Понятно'}</button>
  </div>`);
  $('modal').querySelector('[data-close]').onclick = () => {
    closeModal();
    if (welcome) setSpeed(1);
  };
}

/* ============================================================
   ОТРИСОВКА
   ============================================================ */
function angDiff(a, b) {
  let d = (a - b + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r * f), 0, 255);
  g = clamp(Math.round(g * f), 0, 255);
  b = clamp(Math.round(b * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function hexPath(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 6 + (i * Math.PI) / 3;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function edgePoints(t, nb) {
  const a = Math.atan2(nb.y - t.y, nb.x - t.x);
  const norm = (a + TAU) % TAU;
  const idx = Math.round(norm / (Math.PI / 3)) % 6;
  const a1 = -Math.PI / 6 + idx * (Math.PI / 3);
  const a2 = a1 + Math.PI / 3;
  return [
    [t.x + HEX * Math.cos(a1), t.y + HEX * Math.sin(a1)],
    [t.x + HEX * Math.cos(a2), t.y + HEX * Math.sin(a2)],
  ];
}

function drawStar(x, y, r, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawTerrainIcon(t) {
  const x = t.x, y = t.y;
  ctx.save();
  ctx.globalAlpha = 0.55;
  if (t.terrain === 'forest') {
    ctx.fillStyle = '#20301c';
    for (let i = 0; i < 3; i++) {
      const ox = -12 + i * 12 + (t.id % 3) * 2, oy = 9 - (i % 2) * 5;
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy - 13);
      ctx.lineTo(x + ox + 6, y + oy + 2);
      ctx.lineTo(x + ox - 6, y + oy + 2);
      ctx.closePath(); ctx.fill();
    }
  } else if (t.terrain === 'mountain') {
    ctx.fillStyle = '#2c2c24';
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 7); ctx.lineTo(x - 2, y - 14); ctx.lineTo(x + 10, y + 7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4b4a3c';
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 14); ctx.lineTo(x + 3, y - 5); ctx.lineTo(x - 7, y - 5);
    ctx.closePath(); ctx.fill();
  } else if (t.terrain === 'city') {
    ctx.fillStyle = '#3a3a2c';
    ctx.fillRect(x - 14, y - 3, 8, 10);
    ctx.fillRect(x - 4, y - 10, 7, 17);
    ctx.fillRect(x + 5, y - 1, 9, 8);
    ctx.fillStyle = '#6d6a4d';
    ctx.fillRect(x - 12, y - 1, 2, 2);
    ctx.fillRect(x - 2, y - 8, 2, 2);
  }
  ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!game) return;

  const bg = ctx.createRadialGradient(W * 0.4, H * 0.5, 60, W * 0.4, H * 0.5, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#14160f');
  bg.addColorStop(1, '#070804');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const s = effScale();
  ctx.save();
  ctx.translate(cam.cx + cam.panX, cam.cy + cam.panY);
  ctx.scale(s, s);
  ctx.translate(-cam.mx, -cam.my);

  // заливка гексов
  for (const t of tiles) {
    const c = game.countries[t.owner];
    const f = 0.34 + ((t.id * 7) % 5) * 0.012;
    ctx.fillStyle = shade(c.color, c.eliminated ? f * 0.75 : f);
    hexPath(t.x, t.y, HEX - 0.6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawTerrainIcon(t);
  }

  // границы, фронты, берег
  for (const t of tiles) {
    for (const nb of t.nb) {
      if (nb.owner === t.owner) continue;
      const pts = edgePoints(t, nb);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      if (atWar(t.owner, nb.owner)) {
        ctx.strokeStyle = 'rgba(214,74,58,.92)';
        ctx.lineWidth = 3.4;
        ctx.setLineDash([6, 5]);
      } else {
        ctx.strokeStyle = 'rgba(6,7,4,.85)';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const near = t.nb.find((nb) => Math.abs(angDiff(Math.atan2(nb.y - t.y, nb.x - t.x), a)) < 0.15);
      if (near) continue;
      const a1 = -Math.PI / 6 + i * (Math.PI / 3);
      const a2 = a1 + Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(t.x + HEX * Math.cos(a1), t.y + HEX * Math.sin(a1));
      ctx.lineTo(t.x + HEX * Math.cos(a2), t.y + HEX * Math.sin(a2));
      ctx.strokeStyle = 'rgba(3,4,2,.95)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }

  // заводы и столицы
  for (const t of tiles) {
    if (t.factories > 0) {
      const n = Math.min(t.factories, 5);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = 'rgba(216,196,131,.8)';
        ctx.fillRect(t.x - 16 + (i % 3) * 11, t.y - 27 + Math.floor(i / 3) * 7, 6, 5);
      }
      if (t.factories > 5) {
        ctx.fillStyle = '#d8c483';
        ctx.font = 'bold 8px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('+' + (t.factories - 5), t.x + 18, t.y - 21);
      }
    }
    if (t.capital) {
      ctx.fillStyle = '#f0dca0';
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 1;
      drawStar(t.x + 20, t.y - 20, 6.5, 5);
      ctx.fill(); ctx.stroke();
    }
  }

  // подсветка и стрелки
  if (game.source && game.selected) drawArrow(game.source, game.selected, 'rgba(220,90,70,.85)');
  if (mouse.hover && (!game.selected || mouse.hover !== game.selected)) {
    hexPath(mouse.hover.x, mouse.hover.y, HEX - 2);
    ctx.strokeStyle = 'rgba(255,248,220,.55)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
  if (game.selected) {
    hexPath(game.selected.x, game.selected.y, HEX - 2);
    ctx.strokeStyle = '#f0dca0';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,220,160,.18)';
    ctx.lineWidth = 9;
    ctx.stroke();
  }
  if (game.source) {
    hexPath(game.source.x, game.source.y, HEX - 2);
    ctx.strokeStyle = 'rgba(240,220,160,.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // юниты
  for (const t of tiles) {
    const divs = t.divs[t.owner] || 0;
    if (divs < 0.05) continue;
    const c = game.countries[t.owner];
    const label = divText(divs);
    const w = 14 + label.length * 7;
    const bx = t.x - w / 2, by = t.y + HEX * 0.42;
    ctx.fillStyle = 'rgba(8,9,5,.82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, w, 17, 3); else ctx.rect(bx, by, w, 17);
    ctx.fill();
    ctx.strokeStyle = shade(c.color, 1.4);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#f4eed8';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, t.x, by + 9);
    ctx.fillStyle = c.color;
    ctx.fillRect(bx + 3, by + 3, 3, 11);
  }

  // бои
  for (const b of game.battles) {
    const tt = byId(b.to);
    if (!tt) continue;
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180 + b.id);
    ctx.save();
    ctx.globalAlpha = 0.45 + pulse * 0.4;
    ctx.strokeStyle = '#e0553f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(tt.x, tt.y, HEX * 0.78, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(tt.x, tt.y - 30);
    ctx.strokeStyle = '#f0e2c0';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, -7); ctx.lineTo(7, 7);
    ctx.moveTo(7, -7); ctx.lineTo(-7, 7);
    ctx.stroke();
    ctx.restore();

    const bw = 40;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(tt.x - bw / 2, tt.y + HEX * 0.72, bw, 5);
    ctx.fillStyle = b.atk === PLAYER ? '#8fb35f' : '#c8503c';
    ctx.fillRect(tt.x - bw / 2, tt.y + HEX * 0.72, (bw * b.progress) / 100, 5);
  }

  ctx.restore();

  // подписи стран
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const c of game.countries) {
    if (c.eliminated) continue;
    const own = tilesOf(c.id);
    if (!own.length) continue;
    let cx = 0, cy = 0;
    for (const t of own) { cx += t.x; cy += t.y; }
    cx /= own.length; cy /= own.length;
    const sp = worldToScreen(cx, cy);
    if (sp.x < -100 || sp.x > W + 100 || sp.y < -50 || sp.y > H + 50) continue;
    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillStyle = 'rgba(240,232,205,.5)';
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 5;
    ctx.letterSpacing = '3px';
    ctx.fillText(c.name.toUpperCase(), sp.x, sp.y - 14);
    ctx.letterSpacing = '0px';
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  const vg = ctx.createRadialGradient(W * 0.42, H * 0.5, Math.min(W, H) * 0.35, W * 0.42, H * 0.5, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawArrow(from, to, color) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const sx = from.x + ux * HEX * 0.6, sy = from.y + uy * HEX * 0.6;
  const ex = to.x - ux * HEX * 0.55, ey = to.y - uy * HEX * 0.55;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ux * 16 - uy * 9, ey - uy * 16 + ux * 9);
  ctx.lineTo(ex - ux * 16 + uy * 9, ey - uy * 16 - ux * 9);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/* ============================================================
   УПРАВЛЕНИЕ
   ============================================================ */
function tileAtScreen(sx, sy) {
  const w = screenToWorld(sx, sy);
  let best = null, bd = 1e9;
  for (const t of tiles) {
    const d = Math.hypot(t.x - w.x, t.y - w.y);
    if (d < bd) { bd = d; best = t; }
  }
  return bd <= HEX * 0.95 ? best : null;
}

function updateHover(sx, sy) {
  mouse.x = sx; mouse.y = sy;
  const w = screenToWorld(sx, sy);
  mouse.wx = w.x; mouse.wy = w.y;
  mouse.hover = tileAtScreen(sx, sy);
  updateTooltip(mouse.hover);
}

function updateTooltip(t) {
  const el = $('tooltip');
  if (!t || !game || game.modal) { el.classList.add('hidden'); return; }
  const c = game.countries[t.owner];
  const war = atWar(PLAYER, t.owner) && t.owner !== PLAYER;
  el.innerHTML = `<b>${t.name}</b>${c.name} · ${TERRAIN[t.terrain].name}<br>
    Дивизий: ${divText(t.divs[t.owner] || 0)} · Заводов: ${t.factories}
    ${t.capital ? '<br>★ Столица' : ''}
    ${war ? '<br><span class="t-war">⚔ Война с вами</span>' : ''}`;
  el.classList.remove('hidden');
  const pad = 16;
  let x = mouse.x + pad, y = mouse.y + pad;
  const r = el.getBoundingClientRect();
  if (x + r.width > W - 8) x = mouse.x - r.width - pad;
  if (y + r.height > H - 8) y = mouse.y - r.height - pad;
  el.style.left = Math.max(6, x) + 'px';
  el.style.top = Math.max(6, y) + 'px';
}

function handleClick(t) {
  if (!t) {
    game.selected = null; game.source = null;
    renderTilePanel(); return;
  }
  if (t.owner === PLAYER) {
    game.selected = t; game.source = null;
  } else if (game.selected && game.selected.owner === PLAYER &&
    game.selected.id !== t.id && game.selected.nb.indexOf(t) !== -1) {
    game.source = game.selected;
    game.selected = t;
  } else {
    game.selected = t; game.source = null;
  }
  renderTilePanel();
  SND.click();
}

function moveDivisions(t, shift) {
  if (!t || t.owner !== PLAYER) return;
  const src = game.selected;
  if (!src || src.owner !== PLAYER || src === t || src.nb.indexOf(t) === -1) {
    toast('Выберите свою провинцию и ПКМ по соседней своей');
    return;
  }
  const avail = src.divs[PLAYER] || 0;
  let n = shift ? avail : Math.min(1, avail);
  if (n < 0.5) { toast('Здесь нечего перебрасывать'); SND.bad(); return; }
  src.divs[PLAYER] = avail - n;
  if (src.divs[PLAYER] < 0.05) delete src.divs[PLAYER];
  t.divs[PLAYER] = (t.divs[PLAYER] || 0) + n;
  toast(`Переброшено ${divText(n)} див. в ${t.name}`);
  SND.click();
  renderTilePanel();
}

let drag = { down: false, moved: false, lastX: 0, lastY: 0, sx: 0, sy: 0, button: 0 };

canvas.addEventListener('pointerdown', (e) => {
  if (game && game.modal) return;
  if (e.button === 2) return;
  drag.down = true; drag.moved = false;
  drag.lastX = drag.sx = e.clientX; drag.lastY = drag.sy = e.clientY;
  drag.button = e.button;
  if (e.button === 0) updateHover(e.clientX, e.clientY);
});

canvas.addEventListener('pointermove', (e) => {
  updateHover(e.clientX, e.clientY);
  if (!drag.down) return;
  const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
  drag.lastX = e.clientX; drag.lastY = e.clientY;
  if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) drag.moved = true;
  if (drag.moved) {
    cam.panX += dx; cam.panY += dy;
    clampPan();
    $('tooltip').classList.add('hidden');
  }
});

window.addEventListener('pointerup', (e) => {
  if (!drag.down) return;
  drag.down = false;
  if (drag.moved) return;
  if (e.target !== canvas) return;
  if (game.modal) return;
  const t = tileAtScreen(e.clientX, e.clientY);
  if (drag.button === 0) handleClick(t);
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!game || game.modal) return;
  const t = tileAtScreen(e.clientX, e.clientY);
  moveDivisions(t, e.shiftKey);
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!game) return;
  const wx = screenToWorld(e.clientX, e.clientY).x;
  const wy = screenToWorld(e.clientX, e.clientY).y;
  cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.0012), 0.55, 3);
  const ns = effScale();
  cam.panX = e.clientX - cam.cx - (wx - cam.mx) * ns;
  cam.panY = e.clientY - cam.cy - (wy - cam.my) * ns;
  clampPan();
  updateHover(e.clientX, e.clientY);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (!game) return;
  if (e.code === 'Escape') {
    if (game.modal) closeModal();
    else if (game.speed > 0) setSpeed(0);
    return;
  }
  if (game.modal) return;
  if (e.code === 'Space') {
    e.preventDefault();
    setSpeed(game.speed > 0 ? 0 : 1);
  }
  if (e.code === 'Digit1') setSpeed(1);
  if (e.code === 'Digit2') setSpeed(2);
  if (e.code === 'Digit3') setSpeed(3);
  if (e.code === 'KeyF') openFocus();
  if (e.code === 'KeyD') openDiplo();
  if (e.code === 'KeyH') openHelp(false);
});

document.querySelectorAll('.speed button').forEach((b) => {
  b.addEventListener('click', () => {
    if (game.over) return;
    setSpeed(+b.dataset.speed);
  });
});
$('btnFocus').addEventListener('click', () => { if (!game.modal) openFocus(); });
$('btnDiplo').addEventListener('click', () => { if (!game.modal) openDiplo(); });
$('btnHelp').addEventListener('click', () => { if (!game.modal) openHelp(false); });
$('btnSound').addEventListener('click', () => {
  muted = !muted;
  $('btnSound').textContent = 'Звук: ' + (muted ? 'выкл' : 'вкл');
  if (!muted) SND.click();
});

/* ============================================================
   ЦИКЛ
   ============================================================ */
const DAY_MS = { 1: 320, 2: 160, 3: 80 };

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(120, now - lastTime);
  lastTime = now;

  if (game && !game.modal && !game.over && game.speed > 0) {
    const dayMs = DAY_MS[game.speed] || 320;
    game.acc += dt;
    let guard = 0;
    while (game.acc >= dayMs && guard < 12) {
      game.acc -= dayMs;
      advanceDay();
      guard++;
      if (game.modal || game.over) { game.acc = 0; break; }
    }
    if (guard >= 12) game.acc = 0;
  }

  draw();
  requestAnimationFrame(frame);
}

/* ---------------- запуск ---------------- */
resize();
newGame();
setSpeed(0);
renderSpeed();
openHelp(true);
requestAnimationFrame(frame);


