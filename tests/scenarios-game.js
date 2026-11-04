// 遊戲系統：番茄鐘、寶箱、商店、升級、水族箱、圖鑑、運動紀錄、連勝與日期
const W0 = { id: 'w0', t: 1, d: '2026-10-01', k: 'welcome', key: 'welcome', c: 0, xp: 0 };
const base = (...logs) => mkState({ logs: [W0, ...logs] });
const drops = (ids, d = '2026-10-02') => ids.map((id, i) => ({ id: 'dr' + i + id, t: 1000 + i, d, k: 'chest', drop: id, c: 0, xp: 0 }));
const coinLog = n => ({ id: 'coin' + n, t: 2, d: '2026-10-02', k: 'bonus', c: n, xp: 0 });
function stubRandom(I, seq, rest = 0.5) { const orig = I.win.Math.random; I.win.Math.random = () => seq.length ? seq.shift() : rest; return () => { I.win.Math.random = orig; }; }

test('番茄鐘：開始→專注畫面蓋住遊戲→25 分鐘拿獎勵→第二次沒有', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click('[data-act=start]');
  ok(!I.$('#focus').classList.contains('hidden'), '專注畫面要出現');
  const why = I.blocked(I.$('#nav button')); ok(why && why.includes('focus'), '專注時分頁按鈕要被蓋住點不到：' + why);
  await I.advance(70e3);   // 開始超過一分鐘：結束要先確認（一分鐘內按結束不用確認，另有測驗）
  await I.click('#focus [data-act=cancel]', {}); ok(!I.$('#askov').classList.contains('hidden'), '結束要先確認');
  await I.click('#askno'); ok(I.S.timer, '按取消，計時繼續');
  await I.advance(23 * 60e3 + 20e3); ok(I.S.timer && I.S.logs.every(l => l.k !== 'pomo'), '24.5 分鐘還沒完成');
  await I.advance(40e3); await I.dismiss();
  ok(!I.S.timer, '25 分鐘後計時結束'); ok(I.S.logs.some(l => l.key === 'pomo:' + D0 && l.pend), '拿到番茄鐘獎勵（待領取）');
  ok(I.$('#focus').classList.contains('hidden'), '專注畫面消失');
  await I.click('[data-act=start]'); await I.advance(26 * 60e3); await I.dismiss();
  eq(I.S.logs.filter(l => l.k === 'pomo').length, 2, '第二段照樣記錄'); eq(I.S.logs.filter(l => l.key === 'pomo:' + D0).length, 1, '但獎勵只有一份');
  I.check('番茄鐘'); I.destroy();
});

test('番茄鐘：90 分鐘分段、跳過休息、中途重開、離開很久回來', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click('[data-act=pomoset][data-v="90"]'); await I.click('[data-act=start]');
  const segs = I.S.timer.segs.map(s => s.m[0] + s.min).join(','); eq(segs, 'f25,b5,f25,b5,f30', '90 分鐘的分段');
  await I.advance(25 * 60e3 + 5e3); await I.dismiss();
  ok(I.has('休息'), '專注完進入休息畫面'); await I.click('#focus [data-act=skipbreak]');
  eq(I.S.timer.si, 2, '跳過休息直接進下一段專注');
  const J = await I.reload(); await J.dismiss(); ok(!J.$('#focus').classList.contains('hidden'), '重開後還在專注中');
  const left = J.$('#tclock').innerText; ok(/^\d\d:\d\d$/.test(left), '時間顯示格式：' + left);
  await J.advance(5 * 3600e3); await J.dismiss();     // 離開 5 小時
  ok(!J.S.timer, '離開很久回來，計時已結束'); eq(J.S.logs.filter(l => l.k === 'pomo').length, 3, '三段專注都有記錄');
  J.check('離開很久'); J.destroy(); I.destroy();
});

test('番茄鐘：自訂分鐘的各種輸入', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click('[data-act=pomocustom]');
  for (const [v, exp] of [['4', 25], ['121', 25], ['', 25], ['abc', 25], ['35', 35], ['37.5', 38], ['120', 120], ['5', 5]]) {
    await I.type('#pomoMin', v);
    const got = I.win.eval('pomoMin()'); ok(got === exp || (v === '37.5' && (got === 38 || got === 37)) , `自訂「${v}」→ ${got}（預期 ${exp}）`);
  }
  await I.click('[data-act=start]'); ok(I.S.timer.segs.reduce((a, s) => a + s.min, 0) === 5, '5 分鐘的工作階段');
  await I.advance(6 * 60e3); await I.dismiss(); ok(!I.S.timer, '5 分鐘結束');
  ok(!I.S.logs.some(l => l.key === 'pomo:' + D0), '不滿 25 分鐘沒有獎勵');
  I.check('自訂分鐘'); I.destroy();
});

test('番茄鐘：系統時間被往回調時不會卡很久', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click('[data-act=start]');
  await I.setTime(T0 - 3 * 3600e3);       // 手動把時鐘調早 3 小時
  const txt = I.$('#tclock').innerText, mins = +txt.split(':')[0];
  ok(mins <= 25, `時鐘往回調後，倒數不應超過 25 分鐘，現在顯示 ${txt}`);
  I.destroy();
});

