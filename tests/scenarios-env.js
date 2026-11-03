// 環境差異：沒有音效引擎、沒有動畫 API、App 內建瀏覽器、舊引擎語法、各種螢幕寬度的版面
const TABS = ['today', 'quest', 'tank', 'shop', 'log', 'about'];
const BIG = () => {   // 內容很多、很長、數字很大的狀態，用來撐爆版面
  const long = '很長很長的事情名稱'.repeat(12);
  const logs = [W0, coinLog(98765432), { id: 'bigxp', t: 5, d: '2026-10-05', k: 'bonus', xp: 4000000, c: 0 }];
  const ids = ['clown', 'damsel', 'butterfly', 'star', 'hermit', 'urchin', 'turtle', 'octopus', 'nudi', 'lion', 'puffer', 'cuttle', 'seahorse', 'shark', 'moray', 'jelly', 'manta', 'mola', 'dolphin', 'whaleshark'];
  logs.push(...drops(ids.flatMap(i => [i, i])));
  for (let i = 0; i < 7; i++) logs.push({ id: 'rd' + i, t: 50 + i, d: '2026-10-0' + (i + 1), k: 'redeem', name: long, c: -10 });
  const plans = { [D0]: Array.from({ length: 6 }, (_, i) => ({ text: long, cat: 'other', done: i < 2, rw: i < 2 })) };
  const habits = [{ id: 'vocus', n: 'Vocus', kind: 'vocus', weeks: 1, target: 7 }, { id: 'exercise', n: '運動運動運動運動運動運動運動運動', kind: 'exercise', weeks: 2, target: 7 }, { id: 'a1', n: long.slice(0, 20), kind: 'custom', weeks: 0, target: 1 }, { id: 'a2', n: 'A'.repeat(20), kind: 'custom', weeks: 1, target: 7 }, { id: 'a3', n: '短', kind: 'custom', weeks: 2, target: 7 }];
  const checks = { [D0]: { vocus: [{ t: 1, title: long }], exercise: [{ t: 1, type: '潛水', depth: 40, min: 55, site: long, note: long }] } };
  return mkState({ logs, plans, habits, checks, favs: Array.from({ length: 12 }, (_, i) => '常用' + long.slice(0, 10) + i), shop: Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, icon: '🍰', name: long, price: 12345678 + i })) });
};

