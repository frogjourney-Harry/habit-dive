// 遊戲系統：番茄鐘、寶箱、商店、升級、水族箱、圖鑑、運動紀錄、連勝與日期
const W0 = { id: 'w0', t: 1, d: '2026-10-01', k: 'welcome', key: 'welcome', c: 0, xp: 0 };
const base = (...logs) => mkState({ logs: [W0, ...logs] });
const drops = (ids, d = '2026-10-02') => ids.map((id, i) => ({ id: 'dr' + i + id, t: 1000 + i, d, k: 'chest', drop: id, c: 0, xp: 0 }));
const coinLog = n => ({ id: 'coin' + n, t: 2, d: '2026-10-02', k: 'bonus', c: n, xp: 0 });
function stubRandom(I, seq, rest = 0.5) { const orig = I.win.Math.random; I.win.Math.random = () => seq.length ? seq.shift() : rest; return () => { I.win.Math.random = orig; }; }
async function chooseTankFilter(I, key, value) {
  await I.click(`[data-tank-filter="${key}"]`);
  await I.click(`#sheet [data-act=tankfilterpick][data-v="${value}"]`);
}

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
  await J.tab('log'); ok(!J.$('.dive'), '紀錄頁只放入口，不直接列稱號'); ok(J.$('.rkbtn').innerText.includes('2 / '), '入口寫已拿到 2 個');
  await J.click('.rkbtn'); const rk = J.$$('.dive .rk');
  eq(rk.length, J.ev('RANKS.length'), '每個稱號都列出來');
  eq(J.$$('.dive .rk p').length, 1, '只有目前的稱號展開介紹，不會一整頁都是字'); ok(J.$('.rk.cur p').innerText.trim().length > 10, '目前的稱號有介紹');
  ok(!J.$('.dive').innerText.includes('🔒'), '還沒拿到的稱號沒有鎖的圖示');
  await J.click(J.$$('.rk.lock')[2]); ok(J.$$('.rk.lock')[2].querySelector('p') && J.$$('.rk.lock')[2].querySelector('p').innerText.trim().length > 10, '點還沒拿到的稱號也看得到介紹');
  await J.click(J.$$('.rk.lock')[2]); ok(!J.$$('.rk.lock')[2].querySelector('p'), '再點一次收起來');
  ok(J.ev('RANKS').every(r => r[3].length > 10), '每個稱號都有介紹');
  eq(J.$$('.rk.got').length, 1, 'Lv.3：浮潛客已拿到'); ok(J.$('.rk.cur').innerText.includes('體驗潛水員'), 'Lv.3：現在是體驗潛水員');
  eq(J.$$('.rk.lock').length, rk.length - 2, '其他還鎖著'); ok(J.$('.rk.cur').innerText.includes('再 '), '現在的稱號下面寫還差多少 XP');
  J.check('稱號頁'); await J.click('[data-act=logview][data-v=""]'); ok(J.$('.rkbtn') && !J.$('.dive'), '返回紀錄頁');
  await J.click('.rkbtn'); await J.tab('today'); await J.tab('log'); ok(!J.$('.dive'), '切到別的分頁再回來，回到紀錄頁本身'); J.destroy();
  const K = await boot({ state: mkState({ logs: [W0, coinLog(0), { id: 'p1', t: 9, d: D0, k: 'plan', key: 'plan:' + D0, xp: 100000, c: 15, pend: true }] }) });
  await K.dismiss(); await K.tab('quest'); await K.click('.qall'); ok(K.has('Lv.'), '超大等級彈窗有顯示'); K.check('升級彈窗');
  await K.click('[data-act=seeranks]'); await K.dismiss(); ok(K.$('.dive') && K.$('#nav .sel').innerText.includes('紀錄'), '升級彈窗的「看所有稱號」打開稱號頁');
  ok(K.$('.rk.cur').innerText.includes('海洋傳說') && !K.$('.rk.lock') && !K.$('.rk.cur .bar'), '最高稱號：全部拿到、沒有下一級的進度條');
  for (const t of ['today', 'quest', 'tank', 'shop', 'log', 'about']) { await K.tab(t); K.check('Lv.' + K.ev('levelOf(derive().xp)') + ' ' + t); }
  K.destroy(); I.destroy();
});

