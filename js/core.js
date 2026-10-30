// 核心：日期、存檔與資料轉換、習慣與打卡紀錄、狀態推導（XP、金幣、連勝、等級）、音效。
/* ========= 日期 ========= */
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayKey = (ts = Date.now()) => keyOf(new Date(ts - CONFIG.dayStartHour * 3600e3));
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const weekKey = k => { const d = parseKey(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return keyOf(d); };
const EPOCH = '2026-01-05'; // 一個星期一，兩週為一期時從這天起算
function periodKey(d, weeks) {
  const w = weekKey(d);
  if (weeks <= 1) return w;
  const days = Math.round((parseKey(w) - parseKey(EPOCH)) / 864e5);
  return addDays(EPOCH, Math.floor(days / (7 * weeks)) * 7 * weeks);
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const rid = () => Math.random().toString(36).slice(2);

/* ========= 存檔 ========= */
const KEY = 'habitdive.v1';
const blank = () => ({ v: 5, logs: [], plans: {}, checks: {}, mute: false });
const OLD_CAT = { '☀️': 'wake', '💻': 'research', '✍️': 'vocus', '🏃': 'exercise', '📘': 'digital', '📌': 'other' };
// v1：六件事有 line/time/dur；v2：分類用 emoji、習慣寫死；v3：習慣可自訂；v4：習慣改在卡片上打卡（S.checks）
function migrate(s) {
  const old = (s.v || 1) < 3;
  s.logs = Array.isArray(s.logs) ? s.logs : [];
  for (const l of s.logs) if (!l.id) l.id = rid();
  s.plans = s.plans && typeof s.plans === 'object' ? s.plans : {};
  for (const [d, P] of Object.entries(s.plans)) if (!Array.isArray(P)) delete s.plans[d];
  for (const P of Object.values(s.plans)) for (const it of P) {
    it.text = String(it.text ?? '');
    if (!it.cat) it.cat = it.line || '📌';
    if (OLD_CAT[it.cat]) it.cat = OLD_CAT[it.cat];
    if (it.done && it.rw === undefined) it.rw = true;
    delete it.line; delete it.time; delete it.dur; delete it.cal;
  }
  s.checks = s.checks && typeof s.checks === 'object' ? s.checks : {};
  if (!s.habits) {
    s.habits = DEFAULT_HABITS.map(h => ({ ...h }));
    if (s.vcfg) { Object.assign(s.habits.find(h => h.id === 'vocus'), { weeks: s.vcfg.weeks, target: s.vcfg.target }); s.vocusSet = true; }
    if (old && (s.logs.length > 1 || Object.keys(s.plans).length))
      s.habits.push({ id: 'wake', e: '☀️', n: '早起', kind: 'custom', weeks: 0, target: 1 },
                    { id: 'research', e: '💻', n: '研究', kind: 'custom', weeks: 0, target: 1 });
    delete s.vcfg;
  }
  // v5：六件事不再算連勝。「六件事」習慣拿掉；用習慣當分類打過勾的項目，搬成習慣打卡紀錄（不重複計算）
  s.habits = s.habits.filter(h => h.kind !== 'plan');
  const today = dayKey();
  for (const [d, P] of Object.entries(s.plans)) for (const it of P) {
    if (!s.habits.some(h => h.id === it.cat)) continue;   // 只處理用習慣當分類的項目
    if (it.done && (it.cat !== 'vocus' || (it.pub && it.pub.on))) {
      const entry = it.cat === 'exercise' ? { ...(it.ex || {}), note: (it.ex && it.ex.note) || it.text || undefined }
        : it.cat === 'vocus' ? { title: (it.pub && it.pub.title) || it.text || undefined } : {};
      const c = s.checks[d] || (s.checks[d] = {});
      (c[it.cat] || (c[it.cat] = [])).push({ t: 0, ...entry });
      // 今天搬過來的不要再發一次打卡寶箱（當時打勾已經給過了）
      if (d === today) {
        const key = it.cat === 'vocus' ? 'art:' + d : `hab:${it.cat}:${d}`;
        if (!s.logs.some(l => l.key === key)) s.logs.push({ id: rid(), t: 0, d, k: 'habit', key, xp: 0, c: 0 });
      }
    }
    it.cat = 'other'; delete it.ex; delete it.pub;
  }
  if (s.fed) for (const k of Object.keys(s.fed)) if (!k.includes('#') && CR[k]) { s.fed[k + '#0'] = (s.fed[k + '#0'] || 0) + s.fed[k]; delete s.fed[k]; }
  // 每一隻改用抽到牠的那筆紀錄 id 當身分：clown#0 → 第 1 筆小丑魚紀錄的 id
  if (s.fed) for (const k of Object.keys(s.fed)) {
    const m = k.match(/^(\w+)#(\d+)$/); if (!m) continue;
    const lg = s.logs.filter(l => l.drop === m[1])[+m[2]];
    if (lg) s.fed[lg.id] = (s.fed[lg.id] || 0) + s.fed[k];
    delete s.fed[k];
  }
  s.released = s.released || {}; s.outTank = s.outTank || {}; s.favs = Array.isArray(s.favs) ? s.favs : [];
  if (!s.gcats) {
    s.gcats = CONFIG.generalCats.map(c => ({ ...c }));
    if (Object.values(s.plans).some(P => P.some(it => it.cat === 'digital')))
      s.gcats.unshift({ id: 'digital', e: '📘', n: '數位商品' });
  }
  if (!s.gcats.some(c => c.id === 'other')) s.gcats.push({ ...CONFIG.generalCats[CONFIG.generalCats.length - 1] });
  // 只剩少數分類的舊資料，補上預設分類（不重複、總數不超過 6）
  if (!s.catsFilled) {
    for (const c of CONFIG.generalCats) if (s.gcats.filter(x => !x.off).length < 6 && !s.gcats.some(x => x.id === c.id || x.n === c.n)) s.gcats.splice(s.gcats.length - 1, 0, { ...c });
    s.catsFilled = true;
  }
  if (s.timer && (s.timer.k || !(s.timer.start > 0) || (s.timer.segs && !(s.timer.segs[s.timer.si] && s.timer.segs[s.timer.si].min > 0)))) delete s.timer;
  s.v = 5;
  return s;
}
function load() {
  try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && Array.isArray(j.logs)) return migrate(Object.assign(blank(), j)); } catch (e) {}
  return migrate(blank());
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ========= 習慣與分類 ========= */
const activeHabits = () => S.habits.filter(h => !h.off);
const habit = id => S.habits.find(h => h.id === id && !h.off);
const customCount = () => activeHabits().filter(h => h.kind === 'custom').length;
const gcats = () => S.gcats.filter(c => !c.off);
function catOf(id) {
  return gcats().find(c => c.id === id) || S.gcats.find(c => c.id === 'other');
}
const catList = () => gcats();
const placeholder = c => c.ph || `${c.n}：今天要做什麼？`;
const periodWord = h => h.weeks === 1 ? '本週' : '這兩週';
const countWord = h => h.kind === 'vocus' ? '篇' : '天';

// 習慣打卡紀錄：S.checks[日期][習慣 id] = [{ t, title?, type?, dist?, min?, note? }]
const dayChecks = (d, id) => (S.checks[d] && S.checks[d][id]) || [];
function addCheck(d, id, entry) {
  const c = S.checks[d] || (S.checks[d] = {});
  (c[id] || (c[id] = [])).push({ t: Date.now(), ...entry });
}
function delCheck(d, id, i) {
  const a = dayChecks(d, id); a.splice(i, 1);
  if (!a.length && S.checks[d]) delete S.checks[d][id];
  if (S.checks[d] && !Object.keys(S.checks[d]).length) delete S.checks[d];
}

/* ========= 狀態推導 ========= */
// XP、金幣、圖鑑由 logs 算；習慣完成由卡片打卡（S.checks）算，加上舊版的六件事打勾與紀錄
function derive() {
  const D = { xp: 0, coins: 0, col: {}, days: {}, per: {}, articles: 0, claimed: new Set() };
  const inc = (d, k, n = 1) => { const x = D.days[d] || (D.days[d] = {}); x[k] = (x[k] || 0) + n; };
  for (const l of S.logs) {
    D.xp += l.xp || 0; D.coins += l.c || 0;
    if (l.drop) D.col[l.drop] = (D.col[l.drop] || 0) + 1;
    if (l.key) D.claimed.add(l.key);
    if (['wake', 'research', 'exercise'].includes(l.k) && !l.late) inc(l.d, l.k);
    if (l.k === 'article') inc(l.d, 'vocus');
  }
  for (const [d, C] of Object.entries(S.checks)) for (const [id, arr] of Object.entries(C))
    if (arr.length) inc(d, id, id === 'vocus' ? arr.length : 1);
  for (const x of Object.values(D.days)) D.articles += x.vocus || 0;
  // 週期型習慣：Vocus 算篇數，其他算「有做的天數」（一天做兩次也只算一天）
  for (const h of activeHabits()) if (h.weeks) for (const [d, x] of Object.entries(D.days)) if (x[h.id]) {
    const k = h.id + '@' + periodKey(d, h.weeks);
    D.per[k] = (D.per[k] || 0) + (h.kind === 'vocus' ? x[h.id] : 1);
  }
  return D;
}
const dayDone = (D, d, k) => !!(D.days[d] && D.days[d][k]);
const perCount = (D, h, p) => D.per[h.id + '@' + p] || 0;
const periodDone = (D, h, p) => perCount(D, h, p) >= h.target;

// 每天的習慣「不連續漏兩次」：漏一次不斷，連續漏兩次才歸零；進行中的今天不算漏。
// 週期型習慣漏一期就斷：週期本身已經是自己選的寬鬆度
function chain(isDone, cur, step, first, maxMiss) {
  let n = isDone(cur) ? 1 : 0, miss = 0, k = step(cur);
  const prevMissed = !isDone(k);
  while (k >= first) {
    if (isDone(k)) { n++; miss = 0; } else if (++miss >= maxMiss) break;
    k = step(k);
  }
  return { n, risk: maxMiss > 1 && n > 0 && !isDone(cur) && prevMissed };
}
function streaks(D) {
  const today = dayKey(), first = Object.keys(D.days).sort()[0] || today, out = {};
  for (const h of activeHabits()) out[h.id] = h.weeks
    ? chain(p => periodDone(D, h, p), periodKey(today, h.weeks), p => addDays(p, -7 * h.weeks), periodKey(first, h.weeks), 1)
    : chain(d => dayDone(D, d, h.id), today, d => addDays(d, -1), first, 2);
  return out;
}
// 等級：升到 Lv.n 需要累積 10×(n−1)² XP
const levelOf = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 10)) + 1;
const xpFor = lv => 10 * (lv - 1) ** 2;
const rankIdx = lv => RANKS.reduce((a, r, i) => lv >= r[0] ? i : a, 0);

/* ========= 音效 ========= */
let AC;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, t0, d, type = 'square', vol = .05) {
  if (S.mute) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + t0 + d);
    o.connect(g).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + d + .05);
  } catch (e) {}
}
const SFX = {
  tap: () => tone(660, 0, .05),
  shake: () => tone(196, 0, .06, 'square', .03),
  open: r => [[523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175], [523, 659, 784, 1047, 1319, 1568],
    [392, 523, 659, 784, 1047, 1319, 1568, 2093]][r].forEach((f, i) => tone(f, i * .08, .2)),
  done: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * .16, .35, 'triangle', .09)),
  buy: () => [880, 1320, 1760].forEach((f, i) => tone(f, i * .07, .12)),
  rank: () => [262, 330, 392, 523, 392, 523].forEach((f, i) => tone(f, i * .12, .25, 'triangle', .08)),
  eat: () => tone(880, 0, .06, 'triangle', .04),
};

