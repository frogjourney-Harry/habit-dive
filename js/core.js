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
  s.logs = (Array.isArray(s.logs) ? s.logs : []).filter(l => l && typeof l === 'object');
  for (const l of s.logs) {
    if (!l.id) l.id = rid();
    for (const k of ['c', 'xp']) if (l[k] != null && typeof l[k] !== 'number') l[k] = Number(l[k]) || 0;   // 字串數字會讓金幣變成字串相加
  }
  s.plans = s.plans && typeof s.plans === 'object' && !Array.isArray(s.plans) ? s.plans : {};
  for (const [d, P] of Object.entries(s.plans)) {
    if (!Array.isArray(P)) { delete s.plans[d]; continue; }
    // 六件事一律剛好 6 格（舊版可能只有幾格、壞資料可能有 null）
    const fixed = P.filter(it => it && typeof it === 'object').slice(0, 6);
    while (fixed.length < 6) fixed.push({ text: '', cat: 'other', done: false, rw: false });
    s.plans[d] = fixed;
  }
  for (const k of ['fed', 'released', 'outTank', 'held', 'seen']) if (s[k] && (typeof s[k] !== 'object' || Array.isArray(s[k]))) s[k] = {};
  if (s.shop && !Array.isArray(s.shop)) delete s.shop;
  // 單一數值欄位：型別不對就換成合理的值（字串會讓飼料 5+10 變成 "510"；番茄鐘分鐘太大會讓整個頁面卡死）
  const num = v => (v === null || v === '' || v === true || v === false || !Number.isFinite(+v)) ? 0 : +v;
  for (const k of ['feed', 'lvSeen', 'tossed']) if (s[k] != null) s[k] = Math.max(0, Math.floor(num(s[k])));
  if (s.mtime != null) s.mtime = Math.max(0, num(s.mtime));
  if (s.pomoMin != null) { const m = Math.round(num(s.pomoMin)); if (m >= 5 && m <= 120) s.pomoMin = m; else delete s.pomoMin; }
  if (s.feedDay != null) { if (typeof s.feedDay === 'object' && !Array.isArray(s.feedDay)) s.feedDay = { d: String(s.feedDay.d || ''), used: Math.max(0, Math.floor(num(s.feedDay.used))) }; else delete s.feedDay; }
  // 撒過幾顆飼料（新手提示用）：還沒有這個欄位的舊存檔，用吃掉的顆數加今天撒的估計
  if (s.tossed == null && s.fed && typeof s.fed === 'object') s.tossed = Object.values(s.fed).reduce((a, v) => a + Math.max(0, +v || 0), 0) + (s.feedDay ? s.feedDay.used : 0);
  if (s.favs != null) s.favs = (Array.isArray(s.favs) ? s.favs : []).filter(x => typeof x === 'string' && x.trim()).slice(0, 12);
  if (s.habits) for (const h of s.habits) { if (h.unit != null) h.unit = String(h.unit).slice(0, 4); h.n = String(h.n ?? ''); h.weeks = Math.max(0, Math.min(2, Math.round(num(h.weeks)))); h.target = Math.max(1, Math.min(14, Math.round(num(h.target)) || 1)); }
  if (s.habits && !Array.isArray(s.habits)) delete s.habits;
  if (s.habits) s.habits = s.habits.filter(h => h && typeof h === 'object' && h.id);
  for (const P of Object.values(s.plans)) for (const it of P) {
    it.text = String(it.text ?? '');
    if (!it.cat) it.cat = it.line || '📌';
    if (OLD_CAT[it.cat]) it.cat = OLD_CAT[it.cat];
    if (it.rw === undefined) it.rw = !!it.done && (s.v || 1) < 5;   // 舊制度（v5 以前）打勾都有獎勵；之後沒有欄位的一律當作沒領過，不然每次開啟都會把「沒獎勵的打勾」算成有
    delete it.line; delete it.time; delete it.dur; delete it.cal;
  }
  s.checks = s.checks && typeof s.checks === 'object' && !Array.isArray(s.checks) ? s.checks : {};
  for (const [d, C] of Object.entries(s.checks)) {
    if (!C || typeof C !== 'object') { delete s.checks[d]; continue; }
    for (const [id, arr] of Object.entries(C)) { if (!Array.isArray(arr)) delete C[id]; else C[id] = arr.filter(e => e && typeof e === 'object'); if (C[id] && !C[id].length) delete C[id]; }
    if (!Object.keys(C).length) delete s.checks[d];
  }
  if (!s.habits) {
    s.habits = DEFAULT_HABITS.map(h => ({ ...h }));
    // 很舊的存檔有寫文章的紀錄（設定過發文節奏、或六件事用了寫文章的分類）：保留成一般習慣，單位是「篇」
    if (s.vcfg || (old && Object.values(s.plans).some(P => P.some(it => it.cat === 'vocus'))))
      s.habits.unshift({ id: 'vocus', e: '✍️', n: 'Vocus', kind: 'custom', unit: '篇', weeks: s.vcfg ? s.vcfg.weeks : 1, target: s.vcfg ? s.vcfg.target : 1 });
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
      const entry = it.cat === 'exercise' ? { ...(it.ex || {}), note: (it.ex && it.ex.note) || it.text || undefined } : {};
      const c = s.checks[d] || (s.checks[d] = {});
      (c[it.cat] || (c[it.cat] = [])).push({ t: 0, ...entry });
      // 今天搬過來的不要再發一次打卡寶箱（當時打勾已經給過了）
      if (d === today) {
        const key = `hab:${it.cat}:${d}`;
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
  if (s.timer && (typeof s.timer !== 'object' || s.timer.k || !(s.timer.start > 0) || (s.timer.segs && (!Array.isArray(s.timer.segs) || !(s.timer.segs[s.timer.si] && s.timer.segs[s.timer.si].min > 0))))) delete s.timer;
  // v6：生物只從商店寶箱來。舊制度（打卡、新手寶箱）送的生物收回，金幣和 XP 保留；圖鑑跟著重來
  if (s.v < 6) {
    const gone = new Set();
    for (const l of s.logs) if (l.drop && l.k !== 'chest') { gone.add(l.id); delete l.drop; }
    for (const o of [s.fed, s.released, s.outTank]) if (o) for (const id of gone) delete o[id];
    s.seen = {};
  }
  // v7：新手禮物改成一隻小丑魚；已經玩過的（新手紀錄上沒有生物）補送
  if (s.v < 7) { const w = s.logs.find(l => l.k === 'welcome'); if (w && !w.drop) w.drop = 'clown'; }
  // v8：拿掉內建的 Vocus 發文習慣。沒設定也沒打過卡的（預設帶的）直接移除；用過的改成一般習慣（單位「篇」），
  // 打卡、請假、已領的獎勵都接著用（獎勵紀錄的 key 改成一般習慣的格式，今天不會重複發）
  if (s.v < 8) {
    const used = id => Object.values(s.checks).some(C => C[id]) || s.logs.some(l => l.k === 'article');
    s.habits = s.habits.filter(h => h.kind !== 'vocus' || s.vocusSet || used(h.id));
    for (const h of s.habits) if (h.kind === 'vocus') { h.kind = 'custom'; if (!h.unit) h.unit = '篇'; }
    const fix = l => {
      if (l.k === 'pubchest') l.k = 'habit';
      if (typeof l.key === 'string' && l.key.startsWith('art:')) l.key = 'hab:vocus:' + l.key.slice(4);
    };
    for (const l of s.logs) {
      fix(l);
      // 最早的版本把發文記在 logs（k: 'article'）：補成那天的打卡
      if (l.k === 'article' && l.d) { const c = s.checks[l.d] || (s.checks[l.d] = {}); if (!c.vocus) c.vocus = [{ t: 0 }]; l.k = 'habit'; }
    }
    if (s.held) for (const [k, l] of Object.entries(s.held)) if (k.startsWith('art:')) { delete s.held[k]; if (l && typeof l === 'object') { fix(l); s.held[l.key || 'hab:vocus:' + k.slice(4)] = l; } }
    delete s.vocusSet;
  }
  s.v = 8;
  // 第一次打開的引導（選習慣、登入）：還沒用過的新存檔要做；用過的（有紀錄、打卡或寫過六件事）當作做過了
  if (typeof s.onb !== 'boolean') s.onb = s.logs.some(l => l.k !== 'welcome' && l.k !== 'login') || Object.keys(s.checks).length > 0 || Object.values(s.plans).some(P => P.some(x => x.text.trim()));
  // 從這天起每天型的習慣漏一天就斷（之前的舊規則是漏兩天才斷，已經有的連勝照舊算）
  if (typeof s.strictFrom !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(s.strictFrom)) s.strictFrom = dayKey();
  return s;
}
const needOnb = () => S.onb === false && !window.__noOnb;   // __noOnb：自動測驗用，略過引導
let STORAGE_OK = true;   // 這個瀏覽器存不存得了紀錄（無痕模式、封鎖網站資料、容量滿了都會變 false）
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { STORAGE_OK = false; }
  try { const j = JSON.parse(raw); if (j && typeof j === 'object' && Array.isArray(j.logs)) return migrate(Object.assign(blank(), j)); } catch (e) {}
  // 讀不懂的存檔先另存一份，不要被新的空存檔蓋掉
  if (raw) { try { localStorage.setItem(KEY + '.corrupt', raw); } catch (e) {} }
  return migrate(blank());
}
let S = load();
function probeStorage() { try { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); STORAGE_OK = true; } catch (e) { STORAGE_OK = false; } }
probeStorage();
// push=true：使用者真的改了東西，記下修改時間並排入雲端同步；false：只寫回本機（例如剛從雲端載入）
function save(push = true) {
  // 修改時間只增不減：這台的時鐘比別台慢（甚至慢好幾分鐘）時，接手別台的紀錄後再改，新的修改時間仍然比對方大，不會被當成「比較舊」而被蓋掉
  if (push) S.mtime = Math.max(Date.now(), (S.mtime || 0) + 1);
  try { localStorage.setItem(KEY, JSON.stringify(S)); STORAGE_OK = true; } catch (e) { STORAGE_OK = false; }
  if (push && typeof cloudSchedule === 'function') cloudSchedule();
}
// 同一個瀏覽器開了兩個分頁時：別的分頁存了比較新的，這一頁就換成那一份，不然這一頁下一次存檔會把對方的改動整個蓋掉
function syncFromStorage() {
  let j; try { j = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return false; }
  if (!j || typeof j !== 'object' || !Array.isArray(j.logs) || (j.mtime || 0) <= (S.mtime || 0)) return false;
  const old = S;
  try { S = migrate(Object.assign(blank(), j)); } catch (e) { S = old; return false; }
  carryEditDrafts(old);
  return true;
}
// 正在編輯習慣或獎勵商店時，從別處同步進來的紀錄不能把編輯中的草稿換掉（欄位對應的位置會錯亂，獎勵商店甚至會整個壞掉）
function carryEditDrafts(old) {
  if (typeof UI === 'undefined') return;
  if (UI.shopEdit && Array.isArray(old.shop)) S.shop = old.shop;
  if (UI.habEdit && Array.isArray(old.habits)) S.habits = old.habits;
  if (UI.tankEdit && old.names) S.names = old.names;
}