test('升級：彈窗、稱號、只慶祝一次、超大等級', async () => {
  const I = await boot({ state: mkState({ logs: [W0, coinLog(0), { id: 'x1', t: 5, d: '2026-10-05', k: 'bonus', xp: 35, c: 0 }, { id: 'p1', t: 9, d: D0, k: 'plan', key: 'plan:' + D0, xp: 10, c: 15, pend: true }] }) });
  await I.dismiss(); await I.claimAll();
  eq(I.ev('levelOf(derive().xp)'), 3, '45 XP = Lv.3');
  const sawTitle = I.S.lvSeen === 3; ok(sawTitle, '記下已慶祝到 Lv.3');
  const J = await I.reload(); ok(J.$('#ov').classList.contains('hidden'), '重開不會再跳升級彈窗');
  await J.tab('log'); ok(!J.$('.ranks'), '稱號一覽預設收起來');
  await J.click('[data-act=ranks]'); const rk = J.$$('.rk');
  eq(rk.length, J.ev('RANKS.length'), '每個稱號都列出來');
  ok(rk.every(e => e.querySelector('p').innerText.trim().length > 10), '每個稱號都有介紹');
  eq(J.$$('.rk.got').length, 1, 'Lv.3：浮潛客已拿到'); ok(J.$('.rk.cur').innerText.includes('體驗潛水員'), 'Lv.3：現在是體驗潛水員');
  eq(J.$$('.rk.lock').length, rk.length - 2, '其他還鎖著'); ok(J.$('.rkbtn').innerText.includes('2 / '), '按鈕寫已拿到 2 個');
  J.check('稱號一覽'); await J.click('[data-act=ranks]'); ok(!J.$('.ranks'), '再按一次收起來'); J.destroy();
  const K = await boot({ state: mkState({ logs: [W0, coinLog(0), { id: 'p1', t: 9, d: D0, k: 'plan', key: 'plan:' + D0, xp: 100000, c: 15, pend: true }] }) });
  await K.dismiss(); await K.tab('quest'); await K.click('.qall'); ok(K.has('Lv.'), '超大等級彈窗有顯示'); K.check('升級彈窗'); await K.dismiss();
  for (const t of ['today', 'quest', 'tank', 'shop', 'log', 'about']) { await K.tab(t); K.check('Lv.' + K.ev('levelOf(derive().xp)') + ' ' + t); }
  K.destroy(); I.destroy();
});

test('寶箱：五種價格、稀有度、重複換金幣', async () => {
  const I = await boot({ state: base(coinLog(5000)) }); await I.dismiss(); await I.tab('shop');
  const exp = [[0, 'clown', 40, 2], [1, 'turtle', 100, 5], [2, 'seahorse', 250, 15], [3, 'manta', 600, 40], [4, 'whaleshark', 1500, 100]];
  const rest = stubRandom(I, [], 0);
  for (const [i, id, price, dup] of exp) {
    rest(); const un = stubRandom(I, [0.5, 0.99, 0, 0]);
    const c0 = I.coins(); await I.click(`[data-act=buychest][data-v=c${i}]`); await I.dismiss(); un();
    eq(I.coins(), c0 - price, `${price} 金幣的寶箱：第一次扣 ${price}`);
    ok(I.ev('derive().col')[id] === 1, `c${i} 開出 ${id}：` + JSON.stringify(I.ev('derive().col')));
    const un2 = stubRandom(I, [0.5, 0.99, 0, 0]); const c1 = I.coins(); await I.click(`[data-act=buychest][data-v=c${i}]`); await I.dismiss(); un2();
    eq(I.coins(), c1 - price + dup, `重複的${id}要退 ${dup} 金幣`);
    I.check('寶箱 c' + i);
  }
  I.destroy();
});

test('寶箱：普通寶箱的飼料機率；金幣不夠不能買', async () => {
  const I = await boot({ state: base(coinLog(100)) }); await I.dismiss(); await I.tab('shop');
  const un = stubRandom(I, [0.5, 0]);
  await I.click('[data-act=buychest][data-v=c0]'); ok(I.has('飼料'), '開出飼料的畫面'); await I.dismiss(); un();
  eq(I.S.feed, 5, '飼料 +5 顆'); eq(I.coins(), 60, '扣 40 金幣');
  ok(/消費紀錄[\s\S]*普通寶箱[\s\S]*-40/.test(I.$('#main').innerText) && !/普通寶箱\s*→/.test(I.$('#main').innerText), '消費紀錄有這次買寶箱，但不寫抽到什麼');
  ok(!I.S.logs.some(l => l.drop && l.k === 'chest'), '開出飼料就沒有生物');
  eq(I.$('[data-act=buychest][data-v=c1]').disabled, true, '60 金幣買不起少見寶箱（按鈕停用）');
  ok(!(await I.tryClick('[data-act=buychest][data-v=c1]')), '停用的按鈕點不下去');
  const draws = {};
  for (let r = 0; r < 5; r++) for (let n = 0; n < 400; n++) { const c = I.ev(`rollCreature(CONFIG.chests[${r}].rates)`); (draws[r] = draws[r] || {})[c.id] = c.r; }
  for (let r = 0; r < 5; r++) { const ids = Object.keys(draws[r]); ok(Object.values(draws[r]).every(x => x === r), `寶箱 ${r} 只會開出稀有度 ${r}`); const pool = I.ev('CREATURES').filter(c => c.r === r).length; eq(ids.length, pool, `寶箱 ${r} 每一種（${pool}）都抽得到`); }
  I.check('飼料'); I.destroy();
});