test('沒有音效引擎（舊瀏覽器、部分 App 內建瀏覽器）：所有操作照常', async () => {
  const I = await boot({ state: mkState({ mute: false }), noAudio: true }); await I.dismiss();
  await I.plan(['A', 'B', 'C']); await I.saveList(); await I.tick(0); await I.tick(1); await I.tick(2);
  ok(I.S.logs.some(l => l.key === 'top3:' + D0), '沒有音效也拿得到獎勵');
  await I.claimAll(); await I.tab('shop'); await I.click('[data-act=buyfeed][class*=pri]'); await I.tab('today'); await I.click('[data-act=start]'); await I.advance(26 * 60e3); await I.dismiss();
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
  await I.tab('about'); await I.click('[data-act=export]'); eq(I.win.__downloads.length, 1, '沒有分享 API 時改用下載');
  const names = I.win.__downloads.map(d => d.name); ok(!/[\\/:*?"<>|]/.test(names[0]), '檔名沒有不合法字元：' + names[0]);
  I.destroy();
});

test('原始碼掃描：舊引擎不支援的語法和 API', async () => {
  const base = new URL('../', location.href).href;
  const files = ['js/config.js', 'js/creatures.js', 'js/core.js', 'js/game.js', 'js/views.js', 'js/sync.js', 'js/main.js', 'js/firebase-config.js'];
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
  const files = ['js/sync.js', 'js/main.js', 'js/views.js', 'js/core.js', 'js/game.js'];
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
    const last = [...doc.querySelectorAll('main button, main a, main input, main select')].filter(e => I.vis(e)).pop();
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
  const scan = where => { for (const e of I.$$('button, input:not([type=file]), select, textarea, [role=button], a[href]')) { if (!I.vis(e)) continue; if (!nameOf(e)) unnamed.set(`${where}:${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.dataset.act ? '[' + e.dataset.act + ']' : ''}${e.dataset.pf ? '[pf=' + e.dataset.pf + ']' : ''}`, 1); } };
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
  const bgOf = e => { let layers = []; for (let x = e; x; x = x.parentElement) { const c = parse(I.win.getComputedStyle(x).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= .99) break; } } let base = { r: 11, g: 37, b: 70 }; for (const c of layers.reverse()) base = { r: base.r * (1 - c.a) + c.r * c.a, g: base.g * (1 - c.a) + c.g * c.a, b: base.b * (1 - c.a) + c.b * c.a }; return base; };
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

test('版面：全新使用者（Vocus 設定卡）和空圖鑑在最窄的手機上', async () => {
  for (const w of [280, 320, 360]) {
    const I = await boot({ seed: {}, width: w, height: 700 }); await I.dismiss();
    ok(I.has('Vocus 發文節奏'), '全新使用者有節奏設定卡'); layoutAudit(I, `${w}px/全新`); I.check(`${w}px/全新`);
    for (const t of TABS) { await I.tab(t); layoutAudit(I, `${w}px/全新/${t}`); }
    await I.tab('tank'); await I.click('[data-act=tankview][data-v=dex]'); layoutAudit(I, `${w}px/空圖鑑`); I.check(`${w}px/空圖鑑`);
    I.destroy();
  }
});

test('待領取的獎勵一定領得到：刪掉習慣後它的獎勵仍在任務頁', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click(['#habits .hab', 'Vocus']); await I.click('[data-act=artadd]'); await I.dismiss(); await I.click('#sheet [data-act=sheetclose]').catch(() => {});
  ok(I.S.logs.some(l => l.key === 'art:' + D0 && l.pend), 'Vocus 發文有待領取的獎勵');
  await I.click('#habits [data-act=habedit]'); await I.click(I.$$('[data-act=habdel]')[0]); await I.click('#askyes'); await I.click('[data-act=habdone]');
  await I.tab('quest'); ok(I.has('其他獎勵') || I.has('Vocus'), '刪掉習慣後，它還沒領的獎勵要在任務頁'); ok(I.$('.qall'), '全部領取還在'); I.check('刪掉有獎勵的習慣');
  await I.click('.qall'); await I.dismiss(); eq(I.pendCount(), 0, '全部領得到'); I.check('領完'); I.destroy();
});

test('舊資料的六件事：沒有獎勵欄位的打勾不能每次開啟都變成「有獎勵」', async () => {
  const plan = Array.from({ length: 6 }, (_, i) => ({ text: i < 5 ? '事' + i : '', cat: 'other', done: i >= 3 && i < 5 }));   // 沒有 rw 欄位，第 4、5 件有打勾
  const I = await boot({ state: mkState({ plans: { [D0]: plan } }) }); await I.dismiss();
  eq(I.S.plans[D0].filter(x => x.rw).length, 0, '第 4、5 件打勾沒有獎勵，不能算進獎勵名額');
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

test('第一次打開：先問綁定 Google（可跳過，要說資料可能不見）→ 選習慣 → 才發新手禮物', async () => {
  resetCloud();
  const I = await boot({ onb: true });
  ok(onbOpen(I), '新存檔一打開就是引導'); ok(I.$('#onb').textContent.includes('可能會消失'), '步驟 1 要說清楚不綁定紀錄可能會不見');
  ok(I.$('#onb [data-act=login]') && I.$('#onb [data-act=onbskip]'), '有登入按鈕，也能先跳過');
  ok(!I.S.logs.some(l => l.k === 'welcome') && I.$('#ov').classList.contains('hidden'), '引導做完之前不發新手禮物、不跳寶箱');
  ok(!I.$('#onb').textContent.includes('Vocus'), '引導的第一頁沒有 Vocus');
  await I.click('#onb [data-act=onbskip]'); ok(I.$('#onb').textContent.includes('你想養成什麼習慣'), '跳過後選習慣');
  eq(I.$$('#onb [data-act=onbpick]').map(b => b.dataset.v), ['exercise', 'write', 'read', 'meditate'], '選項：運動、寫作、閱讀、冥想（Vocus 不是獨立選項）'); ok(I.$('#onb [data-onb=name]') && !I.$('#onb [data-onb=freq]'), '還有自訂（頻率之後在編輯改）'); ok(!I.$('#onb').textContent.includes('Vocus'), '引導裡沒有 Vocus（寫作就是寫作）');
  ok(I.$('#onb [data-act=onbdone]').textContent.includes('先不選'), '一個都沒選時按鈕寫「先不選」');
  await I.click('#onb [data-act=onbpick][data-v=exercise]'); await I.click('#onb [data-act=onbpick][data-v=write]');
  ok(I.$('#onb [data-act=onbpick][data-v=write]').classList.contains('sel'), '選到的有標示'); ok(I.$('#onb [data-act=onbdone]').textContent === '開始', '有選時按鈕寫「開始」');
  ok(!I.S.onb, '還沒按開始，不算做完');
  await I.click('#onb [data-act=onbdone]');
  ok(!onbOpen(I), '開始後引導關掉'); eq(I.S.onb, true, '記下做過了'); eq(activeIds(I), ['exercise', 'write'], '習慣就是選的那兩個');
  ok(!I.S.habits.some(h => h.id === 'vocus'), '沒選 Vocus：習慣裡沒有 Vocus'); eq(I.S.habits.find(h => h.id === 'write').unit, '篇', '寫作的單位是篇');
  ok(I.has('寫作') && !I.has('Vocus'), '今日頁有寫作、完全沒有 Vocus 字樣'); ok(I.has('本週 0/1 篇'), '寫作寫「本週 0/1 篇」：' + I.$('#habits').innerText.replace(/\s+/g, ' '));
  ok(!I.$('#ov').classList.contains('hidden'), '引導完成後才出現新手禮物'); await I.dismiss(); ok(I.S.logs.some(l => l.k === 'welcome'), '新手禮物發了');
  I.check('引導'); const J = await I.reload({ onb: true }); await J.dismiss(); ok(!onbOpen(J), '重開不會再問'); eq(activeIds(J), ['exercise', 'write'], '習慣還在'); J.check('引導後重開'); J.destroy(); I.destroy();
});

test('引導：Vocus 只留給選的人；不選也能開始；自訂習慣和上限；用過的存檔不引導', async () => {
  resetCloud();
  const A = await boot({ onb: true }); await A.click('#onb [data-act=onbskip]'); await A.click('#onb [data-act=onbpick][data-v=write]'); ok(!A.$('#onb [data-act=onbvocus]') && !A.$('#onb').textContent.includes('Vocus'), '選了寫作也沒有 Vocus 選項'); await A.click('#onb [data-act=onbdone]'); await A.dismiss();
  eq(activeIds(A), ['write'], '寫作就是一般習慣'); ok(!A.S.habits.some(h => h.kind === 'vocus'), '新使用者沒有 Vocus 專屬習慣'); ok(!A.$('#main').innerText.includes('Vocus') && !A.has('發文節奏'), '畫面上沒有 Vocus、沒有發文設定');
  await A.click('[data-act=habtap][data-v=write]'); await A.click('#sheet [data-act=chk]'); const wk = A.S.logs.filter(l => l.k === 'habit' || l.k === 'pubchest'); ok(!A.S.logs.some(l => l.k === 'pubchest') && A.S.logs.some(l => l.key === 'hab:write:' + D0), '寫作打卡只是一般習慣獎勵，沒有發文額外獎勵'); A.check('寫作'); A.destroy();
  const L = await boot({ onb: true, state: mkState({ vocusSet: false, checks: { [D0]: { exercise: [{ t: 1 }] } } }) }); await L.dismiss();   // 還在用舊版 Vocus 習慣、而且沒設定過節奏的人
  ok(L.has('Vocus 發文節奏') && L.has('我不寫 Vocus'), '舊的 Vocus 習慣：可以直接移除'); await L.click('[data-act=vdrop]'); ok(!L.S.habits.some(h => h.kind === 'vocus') && !L.$('#main').innerText.includes('Vocus'), '移除後畫面上沒有 Vocus'); L.check('移除 Vocus'); L.destroy();
  const B = await boot({ onb: true }); await B.click('#onb [data-act=onbskip]'); await B.click('#onb [data-act=onbdone]'); await B.dismiss();
  eq(activeIds(B), [], '什麼都沒選也能開始'); ok(!B.has('Vocus'), '沒有 Vocus'); ok(B.S.habits.some(h => h.id === 'exercise' && h.off), '運動留著，可以到編輯畫面加回');
  await B.click('[data-act=habedit]'); ok(B.has('加回 運動') && !B.has('加回 Vocus'), '編輯畫面只能加回運動'); B.check('空習慣'); B.destroy();
  const C = await boot({ onb: true }); await C.click('#onb [data-act=onbskip]');
  for (const id of ['write', 'read', 'meditate']) await C.click(`#onb [data-act=onbpick][data-v=${id}]`);
  await C.type('#onb [data-onb=name]', '  喝水  ');
  await C.click('#onb [data-act=onbdone]'); ok(onbOpen(C) && !C.S.onb, '自訂型習慣超過 ' + C.CONFIG.maxCustom + ' 個：不能開始'); ok(C.has('最多'), '要說明原因');
  await C.type('#onb [data-onb=name]', ''); await C.click('#onb [data-act=onbdone]');
  eq(activeIds(C), ['write', 'read', 'meditate'], '拿掉自訂就能開始'); eq(C.S.habits.find(h => h.id === 'read').target, 3, '閱讀每週 3 天'); eq(C.S.habits.find(h => h.id === 'meditate').weeks, 0, '冥想每天'); C.destroy();
  const D = await boot({ onb: true }); await D.click('#onb [data-act=onbskip]'); await D.click('#onb [data-act=onbpick][data-v=read]'); await D.type('#onb [data-onb=name]', '<img src=x onerror=window.__xss=1>喝');
  await D.click('#onb [data-act=onbdone]'); await D.dismiss(); const my = D.S.habits.find(h => h.kind === 'custom' && h.id !== 'read');
  ok(my && my.n.length === 20 && my.weeks === 0 && my.target === 1, '自訂習慣：名稱最多 20 字、預設每天：' + JSON.stringify(my)); ok(!D.win.__xss && !D.$('#main img[src=x]'), 'XSS：自訂習慣名稱'); D.check('自訂習慣'); D.destroy();
  const used = { checks: { [D0]: { exercise: [{ t: 1 }] } } };   // 舊存檔（沒有 onb 欄位）但用過了
  const E = await boot({ onb: true, state: mkState(used) }); await E.dismiss(); ok(!onbOpen(E), '用過的舊存檔不會被問'); eq(E.S.onb, true, '補上做過了'); ok(E.has('Vocus'), '舊存檔的習慣不動'); E.destroy();
  const F = await boot({ onb: true, state: mkState() }); ok(onbOpen(F), '只有新手禮物、沒做過任何事的存檔還是要引導'); F.destroy();
});

test('引導：綁定 Google 一次點擊（iPhone）；雲端已有紀錄就直接進遊戲', async () => {
  resetCloud();
  const A = await boot({ state: mkState({ checks: { [D0]: { exercise: [{ t: 1 }] } } }), ua: IPHONE }); await A.dismiss(); await loginAs(A); ok(window.__cloudDb.docs.u1, '準備好另一台裝置的雲端紀錄');
  const B = await boot({ onb: true, seed: {}, ua: IPHONE }); await flush(6);
  ok(onbOpen(B) && B.ev('CLOUD.ready'), 'B：引導一出現就把登入程式載好');
  window.__cloudDb.nextUser = { uid: 'u1' }; await B.click('#onb [data-act=login]'); await flush(14);
  ok(B.S.cloudUid === 'u1', 'iPhone 一次點擊就登入'); ok(!onbOpen(B), '雲端已有做過引導的紀錄：直接進遊戲，不再問'); eq(B.S.onb, true, '換成雲端的紀錄'); ok(B.S.checks[D0], '雲端的打卡紀錄到了'); B.check('引導登入'); B.destroy();
  const C = await boot({ onb: true, seed: {}, ua: IPHONE }); await flush(6);
  window.__cloudDb.nextUser = { uid: 'u2' }; await C.click('#onb [data-act=login]'); await flush(14);
  ok(C.S.cloudUid === 'u2' && onbOpen(C), '全新的帳號：登入後接著選習慣'); ok(C.$('#onb').textContent.includes('已綁定') && C.$('#onb').textContent.includes('你想養成什麼習慣'), '顯示已綁定、進到選習慣');
  await C.click('#onb [data-act=onbdone]'); await C.dismiss(); await hide(C, true); ok(C.S.onb, '做完'); ok(JSON.parse(window.__cloudDb.docs.u2.data).onb === true, '雲端上也記著做過了'); C.destroy(); A.destroy();
  const M = await boot({ onb: true, ua: 'Mozilla/5.0 TikTok_26.0' }); ok(M.$('#onb').textContent.includes('App 內建') && !M.$('#onb [data-act=login]'), 'App 內建瀏覽器：說明無法登入，沒有登入按鈕'); ok(M.$('#onb [data-act=onbskip]'), '但可以先跳過'); M.destroy();
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