/* ========= 存檔瘦身 ========= */
// 天天玩的話，存檔每天約長 1.5 KB；雲端文件上限 1 MB，大約一年半就會超過、同步會一直失敗。
// 存檔超過一定大小時，把「很久以前」的零碎獎勵紀錄合併成一天一筆、舊的六件事文字只留「那天有做事」。
// 金幣、XP、番茄鐘次數與時數、打卡天數、習慣連勝都不會變；抽到的生物、買寶箱、兌換、習慣打卡紀錄（checks）原樣保留。
const COMPACT_LIMIT = 400000, COMPACT_KEEP_DAYS = 60;
const FOLD_KINDS = new Set(['check', 'habit', 'plan', 'top3', 'period', 'weekly', 'anyhab', 'pomo', 'login']);
function compactIfLarge(s = S) {
  if (JSON.stringify(s).length < COMPACT_LIMIT) return false;
  // 以資料裡最新的日期為準（不是裝置現在的日期），裝置日期被調到很後面也不會把近期紀錄收掉
  const dates = [...s.logs.map(l => l.d), ...Object.keys(s.checks), ...Object.keys(s.plans)].filter(Boolean).sort();
  const latest = dates[dates.length - 1], today = dayKey(), cutoff = addDays(latest < today ? latest : today, -COMPACT_KEEP_DAYS);
  const sums = {}, keep = [];
  for (const l of s.logs) {
    if (l.k === 'sum' && l.d < cutoff) { const x = sums[l.d] || (sums[l.d] = { id: 'sum_' + l.d, t: 0, d: l.d, k: 'sum', xp: 0, c: 0 }); x.xp += l.xp || 0; x.c += l.c || 0; if (l.plan) x.plan = true; if (l.pomo) { x.pomo = (x.pomo || 0) + l.pomo; x.pomoMin = (x.pomoMin || 0) + (l.pomoMin || 0); } continue; }
    if (l.d && l.d < cutoff && !l.drop && !l.late && FOLD_KINDS.has(l.k)) {
      const x = sums[l.d] || (sums[l.d] = { id: 'sum_' + l.d, t: 0, d: l.d, k: 'sum', xp: 0, c: 0 });
      x.xp += l.xp || 0; x.c += l.c || 0;
      if (l.k === 'plan') x.plan = true;
      if (l.k === 'pomo') { x.pomo = (x.pomo || 0) + 1; x.pomoMin = (x.pomoMin || 0) + (l.min || CONFIG.pomodoroMin); }
      continue;
    }
    keep.push(l);
  }
  s.logs = [...Object.values(sums), ...keep];
  s.doneDays = s.doneDays || {};
  for (const [d, P] of Object.entries(s.plans)) if (d < cutoff) { if (P.some(x => x.done && x.text && x.text.trim())) s.doneDays[d] = 1; delete s.plans[d]; }
  for (const k of Object.keys(s.held || {})) { const m = k.match(/(\d{4}-\d\d-\d\d)/); if (m && m[1] < cutoff) delete s.held[k]; }
  return true;
}

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
const countWord = h => h.unit || '天';

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