test('寶箱：同種超過 5 隻要選一隻放生', async () => {
  const I = await boot({ state: base(coinLog(500), ...drops(['clown', 'clown', 'clown', 'clown', 'clown'])) }); await I.dismiss(); await I.tab('shop');
  const un = stubRandom(I, [0.5, 0.99, 0, 0]); await I.click('[data-act=buychest][data-v=c0]'); un();
  await I.click('[data-act=openchest]'); await I.click('#modal [data-act=close]');
  ok(I.has('已經有 5 隻了'), '第 6 隻要出現放生選單：' + I.$('#modal').innerText.slice(0, 40));
  eq(I.$$('#modal [data-act=releasepick]').length, 6, '六隻都列出來');
  const pickNew = I.$$('#modal .entry').find(e => e.innerText.includes('新抽到')); ok(pickNew, '標出哪一隻是新抽到的');
  await I.click(pickNew.querySelector('[data-act=releasepick]'));
  eq(I.ev("pets('clown').length"), 5, '放生後剩 5 隻'); ok(I.$('#ov').classList.contains('hidden'), '放生完彈窗關閉');
  I.check('放生'); I.destroy();
});

test('獎勵商店：兌換、編輯、價格與名稱的怪輸入、XSS', async () => {
  const I = await boot({ state: base(coinLog(299)) }); await I.dismiss(); await I.tab('shop');
  ok(!I.$('[data-act=redeem]'), '299 金幣買不起 300 的手搖飲');
  I.S.logs.push({ id: 'c1', t: 3, d: '2026-10-02', k: 'bonus', c: 1, xp: 0 }); I.win.render();
  await I.click('[data-act=redeem]'); ok(!I.$('#askov').classList.contains('hidden'), '兌換要先確認');
  await I.click('#askno'); eq(I.coins(), 300, '取消不扣金幣');
  await I.click('[data-act=redeem]'); await I.click('#askyes'); eq(I.coins(), 0, '兌換扣 300'); ok(I.has('喝一杯手搖飲'), '兌換紀錄有寫');
  I.S.logs.push(coinLog(10000)); I.win.render();
  await I.click('[data-act=shopedit]');
  await I.click('[data-act=shopadd]'); const idx = I.$$('[data-sf=name]').length - 1;
  await I.type(`[data-sf=name][data-si="${idx}"]`, '<img src=x onerror=window.__xss=1>');
  await I.type(`[data-sf=icon][data-si="${idx}"]`, '"><b>');
  await I.type(`[data-sf=price][data-si="${idx}"]`, '-5');
  await I.click('[data-act=shopadd]'); await I.type(`[data-sf=price][data-si="${idx + 1}"]`, '0');      // 沒名字，要被丟掉
  await I.click('[data-act=shopadd]'); await I.type(`[data-sf=name][data-si="${idx + 2}"]`, '小數'); await I.type(`[data-sf=price][data-si="${idx + 2}"]`, '12.6');
  await I.click('[data-act=shopadd]'); await I.type(`[data-sf=name][data-si="${idx + 3}"]`, '很貴'); await I.type(`[data-sf=price][data-si="${idx + 3}"]`, '1e9');
  await I.click('[data-act=shopdone]');
  ok(!I.win.__xss, 'XSS：獎勵名稱'); ok(!I.$('#main img[src=x]'), '獎勵名稱裡的 HTML 不能變成元素');
  const names = I.ev('shopItems()').map(x => `${x.name}:${x.price}`);
  ok(names.some(n => n.endsWith(':1') && n.includes('<img')), '負價錢要變成 1：' + names.join('|'));
  ok(names.includes('小數:13'), '小數要四捨五入：' + names.join('|')); ok(!names.some(n => n.startsWith(':')), '沒名字的要被丟掉');
  ok(I.has('很貴'), '超大價錢也要能顯示'); I.check('商店編輯');
  for (let n = 0; n < 7; n++) { await I.click(`[data-act=redeem][data-v="${I.ev('shopItems()').find(x => x.price <= I.coins()).id}"]`); await I.click('#askyes'); }
  const rows = I.$$('#main section:last-child .row').length; ok(rows <= 5, '消費紀錄最多 5 筆：' + rows);
  I.check('兌換很多次'); I.destroy();
});

