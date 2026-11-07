// 測驗環境：每個測驗用獨立的 iframe 載入真正的 index.html，
// 預先注入：獨立的 localStorage、可調的假時鐘、假的 Firebase（含假雲端資料庫）、錯誤收集、環境模擬（無音效、儲存被封鎖…）。
// 操作一律走真的 DOM 點擊（會檢查元素有沒有被別的東西蓋住），不直接呼叫內部函式。
const REPORT = { pass: 0, fail: 0, fails: [], notes: [], started: Date.now(), tests: [] };
let CUR = '';
// 測試檔案本身載入或語法失敗也必須列為失敗，避免只跑部分測試卻顯示全數通過。
window.addEventListener('error', e => {
  if (e.target && e.target.tagName === 'SCRIPT') ok(false, '測試檔案無法載入：' + e.target.src);
  else if (e.message) ok(false, '測試頁錯誤：' + e.message);
});
function ok(cond, msg, extra) {
  if (cond) { REPORT.pass++; return true; }
  REPORT.fail++; REPORT.fails.push({ test: CUR, msg, extra: extra === undefined ? undefined : String(extra).slice(0, 400) });
  return false;
}
const note = msg => REPORT.notes.push({ test: CUR, msg });
function eq(a, b, msg) { return ok(JSON.stringify(a) === JSON.stringify(b), msg, `期望 ${JSON.stringify(b)}，實際 ${JSON.stringify(a)}`); }
const macro = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const flush = async (n = 4) => { for (let i = 0; i < n; i++) await macro(); };
const ts = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const T0 = ts(2026, 11, 2, 10, 0);   // 星期一 10:00
const SIM0 = Date.now();   // 所有 iframe 共用同一條時間軸（兩台裝置的時鐘不會一開始就差幾百毫秒）
window.__stores = {}; window.__hubs = {}; window.__clocks = {}; window.__cloudDb = { docs: {}, fail: false, log: [] };