/* ========= 請假 ========= */
// 每天型的習慣：每月可以請 leavePerMonth 天，那天不打卡也不算漏。S.leaves[習慣 id][日期] = 1
// 每週／每兩週型（例如運動）：「這一期請假」，每月 leavePerMonthWeekly 次，記在那一期的第一天；那一期沒達標也不算斷。
// 連勝照樣接下去（不加天數），請假沒有獎勵
// 值：1＝自己請的、'a'＝漏掉時自動用掉的免費假、'f'＝自動用掉的連勝保護卡（不佔每月的免費假）
const leavesOf = id => { const L = S.leaves && typeof S.leaves === 'object' && S.leaves[id]; return L && typeof L === 'object' ? L : {}; };
const onLeave = (id, d) => !!leavesOf(id)[d];
const periodLeave = (h, p) => { const e = addDays(p, 7 * h.weeks - 1); return Object.keys(leavesOf(h.id)).some(x => x >= p && x <= e); };
const leaveHere = (h, d) => h.weeks ? periodLeave(h, periodKey(d, h.weeks)) : onLeave(h.id, d);
const leaveCap = h => h.weeks ? CONFIG.leavePerMonthWeekly : CONFIG.leavePerMonth;
function leaveLeft(id, d) {
  const h = habit(id); if (!h) return 0;
  const key = h.weeks ? periodKey(d, h.weeks) : d, D = h.weeks ? derive() : null;
  // 每週型：請了假、但那一期後來還是達標的，不算用掉
  const L = leavesOf(id);
  const used = Object.keys(L).filter(x => L[x] !== 'f' && x.slice(0, 7) === key.slice(0, 7) && !(h.weeks && periodDone(D, h, periodKey(x, h.weeks)))).length;
  return Math.max(0, leaveCap(h) - used);
}
// 連勝保護卡：所有習慣共用。手上有幾張＝買的張數 − 已經用掉的（補打卡讓那天或那一期完成了，卡就退回）
function freezeLeft(D = derive()) {
  let used = 0;
  for (const [id, L] of Object.entries(S.leaves && typeof S.leaves === 'object' ? S.leaves : {})) {
    if (!L || typeof L !== 'object') continue;
    const h = S.habits.find(x => x.id === id);
    for (const [x, v] of Object.entries(L)) if (v === 'f' && !(h && h.weeks && periodDone(D, h, periodKey(x, h.weeks)))) used++;
  }
  return Math.max(0, S.logs.filter(l => l.freeze).length - used);
}
const autoLeaveOf = (h, d) => { const L = leavesOf(h.id); const k = h.weeks ? Object.keys(L).find(x => x >= d && x <= addDays(d, 7 * h.weeks - 1)) : d; return k && (L[k] === 'a' || L[k] === 'f') ? L[k] : ''; };
// 漏掉的日子（每週型是漏掉的那一期）自動請假：先用當月的免費假，不夠再用保護卡。
// 只補 strictFrom 之後、而且前面真的有連勝的缺口；整段缺口補不完就一張都不用（反正會斷，不白白浪費）
function autoLeave() {
  const td = dayKey(), D = derive(), first = Object.keys(D.days).sort()[0] || td;
  let cards = freezeLeft(D), changed = false;
  for (const h of activeHabits()) {
    const step = h.weeks ? p => addDays(p, -7 * h.weeks) : d => addDays(d, -1);
    const done = h.weeks ? p => periodDone(D, h, p) : d => dayDone(D, d, h.id);
    const lv = h.weeks ? p => periodLeave(h, p) : d => onLeave(h.id, d);
    const endOf = h.weeks ? p => addDays(p, 7 * h.weeks - 1) : d => d;
    const gap = []; let k = step(h.weeks ? periodKey(td, h.weeks) : td);
    const k0 = h.weeks ? periodKey(first, h.weeks) : first;
    while (gap.length < 62 && k >= k0 && !done(k) && !lv(k) && endOf(k) >= S.strictFrom) { gap.push(k); k = step(k); }
    if (!gap.length || !habitChain(D, h, k).n) continue;
    const free = {}, plan = []; let c = cards;
    for (const g of gap.reverse()) {
      const m = g.slice(0, 7); if (free[m] == null) free[m] = leaveLeft(h.id, g);
      if (free[m] > 0) { free[m]--; plan.push([g, 'a']); } else if (c > 0) { c--; plan.push([g, 'f']); } else break;
    }
    if (plan.length < gap.length) continue;
    if (!S.leaves || typeof S.leaves !== 'object') S.leaves = {};
    if (!S.leaves[h.id] || typeof S.leaves[h.id] !== 'object') S.leaves[h.id] = {};
    for (const [g, v] of plan) S.leaves[h.id][g] = v;
    cards = c; changed = true;
  }
  return changed;
}
// 當天打卡了，每天型的請假就自動取消（每週型的請假是整期的，不受影響）
function clearLeave(id, d) { const h = habit(id); if (h && !h.weeks && onLeave(id, d)) delete S.leaves[id][d]; }
// 請假或取消請假，回傳要顯示的訊息
function toggleLeave(id, d) {
  const h = habit(id); if (!h) return '';
  const key = h.weeks ? periodKey(d, h.weeks) : d;
  if (leaveHere(h, d)) {
    if (autoLeaveOf(h, key)) return '這是漏掉時自動補上的假，補打卡就會退回';
    if (h.weeks) { const e = addDays(key, 7 * h.weeks - 1); for (const x of Object.keys(S.leaves[id])) if (x >= key && x <= e) delete S.leaves[id][x]; }
    else delete S.leaves[id][d];
    return '已取消請假';
  }
  if (h.weeks ? periodDone(derive(), h, key) : dayChecks(d, id).length) return h.weeks ? `${periodWord(h)}已經達標，不用請假` : '這天已經完成了，不用請假';
  if (!leaveLeft(id, d)) return `這個月的請假用完了（每月 ${leaveCap(h)} ${h.weeks ? '次' : '天'}）`;
  if (!S.leaves || typeof S.leaves !== 'object') S.leaves = {};
  if (!S.leaves[id] || typeof S.leaves[id] !== 'object') S.leaves[id] = {};
  S.leaves[id][key] = 1; return '請假了，連勝不會中斷';
}