test('水族箱：撒飼料、成長、設定、放生、圖鑑', async () => {
  const all = I => I.win.CREATURES.map(c => c.id);
  const I = await boot({ state: base(coinLog(500), ...drops(['clown', 'star', 'whaleshark', 'jelly', 'manta'])) }); await I.dismiss();
  await I.tab('tank'); await flush(); await new Promise(r => setTimeout(r, 600));
  const fish = () => I.ev('TANK.fish'); eq(fish().length, 5, '五隻都在水族箱裡');
  const W = I.ev('TANK.W'), H = I.ev('TANK.H');
  for (const f of fish()) ok(f.x >= 0 && f.x <= W - f.w + 1 && f.y >= -2 && f.y <= H, `${f.c.id} 在水族箱範圍內 (${f.x | 0},${f.y | 0})`);
  // 撒飼料：先用免費 3 顆，再用買的，再沒有
  const cv = I.$('#tank'); const r = cv.getBoundingClientRect();
  const drop = async () => { cv.dispatchEvent(new I.win.MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 })); await flush(); };
  for (let i = 0; i < 3; i++) await drop(); eq(I.S.feedDay.used, 3, '免費飼料用掉 3 顆');
  await drop(); ok(I.has('飼料用完了'), '沒飼料了要提示');
  await I.click('[data-act=buyfeed]'); eq(I.S.feed, 10, '買 10 顆'); eq(I.coins(), 470, '扣 30 金幣');
  await drop(); eq(I.S.feed, 9, '用了買的飼料');
  // 讓小丑魚吃到飼料：直接把飼料放在牠身上
  I.ev("S.fed = S.fed || {}; S.fed[Object.keys(S.fed)[0] || 'dr0clown'] = 9; S.fed['dr0clown'] = 9");
  const f0 = fish().find(f => f.key === 'dr0clown');
  I.ev("TANK.fish = TANK.fish.filter(f => f.key === 'dr0clown')");   // 別隻（例如大的鯨鯊）剛好游到同一個位置會搶先吃掉，結果就不固定了
  I.ev(`TANK.food.push({ x: ${f0.x + 1}, y: ${f0.y + 1}, vy: 0, age: 0 })`);
  await new Promise(r => setTimeout(r, 400));
  ok(I.S.fed['dr0clown'] >= 10, '吃到飼料 fed=' + I.S.fed['dr0clown']);
  ok(I.ev("stageOf(fedOf('dr0clown'))") >= 2, '吃滿 10 顆長成成體'); ok(I.S.seen && I.S.seen.clown >= 2, '圖鑑記下看過成體');
  I.check('餵魚');
  await I.click('[data-act=tankedit]'); await I.click('[data-act=intank][data-v="dr1star"]');
  ok(I.S.outTank.dr1star, '取消勾選 = 不放進水族箱'); await I.click('[data-act=tankdone]'); await new Promise(r => setTimeout(r, 200));
  eq(fish().length, 4, '水族箱少一隻');
  await I.click('[data-act=tankedit]'); await I.click('[data-act=release][data-v="dr2whaleshark"]'); await I.click('#askyes'); await I.click('[data-act=tankdone]');
  ok(I.S.released.dr2whaleshark, '放生'); ok(I.ev('derive().col').whaleshark === 1, '放生後圖鑑還在');
  await I.click('[data-act=tankview][data-v=dex]'); ok(I.has('水下生物圖鑑'), '圖鑑'); ok(I.has('4 / 20') || I.has('5 / 20'), '圖鑑收集數');
  await I.click('.dex .cell:not(.no)'); ok(!I.$('#sheetov').classList.contains('hidden'), '點生物看介紹');
  I.doc.dispatchEvent(new I.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ok(I.$('#sheetov').classList.contains('hidden'), 'Esc 關閉介紹');
  await I.click('.dex .cell:not(.no)'); await I.click('#sheetov', { force: true }); ok(I.$('#sheetov').classList.contains('hidden'), '點外面關閉介紹');
  I.check('水族箱'); I.destroy();
});

test('水族箱：游動平順（速度不會突然跳、位置對到裝置像素）', async () => {
  const I = await boot({ state: mkState({ logs: [W0, coinLog(100), ...drops(['clown', 'damsel', 'shark', 'jelly', 'manta', 'star', 'hermit'])] }) }); await I.dismiss();
  await I.tab('tank'); await flush();
  const cv = I.$('#tank'), W = I.ev('TANK.W');
  ok(cv.width >= W * 3 && cv.width % W === 0, `畫布是高解析度（${cv.width} 寬 / 遊戲 ${W} 格）`);
  const worst = {}, last = {}; let moved = 0;
  for (let n = 0; n < 150; n++) {   // 約 2.5 秒，每一格都量
    await new Promise(r => setTimeout(r, 16));
    for (const f of I.ev('TANK.fish.map(f => ({ id: f.c.id, x: f.x, mx: f.mx, my: f.my }))')) {
      ok(Number.isFinite(f.mx) && Number.isFinite(f.my), f.id + ' 有速度值');
      const p = last[f.id]; if (p) { worst[f.id] = Math.max(worst[f.id] || 0, Math.abs(f.mx - p.mx), Math.abs(f.my - p.my)); if (f.x !== p.x) moved++; }
      last[f.id] = f;
    }
  }
  ok(moved > 0, '魚有在動');
  for (const [id, d] of Object.entries(worst)) ok(d < .12, `${id} 速度每格變化不超過 .12（最大 ${d.toFixed(3)}），不會忽快忽慢或瞬間掉頭`);
  I.check('游動平順'); I.destroy();
});

