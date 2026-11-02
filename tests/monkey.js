// 隨機亂點（猴子測試）：像真人一樣只點看得到、點得到的東西，亂輸入、跳時間、關掉重開、轉螢幕，
// 每一步之後都檢查不變量（沒有錯誤、金幣不為負、獎勵不重複、存檔一致…）。出問題會印出可重現的操作紀錄。
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const WORDS = ['', ' ', 'a', '寫文章', '很長很長的事情'.repeat(30), '<b>x</b>', '<img src=x onerror=window.__xss=1>', '"\'`', '😀🐠', '0', '-1', '1e9', '99999999', '12.5', '\n', 'abc', '&amp;', '5', '30', '3', '100'];
const JUMPS = [20e3, 5 * 60e3, 30 * 60e3, 2 * 3600e3, 9 * 3600e3, 24 * 3600e3, 3 * 24 * 3600e3, 8 * 24 * 3600e3, 20 * 24 * 3600e3];

async function monkey(seed, steps, o = {}) {
  const rnd = mulberry(seed), pick = a => a[Math.floor(rnd() * a.length)];
  const states = [() => mkState(), () => mkState({ logs: [W0, coinLog(3000), ...drops(['clown', 'clown', 'clown', 'clown', 'clown', 'shark', 'manta'])] }),
    () => null, () => mkState({ logs: [W0, coinLog(200)], plans: { [D0]: [{ text: 'a', done: true, rw: true, cat: 'other' }, { text: 'b', done: false, cat: 'other' }, { text: 'c', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }] } })];
  const st = states[seed % states.length]();
  let I = await boot(st ? { state: st, width: o.width || (seed % 2 ? 375 : 1024), height: 800 } : { seed: {}, width: o.width || 375, height: 800 });
  const trail = [], found = new Map(); let n = 0;
  const label = el => { const t = (el.innerText || el.value || el.title || '').replace(/\s+/g, ' ').slice(0, 14); return `${el.dataset && el.dataset.act ? el.dataset.act + (el.dataset.v !== undefined ? '(' + el.dataset.v + ')' : '') : el.id || el.tagName.toLowerCase()}${t ? '「' + t + '」' : ''}`; };
  const record = (msg) => { if (!found.has(msg)) found.set(msg, { seed, step: n, trail: trail.slice(-14) }); };
  const verify = (tag) => {
    const before = REPORT.fail; const bad = checkInvariants(I, ''); if (I.win.__xss) { bad.push('XSS 執行了'); I.win.__xss = 0; }
    for (const b of bad) record(b); return bad.length;
  };
  for (n = 1; n <= steps; n++) {
    const r = rnd();
    try {
      if (r < 0.02) { trail.push('重開'); I = await I.reload(); await I.dismiss({ ask: false }); }
      else if (r < 0.06) { const j = pick(JUMPS); trail.push('時間+' + Math.round(j / 60e3) + '分'); await I.advance(j); }
      else if (r < 0.075) { const w = pick([320, 375, 414, 768, 1024]); trail.push('寬度' + w); I.resize(w); I.win.dispatchEvent(new I.win.Event('resize')); await flush(); }
      else if (r < 0.085) { const hid = rnd() < .5; trail.push(hid ? '離開畫面' : '回到畫面'); Object.defineProperty(I.doc, 'visibilityState', { get: () => hid ? 'hidden' : 'visible', configurable: true }); I.doc.dispatchEvent(new I.win.Event('visibilitychange')); await flush(); }
      else if (r < 0.30) {   // 輸入
        const inputs = I.$$('input:not([type=checkbox]):not([type=file]):not([disabled]), select').filter(e => I.vis(e));
        if (!inputs.length) continue; const el = pick(inputs);
        if (el.tagName === 'SELECT') { const v = pick([...el.options]).value; trail.push(`選 ${label(el)}=${v}`); await I.type(el, v); }
        else { const v = pick(WORDS); trail.push(`輸入 ${label(el)}=${JSON.stringify(v.slice(0, 12))}`); await I.type(el, v); }
      }
      else if (r < 0.33) {   // 水族箱點一下
        const cv = I.$('#tank'); if (cv && I.vis(cv) && !I.blocked(cv)) { const b = cv.getBoundingClientRect(); trail.push('點水族箱'); cv.dispatchEvent(new I.win.MouseEvent('click', { bubbles: true, clientX: b.left + rnd() * b.width, clientY: b.top + rnd() * b.height })); await flush(); }
      }
      else {
        // 有彈窗先處理（真人沒辦法點到後面）
        let els;
        if (!I.$('#askov').classList.contains('hidden')) els = I.$$('#askov button');
        else if (!I.$('#ov').classList.contains('hidden')) els = I.$$('#ov button');
        else if (!I.$('#sheetov').classList.contains('hidden')) els = I.$$('#sheetov button, #sheetov input[type=checkbox]');
        else if (!I.$('#focus').classList.contains('hidden')) els = I.$$('#focus button');
        else els = I.$$('button, input[type=checkbox], .hab, [data-act]').filter(e => !e.closest('a'));
        els = els.filter(e => I.vis(e) && !e.disabled && !I.blocked(e));
        if (!els.length) continue;
        // 偏好真的有功能的按鈕
        let pool = els; if (rnd() < 0.75) { const nt = els.filter(e => !(e.dataset && e.dataset.act === 'tab')); if (nt.length) pool = nt; }   // 少切分頁，多做真正的事
        const el = pick(pool); trail.push('點 ' + label(el)); const ak = (el.dataset && el.dataset.act) || el.tagName; (window.__monkeyActs = window.__monkeyActs || {})[ak] = (window.__monkeyActs[ak] || 0) + 1; await I.click(el);
      }
    } catch (e) { if (!/找不到|點不到/.test(e.message)) record('丟出例外：' + e.message); }
    verify();
  }
  // 結束：關掉重開，資料要一致
  const coins = I.coins(), xp = I.xp(); const J = await I.reload(); await flush(6);
  if (J.coins() !== coins) record(`重開後金幣不同：${coins} → ${J.coins()}`); if (J.xp() !== xp) record(`重開後 XP 不同：${xp} → ${J.xp()}`);
  checkInvariants(J, '').forEach(record); J.destroy();
  return [...found.entries()].map(([msg, v]) => ({ msg, ...v }));
}

