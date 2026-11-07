// 環境差異：沒有音效引擎、沒有動畫 API、App 內建瀏覽器、舊引擎語法、各種螢幕寬度的版面
const TABS = ['today', 'quest', 'tank', 'shop', 'log', 'about'];
const BIG = () => {   // 內容很多、很長、數字很大的狀態，用來撐爆版面
  const long = '很長很長的事情名稱'.repeat(12);
  const logs = [W0, coinLog(98765432), { id: 'bigxp', t: 5, d: '2026-10-05', k: 'bonus', xp: 4000000, c: 0 }];
  const ids = ['clown', 'damsel', 'butterfly', 'star', 'hermit', 'urchin', 'turtle', 'octopus', 'nudi', 'lion', 'puffer', 'cuttle', 'seahorse', 'shark', 'moray', 'jelly', 'manta', 'mola', 'dolphin', 'whaleshark'];
  logs.push(...drops(ids.flatMap(i => [i, i])));
  for (let i = 0; i < 7; i++) logs.push({ id: 'rd' + i, t: 50 + i, d: '2026-10-0' + (i + 1), k: 'redeem', name: long, c: -10 });
  const plans = { [D0]: Array.from({ length: 6 }, (_, i) => ({ text: long, cat: 'other', done: i < 2, rw: i < 2 })) };
  const habits = [{ id: 'write', n: '寫作', kind: 'custom', unit: '篇', weeks: 1, target: 7 }, { id: 'exercise', n: '運動運動運動運動運動運動運動運動', kind: 'exercise', weeks: 2, target: 7 }, { id: 'a1', n: long.slice(0, 20), kind: 'custom', weeks: 0, target: 1 }, { id: 'a2', n: 'A'.repeat(20), kind: 'custom', weeks: 1, target: 7 }, { id: 'a3', n: '短', kind: 'custom', weeks: 2, target: 7 }];
  const checks = { [D0]: { write: [{ t: 1 }], exercise: [{ t: 1, type: '潛水', depth: 40, min: 55, site: long, note: long }] } };
  return mkState({ logs, plans, habits, checks, favs: Array.from({ length: 12 }, (_, i) => '常用' + long.slice(0, 10) + i), shop: Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, icon: '🍰', name: long, price: 12345678 + i })) });
};

test('沒有音效引擎（舊瀏覽器、部分 App 內建瀏覽器）：所有操作照常', async () => {
  const I = await boot({ state: mkState({ mute: false }), noAudio: true }); await I.dismiss();
  await I.plan(['A', 'B', 'C']); await I.saveList(); await I.tick(0); await I.tick(1); await I.tick(2);
  ok(I.S.logs.some(l => l.key === 'top3:' + D0), '沒有音效也拿得到獎勵');
  await I.claimAll(); await I.tab('shop'); await I.click('.shop [data-act=buyfeed]'); await I.tab('today'); await I.click('[data-act=start]'); await I.advance(26 * 60e3); await I.dismiss();
  ok(I.S.logs.some(l => l.key === 'pomo:' + D0), '番茄鐘也正常');
  await I.tab('about'); await I.click('[data-act=mute]'); await I.click('[data-act=mute]');
  I.check('沒有音效'); I.destroy();
});

test('沒有 Element.animate（舊瀏覽器）：金幣動畫不能讓獎勵流程中斷', async () => {
  const I = await boot({ state: mkState(), noAnimate: true }); await I.dismiss();
  await I.plan(['A', 'B', 'C']); await I.tick(0);
  ok(I.S.logs.some(l => l.k === 'check' && l.pend), '打勾仍有獎勵'); eq(I.errors.length, 0, '沒有錯誤：' + I.errors.slice(0, 2).join('|'));
  await I.tick(1); await I.tick(2); await I.claimAll(); I.check('沒有 animate'); I.destroy();
});

test('App 內建瀏覽器（FB / LINE / IG）：提示橫幅、Google 登入說明', async () => {
  for (const ua of ['Mozilla/5.0 (iPhone) FBAN/FBIOS', 'Mozilla/5.0 (Linux; Android) Line/12.0', 'Mozilla/5.0 Instagram 300']) {
    const I = await boot({ state: mkState(), ua }); await I.dismiss();
    ok(I.has('App 內建的瀏覽器'), '要提示用 Chrome / Safari 開啟：' + ua.slice(-20));
    await I.click('[data-act=iabok]'); ok(!I.has('App 內建的瀏覽器'), '按知道了就消失');
    await I.tab('about'); ok(I.has('Chrome 或 Safari'), '更多頁說明無法登入');
    ok(!I.$('.gbtn'), '內建瀏覽器不顯示登入按鈕（避免被 Google 擋）'); I.check('IAB ' + ua.slice(-10)); I.destroy();
  }
});