test('水族箱：20 種 × 5 隻全部放進去也不會壞', async () => {
  const ids = []; for (const c of ['clown','damsel','butterfly','star','hermit','urchin','turtle','octopus','nudi','lion','puffer','cuttle','seahorse','shark','moray','jelly','manta','mola','dolphin','whaleshark']) for (let k = 0; k < 5; k++) ids.push(c);
  const I = await boot({ state: mkState({ logs: [W0, coinLog(100), ...drops(ids)], fed: Object.fromEntries(ids.map((c, i) => ['dr' + i + c, i % 3 === 0 ? 30 : i % 3 === 1 ? 10 : 0])) }) }); await I.dismiss();
  await I.tab('tank'); await new Promise(r => setTimeout(r, 900));
  eq(I.ev('TANK.fish.length'), 100, '100 隻');
  const W = I.ev('TANK.W'); let off = 0; for (const f of I.ev('TANK.fish')) if (f.x < -1 || f.x > W - f.w + 2 || !Number.isFinite(f.x) || !Number.isFinite(f.y)) off++;
  eq(off, 0, '沒有生物跑出水族箱或變成 NaN');
  I.check('100 隻'); await I.click('[data-act=tankedit]'); I.check('100 隻設定頁'); await I.click('[data-act=tankdone]');
  await I.click('[data-act=tankview][data-v=dex]'); I.check('圖鑑全收集'); ok(I.has('20 / 20'), '圖鑑 20/20');
  for (const c of I.$$('.dex .cell')) { c.click(); await flush(2); if (!I.$('#sheetov').classList.contains('hidden')) { I.check('介紹 ' + c.dataset.v); I.doc.dispatchEvent(new I.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } }
  I.destroy();
});

test('水族箱：視窗大小改變（手機轉橫向）後畫面不能變形', async () => {
  const I = await boot({ state: base(coinLog(0), ...drops(['clown', 'shark'])), width: 375, height: 700 }); await I.dismiss();
  await I.tab('tank'); await new Promise(r => setTimeout(r, 300));
  const asp = () => { const c = I.$('#tank'); return [c.width / c.height, c.clientWidth / c.clientHeight]; };
  let [a, b] = asp(); ok(Math.abs(a - b) / b < 0.06, `直式：畫布比例 ${a.toFixed(2)} 要接近畫面比例 ${b.toFixed(2)}`);
  I.resize(760, 360); I.win.dispatchEvent(new I.win.Event('resize')); await new Promise(r => setTimeout(r, 600));
  [a, b] = asp(); ok(Math.abs(a - b) / b < 0.06, `轉橫向後：畫布比例 ${a.toFixed(2)} 要接近畫面比例 ${b.toFixed(2)}（否則生物會被拉扁）`);
  I.destroy();
});

test('運動紀錄：各種運動、怪數字、補登昨天', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click(['#habits .hab', '運動']);
  await I.type('#exType', '跑步'); await I.type('#ex_dist', '5'); await I.type('#ex_min', '30'); ok(I.has("配速 6'00\"/km"), '跑步配速：' + I.$('#exPace').innerText);
  await I.click('[data-act=exadd]'); ok(I.has('跑步・5 km・30 分'), '紀錄文字');
  await I.type('#exType', '游泳'); await I.type('#ex_m', '200'); await I.type('#ex_min', '10'); ok(I.has("配速 5'00\"/100m"), '游泳配速：' + I.$('#exPace').innerText);
  await I.click('[data-act=exadd]');
  await I.type('#exType', '潛水'); await I.type('#ex_depth', '18'); await I.type('#ex_site', '<b>Manta Point</b>'); await I.type('#ex_note', '看到 5 隻');
  await I.click('[data-act=exadd]'); ok(!I.$('#sheet .entry b'), '潛點裡的 HTML 要跳脫');
  for (const bad of ['-5', '0', '1e999', '99999999999999999999']) {
    await I.type('#exType', '跑步'); await I.type('#ex_dist', bad); await I.type('#ex_min', bad); await I.click('[data-act=exadd]');
    I.check('輸入 ' + bad);
  }
  const txt = I.$('#sheet').innerText; ok(!/-5 km|-5 分|Infinity|e\+/.test(txt), '負數、無限大、科學記號不能直接出現在紀錄裡：' + txt.replace(/\n/g, ' ').slice(0, 200));
  await I.type('#exType', '登山'); await I.type('#ex_dist', '12.3'); await I.type('#ex_gain', '800'); await I.click('[data-act=exadd]');
  await I.click('[data-act=shday][data-v="-1"]'); await I.type('#exType', '重訓'); await I.type('#ex_min', '45');
  const rBefore = I.S.logs.length; await I.click('[data-act=exadd]');
  eq(I.S.logs.length, rBefore, '補登昨天沒有獎勵'); ok(I.S.checks['2026-11-01'] && I.S.checks['2026-11-01'].exercise.length === 1, '紀錄記在昨天');
  const n = I.$$('#sheet [data-act=chkdel]').length; await I.click('#sheet [data-act=chkdel]'); ok(I.S.checks['2026-11-01'] === undefined, '刪掉昨天唯一的紀錄後，那天的資料夾也清掉');
  I.check('運動紀錄'); I.destroy();
});

test('連勝：每天習慣漏一天不斷、連漏兩天歸零；每週習慣漏一週就斷', async () => {
  const mk = days => Object.fromEntries(days.map(d => [d, { h1: [{ t: 1 }] }]));
  const hab = { id: 'h1', n: '看書', kind: 'custom', weeks: 0, target: 1 };
  const streakOf = async checks => { const I = await boot({ state: mkState({ habits: [{ id: 'vocus', n: 'Vocus', kind: 'vocus', weeks: 1, target: 1 }, { id: 'exercise', n: '運動', kind: 'exercise', weeks: 1, target: 3 }, hab], checks }) }); await I.dismiss(); const s = I.ev('streaks(derive()).h1'); I.destroy(); return s; };
  eq((await streakOf(mk(['2026-11-02', '2026-11-01', '2026-10-31']))).n, 3, '連續 3 天');
  eq((await streakOf(mk(['2026-11-02', '2026-10-31', '2026-10-30']))).n, 3, '中間漏一天不算斷（3 天）');
  eq((await streakOf(mk(['2026-11-02', '2026-10-30', '2026-10-29']))).n, 1, '連漏兩天就斷：只剩今天');
  const t = await streakOf(mk(['2026-11-01', '2026-10-31'])); eq(t.n, 2, '今天還沒做：昨天前天仍算 2');
  eq((await streakOf(mk(['2026-10-25']))).n, 0, '很久以前做過的不算');
});

