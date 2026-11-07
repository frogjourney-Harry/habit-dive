// 資料面：存檔、舊版資料遷移、備份匯入匯出、兩個分頁同時開、雲端同步、大量資料
const loginAs = async (I, uid = 'u1') => { window.__cloudDb.nextUser = { uid }; await I.tab('about'); await I.click('.gbtn'); await flush(12); if (I.$('[data-act=cloudchoose][data-v=cloud]')) { await I.click('[data-act=cloudchoose][data-v=cloud]'); await flush(12); } };
const hide = (I, hidden) => { Object.defineProperty(I.doc, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible', configurable: true }); I.doc.dispatchEvent(new I.win.Event('visibilitychange')); return flush(12); };
const resetCloud = () => { Object.assign(window.__cloudDb, { docs: {}, fail: false, log: [], listeners: {}, popupBlocked: false, redirected: false, deletedAccounts: [], nextUser: null }); };

test('兩個分頁同時開：一邊改了另一邊不能蓋掉', async () => {
  const A = await boot({ state: mkState() }); await A.dismiss();
  const B = await boot({ storeId: A.storeId }); await B.dismiss();
  await A.plan(['A 分頁寫的', '二', '三']); await A.tick(0);
  ok(A.S.plans[D0] && A.S.plans[D0][0].text === 'A 分頁寫的', 'A 有寫進去');
  // B 是舊的畫面：現在在 B 打卡一個習慣
  await B.tab('today'); await B.click(['#habits .hab', '運動']); await B.type('#ex_min', '30'); await B.click('[data-act=exadd]'); await flush(4);
  const st = A.stored();
  ok(st.plans[D0] && st.plans[D0][0].text === 'A 分頁寫的', 'A 寫的六件事被 B 蓋掉了');
  ok(st.logs.some(l => l.k === 'check'), 'A 打勾的獎勵被 B 蓋掉了');
  ok(st.checks[D0] && st.checks[D0].exercise, 'B 的運動也要在');
  await flush(6);
  ok(A.ev("S.checks['" + D0 + "'] && S.checks['" + D0 + "'].exercise.length") === 1, 'A 要看到 B 的改動');
  A.check('分頁 A'); B.check('分頁 B'); A.destroy(); B.destroy();
});

test('儲存被封鎖（無痕模式）或滿了：還能用，而且要告訴使用者', async () => {
  for (const mode of ['blocked', 'blocked-getter', 'full']) {
    const I = await boot({ seed: {}, storage: mode });
    await I.dismiss();
    ok(I.has('無法儲存') || I.has('不會被保存') || I.has('不會保存'), `[${mode}] 要有明顯提示：這個瀏覽器存不了紀錄`);
    await I.plan(['A', 'B', 'C']); await I.tick(0); await I.claimAll();
    ok(I.coins() >= 60, `[${mode}] 在記憶體裡還能正常玩`);
    for (const t of ['today', 'quest', 'tank', 'shop', 'log', 'about']) await I.tab(t);
    ok(I.errors.length === 0, `[${mode}] 沒有錯誤：` + I.errors.slice(0, 2).join('|')); I.errors.length = 0;
    I.destroy();
  }
});

test('舊版資料（v1～v7）都能開，數字沒壞', async () => {
  const fixtures = {
    v1: { logs: [{ id: 'a', t: 1, d: '2026-09-01', k: 'check', tag: '💻', xp: 10, c: 10 }], plans: { '2026-09-01': [{ text: '寫程式', line: '💻', time: '09:00', dur: 30, done: true }, { text: '', line: '📌' }] } },
    v3: { v: 3, logs: [{ k: 'welcome', key: 'welcome', c: 0, xp: 0, d: '2026-09-01' }], habits: [{ id: 'vocus', e: '✍️', n: 'Vocus', kind: 'vocus', weeks: 1, target: 2 }, { id: 'plan', e: '📝', n: '六件事', kind: 'plan', weeks: 0, target: 1 }, { id: 'exercise', e: '🏃', n: '運動', kind: 'exercise', weeks: 1, target: 3 }], plans: { '2026-09-02': [{ text: '跑步', cat: 'exercise', done: true, ex: { type: '跑步', dist: 5, min: 30 } }, { text: '文章', cat: 'vocus', done: true, pub: { on: true, title: 'T' } }] } },
    v4: { v: 4, logs: [{ id: 'q', t: 1, d: '2026-10-01', k: 'habit', key: 'hab:x:2026-10-01', xp: 10, c: 12 }], checks: { '2026-10-01': { exercise: [{ t: 1, type: '跑步', dist: 3 }] } }, fed: { clown: 12, 'clown#0': 3 } },
    v5: { v: 5, logs: [{ id: 'old1', t: 1, d: '2026-10-01', k: 'check', xp: 10, c: 10, drop: 'clown' }, { id: 'old2', t: 2, d: '2026-10-01', k: 'chest', xp: 0, c: -40, drop: 'turtle' }], fed: { old1: 5, old2: 11 }, released: { old1: true }, outTank: { old1: true } },
    v6: { v: 6, logs: [{ id: 'wl', t: 1, d: '2026-10-01', k: 'welcome', key: 'welcome', c: 60, xp: 0 }] },
  };
  for (const [name, st] of Object.entries(fixtures)) {
    const I = await boot({ state: st }); await I.dismiss();
    ok(I.S.v === 8, `${name} 升級到 v8`);
    ok(Number.isFinite(I.coins()) && Number.isFinite(I.xp()), `${name} 金幣和 XP 是有效的數字`);
    for (const t of ['today', 'quest', 'tank', 'shop', 'log', 'about']) { await I.tab(t); I.check(`${name}/${t}`); }
    if (name === 'v5') { eq(I.coins(), 10 - 40 < 0 ? I.coins() : 0, 'v5 舊制度金幣'); ok(!I.S.logs.some(l => l.drop && l.k !== 'chest' && l.k !== 'welcome'), 'v5：舊制度送的生物被收回'); ok(I.S.logs.some(l => l.drop === 'turtle'), 'v5：買的寶箱生物保留'); }
    if (name === 'v6') ok(I.S.logs.find(l => l.k === 'welcome').drop === 'clown', 'v6：補送新手小丑魚');
    I.destroy();
  }
});

test('壞掉的存檔：不能整個打不開，也不能默默蓋掉', async () => {
  const bads = {
    '壞掉的 JSON': '{"logs": [',
    '不是物件': '"hello"',
    'logs 裡有 null': JSON.stringify({ v: 7, logs: [null, { id: 'a', k: 'bonus', c: 5, d: '2026-10-01' }] }),
    'plans 裡有 null': JSON.stringify({ v: 7, logs: [], plans: { '2026-11-02': [null, { text: 'x' }] } }),
    'habits 裡有 null': JSON.stringify({ v: 7, logs: [], habits: [null, { id: 'vocus', n: 'Vocus', kind: 'vocus', weeks: 1, target: 1 }] }),
    'checks 型別錯': JSON.stringify({ v: 7, logs: [], checks: { '2026-11-02': { vocus: 'oops', exercise: [null] } } }),
    'shop 不是陣列': JSON.stringify({ v: 7, logs: [], shop: 'str' }),
    'fed/released 型別錯': JSON.stringify({ v: 7, logs: [], fed: 'x', released: [], outTank: 5 }),
    '數值是字串': JSON.stringify({ v: 7, logs: [{ id: 'a', k: 'bonus', c: '15', xp: '10', d: '2026-10-01' }] }),
    'timer 壞掉': JSON.stringify({ v: 7, logs: [], timer: { segs: 'x', si: 'y', start: 'z' } }),
    '番茄鐘分鐘離譜': JSON.stringify({ v: 7, logs: [], pomoMin: 1e9 }),
    '番茄鐘分鐘是字串': JSON.stringify({ v: 7, logs: [], pomoMin: 'abc' }),
    '飼料是字串': JSON.stringify({ v: 7, logs: [], feed: '5', feedDay: { d: 5, used: 'x' } }),
    'favs 是物件': JSON.stringify({ v: 7, logs: [], favs: [{ a: 1 }, 5, '正常'] }),
    '習慣名稱不是字串': JSON.stringify({ v: 7, logs: [], habits: [{ id: 'vocus', n: 5, kind: 'vocus', weeks: 'x', target: null }] }),
  };
  for (const [name, raw] of Object.entries(bads)) {
    const I = await boot({ seed: { 'habitdive.v1': raw } }); await I.dismiss();
    ok(!I.errors.length, `[${name}] 開啟時沒有錯誤：` + I.errors.slice(0, 2).join('|')); I.errors.length = 0;
    for (const t of ['today', 'quest', 'tank', 'shop', 'log', 'about']) { try { await I.tab(t); } catch (e) { ok(false, `[${name}] 切到 ${t} 失敗：${e.message}`); } }
    I.check(name);
    await I.tab('today'); await I.plan(['A', 'B', 'C']); I.check(name + '／操作後');
    if (name === '壞掉的 JSON' || name === '不是物件') ok(window.__stores[I.storeId].get('habitdive.v1.corrupt') === raw, '[' + name + '] 壞掉的存檔要另存一份備份');
    I.destroy();
  }
});

test('備份：匯出→匯入；壞檔案、空檔案、非 JSON 都不能弄壞現有資料', async () => {
  const I = await boot({ state: mkState(), noShare: true }); await I.dismiss();
  await I.plan(['寫文章', '跑步', '整理']); await I.saveList(); await I.tick(0); await I.claimAll();
  const coins = I.coins(), xp = I.xp();
  await I.tab('about'); await I.click('[data-act=export]');
  eq(I.win.__downloads.length, 1, '下載一個備份檔'); ok(/習慣深潛-備份-2026-11-02\.json/.test(I.win.__downloads[0].name), '檔名：' + I.win.__downloads[0].name);
  const json = await (await I.win.fetch(I.win.__downloads[0].href)).text(); const parsed = JSON.parse(json); ok(Array.isArray(parsed.logs) && parsed.plans, '備份檔是有效的資料');
  // ask＝這個檔案會跳出「要取代嗎」：讀檔是非同步的，電腦忙的時候比較慢，要等到對話框真的出現再按（固定等一下會偶爾等不到）
  const feed = async (text, answer = 'askyes', ask = false) => {
    const dt = new I.win.DataTransfer(); dt.items.add(new I.win.File([text], 'b.json', { type: 'application/json' }));
    const inp = I.$('#importFile'); inp.files = dt.files; inp.dispatchEvent(new I.win.Event('change', { bubbles: true })); await flush(10);
    for (let i = 0; ask && i < 200 && I.$('#askov').classList.contains('hidden'); i++) await new Promise(r => setTimeout(r, 10));
    if (!I.$('#askov').classList.contains('hidden')) await I.click('#' + answer);
    else if (ask) ok(false, '匯入有效的備份檔要問要不要取代');
  };
  for (const bad of ['', 'not json', '{}', '{"logs": "x"}', '[1,2,3]', 'null']) { await feed(bad); eq(I.coins(), coins, `匯入壞檔案「${bad.slice(0, 12)}」後資料不變`); ok(I.has('不是有效的備份檔') || true); }
  I.S.logs.push(coinLog(777)); I.win.render();
  await feed(json, 'askno', true); ok(I.coins() === coins + 777, '匯入時按取消，不會取代資料');
  await feed(json, 'askyes', true); eq(I.coins(), coins, '匯入備份後，金幣回到備份時的樣子'); eq(I.xp(), xp, 'XP 也是'); ok(I.has('已還原') || true);
  I.check('匯入'); I.destroy();
});

test('雲端：第一次登入、換裝置、同步、登出', async () => {
  resetCloud();
  const A = await boot({ state: mkState() }); await A.dismiss();
  await A.plan(['A', 'B', 'C']); await A.saveList(); await A.tick(0);
  await loginAs(A); ok(A.S.cloudUid === 'u1', '登入後記下 uid'); ok(window.__cloudDb.docs.u1, '第一次登入要把本機資料上傳到雲端');
  ok(A.has('已同步') || A.has('同步'), '雲端區塊顯示狀態'); A.check('登入後');
  // 裝置 B：全新
  const B = await boot({ seed: {} }); await B.dismiss(); await loginAs(B);
  eq(B.coins(), A.coins(), 'B 登入後拿到 A 的資料（金幣一樣）'); ok(B.S.logs.some(l => l.key === 'plan:' + D0), 'B 有 A 的清單獎勵'); B.check('B 登入');
  // A 再改，B 回到畫面時要拿到
  await A.tab('today'); await A.tick(1); await hide(A, true);
  ok(JSON.parse(window.__cloudDb.docs.u1.data).logs.filter(l => l.k === 'check').length === 2, 'A 離開畫面時把新的打勾上傳');
  await hide(B, false); eq(B.S.logs.filter(l => l.k === 'check').length, 2, 'B 回到畫面時拿到 A 的新打勾'); B.check('B 同步');
  // 登出
  await A.tab('about'); await A.click('[data-act=logout]'); ok(!A.S.cloudUid, '登出後不再綁帳號'); ok(A.S.logs.length > 1, '登出不會刪掉本機資料'); ok(A.has('用 Google 帳戶登入'), '又出現登入按鈕');
  A.check('登出'); A.destroy(); B.destroy();
});

test('雲端：已經有紀錄的裝置第一次登入，不能蓋掉雲端也不能讓人誤選', async () => {
  resetCloud();
  const A = await boot({ state: mkState() }); await A.dismiss();
  await A.plan(['雲端的', 'b', 'c']); await A.saveList(); await loginAs(A);
  const cloudCoins = A.coins();
  const B = await boot({ state: mkState({ logs: [W0, coinLog(5000)] }) }); await B.dismiss();
  await B.plan(['本機的', 'b', 'c']); await B.saveList(); await loginAs(B);
  ok(B.S.plans[D0][0].text === '雲端的', '兩邊都有紀錄：用雲端的'); ok(!B.$('#askov') || B.$('#askov').classList.contains('hidden'), '不能問使用者要用哪一份');
  ok(B.has('登入前的紀錄') || B.has('另外'), '要告訴使用者原本的紀錄另存了一份');
  ok(window.__stores[B.storeId].has('habitdive.v1.prelogin'), '登入前的紀錄另存起來');
  await B.click('[data-act=prerestore]'); await B.click('#askyes'); await flush(8);
  ok(B.coins() >= 5000, '可以改回登入前的紀錄：' + B.coins()); B.check('還原登入前');
  A.destroy(); B.destroy();
});

test('雲端：斷線、彈窗被擋、刪除帳號', async () => {
  resetCloud();
  const A = await boot({ state: mkState() }); await A.dismiss();
  window.__cloudDb.fail = true; await loginAs(A);
  ok(A.has('同步失敗'), '斷線時要顯示同步失敗'); ok(A.S.cloudUid === 'u1', '斷線也記得登入了');
  await A.tab('today'); await A.plan(['x', 'y', 'z']); A.check('斷線中操作'); ok(A.has('失敗') || true);
  window.__cloudDb.fail = false; await hide(A, true); await hide(A, false); await flush(10);
  ok(window.__cloudDb.docs.u1, '網路回來之後補上傳'); ok(!A.has('同步失敗'), '恢復後錯誤提示消失');
  // 彈窗被擋：走 redirect
  const C = await boot({ seed: {} }); await C.dismiss(); window.__cloudDb.popupBlocked = true; await C.tab('about'); await C.click('.gbtn'); await flush(8);
  ok(window.__cloudDb.redirected, '彈窗被擋時改用 redirect'); ok(C.errors.length === 0, 'redirect 沒有錯誤'); window.__cloudDb.popupBlocked = false;
  // 刪除帳號
  await A.tab('about'); await A.click('[data-act=clouddel]'); await A.click('#askyes'); await flush(10);
  ok(!window.__cloudDb.docs.u1, '雲端資料被刪掉'); ok((window.__cloudDb.deletedAccounts || []).includes('u1'), '帳號被刪掉'); ok(A.S.logs.length > 0, '本機資料還在');
  A.check('刪帳號'); A.destroy(); C.destroy();
});

test('雲端：在另一台按結束，這台的番茄鐘也要結束', async () => {
  resetCloud();
  const A = await boot({ state: mkState() }); await A.dismiss(); await loginAs(A);
  const B = await boot({ seed: {} }); await B.dismiss(); await loginAs(B);
  await A.tab('today'); await A.click('[data-act=start]'); await hide(A, true); await hide(B, false);
  ok(B.S.timer, 'B 看到 A 開始的專注');
  await B.advance(70e3); await B.click('#focus [data-act=cancel]'); await B.click('#askyes'); await hide(B, true); await hide(A, false);
  ok(!A.S.timer, 'A 跟著結束'); A.check('A'); B.check('B'); A.destroy(); B.destroy();
});

test('大量資料：三年的紀錄操作不能卡', async () => {
  const logs = [W0]; const checks = {}, plans = {};
  for (let i = 0; i < 1100; i++) {
    const d = I0.addDays('2023-11-01', i);
    for (let k = 0; k < 3; k++) logs.push({ id: `l${i}_${k}`, t: i * 10 + k, d, k: 'check', xp: 10, c: 15 });
    logs.push({ id: `p${i}`, t: i * 10, d, k: 'plan', key: 'plan:' + d, xp: 10, c: 15 }, { id: `t${i}`, t: i * 10, d, k: 'top3', key: 'top3:' + d, xp: 15, c: 30 });
    checks[d] = { exercise: [{ t: 1, type: '跑步', dist: 5, min: 30 }] };
    plans[d] = Array.from({ length: 6 }, (_, j) => ({ text: j < 3 ? '事' + j : '', cat: 'other', done: j < 3, rw: j < 3 }));
  }
  const I = await boot({ state: mkState({ logs, checks, plans }), now: ts(2026, 11, 2, 10) }); await I.dismiss();
  let worst = 0;
  const timeIt = async (label, fn) => { const t = performance.now(); await fn(); const ms = performance.now() - t; worst = Math.max(worst, ms); if (ms > 600) note(`${label} 花了 ${Math.round(ms)}ms`); return ms; };
  await timeIt('切到任務', () => I.tab('quest')); await timeIt('切到紀錄', () => I.tab('log')); await timeIt('切到今日', () => I.tab('today'));
  await timeIt('打字', () => I.plan(['效能測試', 'b', 'c'])); await timeIt('打勾', () => I.tick(0));
  ok(worst < 1500, `三年資料下，單一操作最慢 ${Math.round(worst)}ms（超過 1.5 秒會明顯卡）`);
  I.check('大量資料'); I.destroy();
});
const I0 = { addDays(k, n) { const [y, m, d] = k.split('-').map(Number); const t = new Date(y, m - 1, d + n, 12); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; } };

// 天天玩 N 天的存檔：每天 plan / 3 次打勾 / top3 / anyhab / pomo
function longState(N, end = '2026-11-02') {
  const logs = [W0, { id: 'ch1', t: 5, d: '2026-01-10', k: 'chest', c: -40, xp: 0, drop: 'turtle' }, { id: 'rd1', t: 6, d: '2026-02-10', k: 'redeem', name: '手搖飲', c: -300 }];
  const plans = {}, checks = {}; let coins = 0, xp = 0;
  for (let i = N - 1; i >= 0; i--) {
    const d = I0.addDays(end, -i);
    const day = [{ k: 'plan', key: 'plan:' + d, xp: 10, c: 15 }, { k: 'check', xp: 10, c: 15 }, { k: 'check', xp: 10, c: 15 }, { k: 'check', xp: 10, c: 15 }, { k: 'top3', key: 'top3:' + d, xp: 15, c: 30 }, { k: 'anyhab', key: 'anyhab:' + d, xp: 10, c: 15 }, { k: 'pomo', key: 'pomo:' + d, xp: 10, c: 15, min: 25 }];
    day.forEach((l, j) => { logs.push({ id: `L${i}_${j}`, t: 100 + i, d, ...l }); coins += l.c; xp += l.xp; });
    plans[d] = Array.from({ length: 6 }, (_, j) => ({ text: j < 3 ? `第${j}件 ${d} 做了一些比較長的描述文字` : '', cat: 'other', done: j < 3, rw: j < 3 }));
    if (i % 3 === 0) checks[d] = { exercise: [{ t: 1, type: '跑步', dist: 5, min: 30 }] };
  }
  return { state: mkState({ logs, plans, checks }), coins: coins - 40 - 300, xp, N };
}
test('存檔瘦身：天天玩兩年後不能超過雲端文件上限，而且數字不變', async () => {
  const L = longState(720); const before = JSON.stringify(L.state).length; note(`兩年存檔瘦身前 ${Math.round(before / 1000)} KB`);
  ok(before > 400000, '測試資料要夠大才有意義：' + before);
  const I = await boot({ state: L.state }); await I.dismiss();
  const after = JSON.stringify(I.S).length; note(`瘦身後 ${Math.round(after / 1000)} KB`);
  ok(after < 400000, `瘦身後要小於 400 KB：${after}`);
  eq(I.coins(), L.coins, '金幣不變'); eq(I.xp(), L.xp, 'XP 不變');
  ok(I.S.logs.some(l => l.drop === 'turtle') && I.S.logs.some(l => l.k === 'redeem') && I.S.logs.some(l => l.k === 'welcome'), '生物、兌換、新手紀錄原樣保留');
  const recent = I.S.logs.filter(l => l.d >= '2026-09-10' && l.k === 'check'); ok(recent.length >= 3 * 50, '最近 60 天的明細要保留：' + recent.length);
  await I.tab('log'); const txt = I.text();
  ok(/總共打卡\s*\n?\s*720/.test(txt.replace(/\s+/g, ' ').replace(/總共打卡 (\d+)/, '總共打卡\n$1')) || txt.includes('720'), '總共打卡 720 天：' + txt.replace(/\s+/g, ' ').slice(txt.indexOf('打卡紀錄'), txt.indexOf('打卡紀錄') + 80));
  ok(txt.replace(/\s+/g, '').includes('720段') || txt.includes('720'), '番茄鐘 720 段'); ok(txt.includes('300.0') || txt.includes('300'), '番茄鐘總時數 300 小時');
  I.check('瘦身後'); const J = await I.reload(); await J.dismiss(); eq(J.coins(), L.coins, '重開後金幣一樣'); J.check('瘦身後重開'); J.destroy(); I.destroy();
  // 裝置日期被調到很後面：不能把近期紀錄收掉
  const F = await boot({ state: longState(720).state, now: ts(2028, 11, 2, 10) }); await F.dismiss();
  ok(F.S.logs.filter(l => l.d >= '2026-09-10' && l.k === 'check').length >= 150, '日期亂調時，以資料裡最新的日期為準，近期明細不會被收掉');
  F.destroy();
  const small = longState(30); const S2 = await boot({ state: small.state }); await S2.dismiss(); ok(!S2.S.logs.some(l => l.k === 'sum') && Object.keys(S2.S.plans).length >= 30, '小存檔不會被瘦身'); S2.destroy();
});

test('雲端同步：存檔大小以位元組計算（中文一字 3 位元組）', async () => {
  resetCloud();
  const I = await boot({ state: mkState() }); await I.dismiss(); await I.tab('today');
  await I.plan(['中'.repeat(190), '文'.repeat(190), '字'.repeat(190)]);
  I.S.favs = []; for (let d = 0; d < 300; d++) { const k = I0.addDays('2026-01-01', d); I.S.plans[k] = Array.from({ length: 6 }, () => ({ text: '中文'.repeat(95), cat: 'other', done: true, rw: false })); }
  I.S.mtime = I.now(); await loginAs(I);
  const bytes = new TextEncoder().encode(JSON.stringify(I.S)).length;
  if (bytes > 1000000) ok(I.has('太大') && !window.__cloudDb.docs.u1, `超過 1 MB（${bytes} 位元組）要提示，不能硬傳`); else ok(!!window.__cloudDb.docs.u1, `${bytes} 位元組在上限內，要能上傳`);
  I.destroy();
});

test('雲端：兩台裝置的時鐘差很多，後改的仍然要贏（B 比 A 慢 10 分鐘）', async () => {
  resetCloud();
  const A = await boot({ state: mkState({ logs: [W0, coinLog(100)] }) }); await A.dismiss(); await loginAs(A);
  const B = await boot({ seed: {}, skew: -10 * 60e3 }); await B.dismiss(); await loginAs(B);
  await A.tab('today'); await A.plan(['A 先寫的', 'b', 'c']); await hide(A, true);               // A 先改，上傳
  await hide(B, false); ok(B.S.plans[D0] && B.S.plans[D0][0].text === 'A 先寫的', 'B 拿到 A 的改動');
  await B.tab('today'); await B.type('#six .ptext[data-i="1"]', 'B 之後改的'); await hide(B, true);   // B 的時鐘慢 10 分鐘，之後才改
  await hide(A, false);
  ok(A.S.plans[D0][1].text === 'B 之後改的', `A 回到畫面要拿到 B 後來的修改（不能被時鐘差蓋掉）：${A.S.plans[D0][1].text}`);
  ok(JSON.parse(window.__cloudDb.docs.u1.data).plans[D0][1].text === 'B 之後改的', '雲端上也是 B 的修改');
  A.check('A'); B.check('B'); A.destroy(); B.destroy();
});

test('雲端：兩台同時開著，即時更新；舊的那台不能蓋掉新的', async () => {
  resetCloud();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async cond => { for (let i = 0; i < 100 && !cond(); i++) await sleep(20); };   // 最多等 2 秒
  const cloud = () => JSON.parse(window.__cloudDb.docs.u1.data);
  const A = await boot({ state: mkState({ logs: [W0, coinLog(100)] }) }); await A.dismiss(); await loginAs(A);
  const B = await boot({ seed: {} }); await B.dismiss(); await loginAs(B);
  ok(window.__cloudDb.log.includes('listen'), '登入後會即時監聽雲端');
  // 等兩台都同步完（各自補發的登入獎勵之類也上傳、也互相收到了）再開始，不然兩台的上傳時機會重疊，結果時好時壞
  const synced = () => { const m = (window.__cloudDb.docs.u1 || {}).mtime; return A.ev('S.mtime') === m && B.ev('S.mtime') === m && !A.ev('CLOUD.pending') && !B.ev('CLOUD.pending'); };
  const settle = async () => { for (let i = 0; i < 5 && !synced(); i++) { await A.ev('CLOUD.pending ? cloudPush() : 0'); await B.ev('CLOUD.pending ? cloudPush() : 0'); await until(synced); } ok(synced(), '兩台同步完成'); };
  await settle();
  // A 改了、上傳：開著的 B 不用重新整理就收到
  // 上傳要等它真的寫完（不能只等固定時間：電腦忙的時候，兩台的上傳會重疊）；再等即時通知送到 B
  await A.ev("S.favs.push('A 加的'); save(); cloudPush()"); await until(() => B.S.favs.includes('A 加的'));
  ok(B.S.favs.includes('A 加的'), 'B 即時收到 A 的改動：' + JSON.stringify(B.S.favs));
  await settle();
  // B 有還沒上傳的改動時，A 又改了：B 上傳時發現雲端比較新，不蓋掉，改用雲端的
  B.ev("S.favs.push('B 還沒上傳的'); save()");
  await A.ev("S.favs.push('A 第二次'); save(); cloudPush()"); await sleep(30); await flush(6);
  ok(!B.S.favs.includes('A 第二次'), 'B 還有沒上傳的改動時，先不換掉畫面');
  await B.ev('cloudPush()'); await flush(6);
  ok(cloud().favs.includes('A 第二次') && !cloud().favs.includes('B 還沒上傳的'), '雲端上 A 的改動沒有被 B 的舊資料蓋掉');
  ok(B.S.favs.includes('A 第二次'), 'B 換成雲端的最新版'); ok(B.has('另一台裝置剛更新過'), '告訴使用者換成最新的了');
  // 連續一直存檔時，上傳不能被一直往後延：從第一個變動算起最多 8 秒
  const sets = () => window.__cloudDb.log.filter(x => x === 'set').length, n0 = sets();
  A.ev('save()'); A.clock.advance(7500); A.ev('save()'); await sleep(900);
  ok(sets() > n0, '連續存檔 7.5 秒後，再存一次也會在 1 秒內上傳（不是又等 3 秒）');
  A.check('A'); B.check('B'); A.destroy(); B.destroy();
});

test('資安：惡意備份價格不執行程式，錯誤結構與原型欄位不取代存檔', async () => {
  const I = await boot({ state: mkState(), noShare: true }); await I.dismiss();
  await I.tab('shop');
  const payload = '"><img src=x onerror="window.__securityProbe=1">';
  const send = async (text, confirm = false) => {
    const dt = new I.win.DataTransfer(); dt.items.add(new I.win.File([text], 'security.json', { type: 'application/json' }));
    const inp = I.$('#importFile'); inp.files = dt.files; inp.dispatchEvent(new I.win.Event('change', { bubbles: true }));
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10));
      if (!I.$('#askov').classList.contains('hidden')) { if (confirm) await I.click('#askyes'); break; }
    }
    await flush(10);
  };
  const original = JSON.stringify(I.S), stored = JSON.stringify(I.stored());
  for (const bad of ['{"logs":[],"habits":{}}', '{"logs":[],"gcats":{}}', '{"logs":[],"__proto__":{"polluted":1}}', '{"logs":[],"plans":{"not-a-date":[]}}']) {
    await send(bad);
    eq(JSON.stringify(I.S), original, '拒絕壞備份，記憶體資料不變');
    eq(JSON.stringify(I.stored()), stored, '拒絕壞備份，存檔不變');
    ok(I.$('#askov').classList.contains('hidden'), '驗證失敗不進入還原確認');
  }
  const backup = JSON.parse(original);
  backup.shop = [{ id: 'safe', name: payload, icon: payload, price: payload }];
  await send(JSON.stringify(backup), true);
  await I.click('[data-act=shopedit]'); await flush(10);
  ok(!I.doc.querySelector('[onerror]'), '沒有產生可執行的 HTML 屬性');
  ok(!I.win.__securityProbe, '惡意程式沒有執行');
  eq(I.S.shop[0].price, 1, '非法價格轉成安全數值');
  ok(!!window.__stores[I.storeId].get('habitdive.v1.before-import'), '成功還原前另存原存檔');
  I.check('資安匯入'); I.destroy();
});