// ---- 注入到每個 iframe 最前面的環境（必須自給自足）----
function SHIM(o, P) {
  const R = Date;
  // 1. 假時鐘
  // 同一個瀏覽器的兩個分頁共用同一個系統時鐘（storeId 相同）；不同裝置（storeId 不同）各自有時鐘，還可以設定 skew 讓它快或慢
  const ck = (P.__clocks[o.storeId] = P.__clocks[o.storeId] || { off: null });
  if (ck.off == null) ck.off = (o.now == null ? R.now() : o.now) - R.now() + (o.skew || 0);
  class FD extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + ck.off); } static now() { return R.now() + ck.off; } }
  window.Date = FD;
  window.__clock = { set(ms) { ck.off = ms - R.now(); }, advance(ms) { ck.off += ms; }, now: () => R.now() + ck.off };
  // 2. 錯誤收集
  window.__errors = []; window.__downloads = [];
  window.__noOnb = !o.onb;   // 第一次打開的引導會蓋住畫面；測驗預設略過，要測引導時傳 onb: true
  // 測驗頁在背景時瀏覽器會停掉 requestAnimationFrame，改成計時器驅動，水族箱才會動
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16); window.cancelAnimationFrame = id => clearTimeout(id);
  window.addEventListener('error', e => window.__errors.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => window.__errors.push('rejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
  const ce = console.error; console.error = (...a) => { window.__errors.push('console.error: ' + a.join(' ')); ce.apply(console, a); };
  // 3. 獨立的 localStorage（可模擬被封鎖、容量滿；多個分頁可共用同一份並互相收到 storage 事件）
  const store = P.__stores[o.storeId], hub = (P.__hubs[o.storeId] = P.__hubs[o.storeId] || { wins: new Set() });
  hub.wins.add(window);
  const mode = () => (P.__storageMode && P.__storageMode[o.storeId]) || (o.storage || 'ok');
  const fake = {
    getItem(k) { if (mode() === 'blocked') throw new DOMException('denied', 'SecurityError'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) {
      if (mode() === 'blocked') throw new DOMException('denied', 'SecurityError');
      if (mode() === 'full') throw new DOMException('quota', 'QuotaExceededError');
      const old = store.has(k) ? store.get(k) : null; store.set(k, String(v));
      hub.wins.forEach(w => { if (w !== window && !w.closed) try { w.dispatchEvent(new w.StorageEvent('storage', { key: k, oldValue: old, newValue: String(v) })); } catch (e) { window.__errors.push('storage event: ' + e.message); } });
    },
    removeItem(k) { if (mode() === 'blocked') throw new DOMException('denied', 'SecurityError'); store.delete(k); },
    clear() { store.clear(); }, key(i) { return [...store.keys()][i] ?? null; }, get length() { return store.size; },
  };
  if (o.storage === 'blocked-getter') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); }, configurable: true });
  else Object.defineProperty(window, 'localStorage', { value: fake, configurable: true });
  // 4. 環境差異
  if (o.noAudio) { window.AudioContext = undefined; window.webkitAudioContext = undefined; }
  if (o.noAnimate) Element.prototype.animate = undefined;
  if (o.ua) Object.defineProperty(navigator, 'userAgent', { get: () => o.ua });
  if (o.noShare) { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); }
  // 下載不要真的存檔，只記下來
  const aClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__downloads.push({ name: this.download, href: this.href }); return; } return aClick.call(this); };
  // 5. 假的 Firebase（完全不連網路）
  const DB = P.__cloudDb; let cur = o.cloudUser ? mkUser(o.cloudUser) : null, authCb = null;
  function mkUser(u) { return { uid: u.uid, email: u.email || u.uid + '@test', async delete() { DB.deletedAccounts = (DB.deletedAccounts || []).concat(u.uid); }, async reauthenticateWithPopup() {} }; }
  // 即時監聽：同一個帳號的文件一有變動，每個開著的裝置都會收到（模擬 Firestore 的 onSnapshot）
  const L = DB.listeners || (DB.listeners = {});
  const snapOf = uid => { const d = DB.docs[uid]; return { exists: !!d, data: () => d, metadata: { hasPendingWrites: false } }; };
  const notify = uid => setTimeout(() => { for (const cb of (L[uid] || []).slice()) { try { cb(snapOf(uid)); } catch (e) {} } }, 0);
  const doc = uid => ({
    async get() { DB.log.push('get'); if (DB.fail) throw new Error('offline'); return snapOf(uid); },
    // 已經關掉的測驗頁（iframe 被拿掉了）不能再寫入：它還沒跑完的上傳會跑進下一個測驗的雲端
    async set(v) { if (!window.frameElement) return; DB.log.push('set'); if (DB.fail) throw new Error('offline'); DB.docs[uid] = JSON.parse(JSON.stringify(v)); notify(uid); },
    async delete() { delete DB.docs[uid]; notify(uid); },
    onSnapshot(cb) { DB.log.push('listen'); (L[uid] = L[uid] || []).push(cb); setTimeout(() => cb(snapOf(uid)), 0); return () => { L[uid] = (L[uid] || []).filter(f => f !== cb); }; },
  });
  // 交易：先讀再寫，寫的內容在交易結束時一次寫入
  async function runTransaction(fn) {
    let w = null; const out = await fn({ get: ref => ref.get(), set: (ref, v) => { w = [ref, v]; } });
    if (w) await w[0].set(w[1]);
    return out;
  }
  const authObj = {
    get currentUser() { return cur; },
    onAuthStateChanged(cb) { authCb = cb; Promise.resolve().then(() => cb(cur)); return () => {}; },
    async signInWithPopup() { if (DB.popupBlocked) { const e = new Error('blocked'); e.code = 'auth/popup-blocked'; throw e; } cur = mkUser(DB.nextUser || { uid: 'u1' }); authCb && authCb(cur); },
    async signInWithRedirect() { DB.redirected = true; },
    async signOut() { cur = null; authCb && authCb(null); },
  };
  window.firebase = {
    initializeApp() {},
    auth: Object.assign(() => authObj, { GoogleAuthProvider: function () {} }),
    firestore: Object.assign(() => ({ collection: () => ({ doc }), runTransaction }), { FieldValue: { serverTimestamp: () => R.now() + ck.off } }),
  };
  window.__fb = { signIn(u) { cur = mkUser(u); authCb && authCb(cur); } };
  const hd = document.head, apd = Node.prototype.appendChild;
  hd.appendChild = function (el) { if (el.tagName === 'SCRIPT' && /gstatic|firebase/i.test(el.src || '')) { Promise.resolve().then(() => el.onload && el.onload()); return el; } return apd.call(this, el); };
}