test('日期工具：跨年、閏日、週與兩週期間', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  const e = c => I.ev(c);
  eq(e("addDays('2026-12-31', 1)"), '2027-01-01', '跨年'); eq(e("addDays('2028-02-28', 1)"), '2028-02-29', '閏日'); eq(e("addDays('2028-02-29', 1)"), '2028-03-01', '閏日後');
  eq(e("addDays('2026-03-01', -1)"), '2026-02-28', '往前一天');
  let bad = [];
  for (let i = 0; i < 800; i++) {
    const d = e(`addDays('2026-01-01', ${i})`), w = e(`weekKey('${d}')`), p = e(`periodKey('${d}', 2)`);
    const wd = e(`parseKey('${w}').getDay()`); if (wd !== 1) bad.push(`weekKey(${d})=${w} 不是週一`);
    const diff = e(`Math.round((parseKey('${d}') - parseKey('${w}')) / 864e5)`); if (diff < 0 || diff > 6) bad.push(`${d} 距離週一 ${diff}`);
    const pd = e(`Math.round((parseKey('${d}') - parseKey('${p}')) / 864e5)`); if (pd < 0 || pd > 13) bad.push(`${d} 距離兩週期間開頭 ${pd}`);
    if (e(`parseKey('${p}').getDay()`) !== 1) bad.push(`兩週期間 ${p} 不是週一`);
  }
  eq(bad.slice(0, 5), [], '800 天的週期計算都正確'); I.destroy();
});

test('紀錄頁統計：目前連續、最長連續、總共打卡', async () => {
  // 打卡的日子：今天、昨天、前天（連續 3），然後空一天，再往前 4 天（連續 4，最長）
  const days = ['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26'];
  const checks = Object.fromEntries(days.map(d => [d, { exercise: [{ t: 1, type: '跑步', dist: 3, min: 20 }] }]));
  const I = await boot({ state: mkState({ checks }) }); await I.dismiss(); await I.tab('log');
  const t = I.text().replace(/\s+/g, ' ');
  ok(/目前連續 3 天/.test(t), '目前連續 3 天：' + t.slice(t.indexOf('目前連續'), t.indexOf('目前連續') + 40));
  ok(/最長連續 4 天/.test(t), '最長連續 4 天（10/26–10/29 被中間隔開）：' + t.slice(t.indexOf('最長連續'), t.indexOf('最長連續') + 40));
  ok(/總共打卡 7 天/.test(t), '總共 7 天');
  I.check('統計'); I.destroy();
  // 今天還沒做：昨天以前的連續照算
  const J = await boot({ state: mkState({ checks: Object.fromEntries(days.slice(1, 3).map(d => [d, { exercise: [{ t: 1, type: '跑步' }] }])) }) }); await J.dismiss(); await J.tab('log');
  ok(/目前連續 2 天/.test(J.text().replace(/\s+/g, ' ')), '今天還沒打卡：昨天前天 = 連續 2 天'); J.destroy();
});

test('習慣：頻率與目標中途修改、自訂習慣每週目標的獎勵', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click('#habits [data-act=habedit]'); await I.click('[data-act=habadd]');
  const hi = I.S.habits.length - 1; await I.type(`[data-hf=n][data-hi="${hi}"]`, '看書'); await I.type(`[data-hf=weeks][data-hi="${hi}"]`, '1'); await I.type(`[data-hf=target][data-hi="${hi}"]`, '2');
  await I.click('[data-act=habdone]');
  ok(I.has('這週') || I.has('本週 0/2'), '卡片顯示每週 0/2：' + I.$('#habits').innerText.replace(/\n/g, ' '));
  const id = I.S.habits[hi].id;
  await I.click(['#habits .hab', '看書']); await I.click('[data-act=chk]'); await I.dismiss(); await I.click('#sheet [data-act=sheetclose]').catch(() => {});
  ok(I.S.logs.some(l => l.key === `hab:${id}:${D0}`), '每次打卡有獎勵');
  ok(!I.S.logs.some(l => l.key && l.key.startsWith(`per:${id}:`)), '1/2 還沒達標');
  await I.advance(24 * 3600e3); await I.dismiss(); await I.tab('today');
  await I.click(['#habits .hab', '看書']); await I.click('[data-act=chk]'); await I.dismiss(); await I.click('#sheet [data-act=sheetclose]').catch(() => {});
  ok(I.S.logs.some(l => l.key && l.key.startsWith(`per:${id}:`)), '第 2 次達標，拿到週目標獎勵：' + I.S.logs.map(l => l.key).filter(Boolean).join('|').slice(-120));
  eq(I.S.logs.filter(l => l.key && l.key.startsWith(`per:${id}:`)).length, 1, '只有一份');
  // 把目標改成 3：已領的達標獎勵不收回、卡片顯示 2/3
  await I.click('#habits [data-act=habedit]'); await I.type(`[data-hf=target][data-hi="${hi}"]`, '3'); await I.click('[data-act=habdone]');
  ok(I.S.logs.some(l => l.key && l.key.startsWith(`per:${id}:`)), '已經領走的達標獎勵不會因為改目標被收回'); ok(I.has('2/3'), '顯示 2/3');
  I.check('習慣目標'); I.destroy();
});

test('任務頁：進度數字在各種狀態下都對（每日 4 項＋習慣）', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss(); await I.tab('quest');
  const read = () => { const m = I.$('#main section .qcnt').innerText.match(/(\d+)\/(\d+)/); return [+m[1], +m[2]]; };
  eq(read(), [0, 4], '一開始 0/4');
  await I.tab('today'); await I.plan(['A', 'B', 'C']); await I.saveList(); await I.tab('quest'); eq(read(), [1, 4], '寫好清單 1/4');
  await I.tab('today'); await I.tick(0); await I.tick(1); await I.tick(2); await I.tab('quest'); eq(read(), [2, 4], '清單、前三件 = 2/4（全部完成加碼併在前三件那一列）');
  I.destroy();
});