/* ========= 狀態推導 ========= */
// XP、金幣、圖鑑由 logs 算（待領取的獎勵 pend 要領了才算，當天沒領的隔天自動算進來）；習慣完成由卡片打卡（S.checks）算，加上舊版的六件事打勾與紀錄
// 待領取只包含尚未自動入帳的獎勵；餘額、任務與領取動作共用。
const isPendingReward = (log, today = dayKey()) => !!log.pend && log.d >= today;
function derive() {
  const D = { xp: 0, coins: 0, col: {}, days: {}, per: {}, claimed: new Set() };
  const today = dayKey();
  const inc = (d, k, n = 1) => { const x = D.days[d] || (D.days[d] = {}); x[k] = (x[k] || 0) + n; };
  for (const l of S.logs) {
    if (!isPendingReward(l, today)) { D.xp += l.xp || 0; D.coins += l.c || 0; }
    if (l.drop) D.col[l.drop] = (D.col[l.drop] || 0) + 1;
    if (l.key) D.claimed.add(l.key);
    if (['wake', 'research', 'exercise'].includes(l.k) && !l.late) inc(l.d, l.k);
  }
  for (const [d, C] of Object.entries(S.checks)) for (const [id, arr] of Object.entries(C))
    if (arr.length) inc(d, id);
  // 週期型習慣算「有做的天數」（一天做兩次也只算一天）
  for (const h of activeHabits()) if (h.weeks) for (const [d, x] of Object.entries(D.days)) if (x[h.id]) {
    const k = h.id + '@' + periodKey(d, h.weeks);
    D.per[k] = (D.per[k] || 0) + 1;
  }
  return D;
}
const dayDone = (D, d, k) => !!(D.days[d] && D.days[d][k]);
const perCount = (D, h, p) => D.per[h.id + '@' + p] || 0;
const periodDone = (D, h, p) => perCount(D, h, p) >= h.target;