let BOOTS = 0;
async function boot(o = {}) {
  const base = new URL('../', location.href).href;
  if (!boot.html) boot.html = await (await fetch(base + 'index.html?_=' + Date.now())).text();
  const id = ++BOOTS, storeId = o.storeId || 's' + id;
  if (!window.__stores[storeId]) {
    const m = new Map(Object.entries(o.seed || {}));
    if (o.state) m.set('habitdive.v1', typeof o.state === 'string' ? o.state : JSON.stringify(o.state));
    window.__stores[storeId] = m;
  }
  const opts = { now: o.now == null ? T0 + (Date.now() - SIM0) : o.now, storeId, storage: o.storage, noAudio: o.noAudio, noAnimate: o.noAnimate, ua: o.ua, cloudUser: o.cloudUser, noShare: o.noShare, skew: o.skew, onb: o.onb };
  const html = boot.html.replace('<head>', `<head><base href="${base}"><script>(${SHIM.toString()})(${JSON.stringify(opts)}, window.parent)<\/script>`);
  const frame = document.createElement('iframe');
  const w = o.width || 375, h = o.height || 812;
  frame.style.cssText = `position:fixed;left:-30000px;top:0;border:0;width:${w}px;height:${h}px`;
  frame.srcdoc = html;
  const loaded = new Promise(r => { frame.onload = r; });
  document.body.appendChild(frame);
  await loaded; await flush(6);
  return mkInst(frame, storeId, opts);
}