test('幫魚取名字：存檔、顯示、放生、亂輸入', async () => {
  const I = await boot({ state: base(coinLog(500), ...drops(['clown', 'clown', 'star'])) }); await I.dismiss();
  const id1 = 'dr0clown', id2 = 'dr1clown';
  await I.tab('tank'); await flush();
  await I.click('[data-act=tankedit]');
  const inp = id => I.$(`input[data-nf="${id}"]`);
  ok(!I.$('input[data-nf]'), '平常不顯示名字欄');
  ok(['dr0clown', 'dr1clown', 'dr2star'].every(id => I.$(`[data-act=petname][data-v="${id}"]`)), '每一隻都有「取名」按鈕');
  const nameIt = async (id, v) => { await I.click(`[data-act=petname][data-v="${id}"]`); await I.type(inp(id), v); };
  await I.click(`[data-act=petname][data-v="${id1}"]`);
  ok(I.$$('input[data-nf]').length === 1 && I.doc.activeElement === inp(id1), '點了才出現，而且游標已經在裡面');
  ok(inp(id1).getAttribute('aria-label') && inp(id1).maxLength === 10, '名字欄有名稱、限 10 字');
  await I.type(inp(id1), '  小橘  '); eq(I.S.names[id1], '小橘', '存起來並去掉前後空白');
  await nameIt(id2, '一二三四五六七八九十十一十二'); eq(I.S.names[id2].length, 10, '超過 10 字會截斷');
  await nameIt('dr2star', '<img src=x onerror=window.__xss=1>'); await flush(); ok(!I.win.__xss, '名字裡的 HTML 不會執行');
  await I.type(inp('dr2star'), ''); ok(!('dr2star' in I.S.names), '清空就是沒有名字');
  ok(I.$$('input[data-nf]').length === 1 && inp('dr2star'), '打字時不會重畫、一次只開一個名字欄');
  await I.click('[data-act=petnamedone]'); ok(!I.$('input[data-nf]'), '按完成就收起來');
  ok(I.text().includes('小橘'), '設定頁的列表上看得到名字'); ok(I.$(`[data-act=petname][data-v="${id1}"]`).innerText === '改名', '有名字的顯示「改名」');
  await I.click(`[data-act=petname][data-v="${id1}"]`); I.doc.activeElement.dispatchEvent(new I.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await flush(); ok(!I.$('input[data-nf]'), '按 Enter 也會收起來');
  I.check('取名字');
  await I.click('[data-act=tankdone]'); await new Promise(r => setTimeout(r, 300));
  const f1 = I.ev('TANK.fish').find(f => f.key === id1); eq(f1.name, '小橘', '水族箱裡的魚帶著名字');
  eq(I.ev('TANK.fish').find(f => f.key === 'dr2star').name, '', '沒名字的魚沒有標籤');
  // 重開還在
  const J = await I.reload(); await J.dismiss(); eq(J.ev("petName('dr0clown')"), '小橘', '重開後名字還在');
  await J.tab('tank'); await new Promise(r => setTimeout(r, 300)); J.check('重開後水族箱');
  // 壞資料：names 不是物件、值不是字串
  for (const bad of ['"字串"', '[1,2]', '{"dr0clown": 123}', 'null']) { J.ev(`S.names = ${bad}; save(); render()`); eq(J.ev("petName('dr0clown')"), '', '壞資料 ' + bad + ' 不會當掉'); J.check('壞的 names ' + bad); }
  // 放生會一起清掉名字
  J.ev("S.names = { dr0clown: '小橘' }; save()"); await J.click('[data-act=tankedit]');
  await J.click('[data-act=release][data-v="dr0clown"]'); ok(J.$('#askmsg').textContent.includes('「小橘」'), '放生確認會寫名字'); await J.click('#askyes');
  ok(!J.S.names.dr0clown, '放生後名字清掉'); ok(J.has('小橘游走了'), '游走提示用名字');
  // 不是自己的個體 id 不能亂寫
  J.ev("setPetName('not-a-pet', 'x')"); ok(!('not-a-pet' in (J.S.names || {})), '不存在的個體不能取名');
  J.check('取名字全部'); J.destroy(); I.destroy();
});

test('大海：整個視窗都是海、頂端列和分頁列浮在上面、不會捲動、沙地在分頁列上面、讓牠游走', async () => {
  for (const [w, h] of [[375, 812], [320, 568], [1024, 800], [1600, 900]]) {
    const I = await boot({ state: base(...drops(['clown', 'hermit', 'star'])), width: w, height: h }); await I.dismiss();
    ok(I.$('#nav [data-v=tank]').innerText.trim() === '大海', `${w}px：分頁叫「大海」`);
    await I.tab('tank'); await flush(); await new Promise(r => setTimeout(r, 300));
    const cv = I.$('#tank'), r = cv.getBoundingClientRect(), nav = I.$('#nav'), fixed = I.win.getComputedStyle(nav).position === 'fixed';
    ok(r.left <= 0.5 && r.top <= 0.5 && r.right >= w - 0.5 && r.bottom >= h - 0.5, `${w}px：海填滿整個視窗，連捲軸那一條都是海（${r.left | 0},${r.top | 0}–${r.right | 0},${r.bottom | 0}）`);
    ok(I.doc.documentElement.scrollHeight <= h + 1, `${w}px：大海頁不會捲動（${I.doc.documentElement.scrollHeight} > ${h}）`);
    ok(!cv.closest('.px') && I.win.getComputedStyle(cv).boxShadow === 'none', `${w}px：沒有面板和外框`);
    ok(!I.vis(I.$('.foot')), `${w}px：大海頁不顯示頁尾`);
    ok(!I.blocked(I.$('.lvchip')) && !I.blocked(I.$('#nav [data-v=today]')), `${w}px：頂端列和分頁列浮在海上面，點得到`);
    // 海底工具列：不透明、橫跨整個寬度，貼在分頁列上面（電腦上在畫面最底下）；沙地在工具列上面
    const bar = I.$('.seabar').getBoundingClientRect(), navTop = fixed ? nav.getBoundingClientRect().top : h;
    ok(bar.left <= 0.5 && bar.right >= w - 0.5 && Math.abs(bar.bottom - navTop) < 1, `${w}px：工具列橫跨整個寬度、貼在${fixed ? '分頁列上面' : '畫面最底下'}（${bar.left | 0}–${bar.right | 0}，底 ${bar.bottom | 0}／${navTop | 0}）`);
    ok(I.win.getComputedStyle(I.$('.seabar')).backgroundColor.match(/[\d.]+/g).length === 3 || +I.win.getComputedStyle(I.$('.seabar')).backgroundColor.match(/[\d.]+/g)[3] === 1, `${w}px：工具列不透明`);
    ok(bar.height <= 56, `${w}px：工具列只有一行（${bar.height | 0}px）`);
    const H = I.ev('TANK.H'), fy = I.ev('TANK.floorY'), sandTop = fy * r.height / H, floorLine = bar.top;
    ok(floorLine - sandTop >= 40 && floorLine - sandTop <= 56, `${w}px：沙地在工具列上面看得到（沙地 ${sandTop | 0}，${floorLine | 0}）`);
    ok(I.ev('TANK.fish').filter(f => f.ground).every(f => Math.abs(f.y + f.h - 2 - fy) < 1), `${w}px：寄居蟹、海星站在沙地上`);
    const px = cv.getContext('2d').getImageData(1, Math.round((fy + 8) * cv.height / H), 1, 1).data; ok(px[3] === 255 && px[0] > 60 && px[0] > px[2], `${w}px：沙地有畫出來（壓暗的沙色）：${[...px]}`);
    const col = I.$('.wrap').getBoundingClientRect();
    for (const s of ['#feedInfo', '[data-act=buyfeed]', '[data-act=tankview]', '[data-act=tankedit]']) {
      const b = I.$(s).getBoundingClientRect();
      ok(b.left >= col.left - 1 && b.right <= col.right + 1 && b.top >= bar.top && b.bottom <= bar.bottom, `${w}px：${s} 在工具列裡、對齊內容欄`);
      if (s !== '#feedInfo') ok(!I.blocked(I.$(s)), `${w}px：工具列的按鈕點得到：${s}`);
    }
    ok(!I.$$('.seahud').some(e => e !== I.$('.seabar') && !e.classList.contains('hint')), `${w}px：海裡沒有其他浮著的按鈕`);
    await I.tab('today'); ok(I.vis(I.$('.foot')) && !I.doc.body.classList.contains('sea-on') && !I.$('#tank'), `${w}px：離開大海頁面恢復`);
    await I.tab('tank'); await I.click('[data-act=tankview][data-v=dex]'); ok(!I.doc.body.classList.contains('sea-on'), `${w}px：圖鑑是一般頁面`);
    I.check('全屏 ' + w); I.destroy();
  }
  const I = await boot({ state: base(...drops(['clown'])) }); await I.dismiss(); await I.tab('tank'); await I.click('[data-act=tankedit]');
  ok(I.has('讓牠游走') && !I.has('放生'), '設定裡的按鈕是「讓牠游走」');
  await I.click('[data-act=release]'); ok(I.$('#askmsg').textContent.includes('游走'), '確認框也寫游走'); await I.click('#askyes'); ok(I.has('小丑魚游走了'), '提示：小丑魚游走了'); I.destroy();
});

test('各頁頂端列的位置一樣（大海頁不會捲動也不能左右跳）', async () => {
  for (const w of [1024, 1600]) {   // 手機的捲軸浮在畫面上、不佔位置，不會跳
    const I = await boot({ state: base(coinLog(500), ...drops(['clown'])), width: w, height: 600 }); await I.dismiss();
    const cs = () => I.win.getComputedStyle(I.doc.documentElement).overflowY;
    const pos = () => ['.brand', '#stat', '#nav'].map(s => { const r = I.$(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; });
    await I.tab('today'); ok(I.doc.documentElement.scrollHeight > 600, `${w}px：今日頁比畫面長（會捲動）`); const ref = pos();
    for (const t of ['tank', 'quest', 'shop', 'log', 'about']) { await I.tab(t); eq(pos(), ref, `${w}px：「${t}」頁的頂端列、金幣、分頁列跟今日頁對齊`); eq(cs(), t === 'tank' ? 'hidden' : 'scroll', `${w}px：「${t}」頁${t === 'tank' ? '沒有捲軸（海畫到最右邊）' : '一律有捲軸（內容短也有）'}`); }
    I.destroy();
  }
});