test('寶箱：五種價格、稀有度、重複生物不退金幣', async () => {
  const I = await boot({ state: base(coinLog(5000)) }); await I.dismiss(); await I.tab('shop');
  const exp = [[0, 'clown', 40], [1, 'turtle', 100], [2, 'seahorse', 250], [3, 'manta', 600], [4, 'whaleshark', 1500]];
  const rest = stubRandom(I, [], 0);
  for (const [i, id, price] of exp) {
    rest(); const un = stubRandom(I, [0.5, 0.99, 0, 0]);
    const c0 = I.coins(); await I.click(`[data-act=buychest][data-v=c${i}]`); await I.dismiss(); un();
    eq(I.coins(), c0 - price, `${price} 金幣的寶箱：第一次扣 ${price}`);
    ok(I.ev('derive().col')[id] === 1, `c${i} 開出 ${id}：` + JSON.stringify(I.ev('derive().col')));
    const un2 = stubRandom(I, [0.5, 0.99, 0, 0]); const c1 = I.coins(); await I.click(`[data-act=buychest][data-v=c${i}]`); await I.dismiss(); un2();
    eq(I.coins(), c1 - price, `重複的 ${id} 仍扣完整 ${price} 金幣`);
    eq(I.ev('derive().col')[id], 2, '重複生物仍加入收藏');
    const purchase = I.S.logs.filter(l => l.k === 'chest').slice(-1)[0];
    eq(purchase.c, -price, '消費紀錄保留完整價格');
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
  // 撒飼料：先用每天免費的 10 顆，再用買的，再沒有
  const cv = I.$('#tank'); const r = cv.getBoundingClientRect();
  const drop = async () => { cv.dispatchEvent(new I.win.MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 })); await flush(); };
  ok(I.$('.seacoach') && I.has('點水裡撒飼料，魚吃到一定數量會長大'), '新手：海中間有撒飼料的提示');
  eq(I.$('.fpill.free').textContent, '今日免費 10/10', '免費標籤 10/10'); eq(I.$('.fpill.paid').textContent, '已購 0', '買的標籤 0');
  await drop(); await drop(); ok(I.$('.seacoach'), '撒了 2 顆提示還在'); eq(I.$('.fpill.free').textContent, '今日免費 8/10', '免費剩 8/10');
  await drop(); ok(!I.$('.seacoach'), '撒滿 3 顆提示就消失'); eq(I.S.tossed, 3, '記下撒過 3 顆');
  for (let i = 0; i < 7; i++) await drop();
  eq(I.S.feedDay.used, 10, '每天免費 10 顆用完'); ok(I.$('.fpill.free.out') && I.$('.fpill.free').textContent === '今日免費 0/10', '免費用完標籤變灰');
  await drop(); ok(I.has('飼料用完了') && I.has('明天會再送 10 顆'), '沒飼料了要提示，寫明天送 10 顆');
  await I.click('[data-act=buyfeed]'); eq(I.S.feed, 10, '買 10 顆'); eq(I.coins(), 470, '扣 30 金幣');
  await drop(); eq(I.S.feed, 9, '用了買的飼料'); eq(I.$('.fpill.paid').textContent, '已購 9', '買的標籤跟著減少');
  { const J = await boot({ state: mkState({ fed: { a: 2, b: 1 } }) }); await J.dismiss(); await J.tab('tank'); ok(!J.$('.seacoach'), '以前餵過 3 顆以上的舊存檔不顯示新手提示'); J.destroy(); }
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
  ok(!I.S.outTank.dr1star, '取消勾選先留在草稿，不立即改存檔'); await I.click('[data-act=tankdone]'); ok(I.S.outTank.dr1star, '完成後才儲存展示選擇'); await new Promise(r => setTimeout(r, 200));
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

test('水族箱：舊資料擁有 100 隻，展示 12 隻且收藏與圖鑑保留', async () => {
  const ids = []; for (const c of ['clown','damsel','butterfly','star','hermit','urchin','turtle','octopus','nudi','lion','puffer','cuttle','seahorse','shark','moray','jelly','manta','mola','dolphin','whaleshark']) for (let k = 0; k < 5; k++) ids.push(c);
  const I = await boot({ state: mkState({ logs: [W0, coinLog(100), ...drops(ids)], fed: Object.fromEntries(ids.map((c, i) => ['dr' + i + c, i % 3 === 0 ? 30 : i % 3 === 1 ? 10 : 0])) }) }); await I.dismiss();
  await I.tab('tank'); await new Promise(r => setTimeout(r, 900));
  eq(I.ev('TANK.fish.length'), 12, '展示前 12 隻');
  eq(I.ev('tankOwned().length'), 100, '100 隻仍全部擁有');
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

test('水族箱：跨手機斷點後全部型態縮至八成，回桌面恢復', async () => {
  const ids = ['clown', 'lion', 'hermit', 'star'].flatMap(id => [id, id, id]);
  const state = mkState({ logs: [W0, ...drops(ids)], fed: Object.fromEntries(ids.map((id, i) => ['dr' + i + id, [0, 10, 30][i % 3]])) });
  const I = await boot({ state, width: 1024, height: 844 });
  try {
    await I.dismiss(); await I.tab('tank');
    await new Promise(r => setTimeout(r, 300));
    const dimensions = () => I.ev('TANK.fish.map(f => ({key:f.key,w:f.w,h:f.h,st:f.st,x:f.x,y:f.y,baseY:f.baseY,ground:f.ground}))');
    const desktop = new Map(dimensions().map(f => [f.key, f]));
    eq(I.ev('tankOwned().length'), 12, '測試資料只擁有 12 隻，沒有額外新手生物擠掉型態');
    eq(desktop.size, 12, '四物種 × 三型態全部展示');
    for (const width of [600, 390, 601, 1024, 390]) {
      I.resize(width, 844); I.win.dispatchEvent(new I.win.Event('resize'));
      await new Promise(r => setTimeout(r, 300));
      const factor = width <= 600 ? .8 : 1;
      const current = dimensions();
      const world = I.ev('({width:TANK.W,height:TANK.H,floor:TANK.floorY})');
      eq(current.length, desktop.size, width + 'px 展示個體不變');
      eq(I.ev("getComputedStyle(document.getElementById('nav')).position === 'fixed'"), width <= 600, '手機導覽列與尺寸斷點一致');
      for (const f of current) {
        const original = desktop.get(f.key);
        ok(Math.abs(f.w / original.w - factor) < 1e-9 && Math.abs(f.h / original.h - factor) < 1e-9, width + 'px ' + f.key + ' 寬高比例正確');
        eq(f.st, original.st, '切換寬度不改變型態');
        ok(f.x >= 0 && f.x <= world.width - f.w + 1e-8 && f.baseY >= 0 && f.baseY + f.h <= world.height, '切換後基準位置仍在畫布範圍內，允許游動浮沉');
        if (f.ground) ok(Math.abs(f.y - (world.floor - f.h + 2)) < 1e-8, '海底生物仍貼著沙地');
      }
      ok(!I.$('#tank').getContext('2d').imageSmoothingEnabled, '像素圖保持關閉平滑');
      I.check(width + 'px 尺寸切換');
    }
  } finally { I.destroy(); }
});

test('水族箱管理：滿額替換草稿、取消、完成與重開保存', async () => {
  const ids = ['clown','lion','hermit','puffer','cuttle','star','clown','lion','hermit','puffer','cuttle','star','clown','lion'];
  const state = base(...drops(ids)); state.fed = { dr0clown: 35 }; state.names = { dr0clown: '黑糖' };
  const I = await boot({state}); await I.dismiss(); await I.tab('tank');
  const original = I.ev('tankResidents().map(l => l.id)');
  const outBefore = JSON.stringify(I.S.outTank);
  await I.click('[data-act=tankedit]');
  ok(I.$('[data-act=intank][data-v=dr12clown]').disabled, '已滿時不能選第 13 隻');
  await I.click('[data-act=intank][data-v=dr0clown]');
  await I.click('[data-act=intank][data-v=dr12clown]');
  eq(JSON.stringify(I.S.outTank), outBefore, '改草稿未改正式選擇');
  await I.click('[data-act=tankcancel]');
  eq(I.ev('tankResidents().map(l => l.id)'), original, '取消保留原名單');
  await I.click('[data-act=tankedit]');
  await I.click('[data-act=intank][data-v=dr0clown]'); await I.click('[data-act=intank][data-v=dr12clown]');
  await I.click('[data-act=tankdone]');
  ok(I.ev("inTank('dr12clown') && !inTank('dr0clown')"), '替換入海成功');
  eq(I.S.fed.dr0clown,35,'留在收藏仍保留成長'); eq(I.S.names.dr0clown,'黑糖','收藏保留名字');
  eq(I.ev('tankOwned().length'),14,'沒有放走任何個體');
  I.resize(1024,844); I.win.dispatchEvent(new I.win.Event('resize')); await new Promise(r=>setTimeout(r,250));
  eq(I.ev('TANK.fish.length'),12,'桌面仍最多 12 隻');
  const J=await boot({state:I.stored()}); await J.dismiss(); await J.tab('tank');
  ok(J.ev("inTank('dr12clown') && !inTank('dr0clown')"),'重開仍保留替換選擇');
  J.check('重開管理選擇'); J.destroy(); I.check('管理草稿'); I.destroy();
});

test('水族箱管理：草稿切頁丟棄、外部換資料失效、放走不讓候補補位', async () => {
  const ids=['clown','lion','hermit','puffer','cuttle','star','clown','lion','hermit','puffer','cuttle','star','clown'];
  const I=await boot({state:base(...drops(ids))}); await I.dismiss(); await I.tab('tank');
  await I.click('[data-act=tankedit]'); await I.click('[data-act=intank][data-v=dr0clown]');
  await I.tab('today'); await I.tab('tank'); await I.click('[data-act=tankedit]');
  ok(I.$('[data-act=intank][data-v=dr0clown]').checked,'切頁丟棄未完成選擇');
  await I.click('[data-act=intank][data-v=dr0clown]');
  I.ev('S = JSON.parse(JSON.stringify(S)); S.outTank.dr1lion = true');
  await I.click('[data-act=tankdone]');
  ok(I.UI.tankEdit && I.has('資料已更新'),'外部換資料後不能直接送出舊草稿');
  ok(!I.S.outTank.dr0clown,'舊草稿沒有覆蓋新資料');
  await I.click('[data-act=tankcancel]');
  // Restore a legacy overflow state, then release one of the twelve visible pets.
  I.ev('S.outTank = {}; save(); render()');
  await I.click('[data-act=tankedit]');
  const coins=I.coins(),xp=I.ev('derive().xp');
  await I.click('[data-act=release][data-v=dr0clown]');
  ok(I.has('無法復原') && I.has('留在收藏'),'永久放走與收藏清楚區分');
  await I.click('#askyes');
  eq(I.ev('tankResidents().length'),11,'放走海中一隻後維持 11 隻');
  ok(!I.ev("inTank('dr12clown')"),'候補沒有偷偷補位');
  eq(I.UI.tankDraft.length,11,'草稿也移除放走者');
  ok(I.$('[data-act=intank][data-v=dr6clown]').closest('label').textContent.includes('小丑魚 2 號'),'放走前一隻不會更改其他個體編號');
  eq(I.coins(),coins,'沒有新增放走金幣');eq(I.ev('derive().xp'),xp,'沒有新增放走經驗');
  await I.click('[data-act=tankdone]'); I.check('放走與外部更新'); I.destroy();
});

test('水族箱管理：真正雲端採用資料時不帶回舊名字或舊選擇', async () => {
  const state=base(...drops(['clown','star']));state.names={dr0clown:'舊名字'};
  const I=await boot({state});await I.dismiss();await I.tab('tank');await I.click('[data-act=tankedit]');
  await I.click('[data-act=intank][data-v=dr0clown]');
  I.ev("CLOUD.user={uid:'mock-owner'};adopt({...S,names:{dr0clown:'新名字'},outTank:{dr1star:true}})");
  eq(I.S.names.dr0clown,'新名字','雲端名字沒有被舊管理資料覆蓋');
  ok(I.UI.tankDraft.includes('dr0clown') && !I.UI.tankDraft.includes('dr1star'),'草稿重新載入雲端展示選擇');
  ok(I.has('資料已更新'),'明確提示草稿已重載');
  await I.click('[data-act=tankdone]');
  ok(I.ev("inTank('dr0clown') && !inTank('dr1star')"),'完成不會恢復舊選擇');
  I.check('真實 adopt 路徑');I.destroy();
});

test('水族箱管理：長清單勾選保留焦點、捲動與上限', async () => {
  const ids=['clown','lion','hermit','puffer','cuttle','star'].flatMap(id=>Array(5).fill(id));
  const I=await boot({state:base(...drops(ids)),width:390});await I.dismiss();await I.tab('tank');await I.click('[data-act=tankedit]');
  I.ev("window._choice=document.querySelector('[data-act=intank][data-v=dr11hermit]');_choice.focus();_choice.scrollIntoView({block:'center'});window._choiceTop=_choice.getBoundingClientRect().top;_choice.click()");
  await flush();
  ok(I.ev('document.activeElement===window._choice'),'勾選不會換掉焦點節點');
  ok(I.ev('Math.abs(_choice.getBoundingClientRect().top-window._choiceTop)<2'),'勾選後項目在視窗中的位置不跳動（容許瀏覽器捲動錨定）');
  ok(I.$('.tank-summary').textContent.includes('11／12'),'同一個計數節點更新選擇');
  await I.click('[data-act=intank][data-v=dr12hermit]');
  I.ev("const extra=document.querySelector('[data-act=intank][data-v=dr13hermit]');extra.disabled=false;extra.click()");
  await flush();eq(I.UI.tankDraft.length,12,'即使繞過 disabled 仍拒絕第 13 隻');
  ok(!I.$('[data-act=intank][data-v=dr13hermit]').checked,'拒絕後核取狀態與草稿一致');
  I.check('焦點與防護');I.destroy();
});

test('水族箱管理：同種強制放走遇到舊彈窗仍可繼續，收藏不補位', async () => {
  const ids=['clown','clown','clown','clown','clown','lion','hermit','puffer','cuttle','star','lion','star'];
  const I=await boot({state:base(...drops(ids))});await I.dismiss();
  I.ev("dropCreature({id:'sixth-clown',t:Date.now(),d:dayKey(),k:'chest',c:0,xp:0},null,'測試',0,CR.clown);save();nextChest()");
  await I.click('#modal [data-act=close]');
  ok(I.has('同種最多收藏 5 隻'),'說明同種收藏上限與展示上限不同');
  // Same ids in a replaced state must not be released through a stale modal.
  I.ev('S=JSON.parse(JSON.stringify(S));save()');
  await I.click('#modal [data-act=releasepick][data-v=dr0clown]');
  ok(!I.S.released.dr0clown,'換資料後舊彈窗不會直接放走');
  ok(I.$('#modal [data-act=releasepick]'),'仍超額時重建可操作的放走彈窗');
  await I.click('#modal [data-act=releasepick][data-v=dr0clown]');
  eq(I.ev("pets('clown').length"),5,'有效操作後同種回到 5 隻');
  eq(I.ev('tankResidents().length'),11,'永久放走海中個體後不補位');
  ok(I.S.outTank['sixth-clown'],'第六隻仍留在收藏');
  // A removed target should close the stale modal and let queued items continue.
  // Recreate an actual overflow for this race fixture.
  I.ev("S.released.dr0clown=false;Q.push({release:'clown',newId:'sixth-clown'});UI.opened=false;nextChest()");
  I.ev("S=JSON.parse(JSON.stringify(S));S.released.dr0clown=true;save()");
  await I.click('#modal [data-act=releasepick][data-v=dr0clown]');
  ok(I.$('#ov').classList.contains('hidden'),'不再超額時關閉舊彈窗，不會卡住');
  I.check('強制放走競態');I.destroy();
});

test('水族箱管理：新生物有位入海、滿額收藏並可直接管理', async () => {
  const ids=['clown','lion','hermit','puffer','cuttle','star','clown','lion','hermit','puffer','cuttle'];
  const I=await boot({state:base(...drops(ids))}); await I.dismiss();
  I.ev("dropCreature({id:'newA',t:Date.now(),d:dayKey(),k:'chest',c:0,xp:0},null,'測試',0,CR.star); save(); nextChest()");
  ok(I.ev("inTank('newA')"),'第 12 隻自動入海'); await I.dismiss();
  I.ev("dropCreature({id:'newB',t:Date.now(),d:dayKey(),k:'chest',c:0,xp:0},null,'測試',0,CR.clown); save(); nextChest()");
  ok(!I.ev("inTank('newB')") && I.S.outTank.newB,'第 13 隻留在收藏');
  ok(I.has('大海已滿') && I.has('已留在收藏'),'開箱說明滿額去向');
  await I.click('#modal [data-act=seamanage]');
  ok(I.UI.tankEdit && I.has('管理生物'),'直接進入管理');
  eq(I.ev('tankOwned().length'),13,'仍擁有 13 隻');
  I.check('新生物收藏'); I.destroy();
});

test('水族箱管理：全留收藏可回管理，失效個體不可寫回', async () => {
  const I=await boot({state:base(...drops(['clown','star']))});await I.dismiss();await I.tab('tank');
  await I.click('[data-act=tankedit]'); await I.click('[data-act=intank][data-v=dr0clown]');await I.click('[data-act=intank][data-v=dr1star]');
  await I.click('[data-act=tankdone]'); eq(I.ev('TANK.fish.length'),0,'可以選擇零展示');
  ok(I.$('.seaempty [data-act=tankedit]'),'空海仍可管理');
  await I.click('.seaempty [data-act=tankedit]');await I.click('[data-act=intank][data-v=dr0clown]');
  I.ev('S.released.dr0clown = true; save()');
  await I.click('[data-act=tankdone]'); ok(!I.ev("inTank('dr0clown')"),'已放走個體不能由草稿復活');
  I.check('空海與失效個體');I.destroy();
});

test('運動紀錄：各種運動、怪數字、補登昨天', async () => {
  const I = await boot({ state: mkState() }); await I.dismiss();
  await I.click(['#habits .hab', '運動']);
  await I.type('#exType', '跑步'); await I.type('#ex_dist', '5'); await I.type('#ex_min', '30'); ok(I.has("配速 6'00\"/km"), '跑步配速：' + I.$('#exPace').innerText);
  await I.click('[data-act=exadd]'); ok(!I.UI.sheet && I.UI.tab==='today', '成功後關閉表單回到今日');
  await I.habit('運動');ok(I.has('跑步・5 km・30 分'), '紀錄文字');
  await I.type('#exType', '游泳'); await I.type('#ex_m', '200'); await I.type('#ex_min', '10'); ok(I.has("配速 5'00\"/100m"), '游泳配速：' + I.$('#exPace').innerText);
  await I.click('[data-act=exadd]');
  await I.habit('運動');await I.type('#exType', '騎車');await I.type('#ex_dist','12');await I.type('#ex_min','40');await I.type('#ex_note','<b>河濱</b>');
  await I.click('[data-act=exadd]');await I.habit('運動');ok(!I.$('#sheet .entry b'),'備註裡的 HTML 要跳脫');
  for (const bad of ['-5', '0', '1e999', '99999999999999999999']) {
    await I.type('#exType', '跑步'); await I.type('#ex_dist', bad); await I.type('#ex_min', bad); await I.click('[data-act=exadd]');
    I.check('輸入 ' + bad);
  }
  const txt = I.$('#sheet').innerText; ok(!/-5 km|-5 分|Infinity|e\+/.test(txt), '負數、無限大、科學記號不能直接出現在紀錄裡：' + txt.replace(/\n/g, ' ').slice(0, 200));
  await I.click('[data-act=sheetclose]');await I.habit('運動');await I.type('#exType', '走路');await I.type('#ex_dist','2.5');await I.type('#ex_min','35');await I.click('[data-act=exadd]');
  await I.habit('運動');
  await I.click('[data-act=shday][data-v="-1"]'); await I.type('#exType', '重訓'); await I.type('#ex_min', '45');
  const rBefore = I.S.logs.length; await I.click('[data-act=exadd]');
  eq(I.S.logs.length, rBefore, '補登昨天沒有獎勵'); ok(I.S.checks['2026-11-01'] && I.S.checks['2026-11-01'].exercise.length === 1, '紀錄記在昨天');
  await I.habit('運動');await I.click('[data-act=shday][data-v="-1"]');
  await I.click('#sheet [data-act=chkdel]'); ok(I.S.checks['2026-11-01'] === undefined, '刪掉昨天唯一的紀錄後，那天的資料夾也清掉');
  I.check('運動紀錄'); I.destroy();
});

test('連勝：每天習慣漏一天不斷、連漏兩天歸零；每週習慣漏一週就斷', async () => {
  const mk = days => Object.fromEntries(days.map(d => [d, { h1: [{ t: 1 }] }]));
  const hab = { id: 'h1', n: '看書', kind: 'custom', weeks: 0, target: 1 };
  const streakOf = async checks => { const I = await boot({ state: mkState({ habits: [{ id: 'exercise', n: '運動', kind: 'exercise', weeks: 1, target: 3 }, hab], checks }) }); await I.dismiss(); const s = I.ev('streaks(derive()).h1'); I.destroy(); return s; };
  eq((await streakOf(mk(['2026-11-02', '2026-11-01', '2026-10-31']))).n, 3, '連續 3 天');
  eq((await streakOf(mk(['2026-11-02', '2026-10-31', '2026-10-30']))).n, 3, '中間漏一天不算斷（3 天）');
  eq((await streakOf(mk(['2026-11-02', '2026-10-30', '2026-10-29']))).n, 1, '連漏兩天就斷：只剩今天');
  const t = await streakOf(mk(['2026-11-01', '2026-10-31'])); eq(t.n, 2, '今天還沒做：昨天前天仍算 2');
  eq((await streakOf(mk(['2026-10-25']))).n, 0, '很久以前做過的不算');
});

test('運動表單：大眾選單、留空完成與一天只算一天', async () => {
  const I=await boot({state:mkState()});await I.dismiss();await I.habit('運動');
  const options=[...I.$('#exType').options].map(o=>o.value);
  eq(options,['其他運動','走路','跑步','騎車','重訓','伸展／瑜伽','游泳'],'不預設跑步，也不提供潛水');
  eq(I.$('#exType').value,'其他運動','初始不假設特定運動');
  await I.click('[data-act=exadd]');ok(!I.UI.sheet&&I.UI.tab==='today','留空可完成並返回今日');
  await I.habit('運動');await I.type('#exType','騎車');await I.type('#ex_min','25');await I.click('[data-act=exadd]');
  eq(I.S.checks[D0].exercise.length,2,'同一天可記兩次活動');
  eq(I.ev("perCount(derive(),habit('exercise'),periodKey(dayKey(),1))"),1,'週進度只計完成天數');
  eq(I.S.logs.filter(l=>l.key==='hab:exercise:'+D0).length,1,'不因多筆重複發打卡獎勵');I.check('大眾運動');I.destroy();
});

test('運動表單：類型及今天昨天草稿保留，公尺公里不混用', async () => {
  const I=await boot({state:mkState()});await I.dismiss();await I.habit('運動');
  await I.type('#exType','跑步');await I.type('#ex_min','30');await I.type('#ex_dist','5');await I.type('#ex_note','公園');
  await I.type('#exType','游泳');eq(I.$('#ex_min').value,'30','切換保留時間');eq(I.$('#ex_note').value,'公園','切換保留備註');eq(I.$('#ex_m').value,'','公里不會誤當公尺');await I.type('#ex_m','500');
  await I.type('#exType','跑步');eq(I.$('#ex_dist').value,'5','切回跑步保留原距離');ok(I.$('#exPace').textContent.includes("6'00"),'切回後配速重新顯示');
  await I.click('[data-act=shday][data-v="-1"]');eq(I.$('#ex_min').value,'','昨天是另一份草稿');await I.type('#ex_min','20');await I.type('#ex_note','昨天散步');
  await I.click('[data-act=shday][data-v="0"]');eq(I.$('#ex_min').value,'30','回今天保留原時間');eq(I.$('#ex_note').value,'公園','今天備註不被昨天覆蓋');
  await I.type('#exType','游泳');eq(I.$('#ex_m').value,'500','游泳專屬距離仍保留');await I.click('[data-act=exadd]');
  const entry=I.S.checks[D0].exercise[0];eq(entry.m,500,'只儲存目前類型的公尺');ok(!('dist' in entry),'不偷偷送出另一類型的公里');I.check('運動草稿');I.destroy();
});

test('運動表單：錯誤保留輸入，舊潛水登山只讀顯示不遺失', async () => {
  const legacy=[{t:1,type:'潛水',depth:18,min:40,site:'舊潛點'},{t:2,type:'登山',dist:12,gain:800,min:240}];
  const I=await boot({state:mkState({checks:{[D0]:{exercise:legacy}}})});await I.dismiss();await I.habit('運動');
  ok(I.has('潛水')&&I.has('舊潛點')&&I.has('爬升 800 m'),'舊資料仍完整顯示');
  ok(![...I.$('#exType').options].some(o=>o.value==='潛水'),'歷史不會把潛水塞回新增選單');
  await I.type('#ex_min','-3');await I.type('#ex_note','保留內容');await I.click('[data-act=exadd]');
  ok(!!I.UI.sheet,'失敗不關表單');eq(I.$('#ex_min').value,'-3','錯誤數字原樣保留');eq(I.$('#ex_note').value,'保留內容','備註保留');eq(I.S.checks[D0].exercise.length,2,'錯誤不新增紀錄');
  I.ev('S=JSON.parse(JSON.stringify(S));renderSheet()');await I.click('[data-act=exadd]');eq(I.$('#ex_min').value,'-3','同步重畫仍保留輸入');eq(I.S.checks[D0].exercise.length,2,'錯誤草稿不會自動送出');
  await I.type('#ex_min','30');await I.click('[data-act=exadd]');eq(I.S.checks[D0].exercise.length,3,'同步後明確送出只新增一筆');eq(I.S.checks[D0].exercise[2].note,'保留內容','同步後保留備註');
  await I.habit('運動');I.ev('S.checks[dayKey()].exercise.unshift({t:99,type:"走路",min:5})');await I.click('[data-act=chkdel]');eq(I.S.checks[D0].exercise.length,4,'過期清單不會誤刪新紀錄');ok(I.has('紀錄已更新'),'提示重選');await I.click('[data-act=chkdel]');eq(I.S.checks[D0].exercise.length,3,'更新後仍能刪除正確紀錄');I.check('舊運動與錯誤');I.destroy();
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
    ok(!I.$$('.seahud').some(e => e !== I.$('.seabar')), `${w}px：海裡沒有其他浮著的按鈕`);
    { const th = I.win.getComputedStyle(I.$('#tank')).webkitTapHighlightColor; ok(!th || th === 'rgba(0, 0, 0, 0)' || th === 'transparent', `${w}px：點海不會蓋一層藍色（${th}）`); }
    ok(/^今日免費 \d+\/10$/.test(I.$('.fpill.free').textContent) && /^已購 \d+$/.test(I.$('.fpill.paid').textContent), `${w}px：飼料是 今日免費 x/10、已購 x 兩個標籤`);
    { const tip = I.$('.seacoach'); ok(!tip || !I.blocked(cv), `${w}px：新手提示不會擋住點海撒飼料`); }
    await I.tab('today'); ok(I.vis(I.$('.foot')) && !I.doc.body.classList.contains('sea-on') && !I.$('#tank'), `${w}px：離開大海頁面恢復`);
    await I.tab('tank'); await I.click('[data-act=tankview][data-v=dex]'); ok(!I.doc.body.classList.contains('sea-on'), `${w}px：圖鑑是一般頁面`);
    I.check('全屏 ' + w); I.destroy();
  }
  const I = await boot({ state: base(...drops(['clown'])) }); await I.dismiss(); await I.tab('tank'); await I.click('[data-act=tankedit]');
  eq(I.$('[data-act=release]').textContent, '放走', '管理頁使用精簡的「放走」按鈕');
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

test('生物進度與篩選：交集、展示草稿、取消及改名保留', async () => {
  const state = base(...drops(['clown','lion','star','clown']));
  state.fed = { dr0clown: 7, dr1lion: 18, dr2star: 35 }; state.outTank = { dr3clown: true };
  const I = await boot({ state, width:393, height:771 }); await I.dismiss(); await I.tab('tank'); await I.click('[data-act=tankedit]');
  const visible = () => I.$$('[data-pet]').filter(e => !e.hidden).map(e => e.dataset.pet);
  ok(I.has('已吃 7 顆・再 3 顆長大') && I.has('已吃 18 顆・再 12 顆變特殊型態') && I.has('成長完成'), '三種個體進度直接可見');
  await chooseTankFilter(I, 'location', 'shown'); eq(visible().length, 3, '展示中依已套用名單');
  await I.click('[data-act=intank][data-v=dr0clown]');
  ok(visible().includes('dr0clown'), '取消勾選不突然移出篩選結果'); eq(I.UI.tankDraft.length, 2, '草稿更新');
  await chooseTankFilter(I, 'growth', 'growing'); eq(visible().length, 2, '位置與成長交集');
  await chooseTankFilter(I, 'species', 'clown'); eq(visible(), ['dr0clown'], '三種條件交集');
  ok(I.$('.tank-summary').textContent.includes('2／12'), '總勾選不因篩選改變');
  await I.click('[data-act=petname][data-v=dr0clown]'); await I.type('[data-nf=dr0clown]', '十個字的名字測試看看');
  const input = I.$('[data-nf=dr0clown]');
  await chooseTankFilter(I, 'location', 'stored'); eq(visible(), ['dr3clown'], '收藏中的生物');
  ok(I.$('[data-nf=dr0clown]') === input && I.S.names.dr0clown, '切篩選不重建輸入或丟失已儲存名字');
  await chooseTankFilter(I, 'growth', 'complete'); eq(visible().length, 0, '無符合項目');
  ok(I.$('.tank-filter-result').textContent.includes('沒有符合'), '空狀態可見'); await I.click('[data-act=tankfilterclear]');
  eq(visible().length, 4, '清除篩選'); eq(I.UI.tankDraft.length, 2, '切換篩選保留全部草稿');
  await I.click('[data-act=tankcancel]'); ok(I.ev("inTank('dr0clown')"), '取消不套用勾選'); ok(I.S.names.dr0clown, '取名仍保留');
  await I.click('[data-act=tankedit]'); eq(I.$('[data-tank-filter=location]').value, '', '重新開啟重置篩選');
  I.check('進度篩選'); I.destroy();
});

test('生物篩選：滿額隱藏勾選、完成及窄版不溢出', async () => {
  const state = base(...drops(['clown','lion','hermit','puffer','cuttle','star','clown','lion','hermit','puffer','cuttle','star','clown']));
  const I = await boot({ state, width:393, height:771 }); await I.dismiss(); await I.tab('tank'); await I.click('[data-act=tankedit]');
  await chooseTankFilter(I, 'location', 'stored'); ok(I.$('[data-act=intank][data-v=dr12clown]').disabled, '滿額時收藏不可加選');
  await chooseTankFilter(I, 'location', 'shown'); await I.click('[data-act=intank][data-v=dr0clown]');
  await chooseTankFilter(I, 'location', 'stored'); ok(!I.$('[data-act=intank][data-v=dr12clown]').disabled, '隱藏列同樣更新disabled');
  await I.click('[data-act=intank][data-v=dr12clown]');
  ok(I.doc.documentElement.scrollWidth <= 393, '393寬無水平溢出');
  I.ev("const largeType=document.createElement('style'); largeType.textContent='.tank-manager button,.tank-choice small,.tank-pet-meta,.tank-pet-growth{font-size:20px!important}'; document.head.append(largeType)"); ok(I.doc.documentElement.scrollWidth <= 393, '實際放大文字至20px仍無水平溢出');
  await I.click('[data-act=tankdone]'); ok(I.ev("inTank('dr12clown') && !inTank('dr0clown')"), '完成套用包含隱藏列的完整草稿');
  I.check('滿額篩選'); I.destroy();
});

test('餵食公平性：所有型態可吃、順序不固定偏袒大魚、跨階追食減速', async () => {
  const I = await boot({ state:base(...drops(['whaleshark','clown'])) }); await I.dismiss(); await I.tab('tank');
  I.ev(`cancelAnimationFrame(TANK.raf); window.__realRAF = window.requestAnimationFrame; window.requestAnimationFrame = cb => { window.__tankStep = cb; return 0; }; tankStart();`);
  // 固定位置、速度與亂數，只走一幀真實動畫／吃食，避免靠牆或物種速度掩蓋順序。
  const once = (fed, random, feed = true) => I.ev(`(() => {
    S.fed = ${JSON.stringify(fed)};
    const r = Math.random; Math.random = () => ${random};
    for (const f of TANK.fish) { f.x=10; f.y=f.baseY=20; f.vx=.4; f.mx=f.my=0; f.rest=0; f.tx=null; }
    TANK.food = ${feed ? '[{x:12,y:22,vy:0,age:0}]' : '[]'};
    window.__tankStep(performance.now()+16.7); Math.random=r;
    return {fed:{...S.fed}, order:TANK.fish.map(f=>f.key)};
  })()`);
  let result = once({dr0whaleshark:7,dr1clown:7}, .999);
  eq(result.fed.dr0whaleshark, 8, '此亂數順序讓大魚吃到');
  result = once({dr0whaleshark:7,dr1clown:7}, 0);
  eq(result.fed.dr1clown, 8, '另一順序讓同位置小魚吃到'); eq(result.order[0], 'dr0whaleshark', '繪圖順序始終保留大魚在後');
  result = once({dr0whaleshark:30,dr1clown:7}, .999);
  eq(result.fed.dr0whaleshark, 31, '海中有幼體時滿階仍可進食');
  result = once({dr0whaleshark:30,dr1clown:30}, .999);
  eq(result.fed.dr0whaleshark, 31, '全部滿階仍可進食');
  // 攔下steer觀察真實幀要求的速度，避免繪圖浮沉影響比較。
  I.ev(`window.__realSteer = steer; window.__speeds=[]; steer = (...a) => { window.__speeds.push({key:a[0].key,x:Math.abs(a[1])}); return window.__realSteer(...a); };`);
  const speeds=[];
  for (const fed of [0,10,30,30]) {
    I.ev(`S.fed={dr0whaleshark:${fed},dr1clown:${fed}}; TANK.food=[{x:TANK.W-5,y:20,vy:0}]; for(const f of TANK.fish){f.x=1;f.y=f.baseY=20;f.vx=.4;f.mx=f.my=0;} window.__speeds=[]; window.__tankStep(performance.now()+16.7);`);
    speeds.push(I.ev("window.__speeds.find(s=>s.key==='dr1clown').x"));
  }
  ok(Math.abs(speeds[1]/speeds[0]-.85)<1e-8 && Math.abs(speeds[2]/speeds[0]-.75)<1e-8, '追食依目前fed套用85%與75%');
  ok(Math.abs(speeds[3]-speeds[2])<1e-8, '下一幀不重複累乘');
  I.ev('steer=window.__realSteer; window.requestAnimationFrame=window.__realRAF; save();');
  I.check('餵食公平性'); I.destroy();
});

test('生物篩選：同步重載保留篩選、失效物種與最後放走項目', async () => {
  const I=await boot({state:base(...drops(['clown','star']))}); await I.dismiss(); await I.tab('tank'); await I.click('[data-act=tankedit]');
  await chooseTankFilter(I, 'location', 'shown'); await chooseTankFilter(I, 'growth', 'growing'); await chooseTankFilter(I, 'species', 'clown');
  I.ev("CLOUD.user={uid:'mock-owner'};adopt({...S,names:{dr0clown:'同步名字'}})");
  eq(I.$('[data-tank-filter=species]').value, 'clown', '資料替換後仍保留有效物種'); eq(I.$('[data-tank-filter=location]').value, 'shown', '保留位置篩選');
  await I.click('[data-act=release][data-v=dr0clown]'); await I.click('#askyes');
  eq(I.$('[data-tank-filter=species]').value, '', '放走最後一隻後物種回全部'); ok(!I.ev("tankFilterOptions('species').some(([value]) => value === 'clown')"), '只列仍擁有的物種');
  eq(I.$('.tank-summary').textContent, '已選 1／12 隻', '放走後全域勾選同步更新');
  await chooseTankFilter(I, 'location', 'stored'); ok(I.$('.tank-filter-result').textContent.includes('沒有符合'), '沒有收藏時正確顯示空狀態');
  ok(I.$('.tank-filter-result [role=status]').textContent.includes('沒有符合'), '持續存在的朗讀區包含空結果');
  await chooseTankFilter(I, 'location', 'shown'); await I.click('[data-act=release][data-v=dr1star]'); await I.click('#askyes');
  ok(I.$('.tank-filters').hidden && I.has('還沒有生物'), '收藏全空時收起篩選並保留空收藏提示');
  I.check('篩選資料重載'); I.destroy();
});

test('追食方向：上下對齊不左右抽動，斜向與海底仍能吃到', async () => {
  const I=await boot({state:base(...drops(['clown','star'])),width:393,height:771}); await I.dismiss(); await I.tab('tank');
  I.ev(`cancelAnimationFrame(TANK.raf); window.__realRAF=requestAnimationFrame; window.requestAnimationFrame=cb=>{window.__step=cb;return 0}; tankStart(); window.__realSteer=steer; window.__want=[]; steer=(...a)=>{window.__want.push({key:a[0].key,x:a[1],y:a[2]});return window.__realSteer(...a)};`);
  const trace=I.ev(`(()=>{
    TANK.fish=TANK.fish.filter(f=>f.c.id==='clown'); const f=TANK.fish[0];
    f.x=40;f.y=f.baseY=100;f.vx=.4;f.mx=.08;f.my=0;
    const targetX=f.x+f.w/2+.001, start=performance.now(), positions=[];let flips=0,lastSign=1;
    for(let i=1;i<=360;i++){
      TANK.food=[{x:targetX,y:f.y+f.h/2-60,vy:0,age:0}];
      window.__step(start+i*16.7);
      if(i===240)lastSign=Math.sign(f.vx);
      if(i>240){positions.push(f.x+f.w/2);const sign=Math.sign(f.vx);if(sign!==lastSign)flips++;lastSign=sign;}
    }
    return {want:window.__want[0],span:Math.max(...positions)-Math.min(...positions),flips};
  })()`);
  ok(Math.abs(trace.want.x)<.001 && trace.want.y<0, '水平差極小時主要垂直追食，不以滿速左右衝');
  ok(trace.span<.1, '後段水平漂移小於0.3個螢幕像素，範圍='+trace.span);
  eq(trace.flips,0,'上下對齊後不反覆翻轉朝向');
  // 真實幀向斜下方落點靠攏，最終碰撞仍吃到，不只讓水平速度變成零。
  const ate=I.ev(`(()=>{
    const f=TANK.fish[0];f.x=20;f.y=f.baseY=20;f.mx=f.my=0;f.vx=.4;
    const before=fedOf(f.key);TANK.food=[{x:60,y:80,vy:0,age:0}];const start=performance.now()+7000;
    for(let i=1;i<=800 && TANK.food.length;i++)window.__step(start+i*16.7);
    return fedOf(f.key)>before;
  })()`); ok(ate,'斜向追食仍能吃到');
  I.ev(`steer=window.__realSteer; tankStart(); TANK.fish=TANK.fish.filter(f=>f.ground); const f=TANK.fish[0];f.x=20;f.y=f.baseY=TANK.floorY-f.h+2;f.vx=.1;f.mx=f.my=0;TANK.food=[{x:55,y:TANK.floorY-2,vy:0,age:0}];window.__groundBefore=fedOf(f.key);const start=performance.now()+22000;for(let i=1;i<=1000&&TANK.food.length;i++)window.__step(start+i*16.7);`);
  ok(I.ev('fedOf(TANK.fish[0].key)>window.__groundBefore'),'海底生物仍沿水平方向吃到沉底飼料');
  I.ev('window.requestAnimationFrame=window.__realRAF; save();'); I.check('追食穩定'); I.destroy();
});

test('追食落點：水母與魚上下對齊仍能吃到下沉飼料，遠處斜向保留原速', async () => {
  for (const species of ['clown','jelly']) {
    const I=await boot({state:base(...drops([species])),width:393,height:771}); await I.dismiss(); await I.tab('tank');
    const result=I.ev(`(()=>{
      cancelAnimationFrame(TANK.raf);const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>{window.__step=cb;return 0};tankStart();
      const f=TANK.fish[0];f.x=40;f.y=f.baseY=90;f.vx=.4;f.mx=f.my=0;
      const before=fedOf(f.key), x=f.x+f.w/2;TANK.food=[{x:x+.001,y:20,vy:.25,age:0}];const start=performance.now();let flips=0,last=Math.sign(f.vx);
      for(let i=1;i<=600&&TANK.food.length;i++){window.__step(start+i*16.7);if(last!==Math.sign(f.vx))flips++;last=Math.sign(f.vx);}
      const eaten=fedOf(f.key)>before;
      const afterEating=Math.abs(f.vx);TANK.food=[];
      for(let i=601;i<=660;i++)window.__step(start+i*16.7);
      const afterWander=Math.abs(f.vx);
      const realSteer=steer;let want;steer=(...a)=>{want=[a[1],a[2]];return realSteer(...a)};
      f.x=10;f.y=f.baseY=20;f.vx=.4;f.mx=f.my=0;TANK.food=[{x:100,y:100,vy:0,age:0}];window.__step(start+12000);
      steer=realSteer;window.requestAnimationFrame=raf;
      return {eaten,flips,want,afterEating,afterWander};
    })()`);
    ok(result.eaten, species+'能吃到實際下沉的飼料'); eq(result.flips,0,species+'到吃到為止不反覆水平翻轉');
    ok(Math.abs(result.afterEating-.4)<1e-8 && Math.abs(result.afterWander-.4)<1e-8, '吃完再巡游不降低原本基準速度');
    ok(Math.abs(result.want[0]-.72)<1e-8 && Math.abs(result.want[1]-.576)<1e-8,'遠處斜向維持原本各軸速度');
    I.ev('save()'); I.check('實際下沉追食'); I.destroy();
  }
});

test('生物篩選面板：展開樣式、選取、Escape與焦點返回', async () => {
  const I=await boot({state:base(...drops(['clown','star'])),width:393,height:771});await I.dismiss();await I.tab('tank');await I.click('[data-act=tankedit]');
  const trigger=I.$('[data-tank-filter=location]');await I.click(trigger);
  ok(!I.$('#sheetov').classList.contains('hidden') && I.$('#sheetov').classList.contains('filter-picker'),'開啟遊戲內自訂面板');
  eq(trigger.getAttribute('aria-expanded'),'true','觸發按鈕展開狀態');
  eq(I.$('#sheet [aria-pressed=true]'),I.doc.activeElement,'焦點在已選項目');
  I.doc.activeElement.dispatchEvent(new I.win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  eq(I.doc.activeElement.dataset.v,'shown','方向鍵只移動焦點'); eq(I.UI.tankFilters.location,'','尚未確認不改條件');
  I.doc.activeElement.dispatchEvent(new I.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();
  ok(I.$('#sheetov').classList.contains('hidden'),'Escape關閉不套用');eq(I.doc.activeElement,trigger,'關閉回原入口');eq(trigger.getAttribute('aria-expanded'),'false','關閉狀態更新');
  await chooseTankFilter(I,'location','shown');eq(trigger.value,'shown','選取立刻套用');eq(I.doc.activeElement,trigger,'選取後也回入口');
  await chooseTankFilter(I,'location','');eq(I.UI.tankFilters.location,'','面板內可選回全部');ok(trigger.textContent.includes('位置：全部'),'入口文案回全部');eq(I.doc.activeElement,trigger,'選全部後回入口');
  await I.click('[data-tank-filter=species]');
  eq(I.$$('#sheet .filter-option').length,3,'物種面板只有已擁有物種及全部');ok(I.$('#sheet .filter-option-icon img'),'物種選項帶像素圖');
  eq(I.$$('#sheet [aria-pressed=true]').length,1,'只有一個已選標記');
  ok(I.doc.documentElement.scrollWidth<=393,'展開時沒有水平溢出');
  await I.click('#sheetov',{force:true});ok(I.$('#sheetov').classList.contains('hidden'),'點遮罩可取消');eq(I.UI.tankFilters.species,'','取消未改物種');
  I.check('篩選面板');I.destroy();
});

test('生物篩選面板：同步重畫保留選項焦點與捲動，關閉回新入口', async () => {
  const I=await boot({state:base(...drops(['clown','star','hermit','lion','puffer','cuttle','manta','jelly','urchin','nudi'])),width:393,height:771});await I.dismiss();await I.tab('tank');await I.click('[data-act=tankedit]');
  await I.click('[data-tank-filter=location]');I.doc.activeElement.dispatchEvent(new I.win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  const option=I.doc.activeElement;I.ev("CLOUD.user={uid:'mock-owner'};adopt({...S,names:{dr0clown:'同步名字'}})");await flush();
  eq(I.doc.activeElement,option,'未改選項時同步重畫不重建或搶焦點');eq(I.doc.activeElement.dataset.v,'shown','保留尚未確認的方向鍵焦點');
  I.doc.activeElement.dispatchEvent(new I.win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();eq(I.doc.activeElement,I.$('[data-tank-filter=location]'),'關閉回重新建立的入口');
  await I.click('[data-tank-filter=species]'); const list=I.$('.filter-options');list.scrollTop=100; const before=list.scrollTop;
  I.ev('render()');await flush();eq(I.$('.filter-options'),list,'重畫不重建清單');eq(list.scrollTop,before,'清單維持捲動位置');
  I.ev("adopt({...S,released:{dr9nudi:true}})");await flush();ok(!I.$('#sheet [data-act=tankfilterpick][data-v=nudi]'),'選項內容真的改變時刷新');
  eq(I.$('#sheetov').getAttribute('aria-labelledby'),'tankFilterTitle','面板標題對應可及名稱');
  await I.click('#sheet [data-act=sheetclose]');eq(I.doc.activeElement,I.$('[data-tank-filter=species]'),'清單刷新後仍回正確入口');
  I.check('篩選面板重畫');I.destroy();
});