test('亂點：多組隨機種子（每組數百步）', async () => {
  const seeds = (new URLSearchParams(location.search).get('seeds') || '1-8').split('-').map(Number), all = new Map();
  for (let s = seeds[0]; s <= (seeds[1] ?? seeds[0]); s++) {
    const res = await monkey(s, +(new URLSearchParams(location.search).get('steps') || 200));
    for (const r of res) { const key = r.msg.replace(/\d{4}-\d\d-\d\d/g, 'D').replace(/\d+/g, '#'); if (!all.has(key)) { all.set(key, r); ok(false, `[亂點 seed=${r.seed} 第 ${r.step} 步] ${r.msg}`, '操作紀錄：' + r.trail.join(' → ')); } }
  }
  note('亂點完成 seeds ' + seeds.join('-'));
});

// 同一個瀏覽器開兩個分頁，輪流亂點：兩邊要一直保持一致（不能互相蓋掉、不能無限互相同步）
async function monkey2(seed, steps) {
  const rnd = mulberry(seed), pick = a => a[Math.floor(rnd() * a.length)], found = new Map(), trail = [];
  const A = await boot({ state: mkState({ logs: [W0, coinLog(300)] }), width: 375, height: 800 }); await A.dismiss();
  const B = await boot({ storeId: A.storeId, width: 1024, height: 800 }); await B.dismiss();
  const rec = (m, n) => { if (!found.has(m)) found.set(m, { seed, step: n, trail: trail.slice(-12) }); };
  for (let n = 1; n <= steps; n++) {
    const I = rnd() < .5 ? A : B, who = I === A ? 'A' : 'B';
    try {
      const r = rnd();
      if (r < .2) { const inputs = I.$$('input:not([type=checkbox]):not([type=file]):not([disabled])').filter(e => I.vis(e)); if (inputs.length) { const el = pick(inputs); const v = pick(['寫文章', 'a', '', '5', '30']); trail.push(`${who} 輸入 ${(el.id || el.dataset.pf || el.tagName)}=${v}`); await I.type(el, v); } }
      else if (r < .25) { const j = pick([60e3, 3600e3, 24 * 3600e3]); trail.push(`時間+${j / 60e3}分`); await A.advance(j); B.win.tick(); await flush(); }
      else {
        let els; if (!I.$('#askov').classList.contains('hidden')) els = I.$$('#askov button'); else if (!I.$('#ov').classList.contains('hidden')) els = I.$$('#ov button'); else if (!I.$('#sheetov').classList.contains('hidden')) els = I.$$('#sheetov button'); else if (!I.$('#focus').classList.contains('hidden')) els = I.$$('#focus button'); else els = I.$$('button, input[type=checkbox]').filter(e => !e.closest('a') && !(e.dataset && ['export', 'import', 'login', 'logout', 'clouddel'].includes(e.dataset.act)));
        els = els.filter(e => I.vis(e) && !e.disabled && !I.blocked(e)); if (!els.length) continue;
        const nt = els.filter(e => !(e.dataset && e.dataset.act === 'tab')); const el = pick(rnd() < .75 && nt.length ? nt : els); trail.push(`${who} 點 ${el.dataset && el.dataset.act || el.tagName}${el.dataset && el.dataset.v !== undefined ? '(' + el.dataset.v + ')' : ''}`); await I.click(el);
      }
    } catch (e) { if (!/找不到|點不到/.test(e.message)) rec('例外：' + e.message, n); }
    await flush(3);
    for (const [nm, X] of [['A', A], ['B', B]]) for (const m of checkInvariants(X, '')) rec(`[${nm}] ${m}`, n);
    const ia = document.activeElement; const typing = [A, B].some(X => /INPUT|TEXTAREA|SELECT/.test((X.doc.activeElement || {}).tagName || ''));
    if (!typing && (A.S.mtime || 0) !== (B.S.mtime || 0)) rec(`兩個分頁沒有同步：A.mtime=${A.S.mtime} B.mtime=${B.S.mtime}`, n);
    if (!typing && A.coins() !== B.coins()) rec(`兩個分頁金幣不同：${A.coins()} vs ${B.coins()}`, n);
  }
  A.destroy(); B.destroy(); return [...found.entries()].map(([msg, v]) => ({ msg, ...v }));
}
test('亂點：兩個分頁輪流操作', async () => {
  const seeds = (new URLSearchParams(location.search).get('seeds2') || '1-3').split('-').map(Number), all = new Map();
  for (let s = seeds[0]; s <= (seeds[1] ?? seeds[0]); s++) { const res = await monkey2(s, +(new URLSearchParams(location.search).get('steps2') || 120)); for (const r of res) { const key = r.msg.replace(/\d+/g, '#'); if (!all.has(key)) { all.set(key, r); ok(false, `[雙分頁 seed=${r.seed} 第 ${r.step} 步] ${r.msg}`, '操作紀錄：' + r.trail.join(' → ')); } } }
});