function mkInst(frame, storeId, opts) {
  const win = frame.contentWindow, doc = frame.contentDocument;
  const I = {
    frame, win, doc, storeId, opts,
    get S() { return win.eval("S"); }, get UI() { return win.eval("UI"); }, get Q() { return win.eval("Q"); }, get CONFIG() { return win.eval("CONFIG"); }, get clock() { return win.__clock; }, get errors() { return win.__errors; },
    $(s, r) { return (r || doc).querySelector(s); },
    $$(s, r) { return [...(r || doc).querySelectorAll(s)]; },
    D() { return win.derive(); },
    ev(code) { return win.eval(code); },
    text() { return doc.body.innerText; },
    has(t) { return doc.body.innerText.includes(t); },
    stored() { try { return JSON.parse(window.__stores[storeId].get('habitdive.v1')); } catch (e) { return null; } },
    // ---- 找元素（只看看得到的）----
    vis(el) {
      if (!el || !el.isConnected) return false;
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return false;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = win.getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (e.tagName === 'DETAILS' && !e.open && el !== e && !e.querySelector(':scope > summary')?.contains(el)) return false;
      }
      return true;
    },
    el(t) {
      if (!t) return null;
      if (t.nodeType === 1) return t;
      if (Array.isArray(t)) return I.$$(t[0]).find(e => I.vis(e) && (e.innerText || e.value || e.title || '').includes(t[1]));
      return I.$$(t).find(e => I.vis(e)) || null;
    },
    // 有沒有被別的東西蓋住（真人點不到）。回傳 null＝可以點
    blocked(el) {
      if (!I.vis(el)) return '看不到';
      if (el.disabled) return '停用';
      const cs = win.getComputedStyle(el); if (cs.pointerEvents === 'none') return 'pointer-events:none';
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > win.innerWidth || y > win.innerHeight) return '在畫面外';
      const top = doc.elementFromPoint(x, y);
      if (!top) return '沒有元素';
      if (el === top || el.contains(top) || top.contains(el) || (el.closest('label') && el.closest('label') === top.closest('label'))) return null;
      return `被 ${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}${top.className ? '.' + String(top.className).split(' ')[0] : ''} 蓋住`;
    },
    async click(t, opt = {}) {
      const el = I.el(t); if (!el) throw new Error('找不到可點的元素：' + (Array.isArray(t) ? t.join(' / ') : t));
      const why = I.blocked(el); if (why && !opt.force) throw new Error(`點不到「${Array.isArray(t) ? t.join(' / ') : (el.id || el.dataset.act || el.tagName)}」：${why}`);
      const r = el.getBoundingClientRect(), pe = (n) => new win.PointerEvent(n, { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'touch' });
      el.dispatchEvent(pe('pointerdown')); el.dispatchEvent(pe('pointerup')); el.click();
      await flush(); return el;
    },
    async tryClick(t) { try { await I.click(t); return true; } catch (e) { return false; } },
    async type(t, text) {
      const el = I.el(t); if (!el) throw new Error('找不到輸入框：' + t);
      el.focus();
      const set = Object.getOwnPropertyDescriptor(win[el.tagName === 'SELECT' ? 'HTMLSelectElement' : el.tagName === 'TEXTAREA' ? 'HTMLTextAreaElement' : 'HTMLInputElement'].prototype, 'value').set;
      set.call(el, text); el.dispatchEvent(new win.Event('input', { bubbles: true })); el.dispatchEvent(new win.Event('change', { bubbles: true }));
      await flush(); return el;
    },
    async tab(name) { await I.click(`#nav [data-v="${name}"]`); },
    async dismiss(o = {}) {
      for (let i = 0; i < 30; i++) {
        if (!I.$('#askov').classList.contains('hidden')) { await I.click(o.ask === false ? '#askno' : '#askyes'); continue; }
        if (!I.$('#ov').classList.contains('hidden')) {
          const b = I.$('#modal [data-act=openchest]') || I.$('#modal [data-act=close]') || I.$('#modal [data-act=releasepick]') || I.$('#modal [data-act=seagoto]');
          if (!b) break; const sea = b.dataset.act === 'seagoto'; await I.click(b);
          // 一般測試略過新手禮物後回今日；導覽測試直接操作主按鈕。
          if (sea) await I.tab('today'); continue;
        }
        if (!I.$('#sheetov').classList.contains('hidden')) { await I.click('#sheet [data-act=sheetclose]'); continue; }
        break;
      }
    },
    async advance(ms) { I.clock.advance(ms); win.tick(); await flush(); },
    async setTime(t) { I.clock.set(t); win.tick(); await flush(); },
    now() { return I.clock.now(); },
    async reload(extra = {}) {   // 關掉分頁再打開（同一份儲存、時間接續）
      const now = I.now(); I.destroy();
      return boot({ ...I.opts, ...extra, storeId, now, state: undefined, seed: undefined });
    },
    destroy() { try { window.__hubs[storeId].wins.delete(win); } catch (e) {} frame.remove(); },
    resize(w, h) { frame.style.width = w + 'px'; if (h) frame.style.height = h + 'px'; },
    // ---- 常用動作（都是真的點擊）----
    async plan(texts, day = 0) {
      if (day === 0 && I.vis(I.$('#onb [data-intro-index]'))) {
        for (let i = 0; i < texts.length; i++) await I.type(`#onb [data-intro-index="${i}"]`, texts[i]);
        return;
      }
      if (I.UI.pday !== day) await I.click(`#six [data-act=pday][data-v="${day}"]`);
      for (let i = 0; i < texts.length; i++) {
        let inp = I.$(`#six .ptext[data-i="${i}"]`);
        if (!inp && i >= 3) { await I.click('#six [data-act=addrow]'); inp = I.$(`#six .ptext[data-i="${i}"]`); }
        await I.type(inp, texts[i]);
      }
    },
    async saveList() { await I.click('#six [data-act=plansave]'); },
    async tick(i) { await I.click(`#six [data-act=pdone][data-v="${i}"]`); },
    async habit(name, then) { await I.tab('today'); await I.click(['#habits .hab', name]); if (then) await then(); },
    async claimAll() { await I.tab("quest"); await I.click(".qall"); await I.dismiss(); },
    coins() { return I.D().coins; },
    xp() { return I.D().xp; },
    pendCount() { return I.S.logs.filter(l => l.pend).length; },
    check(label) { return checkInvariants(I, label); },
  };
  return I;
}