// 漏一天（每週型漏一期）就斷，除非那天請了假；進行中的今天（這一期）不算漏。
// 例外：strictFrom 之前是舊規則，每天的習慣連續漏兩天才斷
// 請假的那天不算漏，也不加天數：連勝照樣接下去
function chain(isDone, cur, step, first, maxMiss, isLeave = () => false) {
  let n = isDone(cur) ? 1 : 0, miss = 0, k = step(cur);
  while (k >= first) {
    if (isDone(k)) { n++; miss = 0; } else if (isLeave(k)) miss = 0; else if (++miss >= maxMiss(k)) break;
    k = step(k);
  }
  return { n };
}
// 某個習慣到 cur 這天（這一期）為止的連勝
function habitChain(D, h, cur) {
  const first = Object.keys(D.days).sort()[0] || dayKey();
  return h.weeks
    ? chain(p => periodDone(D, h, p), periodKey(cur, h.weeks), p => addDays(p, -7 * h.weeks), periodKey(first, h.weeks), () => 1, p => periodLeave(h, p))
    : chain(d => dayDone(D, d, h.id), cur, d => addDays(d, -1), first, d => d < S.strictFrom ? 2 : 1, d => onLeave(h.id, d));
}
function streaks(D) {
  const today = dayKey(), out = {};
  for (const h of activeHabits()) out[h.id] = habitChain(D, h, today);
  return out;
}
// 等級：升到 Lv.n 需要累積 10×(n−1)² XP
const levelOf = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 10)) + 1;
const xpFor = lv => 10 * (lv - 1) ** 2;
const rankIdx = lv => RANKS.reduce((a, r, i) => lv >= r[0] ? i : a, 0);

/* ========= 音效 ========= */
let AC;
// 沒有音效引擎（舊瀏覽器、部分 App 內建瀏覽器）時回傳 null，不能丟錯誤：打勾、領取、買東西的流程都會先呼叫它
function ac() {
  try {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); }
    if (AC.state === 'suspended') { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); }
    return AC;
  } catch (e) { return null; }
}
function tone(f, t0, d, type = 'square', vol = .05) {
  if (S.mute) return;
  try {
    const a = ac(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
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