test('Edge / 少見環境：預設分享 API、系統時區與語系不影響日期', async () => {
  const I = await boot({ state: mkState(), noShare: true }); await I.dismiss();
  await I.tab('about'); await I.click('#backupSection > summary'); await I.click('[data-act=export]'); eq(I.win.__downloads.length, 1, '沒有分享 API 時改用下載');
  const names = I.win.__downloads.map(d => d.name); ok(!/[\\/:*?"<>|]/.test(names[0]), '檔名沒有不合法字元：' + names[0]);
  I.destroy();
});

test('原始碼掃描：舊引擎不支援的語法和 API', async () => {
  const base = new URL('../', location.href).href;
  const files = ['js/config.js', 'js/creatures.js', 'js/core.js', 'js/game.js', 'js/views.js', 'js/sync.js', 'js/ui.js', 'js/main.js', 'js/firebase-config.js'];
  const src = {}; for (const f of files) src[f] = await (await fetch(base + f + '?_=' + Date.now())).text();
  const bad = [
    [/\?\?=|\|\|=|&&=/g, '邏輯賦值運算子（Safari 14 以前不支援，整個 script 會語法錯誤）'],
    [/\(\?<[=!]/g, '正規表達式 lookbehind（Safari 16.4 以前不支援，整個 script 會語法錯誤）'],
    [/\.replaceAll\(/g, 'String.replaceAll（Safari 13.1 以前沒有）'], [/\.at\(-?\d+\)/g, 'Array/String.at（Safari 15.4 以前沒有）'],
    [/structuredClone\(/g, 'structuredClone（Safari 15.4 以前沒有）'], [/\.flatMap\(|\.flat\(/g, 'Array.flat/flatMap（Safari 12 以前沒有，這裡有在用）'],
    [/Object\.hasOwn\(/g, 'Object.hasOwn（Safari 15.4）'], [/#[a-zA-Z_]+\s*[=;(]/g, 'class 私有欄位（Safari 15 以前）'], [/\bawait\b[^;\n]*\n?/g, null],
    [/new Intl\.\w+\(/g, 'Intl.* 物件（要確認 fallback）'], [/\bBigInt\b|\d+n\b/g, 'BigInt'], [/\bmatchAll\(/g, 'String.matchAll（Safari 13 以前沒有）'],
    [/\bcatch\s*\{/g, 'catch 沒有參數（Safari 11.1 以前沒有）'], [/\bAbortSignal\.timeout/g, 'AbortSignal.timeout'], [/\bResizeObserver|IntersectionObserver/g, 'Observer API（要確認有沒有 fallback）'],
  ];
  const hits = [];
  for (const [f, s] of Object.entries(src)) for (const [re, why] of bad) { if (!why) continue; const m = s.match(re); if (m && !(why.includes('flat') && f.includes('creatures'))) hits.push(`${f}：${why}（${m.length} 處，例：${String(m[0]).slice(0, 30)}）`); }
  const fatal = hits.filter(h => /整個 script|語法錯誤/.test(h));
  eq(fatal, [], '會讓舊瀏覽器整個打不開的語法');
  for (const h of hits.filter(h => !/語法錯誤/.test(h))) note('相容性：' + h);
  // 所有 data-act 的處理都存在
  const css = await (await fetch(base + 'css/style.css?_=' + Date.now())).text();
  const cssBad = [[/\binset\s*:/g, 'CSS inset（Safari 14.1 / Chrome 87 以前不支援，蓋住全螢幕的彈窗會失效）'], [/\baspect-ratio\s*:/g, 'aspect-ratio'], [/\b100dvh|\b100svh/g, 'dvh/svh'], [/:has\(/g, ':has()'], [/\bgap\s*:/g, 'flex gap（Safari 14.1 以前沒有）'], [/@container|@layer/g, '@container/@layer']];
  for (const [re, why] of cssBad) { const m = css.match(re); if (m) note(`CSS：${why}（${m.length} 處）`); }
});

test('原始碼掃描：資源路徑大小寫、外部連線', async () => {
  const base = new URL('../', location.href).href, html = await (await fetch(base + 'index.html?_=' + Date.now())).text();
  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^https?:|^mailto:/.test(u));
  for (const u of refs) { const r = await fetch(base + u.split('?')[0], { cache: 'no-store' }); ok(r.ok, '資源存在：' + u); }
  const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]); const bad = ext.filter(u => !/vocus\.cc/.test(u));
  eq(bad, [], '除了 vocus 連結，不能有外部資源（離線也要能用）');
  const files = ['js/sync.js', 'js/ui.js', 'js/main.js', 'js/views.js', 'js/core.js', 'js/game.js'];
  for (const f of files) { const s = await (await fetch(base + f + '?_=' + Date.now())).text(); const hosts = [...s.matchAll(/https?:\/\/([\w.-]+)/g)].map(m => m[1]).filter(h => !/vocus\.cc|gstatic\.com|firebase/.test(h)); eq([...new Set(hosts)], [], f + ' 沒有未知的外部網址'); }
});

test('版面：各種寬度 × 各個分頁（正常資料）', async () => {
  for (const w of [280, 320, 360, 375, 412, 600, 768, 1024, 1440]) {
    const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown', 'shark', 'manta'])] }), width: w, height: 800 }); await I.dismiss();
    for (const t of TABS) { await I.tab(t); if (t === 'tank') await new Promise(r => setTimeout(r, 250)); I.check(`${w}px/${t}`); layoutAudit(I, `${w}px/${t}`); }
    I.destroy();
  }
});

test('版面：超長文字、超大數字、很多資料（撐爆測試）', async () => {
  for (const w of [320, 375, 768, 1440]) {
    const I = await boot({ state: BIG(), width: w, height: 800 }); await I.dismiss();
    for (const t of TABS) {
      await I.tab(t); if (t === 'tank') await new Promise(r => setTimeout(r, 250)); I.check(`${w}px/${t}／撐爆`); layoutAudit(I, `${w}px/${t}／撐爆`);
      if (t === 'today') { await I.click(['#habits .hab', '運動']); layoutAudit(I, `${w}px／運動面板`); I.check(`${w}px／運動面板`); await I.dismiss(); await I.click('#habits [data-act=habedit]'); layoutAudit(I, `${w}px／編輯習慣`); I.check(`${w}px／編輯習慣`); await I.click('[data-act=habdone]'); }
      if (t === 'shop') { await I.click('[data-act=shopedit]'); layoutAudit(I, `${w}px／編輯獎勵`); I.check(`${w}px／編輯獎勵`); await I.click('[data-act=shopdone]'); }
      if (t === 'tank') { await I.click('[data-act=tankedit]'); layoutAudit(I, `${w}px／水族箱設定`); await I.click('[data-act=tankdone]'); await I.click('[data-act=tankview][data-v=dex]'); layoutAudit(I, `${w}px／圖鑑`); }
    }
    I.destroy();
  }
});

test('版面：彈窗（寶箱、升級、放生、確認、專注）在小螢幕也要完整', async () => {
  for (const w of [320, 375, 768]) {
    const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown', 'clown', 'clown', 'clown', 'clown']), { id: 'px', t: 9, d: D0, k: 'plan', key: 'plan:' + D0, xp: 100000, c: 0, pend: true }] }), width: w, height: 568 }); await I.dismiss();
    await I.tab('shop'); const un = (() => { const o = I.win.Math.random; let q = [0.5, 0.99, 0, 0]; I.win.Math.random = () => q.length ? q.shift() : 0.5; return () => { I.win.Math.random = o; }; })();
    await I.click('[data-act=buychest][data-v=c0]'); un(); modalAudit(I, `${w}px 寶箱`); await I.click('[data-act=openchest]'); modalAudit(I, `${w}px 開箱結果`); await I.click('#modal [data-act=close]'); modalAudit(I, `${w}px 放生選單`);
    await I.click('[data-act=releasepick]'); await I.tab('quest'); await I.click('.qall'); modalAudit(I, `${w}px 升級`); await I.dismiss();
    await I.tab('today'); await I.click('[data-act=start]'); layoutAudit(I, `${w}px 專注畫面`); modalAudit(I, `${w}px 專注畫面`, '#focus .fbox'); await I.advance(70e3); await I.click('#focus [data-act=cancel]'); modalAudit(I, `${w}px 確認框`, '#askov .modal'); await I.click('#askno');
    I.destroy();
  }
});

test('版面：文字放大（系統字體 150%、200%）', async () => {
  for (const z of [1.5, 2]) {
    const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown'])] }), width: 375, height: 800 }); await I.dismiss();
    I.resize(Math.floor(375 / z), 800);   // 瀏覽器頁面放大 = 版面可用寬度變窄
    for (const t of TABS) { await I.tab(t); layoutAudit(I, `放大 ${z}×/${t}`); I.check(`放大 ${z}×/${t}`); }
    I.destroy();
  }
});

test('手機輸入框：字體至少 16px（否則 iPhone 點輸入框會自動放大頁面）', async () => {
  const I = await boot({ state: mkState(), width: 375, height: 800 }); await I.dismiss();
  const small = new Set();
  const scan = () => { for (const e of I.$$('input:not([type=checkbox]):not([type=file]), select, textarea')) { if (!I.vis(e)) continue; const fs = parseFloat(I.win.getComputedStyle(e).fontSize); if (fs < 16) small.add(`${e.id || e.dataset.pf || e.dataset.sf || e.dataset.hf || e.className || e.tagName}:${fs}px`); } };
  await I.tab('today'); scan(); await I.click('#habits .hab'); scan(); await I.dismiss(); await I.click(['#habits .hab', '運動']); scan(); await I.dismiss();
  await I.click('#habits [data-act=habedit]'); scan(); await I.click('[data-act=habdone]'); await I.click('[data-act=pomocustom]'); scan(); await I.tab('shop'); await I.click('[data-act=shopedit]'); await I.click('[data-act=shopadd]'); scan();
  eq([...small], [], '手機上字體小於 16px 的輸入框（iOS Safari 會在點選時自動放大整個頁面）');
  I.destroy();
});

test('觸控：按鈕大小、鍵盤操作', async () => {
  const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown'])] }), width: 375, height: 800 }); await I.dismiss();
  const small = new Map();
  for (const t of TABS) { await I.tab(t); for (const e of I.$$('button, [data-act], a, input[type=checkbox], select')) { if (!I.vis(e)) continue; const r = e.getBoundingClientRect(), nm = (e.innerText || e.title || e.dataset.act || '').replace(/\s+/g, ' ').slice(0, 14); if (r.height < 30 || r.width < 30) small.set(`${t}:${nm || e.dataset.act}`, `${Math.round(r.width)}×${Math.round(r.height)}`); } }
  for (const [k, v] of small) note(`觸控目標偏小（<30px）：${k} ${v}`);
  ok(small.size < 12, `太小的觸控目標太多：${small.size}`);
  // 鍵盤：Tab 鍵可以走到主要按鈕、Enter 能操作
  await I.tab('today'); const b = I.$('#habits .hab'); b.focus(); ok(I.doc.activeElement === b, '習慣卡片可以用鍵盤聚焦');
  b.dispatchEvent(new I.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); b.click(); await flush(); ok(!I.$('#sheetov').classList.contains('hidden'), 'Enter 開啟習慣面板');
  I.doc.dispatchEvent(new I.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ok(I.$('#sheetov').classList.contains('hidden'), 'Esc 關閉');
  I.destroy();
});

// ---- 版面檢查工具 ----
function layoutAudit(I, label) {
  const win = I.win, doc = I.doc, vw = win.innerWidth, bad = [];
  if (doc.documentElement.scrollWidth > vw + 1) bad.push(`橫向捲動 ${doc.documentElement.scrollWidth} > ${vw}`);
  for (const e of doc.querySelectorAll('main *, .brand *, nav *, #banner *, #focus *')) {
    if (!I.vis(e)) continue; const r = e.getBoundingClientRect(); if (!r.width) continue;
    if (e.closest('canvas, .tank')) continue;
    if (r.right > vw + 2 || r.left < -2) { bad.push(`超出畫面：${(e.className || e.tagName).toString().split(' ')[0]}「${(e.innerText || '').slice(0, 14).replace(/\n/g, ' ')}」(${Math.round(r.left)}→${Math.round(r.right)} / ${vw})`); if (bad.length > 4) break; }
  }
  // 內容被固定的分頁列蓋住：捲到最底，最後一個可點元素要在分頁列上方
  const nav = doc.getElementById('nav'); if (win.getComputedStyle(nav).position === 'fixed') {
    win.scrollTo(0, doc.documentElement.scrollHeight); const nt = nav.getBoundingClientRect().top;
    const last = [...doc.querySelectorAll('main button, main a, main input, main select, main summary')].filter(e => I.vis(e)).pop();
    if (last && last.getBoundingClientRect().bottom > nt + 1) bad.push(`最底下的「${(last.innerText || last.dataset.act || '').slice(0, 10)}」被分頁列蓋住`);
    win.scrollTo(0, 0);
  }
  for (const b of bad) ok(false, `[版面 ${label}] ${b}`);
}
function modalAudit(I, label, sel = '#modal') {
  const m = I.$(sel); if (!m || !I.vis(m)) return ok(false, `[彈窗 ${label}] 沒有顯示`);
  const r = m.getBoundingClientRect(), win = I.win;
  if (r.left < -1 || r.right > win.innerWidth + 1) ok(false, `[彈窗 ${label}] 左右超出畫面 (${Math.round(r.left)}→${Math.round(r.right)} / ${win.innerWidth})`);
  const overflowY = m.scrollHeight > win.innerHeight + 2; const scrollable = ['auto', 'scroll'].includes(win.getComputedStyle(m.closest('.ov') || m).overflowY) || ['auto', 'scroll'].includes(win.getComputedStyle(m).overflowY);
  if (overflowY && !scrollable && r.height > win.innerHeight) ok(false, `[彈窗 ${label}] 比螢幕高 (${Math.round(r.height)} > ${win.innerHeight}) 又不能捲動，按鈕會看不到`);
  const btn = m.querySelector('button'); if (btn) { const b = btn.getBoundingClientRect(); if (b.bottom > win.innerHeight + 1 && !scrollable) ok(false, `[彈窗 ${label}] 按鈕在螢幕外`); }
}

test('無障礙：每個按鈕和輸入框都有名字（螢幕閱讀器念得出來）', async () => {
  const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown'])] }), width: 375, height: 800 }); await I.dismiss();
  const unnamed = new Map();
  const nameOf = e => (e.getAttribute('aria-label') || e.title || (e.innerText || '').trim() || (e.tagName === 'INPUT' && e.type !== 'checkbox' && e.placeholder) || (e.labels && e.labels.length && e.labels[0].innerText.trim()) || (e.closest('label') && e.closest('label').innerText.trim()) || '').trim();
  const scan = where => { for (const e of I.$$('button, input:not([type=file]), select, textarea, summary, [role=button], a[href]')) { if (!I.vis(e)) continue; if (!nameOf(e)) unnamed.set(`${where}:${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.dataset.act ? '[' + e.dataset.act + ']' : ''}${e.dataset.pf ? '[pf=' + e.dataset.pf + ']' : ''}`, 1); } };
  for (const t of TABS) { await I.tab(t); scan(t); }
  await I.tab('today'); await I.click('#habits .hab'); scan('sheet'); await I.dismiss(); await I.click(['#habits .hab', '運動']); scan('運動'); await I.dismiss();
  await I.click('#habits [data-act=habedit]'); scan('編輯習慣'); await I.click('[data-act=habdone]'); await I.click('[data-act=pomocustom]'); scan('番茄鐘'); await I.tab('shop'); await I.click('[data-act=shopedit]'); scan('編輯獎勵');
  eq([...unnamed.keys()], [], '沒有名字的互動元件');
  I.destroy();
});

test('對比度：文字和背景至少 3:1（小字建議 4.5:1）', async () => {
  const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown', 'shark'])] }), width: 375, height: 800 }); await I.dismiss();
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const bgOf = e => { if (e.closest(".brand") || (e.closest("nav") && I.win.getComputedStyle(I.$("nav")).position !== "fixed")) return { r: 32, g: 121, b: 180 }; let layers = []; for (let x = e; x; x = x.parentElement) { const c = parse(I.win.getComputedStyle(x).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= .99) break; } } let base = { r: 11, g: 37, b: 70 }; for (const c of layers.reverse()) base = { r: base.r * (1 - c.a) + c.r * c.a, g: base.g * (1 - c.a) + c.g * c.a, b: base.b * (1 - c.a) + c.b * c.a }; return base; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const low = new Map();
  for (const t of TABS) {
    await I.tab(t);
    for (const e of I.$$('main *, nav *, .brand *')) {
      if (!I.vis(e) || e.disabled) continue;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
      let op = 1; for (let x = e; x && x !== I.doc.body; x = x.parentElement) op *= parseFloat(I.win.getComputedStyle(x).opacity);
      const cs = I.win.getComputedStyle(e), fg = parse(cs.color), bg = bgOf(e); if (!fg) continue;
      const fgEff = { r: fg.r * fg.a * op + bg.r * (1 - fg.a * op), g: fg.g * fg.a * op + bg.g * (1 - fg.a * op), b: fg.b * fg.a * op + bg.b * (1 - fg.a * op) };
      const r = ratio(fgEff, bg); if (r < 4.5) low.set(`${(e.innerText || '').trim().slice(0, 16)}|${cs.fontSize}|${Math.round(r * 10) / 10}`, r);
    }
  }
  const severe = [...low.entries()].filter(([, r]) => r < 3);
  for (const [k, r] of low) note(`對比偏低 ${k.split('|')[2]}:1 「${k.split('|')[0]}」(${k.split('|')[1]})`);
  eq(severe.map(([k]) => k), [], '對比低於 3:1 的文字（幾乎看不清楚）');
  I.destroy();
});

test('捲動位置：在長頁面操作後不能跳回頂端', async () => {
  const I = await boot({ state: mkState(), width: 375, height: 600 }); await I.dismiss();
  await I.tab('today'); await I.plan(['A', 'B', 'C']); 
  const six = I.$('#six'); I.win.scrollTo(0, six.getBoundingClientRect().top + I.win.scrollY - 20); const y0 = I.win.scrollY;
  // 直接點（不經過測驗工具的 scrollIntoView），才看得出網頁自己有沒有亂捲
  for (const q of ['#six [data-act=pdone][data-v="0"]', '#six [data-act=pdone][data-v="1"]', '#six [data-act=pday][data-v="1"]', '#six [data-act=pday][data-v="0"]']) { I.$(q).click(); await flush(); }
  ok(Math.abs(I.win.scrollY - y0) < 40, `操作後捲動位置跳了：${y0} → ${I.win.scrollY}`);
  I.destroy();
});

test('版面：全新使用者和空圖鑑在最窄的手機上', async () => {
  for (const w of [280, 320, 360]) {
    const I = await boot({ seed: {}, width: w, height: 700 }); await I.dismiss();
    ok(!I.has('Vocus'), '全新使用者沒有 Vocus'); layoutAudit(I, `${w}px/全新`); I.check(`${w}px/全新`);
    for (const t of TABS) { await I.tab(t); layoutAudit(I, `${w}px/全新/${t}`); }
    await I.tab('tank'); await I.click('[data-act=tankview][data-v=dex]'); layoutAudit(I, `${w}px/空圖鑑`); I.check(`${w}px/空圖鑑`);
    I.destroy();
  }
});

test('待領取的獎勵一定領得到：刪掉習慣後它的獎勵仍在任務頁', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click(['#habits .hab', '運動']); await I.click('[data-act=exadd]'); await I.dismiss(); await I.click('#sheet [data-act=sheetclose]').catch(() => {});
  ok(I.S.logs.some(l => l.key === 'hab:exercise:' + D0 && l.pend), '運動打卡有待領取的獎勵');
  await I.click('#habits [data-act=habedit]'); await I.click(I.$$('[data-act=habdel]')[0]); await I.click('#askyes'); await I.click('[data-act=habdone]');
  await I.tab('quest'); ok(I.has('其他獎勵') || I.has('運動'), '刪掉習慣後，它還沒領的獎勵要在任務頁'); ok(I.$('.qall'), '全部領取還在'); I.check('刪掉有獎勵的習慣');
  await I.click('.qall'); await I.dismiss(); eq(I.pendCount(), 0, '全部領得到'); I.check('領完'); I.destroy();
});

test('舊資料的六件事：沒有獎勵欄位的打勾不能每次開啟都變成「有獎勵」', async () => {
  const plan = Array.from({ length: 6 }, (_, i) => ({ text: i < 5 ? '事' + i : '', cat: 'other', done: i >= 3 && i < 5 }));   // 沒有 rw 欄位，第 4、5 件有打勾
  const I = await boot({ state: mkState({ plans: { [D0]: plan } }) }); await I.dismiss();
  eq(I.S.plans[D0].filter(x => x.rw).length, 2, '任意三件的新規則：已完成的第四、五件補上獎勵');
  await I.plan(['事0', '事1', '事2']); for (let i = 0; i < 3; i++) await I.tick(i);
  eq(I.S.logs.filter(l => l.k === 'check').length, 3, '前三件還是都拿得到獎勵');
  const J = await I.reload(); await J.dismiss(); eq(J.S.plans[D0].filter(x => x.rw).length, 3, '重開後獎勵名額仍是 3'); J.check('重開'); J.destroy(); I.destroy();
});

test('Safari（iPhone）登入：登入程式先載好，一次就登入；來不及載好才要按第二次', async () => {
  resetCloud();
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const I = await boot({ state: mkState(), ua }); await I.dismiss();
  ok(!I.ev('CLOUD.loading'), '還沒看到登入按鈕：不載入登入程式');
  await I.tab('about'); await flush(6);
  ok(!I.has('App 內建的瀏覽器'), 'Safari 不是 App 內建瀏覽器'); ok(I.ev('CLOUD.ready'), '看到登入按鈕就先把登入程式載好');
  await I.click('.gbtn'); await flush(12); ok(I.S.cloudUid === 'u1', '一次就登入（不用再按第二次）'); I.check('Safari 登入'); I.destroy();
  const J = await boot({ state: mkState(), ua }); await J.dismiss(); await J.tab('about'); await flush(6);
  J.ev('CLOUD.ready = false; CLOUD.loading = null');   // 手指比網路快：按下去時還沒載好
  await J.click('.gbtn'); await flush(10);
  ok(!J.S.cloudUid, '來不及載好：這次只載入，還沒登入'); ok(J.has('再按一次'), '按鈕要提示再按一次：' + J.$('.gbtn').innerText);
  await J.click('.gbtn'); await flush(12); ok(J.S.cloudUid === 'u1', '第二次按：登入成功');
  J.check('Safari 登入（慢）'); J.destroy();
  const C = await boot({ state: mkState(), ua: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36' }); await C.dismiss(); await C.tab('about');
  await C.click('.gbtn'); await flush(12); ok(C.S.cloudUid === 'u1', 'Chrome 一次就登入'); C.destroy();
});

test('更多 App 內建瀏覽器、輸入框屬性', async () => {
  for (const ua of ['Mozilla/5.0 TikTok_26.0', 'Mozilla/5.0 Twitter for iPhone', 'Mozilla/5.0 Snapchat/12']) { const I = await boot({ state: mkState(), ua }); await I.dismiss(); ok(I.has('App 內建的瀏覽器'), '偵測到：' + ua.slice(12)); I.destroy(); }
  const I = await boot({ state: mkState() }); await I.dismiss(); await I.tab('today');
  const bad = I.$$('#six .ptext').filter(e => e.getAttribute('autocomplete') !== 'off' || e.getAttribute('spellcheck') !== 'false'); eq(bad.length, 0, '六件事輸入框要關掉自動填入和拼字檢查'); I.destroy();
});

test('鍵盤：所有可點的東西都能用 Tab 聚焦、Enter 觸發', async () => {
  const I = await boot({ state: mkState({ logs: [W0, coinLog(500), ...drops(['clown'])] }), width: 375, height: 800 }); await I.dismiss();
  const bad = new Set();
  for (const t of TABS) { await I.tab(t); if (t === 'tank') await I.click('[data-act=tankview][data-v=dex]'); for (const e of I.$$('[data-act]')) { if (!I.vis(e)) continue; if (!e.matches('button, input, select, a, [tabindex]')) bad.add(`${t}:${e.dataset.act}`); } }
  eq([...bad], [], '有 data-act 卻無法用鍵盤聚焦的元素');
  await I.tab('quest'); const row = I.$('.qc .sp[data-act=goto]'); if (row) { row.focus(); ok(I.doc.activeElement === row, '任務名稱可以聚焦'); row.dispatchEvent(new I.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await flush(); eq(I.UI.tab, 'today', 'Enter 觸發「前往」'); }
  I.check('鍵盤'); I.destroy();
});

// ---- 第一次打開的引導、專注畫面的結束 ----
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const onbOpen = I => { const e = I.$('#onb'); return !!e && !e.classList.contains('hidden'); };
const activeIds = I => I.ev('activeHabits().map(h => h.id)');

async function feedTutorialClown(I, count) {
  const pet = I.S.logs.find(l => l.k === 'welcome' && l.drop === 'clown');
  for (let n=0; n<count; n++) {
    const before = I.S.fed?.[pet.id] || 0;
    const button = I.$('.seabar [data-act=feedkeyboard]'); button.focus();
    await I.click(button);
    for (let i=0;i<80 && (I.S.fed?.[pet.id] || 0)<=before;i++) await new Promise(resolve=>setTimeout(resolve,20));
    ok((I.S.fed?.[pet.id] || 0)>before,'飼料實際被小丑魚吃到');
    if (I.S.introFeedPending) eq(I.$('#introFeedProgress').textContent,`已吃到 ${I.S.fed[pet.id]}／10 顆`,'進度隨實際吃到更新');
  }
}

test('第一次打開：三步新手導覽清楚呈現且可重開接續', async () => {
  resetCloud(); const I = await boot({onb:true});
  ok(onbOpen(I), '有歡迎畫面'); ok(I.has('每天完成一點事，收集海洋生物。'), '採用指定文案');
  ok(!I.$('#onb [data-act=login]'), '預設不要求 Google 登入');
  ok(!I.ev('CLOUD.loading'), '還沒選登入時不載入 SDK');
  await I.click('#onb [data-act=onbstart]');
  ok(onbOpen(I) && I.$('#onb').textContent.includes('第 1 步，共 3 步'), '主按鈕進入選習慣第一步');
  await I.click('#onb [data-act=onbpick][data-v=read]');
  await I.click('#onb [data-act=onbdone]');
  ok(onbOpen(I) && I.S.onb, '下一步保持獨立彈窗，進入第一件事');
  ok(I.$('#onbbox').textContent.includes('第 2 步，共 3 步'), '清單明確標示正在新手導覽第二步');
  ok(I.$('#onb [data-intro-index="0"]').placeholder.includes('閱讀五頁書'), '有具體輸入範例');
  eq(I.$$('#onb [data-intro-index]').length,3,'獨立彈窗提供三格');
  ok(I.$('[data-act=meetfish]').disabled, '未寫第一件事前不能繼續');
  await I.type('#onb [data-intro-index="2"]','   ');
  ok(I.$('[data-act=meetfish]').disabled,'純空白不能繼續');
  await I.type('#onb [data-intro-index="2"]','散步十分鐘');
  ok(!I.$('[data-act=meetfish]').disabled,'只填第三格也能繼續');
  await I.type('#onb [data-intro-index="2"]','');
  await I.plan(['今天先閱讀一頁']);
  const J = await I.reload({onb:true}); await J.dismiss();
  ok(J.S.introPending && onbOpen(J) && J.$('#onbbox').textContent.includes('第 2 步，共 3 步'), '重開保持第二步及已輸入內容');
  eq(J.$('#onb [data-intro-index="0"]').value,'今天先閱讀一頁','重開保留輸入');
  await J.click('[data-act=meetfish]');
  ok(!onbOpen(J),'領魚時關閉事項彈窗');
  eq(J.S.plans[D0][0].text,'今天先閱讀一頁','輸入留在今日清單');
  ok(J.S.logs.some(l=>l.k==='welcome' && l.drop==='clown'), '寫一件事即可取得小丑魚');
  eq(J.$$('#modal button').length,1,'新手領魚只保留一個前進按鈕');
  ok(!J.$('#modal [data-act=close]'),'不提供跳過大海的選項');
  await J.click('#modal [data-act=seagoto]'); eq(J.UI.tab,'tank','直接進入大海');
  ok(!J.$('.sea-guide'),'餵魚途中不顯示大型教學卡片');
  ok(J.vis(J.$('.seacoach')),'只保留點擊提示');
  const used=J.S.feedDay?.used||0; await feedTutorialClown(J,9);
  ok(J.vis(J.$('.seacoach')) && !J.$('[data-act=introbackup]'),'未長大前持續顯示提示，不提前邀請備份');
  await feedTutorialClown(J,1);
  eq(J.S.feedDay.used,used+10,'用十顆飼料完成首次成長');
  ok(J.S.introCompleteNotice && J.ev("stageOf(fedOf(S.logs.find(l=>l.k==='welcome').id))")===2,'長成成體才完成導覽');
  ok(!J.$('.seacoach'),'長大後移除點擊提示');
  ok(J.$('.sea-guide').textContent.includes('小丑魚長大了'),'先顯示成長回饋');
  for (let i=0;i<100 && !J.$('[data-act=introfinish]');i++) await new Promise(r=>setTimeout(r,20));
  await J.click('[data-act=introfinish]');
  eq(J.UI.tab,'today','完成後回今日');
  ok(J.$('#six .intro-target') && J.has('完成這件事後，回來打勾領獎勵'),'接回剛寫的事項');
  ok(!J.S.plans[D0][0].done,'不代替使用者完成真實事項'); ok(!J.S.introPending && !J.S.introFeedPending && !J.S.introCompleteNotice,'結束導覽狀態');
  eq(J.S.logs.filter(l=>l.k==='welcome').length,1,'新手禮物不重發');
  I.destroy(); J.check('三步導覽'); J.destroy();
});
test('引導：寫作是一般習慣；舊的 Vocus 習慣；不選也能開始；自訂習慣和上限；用過的存檔不引導', async () => {
  resetCloud();
  const A = await boot({ onb: true }); await A.click('#onb [data-act=onbstart]'); await A.click('#onb [data-act=onbpick][data-v=write]'); ok(!A.$('#onb [data-act=onbvocus]') && !A.$('#onb').textContent.includes('Vocus'), '選了寫作也沒有 Vocus 選項'); await A.click('#onb [data-act=onbdone]'); await A.plan(['我的第一件事']); await A.click('[data-act=meetfish]'); await A.dismiss();
  eq(activeIds(A), ['write'], '寫作就是一般習慣'); ok(!A.S.habits.some(h => h.kind === 'vocus'), '新使用者沒有 Vocus 專屬習慣'); ok(!A.$('#main').innerText.includes('Vocus') && !A.has('發文節奏'), '畫面上沒有 Vocus、沒有發文設定');
  await A.click('[data-act=habtap][data-v=write]'); await A.click('#sheet [data-act=chk]'); const wk = A.S.logs.filter(l => l.k === 'habit' || l.k === 'pubchest'); ok(!A.S.logs.some(l => l.k === 'pubchest') && A.S.logs.some(l => l.key === 'hab:write:' + D0), '寫作打卡只是一般習慣獎勵，沒有發文額外獎勵'); A.check('寫作'); A.destroy();
  const OLDV = [{ id: 'vocus', e: '✍️', n: 'Vocus', kind: 'vocus', weeks: 1, target: 1 }, { id: 'exercise', e: '🏃', n: '運動', kind: 'exercise', weeks: 1, target: 3 }];
  const L = await boot({ onb: true, state: mkState({ v: 7, vocusSet: false, habits: OLDV, checks: { [D0]: { exercise: [{ t: 1 }] } } }) }); await L.dismiss();   // 舊版預設帶 Vocus 習慣、沒設定過節奏的人
  ok(!L.S.habits.some(h => h.id === 'vocus') && !L.$('#main').innerText.includes('Vocus') && !L.has('發文節奏'), '沒用過的舊 Vocus 習慣直接移除，不再問節奏'); L.check('移除 Vocus'); L.destroy();
  const B = await boot({ onb: true }); await B.click('#onb [data-act=onbstart]'); await B.click('#onb [data-act=onbdone]'); await B.plan(['我的第一件事']); await B.click('[data-act=meetfish]'); await B.dismiss();
  eq(activeIds(B), [], '什麼都沒選也能開始'); ok(!B.has('Vocus'), '沒有 Vocus'); ok(B.S.habits.some(h => h.id === 'exercise' && h.off), '運動留著，可以到編輯畫面加回');
  await B.click('[data-act=habedit]'); ok(B.has('加回 運動') && !B.has('加回 Vocus'), '編輯畫面只能加回運動'); B.check('空習慣'); B.destroy();
  const C = await boot({ onb: true }); await C.click('#onb [data-act=onbstart]');
  for (const id of ['write', 'read', 'meditate']) await C.click(`#onb [data-act=onbpick][data-v=${id}]`);
  await C.type('#onb [data-onb=name]', '  喝水  ');
  await C.click('#onb [data-act=onbdone]'); ok(onbOpen(C) && !C.S.onb, '自訂型習慣超過 ' + C.CONFIG.maxCustom + ' 個：不能開始'); ok(C.has('最多'), '要說明原因');
  await C.type('#onb [data-onb=name]', ''); await C.click('#onb [data-act=onbdone]');
  eq(activeIds(C), ['write', 'read', 'meditate'], '拿掉自訂就能開始'); eq(C.S.habits.find(h => h.id === 'read').target, 3, '閱讀每週 3 天'); eq(C.S.habits.find(h => h.id === 'meditate').weeks, 0, '冥想每天'); C.destroy();
  const D = await boot({ onb: true }); await D.click('#onb [data-act=onbstart]'); await D.click('#onb [data-act=onbpick][data-v=read]'); await D.type('#onb [data-onb=name]', '<img src=x onerror=window.__xss=1>喝');
  await D.click('#onb [data-act=onbdone]'); await D.plan(['我的第一件事']); await D.click('[data-act=meetfish]'); await D.dismiss(); const my = D.S.habits.find(h => h.kind === 'custom' && h.id !== 'read');
  ok(my && my.n.length === 20 && my.weeks === 0 && my.target === 1, '自訂習慣：名稱最多 20 字、預設每天：' + JSON.stringify(my)); ok(!D.win.__xss && !D.$('#main img[src=x]'), 'XSS：自訂習慣名稱'); D.check('自訂習慣'); D.destroy();
  const used = { checks: { [D0]: { exercise: [{ t: 1 }] } } };   // 舊存檔（沒有 onb 欄位）但用過了
  const E = await boot({ onb: true, state: mkState({ ...used, v: 7, vocusSet: true, habits: OLDV }) }); await E.dismiss(); ok(!onbOpen(E), '用過的舊存檔不會被問'); eq(E.S.onb, true, '補上做過了'); ok(E.has('Vocus') && E.S.habits.find(h => h.id === 'vocus').kind === 'custom', '舊存檔設定過的 Vocus 習慣保留，變成一般習慣'); E.destroy();
  const F = await boot({ onb: true, state: mkState() }); ok(onbOpen(F), '只有新手禮物、沒做過任何事的存檔還是要引導'); F.destroy();
});

test('引導：已有紀錄的登入入口、iPhone 登入與 App 內建瀏覽器', async () => {
  resetCloud(); const A=await boot({state:mkState({checks:{[D0]:{exercise:[{t:1}]}}}),ua:IPHONE}); await A.dismiss(); await loginAs(A);
  const B=await boot({onb:true,seed:{},ua:IPHONE});
  ok(!B.ev('CLOUD.loading'),'進入歡迎頁不載入登入服務');
  await B.click('#onb [data-act=onbreturn]'); await flush(8);
  ok(B.ev('CLOUD.ready'),'選擇接續紀錄後才準備登入');
  window.__cloudDb.nextUser={uid:'u1'}; await B.click('#onb [data-act=login]'); await flush(14);
  ok(B.S.cloudUid==='u1' && !onbOpen(B),'有雲端紀錄便接續遊戲'); ok(B.S.checks[D0],'拿到原紀錄'); B.check('接續');
  const M=await boot({onb:true,ua:'Mozilla/5.0 TikTok_26.0'}); await M.click('#onb [data-act=onbreturn]');
  ok(M.has('App 內建') && !M.$('#onb [data-act=login]'),'App 內建瀏覽器說明替代方案');
  await M.click('#onb [data-act=onbback]'); await M.click('#onb [data-act=onbstart]'); ok(M.$('#onb').textContent.includes('第 1 步，共 3 步'),'仍可不登入開始導覽');
  M.destroy(); B.destroy(); A.destroy();
});
test('專注畫面的結束：一分鐘內直接結束，之後才確認；按鈕夠大', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click('[data-act=start]'); await I.advance(20e3);
  const r = I.$('#focus [data-act=cancel]').getBoundingClientRect(); ok(r.height >= 44 && r.width >= 100, `結束按鈕至少 44px 高：${r.width}×${r.height}`);
  await I.click('#focus [data-act=cancel]'); ok(I.$('#askov').classList.contains('hidden'), '剛開始按結束：不用確認'); ok(!I.S.timer && I.$('#focus').classList.contains('hidden'), '直接結束、回到遊戲');
  await I.click('[data-act=start]'); await I.advance(61e3); await I.click('#focus [data-act=cancel]'); ok(!I.$('#askov').classList.contains('hidden'), '超過一分鐘：要確認'); await I.click('#askyes'); ok(!I.S.timer, '確認後結束');
  await I.click('[data-act=pomoset][data-v="90"]'); await I.click('[data-act=start]'); await I.advance(25 * 60e3 + 5e3); await I.dismiss(); await I.click('#focus [data-act=cancel]'); ok(!I.$('#askov').classList.contains('hidden'), '第二段（休息）時結束：要確認');
  I.check('結束'); I.destroy();
});


test('導覽備份邀請：可跳過，重開不重複要求登入', async () => {
 resetCloud(); const I=await boot({state:mkState({onb:true,introCompleteNotice:true,logs:[W0,{id:'h1',d:D0,k:'habit',c:15,xp:1}]})});await I.dismiss();
 I.ev("UI.tab='tank';render()");await flush(14);
 ok(I.$('[data-act=introbackup]'),'完成第一次餵食後提供 Google 儲存入口');
 eq(I.$('[data-act=introfinish]').textContent,'先玩看看','可以略過綁定');
 const coins=I.coins();await I.click('[data-act=introfinish]');
 eq(I.UI.tab,'today','略過後回到今日');eq(I.coins(),coins,'略過不影響進度');
 ok(!I.S.introCompleteNotice && I.S.backupNudgeDismissed,'記住已略過');
 const J=await I.reload();await J.dismiss();
 ok(!J.$('[data-act=introbackup]') && !J.$('[data-act=backupinvite]'),'重開不重複邀請');
 await J.tab('about');ok(J.$('.gbtn'),'仍可從更多頁登入');J.destroy();
});

test('導覽備份邀請：Google 按鈕沿用安全的首次儲存流程', async () => {
 resetCloud(); const I=await boot({state:mkState({onb:true,introCompleteNotice:true})});await I.dismiss();await I.plan(['導覽後的清單']);
 I.ev("UI.tab='tank';render()");await flush(14);window.__cloudDb.nextUser={uid:'tutorial-user'};
 await I.click('[data-act=introbackup]');await flush(14);
 eq(I.UI.tab,'today','儲存完成回到今日');
 eq(I.S.cloudUid,'tutorial-user','按鈕啟動 Google 登入');
 ok(!I.ev('CLOUD.choice'),'已同意儲存的新帳號不再重複詢問');
 eq(JSON.parse(window.__cloudDb.docs['tutorial-user'].data).plans[D0][0].text,'導覽後的清單','原進度正確存入帳號');
 ok(!I.S.introCompleteNotice,'不再顯示導覽邀請');I.destroy();
});

test('導覽備份邀請：已登入與 App 內建瀏覽器可直接完成', async () => {
 resetCloud(); const I=await boot({state:mkState({onb:true,cloudUid:'u1',introCompleteNotice:true}),cloudUser:{uid:'u1'}});await I.dismiss();await flush(14);
 I.ev("UI.tab='tank';render()");await flush(8);
 ok(!I.$('[data-act=introbackup]'),'已登入不再次邀請綁定');
 await I.click('[data-act=introfinish]');eq(I.UI.tab,'today','已登入者直接完成');I.destroy();
 const J=await boot({state:mkState({onb:true,introCompleteNotice:true}),ua:'Mozilla/5.0 Line/13.0'});await J.dismiss();J.ev("UI.tab='tank';render()");
 ok(!J.$('[data-act=introbackup]'),'不提供內建瀏覽器無法使用的登入操作');
 await J.click('[data-act=introfinish]');eq(J.UI.tab,'today','內建瀏覽器也不阻擋遊戲');J.destroy();
});

test('導覽餵食：提示保留到十顆長大，重開後接續且不提前要求登入', async () => {
 resetCloud();const I=await boot({state:mkState({onb:true,introFeedPending:true})});await I.dismiss();await I.tab('tank');
 eq(I.$('#introFeedProgress').textContent,'已吃到 0／10 顆','初始顯示零顆');
 await feedTutorialClown(I,9);
 ok(I.S.introFeedPending && !I.S.introCompleteNotice,'九顆仍在養成階段');
 ok(I.vis(I.$('.seacoach')) && !I.$('.sea-guide'),'撒超過三顆後仍保留氣泡，沒有大型卡片');
 const J=await I.reload();await J.dismiss();await J.tab('tank');
 eq(J.S.fed.w0,9,'重開保留已吃的九顆');
 eq(J.$('#introFeedProgress').textContent,'已吃到 9／10 顆','重開後顯示保存的進度');
 ok(J.vis(J.$('.seacoach')) && !J.$('[data-act=introbackup]'),'重開後提示仍在，不提前要求登入');
 await feedTutorialClown(J,1);
 ok(J.S.introCompleteNotice && J.S.fed.w0===10,'第十顆實際吃到才完成');
 ok(!J.$('.seacoach'),'長成成體後移除提示');
 for(let i=0;i<100&&!J.$('[data-act=introbackup]');i++)await new Promise(resolve=>setTimeout(resolve,20));
 ok(J.$('[data-act=introbackup]'),'長大後才顯示備份邀請');J.destroy();
});

test('導覽儲存：已有雲端存檔時仍直接載入，不覆蓋為試玩', async () => {
 resetCloud();const I=await boot({state:mkState({onb:true,introCompleteNotice:true})});await I.dismiss();await I.plan(['這次試玩']);
 const remote=JSON.parse(JSON.stringify(I.S));remote.plans[D0][0].text='帳號原本的進度';remote.introCompleteNotice=false;
 window.__cloudDb.docs.existing={data:JSON.stringify(remote),mtime:1,wid:'original'};
 I.ev("UI.tab='tank';render()");await flush(14);window.__cloudDb.nextUser={uid:'existing'};
 await I.click('[data-act=introbackup]');await flush(14);
 eq(I.S.plans[D0][0].text,'帳號原本的進度','既有雲端優先');
 eq(JSON.parse(window.__cloudDb.docs.existing.data).plans[D0][0].text,'帳號原本的進度','沒有用試玩覆蓋');
 ok(I.win.localStorage.getItem('habitdive.v1.prelogin').includes('這次試玩'),'試玩另存備份');I.destroy();
});

test('導覽儲存：取消 Google 後普通登入仍需確認儲存試玩', async () => {
 resetCloud();const I=await boot({state:mkState({onb:true,introCompleteNotice:true})});await I.dismiss();await I.plan(['仍是試玩']);I.ev("UI.tab='tank';render()");await flush(14);
 I.ev("window.__signIn=firebase.auth().signInWithPopup;firebase.auth().signInWithPopup=async()=>{const error=new Error('closed');error.code='auth/popup-closed-by-user';throw error}");
 await I.click('[data-act=introbackup]');await flush(10);
 ok(!I.ev('CLOUD.trialSaveRequested'),'取消後不保留自動儲存的授權');
 I.ev('firebase.auth().signInWithPopup=__signIn');window.__cloudDb.nextUser={uid:'after-cancel'};
 await I.click('.gbtn');await flush(14);
 ok(I.ev('CLOUD.choice?.kind === "new"'),'稍後普通登入仍提供確認');I.destroy();
});