// ---- 通用檢查：每個測驗、每次亂點之後都跑 ----
const KNOWN_ACTS = new Set();   // 由 main.js 原始碼抽出所有 case，用來找「沒有人處理的按鈕」
async function loadActs() {
  if (KNOWN_ACTS.size) return;
  const src = await (await fetch(new URL('../js/main.js', location.href).href + '?_=' + Date.now())).text();
  for (const m of src.matchAll(/case '([A-Za-z]+)'/g)) KNOWN_ACTS.add(m[1]);
}
function checkInvariants(I, label = '') {
  const bad = [], win = I.win, S = I.S, doc = I.doc, UI = I.UI, Q = I.Q, CONFIG = I.CONFIG;
  const add = m => bad.push(m);
  // 錯誤
  if (I.errors.length) { add('執行錯誤：' + I.errors.slice(0, 3).join(' | ')); I.errors.length = 0; }
  let D; try { D = win.derive(); } catch (e) { add('derive() 丟出錯誤：' + e.message); return flushBad(bad, label); }
  // 數字
  if (![D.xp, D.coins].every(Number.isFinite)) add(`XP/金幣不是數字：${D.xp} / ${D.coins}`);
  if (D.coins < 0) add(`金幣變成負的：${D.coins}`);
  if (D.xp < 0) add(`XP 變成負的：${D.xp}`);
  // 紀錄
  const seen = {}; for (const l of S.logs) if (l.key) { if (seen[l.key]) add('同一個獎勵發了兩次：' + l.key); seen[l.key] = 1; }
  for (const k of Object.keys(S.held || {})) if (seen[k]) add('獎勵同時在 logs 和 held：' + k);
  const perDay = {}; for (const l of S.logs) if (l.k === 'check') perDay[l.d] = (perDay[l.d] || 0) + 1;
  for (const [d, n] of Object.entries(perDay)) if (n > CONFIG.rewardRows) add(`${d} 六件事打勾獎勵超過上限：${n} 件`);
  for (const l of S.logs) { if (!l || typeof l !== 'object') add('logs 裡有壞資料'); else if (l.xp != null && !Number.isFinite(l.xp) || l.c != null && !Number.isFinite(l.c)) add('log 數值壞掉：' + JSON.stringify(l)); }
  for (const [d, P] of Object.entries(S.plans)) if (!Array.isArray(P) || P.length !== 6) add(`六件事資料長度不是 6：${d} (${P && P.length})`);
  // 今天還在待領取的獎勵，一定要在任務頁找得到（否則使用者領不到，只能等隔天自動入帳）
  try {
    const today = win.eval('dayKey()'), T = win.eval('dailyTasks(derive())'), shown = new Set(T.flatMap(t => t.logs.map(l => l.id)));
    for (const l of S.logs) if (l.pend && l.d === today && !shown.has(l.id)) add(`待領取的獎勵在任務頁看不到：${l.k} ${l.key || ''}`);
    for (const [d, P] of Object.entries(S.plans)) if (P.filter(x => x.rw).length > CONFIG.rewardRows) add(`${d} 標記有獎勵的六件事超過 ${CONFIG.rewardRows} 件`);
  } catch (e) { add('任務計算丟出錯誤：' + e.message); }
  // 畫面文字
  const txt = doc.body.innerText;
  const m = txt.match(/undefined|NaN|\[object|\bnull\b|Infinity/); if (m) add('畫面出現不該有的文字：' + m[0] + '（…' + txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' ') + '…）');
  // 版面
  const sw = doc.documentElement.scrollWidth, iw = win.innerWidth; if (sw > iw + 1) add(`橫向捲動：頁面寬 ${sw} > 視窗 ${iw}`);
  // 狀態與畫面一致
  const focus = doc.getElementById('focus'), hasTimer = !!(S.timer && S.timer.segs);
  if (hasTimer !== !!(focus && !focus.classList.contains('hidden'))) add('專注畫面和計時狀態不一致');
  const ov = !doc.getElementById('ov').classList.contains('hidden');
  if (ov && !UI.opened) add('彈窗開著但 UI.opened 是 false');
  if (UI.opened && !ov) add('UI.opened 是 true 但彈窗沒開');
  if (Q.length && !UI.opened) add(`有 ${Q.length} 個彈窗排隊卻沒有開（卡住）`);
  const stat = doc.getElementById('stat'); if (stat && !stat.innerText.replace(/,/g, '').includes(String(D.coins))) add('右上角金幣和實際不一致：' + stat.innerText.replace(/\n/g, ' ') + ' vs ' + D.coins);
  // 每個畫面上的按鈕都有人處理
  for (const e of I.$$('[data-act]')) { const a = e.dataset.act; if (KNOWN_ACTS.size && !KNOWN_ACTS.has(a)) add('沒有人處理的按鈕：data-act=' + a); }
  // 存檔和記憶體一致（把還在編輯中的商店草稿除外）
  const st = I.stored();
  if (st && !st.mtime) { /* 還沒存過檔（只是載入）：不比對 */ } else
  if (I.opts.storage !== 'blocked' && I.opts.storage !== 'blocked-getter' && I.opts.storage !== 'full') {
    if (!st) add('localStorage 裡沒有存檔'); else {
      const a = JSON.parse(JSON.stringify(S)), b = JSON.parse(JSON.stringify(st));
      delete a.shop; delete b.shop; if (UI.habEdit) { delete a.habits; delete b.habits; }   // 正在編輯習慣時，草稿本來就和存檔不同
      // 只存在記憶體的空資料不算差異：空的 held、沒寫任何字的六件事草稿（看過就會建立）
      for (const o of [a, b]) { if (o.held && !Object.keys(o.held).length) delete o.held; for (const [d, P] of Object.entries(o.plans || {})) if (P.every(x => !x.text && !x.done)) delete o.plans[d]; }
      if (JSON.stringify(a) !== JSON.stringify(b)) { const ks = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); if (ks.length) add('記憶體和存檔不一致：' + ks.join(',')); }
    }
  }
  return flushBad(bad, label);
}
const SEEN_BAD = new Set();
function flushBad(bad, label) {
  for (const b of bad) { const key = CUR + '|' + b.replace(/\d{4}-\d\d-\d\d/g, 'D'); if (SEEN_BAD.has(key)) continue; SEEN_BAD.add(key); ok(false, (label ? `[${label}] ` : '') + b); }
  return bad;
}