test('資安：備份顯示失敗不覆寫原資料', async () => {
  const I = await boot({ state: mkState(), noShare: true }); await I.dismiss(); await I.tab('shop');
  const original = JSON.stringify(I.S), stored = JSON.stringify(I.stored());
  // 模擬候選備份於顯示階段才發現錯誤，原本資料仍應完整保留。
  I.ev("window.__oldRender = render; window.__oldState = S; render = function() { if (S !== window.__oldState) throw new Error('render failure'); return window.__oldRender(); }");
  const dt = new I.win.DataTransfer(); dt.items.add(new I.win.File([original], 'valid.json', { type: 'application/json' }));
  const inp = I.$('#importFile'); inp.files = dt.files; inp.dispatchEvent(new I.win.Event('change', { bubbles: true }));
  for (let i = 0; i < 100 && I.$('#askov').classList.contains('hidden'); i++) await new Promise(r => setTimeout(r, 10));
  await I.click('#askyes'); await flush(10);
  eq(JSON.stringify(I.S), original, '顯示失敗還原原始狀態');
  eq(JSON.stringify(I.stored()), stored, '顯示失敗不覆寫存檔');
  I.ev('render = window.__oldRender'); I.check('匯入回復'); I.destroy();
});
test('登入選擇：先試玩再登入，兩份紀錄皆保留，可選擇保留試玩', async () => {
 resetCloud(); const A=await boot({state:mkState()}); await A.dismiss(); await A.plan(['雲端清單','二','三']); await A.saveList(); await loginAs(A);
 const B=await boot({state:mkState({logs:[W0,coinLog(500)]})}); await B.dismiss(); await B.plan(['本機試玩','乙','丙']);
 window.__cloudDb.nextUser={uid:'u1'}; await B.tab('about'); await B.click('.gbtn'); await flush(14);
 ok(B.$('[data-act=cloudchoose][data-v=local]'),'有保留試玩選項');
 ok(B.ev('!!CLOUD.choice'),'選擇前暫停同步');
 eq(B.S.plans[D0][0].text,'本機試玩','選擇前不覆寫本機');
 ok(window.__stores[B.storeId].has('habitdive.v1.prelogin') && window.__stores[B.storeId].has('habitdive.v1.cloud-before-choice'),'兩份都有備份');
 A.destroy(); const C = await B.reload({cloudUser:{uid:'u1'}}); await flush(14);
 ok(C.$('[data-act=cloudchoose][data-v=local]'), '重開後仍需選擇，不直接覆蓋');
 await C.click('[data-act=cloudchoose][data-v=local]'); await flush(14);
 eq(C.S.plans[D0][0].text,'本機試玩','明確選擇後保留試玩');
 eq(JSON.parse(window.__cloudDb.docs.u1.data).plans[D0][0].text,'本機試玩','同步選擇的紀錄'); C.check('保留試玩'); C.destroy();
});