// ---- 測驗登錄與執行 ----
const SCENARIOS = [];
const test = (name, fn, o = {}) => SCENARIOS.push({ name, fn, ...o });
async function runAll(filter) {
  await loadActs();
  for (const s of SCENARIOS) {
    if (filter && !(filter instanceof RegExp ? filter.test(s.name) : s.name.includes(filter))) continue;
    CUR = s.name; const t = performance.now(), f0 = REPORT.fail;
    try { await s.fn(); } catch (e) { ok(false, '測驗中斷：' + e.message, (e.stack || '').split('\n').slice(0, 3).join(' / ')); }
    REPORT.tests.push({ name: s.name, ms: Math.round(performance.now() - t), fails: REPORT.fail - f0 });
    renderReport();
  }
  REPORT.done = true; renderReport();
}
function renderReport() {
  const el = document.getElementById('out'); if (!el) return;
  el.textContent = `通過 ${REPORT.pass}　失敗 ${REPORT.fail}　測驗 ${REPORT.tests.length}/${SCENARIOS.length}${REPORT.done ? '　完成' : ''}\n\n` +
    REPORT.fails.map((f, i) => `${i + 1}. [${f.test}] ${f.msg}${f.extra ? '\n     ' + f.extra : ''}`).join('\n');
}

// ---- 範例資料 ----
const D0 = '2026-11-02';
function mkState(p = {}) {
  return { v: 8, mute: true, plans: {}, checks: {}, tipSix: true,
    logs: [{ id: 'w0', t: 1, d: '2026-10-01', k: 'welcome', key: 'welcome', c: 60, xp: 0, drop: 'clown' }], ...p };
}
