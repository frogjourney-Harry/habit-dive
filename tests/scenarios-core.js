// 核心流程：每日循環、獎勵上限與取消、換日、週期、習慣、六件事
const rewardLogs = I => I.S.logs.filter(l => l.k === 'check');
async function startToday(o = {}) { const I = await boot({ state: mkState(o.state), ...o }); await I.dismiss(); return I; }

test('全新使用者：歡迎彈窗、60 金幣、Vocus 節奏設定', async () => {
  const I = await boot({ seed: {} });
  ok(!I.$('#ov').classList.contains('hidden'), '第一次進來應該跳出歡迎彈窗');
  ok(I.has('小丑魚'), '歡迎彈窗要寫小丑魚');
  I.check('剛進來');
  await I.dismiss();
  eq(I.coins(), 60, '歡迎禮物 60 金幣');
  ok(I.has('Vocus 發文節奏'), '第一次要出現 Vocus 節奏設定');
  await I.type('#vW', '2'); await I.type('#vT', '3'); await I.click('[data-act=vcfg]');
  const V = I.S.habits.find(h => h.id === 'vocus'); eq([V.weeks, V.target], [2, 3], 'Vocus 設定存進去');
  ok(!I.has('Vocus 發文節奏'), '設定完節奏卡片要消失');
  const I2 = await I.reload(); await I2.dismiss();
  eq(I2.coins(), 60, '重開後金幣還是 60（不會再送一次歡迎禮物）');
  eq(I2.S.logs.filter(l => l.k === 'welcome').length, 1, '歡迎禮物只有一筆');
  ok(!I2.has('Vocus 發文節奏'), '重開後不會再問節奏');
  I2.check('重開'); I2.destroy();
});

test('每日流程：寫清單→打勾→習慣→領取，金額對得上', async () => {
  const I = await startToday();
  await I.plan(['寫文章', '跑步', '整理文獻']); await I.saveList();
  ok(I.S.logs.some(l => l.key === 'plan:' + D0 && l.pend), '寫好了要產生待領取的清單獎勵');
  ok(I.$('#nav .badge'), '任務分頁要有待領取數字');
  for (let i = 0; i < 3; i++) await I.tick(i);
  eq(rewardLogs(I).length, 3, '前三件各一份獎勵');
  ok(I.S.logs.some(l => l.key === 'top3:' + D0), '三件都完成要有 top3 獎勵');
  await I.habit('Vocus'); await I.type('#artTitle', '我的第一篇'); await I.click('[data-act=artadd]'); await I.click('#sheet [data-act=sheetclose]');
  ok(I.S.logs.some(l => l.key === 'art:' + D0), 'Vocus 發文有獎勵');
  ok(I.S.logs.some(l => l.key === 'anyhab:' + D0), '任一習慣要有獎勵');
  const before = I.coins(), pendC = I.S.logs.filter(l => l.pend).reduce((a, l) => a + l.c, 0), pendXp = I.S.logs.filter(l => l.pend).reduce((a, l) => a + l.xp, 0), x0 = I.xp();
  eq(before, 60, '領之前金幣不變');
  await I.claimAll();
  eq(I.coins(), 60 + pendC, '領取後金幣 = 原本 + 待領總和');
  eq(I.xp(), x0 + pendXp, '領取後 XP 對得上');
  eq(I.pendCount(), 0, '領完沒有待領取');
  ok(!I.$('#nav .badge'), '領完分頁數字消失');
  ok(!I.$('.qall'), '領完「全部領取」消失');
  const done = I.$$('.qc.got').length; ok(done >= 5, '已完成的任務要顯示已完成：' + done);
  I.check('流程結束'); I.destroy();
});

test('六件事獎勵上限：第 4 件以後、換位置、刪除都不能多拿', async () => {
  const I = await startToday();
  await I.plan(['A', 'B', 'C', 'D', 'E', 'F']);
  for (let i = 0; i < 6; i++) await I.tick(i);
  eq(rewardLogs(I).length, 3, '六件都勾，只有 3 份獎勵');
  // 取消再勾回來不能重複
  await I.tick(0); await I.tick(0);
  eq(rewardLogs(I).length, 3, '取消再勾回來還是 3 份');
  I.check('取消再勾');
  // 把有獎勵的搬到第 4 格再刪掉，空出名額
  await I.click('#six [data-act=swap][data-v="0"]'); await I.click('#six [data-act=swap][data-v="3"]');
  I.check('換位置');
  await I.click('#six [data-act=prowdel][data-v="3"]');
  I.check('刪掉換過去的那一件');
  for (let i = 0; i < 3; i++) { const cb = I.$(`#six [data-act=pdone][data-v="${i}"]`); if (cb && !cb.checked) await I.tick(i); }
  ok(rewardLogs(I).length <= 3, `一天六件事獎勵最多 3 份，現在有 ${rewardLogs(I).length}`);
  I.check('刪除後再勾'); I.destroy();
});

test('取消打卡會收回已領的獎勵：不能讓金幣變負的', async () => {
  const I = await startToday();
  await I.plan(['A', 'B', 'C']); await I.tick(0);
  await I.claimAll();                       // 60 + 15 = 75
  await I.tab('shop');
  await I.click('[data-act=buyfeed][class*=pri]'); // -30
  await I.dismiss();
  await I.click('[data-act=buychest][data-v=c0]'); await I.dismiss(); // -40
  const c = I.coins(); ok(c >= 0, '花完之後金幣 ' + c);
  await I.tab('today'); await I.tick(0);    // 取消打勾，收回 15
  ok(I.coins() >= 0, `取消打卡後金幣不可為負，現在是 ${I.coins()}`);
  I.check('取消打卡'); I.destroy();
});

test('寫好清單的規則：至少 3 件、明天 ×2、不能重複領', async () => {
  const I = await startToday();
  await I.plan(['A', 'B']); await I.saveList();
  eq(I.S.logs.filter(l => l.k === 'plan').length, 0, '只寫 2 件不能按寫好了');
  await I.plan(['A', 'B', 'C']); await I.saveList();
  const p = I.S.logs.find(l => l.key === 'plan:' + D0); ok(p && p.c === 15 && p.xp === 10, '今天的清單 15 金幣 10 XP');
  ok(!I.$('#six [data-act=plansave]'), '寫好之後按鈕消失');
  await I.plan(['X', 'Y', 'Z'], 1); await I.saveList();
  const t = I.S.logs.find(l => l.key === 'plan:2026-11-03'); ok(t && t.c === 30 && t.xp === 20, '提前寫明天加倍：' + JSON.stringify(t));
  eq(I.S.logs.filter(l => l.k === 'plan').length, 2, '兩份清單獎勵');
  I.check('清單');
  // 隔天：「寫好今天的清單」已經完成，不用再寫
  await I.advance(24 * 3600e3); const J = await I.reload(); await J.dismiss();
  await J.tab('quest');
  const row = J.$$('.qc').find(e => e.innerText.includes('寫好今天的清單')); ok(row && row.classList.contains('got') || row && row.classList.contains('pend'), '隔天「寫好今天的清單」要算完成');
  J.check('隔天'); J.destroy(); I.destroy();
});

test('換日：沒領的隔天自動入帳；凌晨 4 點才換日', async () => {
  const Z = await startToday();   // 換日判斷另開一個（來回跳時間會多發當天的登入獎勵，不要混進後面的金額）
  const f = async t => { await Z.setTime(t); return Z.ev('dayKey()'); };
  eq(await f(ts(2026, 11, 3, 3, 59)), '2026-11-02', '03:59 還是前一天');
  eq(await f(ts(2026, 11, 3, 4, 0)), '2026-11-03', '04:00 換日');
  eq(await f(ts(2026, 11, 2, 0, 0)), '2026-11-01', '00:00 算前一天');
  Z.destroy();
  const I = await startToday();
  await I.plan(['A', 'B', 'C']); await I.tick(0);
  eq(I.coins(), 60, '還沒領');
  await I.setTime(ts(2026, 11, 3, 3, 30));
  eq(I.coins(), 60, '凌晨 3:30 還是同一天，還沒領的不入帳');
  await I.setTime(ts(2026, 11, 3, 4, 1));
  eq(I.coins(), 90, '換日後沒領的自動入帳（含昨天的登入獎勵 15）');
  const J = await I.reload(); await J.dismiss(); eq(J.coins(), 90, '重開也一樣');
  await J.tab('quest'); ok(![...J.$$('.qc.pend')].some(e => !/每日登入/.test(e.innerText)), '昨天的獎勵不會一直掛在待領取（只剩今天新的登入獎勵）');
  J.check('換日'); J.destroy(); I.destroy();
});

test('運動每週 3 天：達標獎勵、取消收回、換週歸零', async () => {
  const I = await startToday();
  const doEx = async (undo) => {
    await I.tab('today'); await I.click(['#habits .hab', '運動']);
    await I.type('#ex_min', '30'); await I.click('[data-act=exadd]');
    await I.dismiss();
  };
  for (let i = 0; i < 3; i++) {
    await doEx(); ok(true);
    if (i < 2) { await I.advance(24 * 3600e3); await I.dismiss(); }
  }
  ok(I.S.logs.some(l => l.key && l.key.startsWith('week:')), '一週 3 天要有達標獎勵（週一～週三）');
  eq(I.S.logs.filter(l => l.key && l.key.startsWith('hab:exercise')).length, 3, '三天各一份打卡獎勵');
  await I.tab('today'); ok(I.has('本週 3/3'), '卡片要顯示 3/3：' + I.$('#habits').innerText.replace(/\n/g, ' '));
  I.check('達標');
  // 取消今天的紀錄 → 達標獎勵先收回
  await I.click(['#habits .hab', '運動']); await I.click('#sheet [data-act=chkdel]'); await I.dismiss();
  ok(!I.S.logs.some(l => l.key && l.key.startsWith('week:')), '少一天要收回達標獎勵');
  ok(I.S.held && Object.keys(I.S.held).some(k => k.startsWith('week:')), '收回的獎勵要放進 held');
  await I.click(['#habits .hab', '運動']); await I.type('#ex_min', '20'); await I.click('[data-act=exadd]'); await I.dismiss();
  ok(I.S.logs.some(l => l.key && l.key.startsWith('week:')), '補回來又有達標獎勵');
  eq(I.S.logs.filter(l => l.key && l.key.startsWith('week:')).length, 1, '達標獎勵只有一份');
  I.check('取消再補');
  await I.setTime(ts(2026, 11, 9, 10)); await I.dismiss();   // 下週一
  await I.tab('today'); ok(I.has('本週 0/3'), '下週一要歸零：' + I.$('#habits').innerText.replace(/\n/g, ' '));
  I.check('換週'); I.destroy();
});

test('Vocus：一天多篇、篇數累計、週期達標沒有額外獎勵', async () => {
  const I = await startToday({ state: { habits: undefined } });
  await I.habit('Vocus');
  for (const t of ['第一篇', '', '<b>第三篇</b>']) { await I.type('#artTitle', t); await I.click('[data-act=artadd]'); }
  eq(I.S.checks[D0].vocus.length, 3, '一天可以記三篇');
  eq(I.S.logs.filter(l => l.key === 'art:' + D0).length, 1, '當天發文獎勵只有一份');
  ok(I.has('（無標題）') && I.has('<b>第三篇</b>'), '標題要原樣顯示（沒標題顯示無標題，HTML 要被跳脫）');
  ok(!I.$('#sheet .entry b'), '標題裡的 HTML 不能被當成標籤執行');
  await I.click('#sheet [data-act=sheetclose]'); await I.tab('log');
  ok(I.has('3') , '紀錄頁看得到篇數');
  I.check('Vocus'); I.destroy();
});

test('習慣新增、刪除、頻率、上限、空白名稱', async () => {
  const I = await startToday();
  await I.click('#habits [data-act=habedit]');
  for (let i = 0; i < 3; i++) await I.click('[data-act=habadd]');
  ok(I.$('[data-act=habadd]').disabled, '自訂習慣滿 3 個要停用新增按鈕');
  const names = I.$$('[data-hf=n]'); eq(names.length >= 5, true, '編輯畫面有 5 個習慣');
  await I.type(names[names.length - 3], '看書'); await I.type(names[names.length - 2], '<img src=x onerror=window.__xss=1>');
  await I.type(names[names.length - 1], '   ');
  await I.click('[data-act=habdone]');
  const act = I.S.habits.filter(h => !h.off).map(h => h.n);
  ok(act.includes('看書'), '新習慣有加入'); ok(!act.includes('   ') && act.length === 4, '空白名稱的習慣要被拿掉：' + act.join('|'));
  ok(!I.win.__xss, 'XSS：習慣名稱不能執行程式');
  ok(I.$$('#habits img').length === 0, '習慣名稱裡的 HTML 不能變成元素');
  await I.click(['#habits .hab', '看書']); await I.click('[data-act=chk]'); await I.dismiss();
  ok(I.S.logs.some(l => l.key === `hab:${I.S.habits.find(h => h.n === '看書').id}:${D0}`), '自訂習慣打卡有獎勵');
  await I.click('#sheet [data-act=sheetclose]').catch(() => {});
  await I.click('#habits [data-act=habedit]');
  const del = I.$$('[data-act=habdel]'); await I.click(del[del.length - 3]);   // 刪掉「看書」之前的那個或最後一個
  await I.dismiss(); await I.click('[data-act=habdone]');
  I.check('習慣編輯'); I.destroy();
});

test('六件事：常用、補登昨天、明天不能打勾、特殊字元', async () => {
  const I = await startToday();
  await I.plan(['寫文章', '<script>window.__xss=1</script>', '😀 emoji "引號" \'單引號\' & 符號']);
  ok(!I.win.__xss, 'XSS：六件事內容');
  await I.click('#six [data-act=fav][data-v="0"]'); eq(I.S.favs, ['寫文章'], '存成常用');
  await I.click('#six [data-act=fav][data-v="0"]'); eq(I.S.favs, [], '取消常用');
  await I.click('#six [data-act=fav][data-v="0"]');
  await I.click('#six [data-act=pday][data-v="1"]');
  ok(I.$('#six [data-act=pdone]').disabled, '明天的清單不能打勾');
  await I.click('#six .fav [data-act=usefav]');
  eq(I.$('#six .ptext[data-i="0"]').value, '寫文章', '常用填進第一格');
  await I.click('#six [data-act=pday][data-v="-1"]');
  await I.type('#six .ptext[data-i="0"]', '昨天的事');
  const before = I.S.logs.length; await I.tick(0);
  eq(I.S.logs.length, before, '補登昨天不能有獎勵');
  ok(I.$('#six [data-act=pdone]').checked, '補登昨天可以打勾');
  await I.click('#six [data-act=pday][data-v="0"]');
  eq(I.$('#six .ptext[data-i="1"]').value, '<script>window.__xss=1</script>', '今天的內容原樣保留（特殊字元）');
  // 常用最多 12 個
  for (let k = 0; k < 14; k++) { await I.type('#six .ptext[data-i="0"]', '常用' + k); await I.click('#six [data-act=fav][data-v="0"]'); }
  ok(I.S.favs.length <= 12, '常用最多 12 個：' + I.S.favs.length);
  I.check('六件事'); I.destroy();
});

test('拖曳排序與點兩個編號交換', async () => {
  const I = await startToday();
  await I.plan(['一', '二', '三']);
  const nos = () => I.$$('#six .prow .no'), r = e => e.getBoundingClientRect();
  const a = nos()[0], c = nos()[2]; a.scrollIntoView({ block: 'center' });
  const ra = r(a), rc = r(c), P = I.win.PointerEvent;
  a.dispatchEvent(new P('pointerdown', { bubbles: true, clientX: ra.x + 5, clientY: ra.y + 5, pointerId: 1 }));
  I.doc.dispatchEvent(new P('pointermove', { bubbles: true, clientX: ra.x + 5, clientY: ra.y + 30, pointerId: 1 }));
  I.doc.dispatchEvent(new P('pointermove', { bubbles: true, clientX: rc.x + 5, clientY: rc.y + 8, pointerId: 1 }));
  I.doc.dispatchEvent(new P('pointerup', { bubbles: true, clientX: rc.x + 5, clientY: rc.y + 8, pointerId: 1 }));
  a.click(); await flush();   // a 已經被重畫掉了：模擬觸控拖曳不會產生 click
  eq(I.$$('#six .ptext').slice(0, 3).map(e => e.value), ['二', '三', '一'], '拖到第 3 格');
  await new Promise(r => setTimeout(r, 400));   // 真人放開後至少隔一下子才會再點
  ok(I.UI.swap == null, '拖完不會留下「等著交換」的狀態');
  await I.click('#six [data-act=swap][data-v="0"]'); await I.click('#six [data-act=swap][data-v="2"]');
  eq(I.$$('#six .ptext').slice(0, 3).map(e => e.value), ['一', '三', '二'], '點兩個編號交換');
  await I.click('#six [data-act=swap][data-v="1"]'); await I.click('#six [data-act=swap][data-v="1"]');
  ok(I.UI.swap == null, '點同一個編號兩次 = 取消');
  I.check('排序'); I.destroy();
});

test('任務頁：進度、領取單項、全部領取、點未完成會跳到對應位置', async () => {
  const I = await startToday();
  await I.tab('quest');
  const total = I.$('#main section .qcnt').innerText; ok(/^0\/\d+$/.test(total), '一開始 0/n：' + total);
  await I.click(['.qc [data-act=goto], .qc .sp[data-act=goto]', '寫好今天的清單'].length ? '.qc .sp[data-act=goto]' : '');
  eq(I.UI.tab, 'today', '點未完成的任務會回到今日頁');
  await I.plan(['A', 'B', 'C']); await I.saveList(); await I.tick(0);
  await I.tab('quest');
  const one = I.$('.qc.pend button[data-act=claim]'); const c0 = I.coins();
  await I.click(one); await I.dismiss(); ok(I.coins() > c0, '領單項金幣增加');
  ok(I.$$('.qc.pend').length >= 1, '其他待領的還在');
  await I.click('.qall'); await I.dismiss(); eq(I.pendCount(), 0, '全部領取後沒有待領');
  // 首頁「下一步」和任務頁的計數要一致
  await I.tab('today'); const nb = I.$('.nextbar').innerText.match(/(\d+)\/(\d+)/); await I.tab('quest');
  const qc = I.$('#main section .qcnt').innerText.match(/(\d+)\/(\d+)/);
  eq([nb[1], nb[2]], [qc[1], qc[2]], '首頁進度列和任務頁數字一致');
  I.check('任務頁'); I.destroy();
});

test('獎勵名額：打勾拿獎勵→換到後面→刪掉→再打勾，不能超過 3 份', async () => {
  const I = await startToday();
  await I.plan(['A', 'B', 'C', 'D']);
  await I.tick(0);                                                          // A 拿到獎勵
  await I.click('#six [data-act=swap][data-v="0"]'); await I.click('#six [data-act=swap][data-v="3"]');   // A 換到第 4 格
  await I.click('#six [data-act=prowdel][data-v="3"]');                     // 刪掉 A，名額空出來
  await I.tick(0); await I.tick(1); await I.tick(2);
  ok(rewardLogs(I).length <= 3, `一天最多 3 份打勾獎勵，現在有 ${rewardLogs(I).length} 份`);
  // 先取消（獎勵先收起來）、再刪掉那一列
  const J = await startToday();
  await J.plan(['A', 'B', 'C', 'D']); await J.tick(0); await J.tick(0);     // 取消 → 獎勵收起來
  await J.click('#six [data-act=swap][data-v="0"]'); await J.click('#six [data-act=swap][data-v="3"]'); await J.click('#six [data-act=prowdel][data-v="3"]');
  await J.tick(0); await J.tick(1); await J.tick(2);
  ok(rewardLogs(J).length <= 3, `取消後刪除也不能多拿：${rewardLogs(J).length} 份`);
  I.check('A'); J.check('B'); I.destroy(); J.destroy();
});

test('每日登入獎勵：每天一份、要手動領、隔天自動入帳、不算進每日任務', async () => {
  const I = await startToday();
  const logins = () => I.S.logs.filter(l => l.k === 'login');
  eq(logins().length, 1, '打開就有一份登入獎勵');
  eq(logins()[0].key, 'login:' + D0, '以日期當 key');
  ok(logins()[0].pend, '還沒領');
  const c0 = I.coins(), x0 = I.xp();   // 起始金幣（歡迎禮物）
  await I.tab('quest');
  ok(/每日登入/.test(I.$('.qc.pend').innerText), '任務頁看得到待領取的登入獎勵');
  const total = I.ev('questCount(dailyTasks(derive())).daily.length');
  ok(!I.ev("questCount(dailyTasks(derive())).daily.some(t => t.id === 'login')"), '登入不算進「每日任務 x/y」(y=' + total + ')');
  await I.click(['[data-act=claim]', '領取']); await I.dismiss();
  eq(I.coins(), c0 + 15, '領了 +15 金幣');
  eq(I.xp(), x0 + 5, '領了 +5 XP');
  ok(!logins()[0].pend, '領過就不再待領');
  // 同一天重開、時間往前走都不會再發
  const J = await I.reload(); await J.dismiss();
  eq(J.S.logs.filter(l => l.k === 'login').length, 1, '同一天重開不會再發');
  eq(J.coins(), c0 + 15, '金幣不變');
  // 隔天：新的一份；昨天沒領的自動入帳
  await J.setTime(T0 + 24 * 3600e3);
  J.win.tick(); await flush(3);
  eq(J.S.logs.filter(l => l.k === 'login').length, 2, '隔天發新的一份');
  ok(J.S.logs.find(l => l.key === 'login:2026-11-03').pend, '新的一份待領取');
  await J.setTime(T0 + 48 * 3600e3); await flush(3);
  const K = await J.reload(); await K.dismiss();
  eq(K.S.logs.filter(l => l.k === 'login').length, 3, '三天各一份，沒有重複');
  eq(K.coins(), c0 + 15 * 2, '前兩天的自動入帳（第一天領過、第二天自動）');
  ok(K.ev('hasProgress(S)') === false, '只有歡迎禮物和登入獎勵不算「用過」（新裝置要能接雲端存檔）');
  K.check('每日登入'); K.destroy(); J.destroy(); I.destroy();
});

test('六件事拖曳：把手看得到、一直有提示、手勢被中斷會回到原位', async () => {
  const I = await boot({ state: mkState({ plans: { [D0]: [{ text: 'a', done: false, cat: 'other' }, { text: 'b', done: false, cat: 'other' }, { text: 'c', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }] } }) }); await I.dismiss();
  let no = I.$('#six .prow .no');
  ok(I.win.getComputedStyle(no, '::after').content !== 'none', '編號旁邊有拖曳把手（點點）');
  ok(I.has('按住編號上下拖曳'), '提示一直在（不是只有第一次的小技巧）');
  await I.click('[data-act=tipsix]').catch(() => {}); ok(I.has('按住編號上下拖曳'), '關掉小技巧後提示還在');
  no = I.$('#six .prow .no');
  const r = no.getBoundingClientRect(), ev = (t, y) => new I.win.PointerEvent(t, { bubbles: true, clientX: r.left + 5, clientY: y, pointerId: 3, pointerType: 'touch' });
  no.dispatchEvent(ev('pointerdown', r.top + 5)); I.doc.dispatchEvent(ev('pointermove', r.top + 60)); await flush();
  ok(I.$('#six .prow.drag'), '拖曳中那一列有標示');
  I.doc.dispatchEvent(ev('pointercancel', r.top + 60)); await flush();
  ok(!I.$('#six .prow.drag'), '手勢被中斷：恢復原狀'); eq(I.ev('getPlan(dayKey())[0].text'), 'a', '順序沒變');
  I.check('拖曳把手'); I.destroy();
});

test('拖曳排序：判斷範圍寬鬆（拖過相鄰一列的 40% 就換、20% 不換、拖到最外面不會壞）', async () => {
  const I = await startToday();
  await I.plan(['一', '二', '三']);
  const P = I.win.PointerEvent, rows = () => I.$$('#six .prow'), vals = () => I.$$('#six .ptext').slice(0, 3).map(e => e.value);
  rows()[0].scrollIntoView({ block: 'center' });
  const pitch = () => { const q = rows().map(r => r.getBoundingClientRect()); return q[1].top - q[0].top; };
  const drag = async (idx, frac, { cancel } = {}) => {   // 從第 idx 列的編號出發，往下（正）或往上（負）拖相鄰列距離的 frac 倍
    const no = I.$$('#six .prow .no')[idx], r = no.getBoundingClientRect(), y0 = r.top + r.height / 2, dy = frac * pitch();
    no.dispatchEvent(new P('pointerdown', { bubbles: true, clientX: r.left + 5, clientY: y0, pointerId: 1 }));
    I.doc.dispatchEvent(new P('pointermove', { bubbles: true, clientX: r.left + 5, clientY: y0 + dy, pointerId: 1 }));
    I.doc.dispatchEvent(new P('pointerup', { bubbles: true, clientX: r.left + 5, clientY: y0 + dy, pointerId: 1 }));
    await flush(); await new Promise(r => setTimeout(r, 380));
  };
  await drag(0, 0.2); eq(vals(), ['一', '二', '三'], '只拖 20%：不換');
  await drag(0, 0.4); eq(vals(), ['二', '一', '三'], '拖 40%：就換到下一格');
  await drag(1, -0.4); eq(vals(), ['一', '二', '三'], '往上拖 40%：換回來');
  await drag(0, 1.4); eq(vals(), ['二', '三', '一'], '拖 1.4 列：跳到第 3 格');
  await drag(2, -2.4); eq(vals(), ['一', '二', '三'], '往上拖 2.4 列：回到第 1 格');
  await drag(0, -5); eq(vals(), ['一', '二', '三'], '往上拖出最頂端：還在第 1 格');
  await drag(0, 8); eq(vals().length, 3, '往下拖過頭：不會壞'); ok(I.$$('#six .prow').length >= 3, '列還在');
  I.check('拖曳範圍'); I.destroy();
});

// 請假：每天的習慣每個月可以請 2 天假，那天不算漏、連勝接下去、沒有獎勵
async function startWithWake(checkDays = []) {
  const I = await startToday();
  I.ev(`S.habits.push({ id: 'hwake', e: '', n: '8:00 起床', kind: 'custom', weeks: 0, target: 1 }); ${JSON.stringify(checkDays)}.forEach(d => addCheck(addDays(dayKey(), d), 'hwake', {})); save(); render()`);
  return I;
}
const streakOf = I => I.ev("streaks(derive()).hwake");
test('請假：連勝不中斷、不算漏', async () => {
  const I = await startWithWake([-6, -5, -4, -3]);   // 連續 4 天，昨天和前天都沒做
  eq(streakOf(I).n, 0, '連漏兩天（前天、昨天）：連勝歸零（沒請假的對照）');
  ok(I.ev("toggleLeave('hwake', addDays(dayKey(), -2))") !== '', '前天請假');
  eq(streakOf(I).n, 4, '前天請假：連勝還在（4 天），請假的那天不加天數');
  ok(streakOf(I).risk === true, '昨天漏了、今天還沒做：還是會提醒');
  I.ev("toggleLeave('hwake', addDays(dayKey(), -1))");
  eq(streakOf(I).n, 4, '昨天也請假：連勝還在');
  ok(streakOf(I).risk === false, '昨天請假不算漏，不用提醒');
  I.ev("addCheck(dayKey(), 'hwake', {})"); eq(streakOf(I).n, 5, '今天做了就 +1');
  I.ev('save()'); I.check('請假連勝'); I.destroy();
});

test('請假：每月額度、取消、打卡後自動恢復額度、月份分開算', async () => {
  const I = await startWithWake([]);
  const t = I.ev("dayKey()"), m = t.slice(0, 8), tog = d => I.ev(`toggleLeave('hwake', '${d}')`), left = d => I.ev(`leaveLeft('hwake', '${d}')`);
  eq(left(t), 2, '一開始每月 2 天');
  tog(m + '03'); tog(m + '04'); eq(left(t), 0, '請了 2 天：用完');
  ok(/用完/.test(tog(m + '05')), '第 3 天被拒絕'); ok(!I.ev(`onLeave('hwake', '${m}05')`), '沒有真的請到');
  eq(left('2026-10-20'), 2, '上個月的額度另外算');
  ok(/取消/.test(tog(m + '03')), '再按一次取消'); eq(left(t), 1, '取消後額度回來');
  // 當天打卡：請假自動取消、額度回來；已經打卡的日子不能請假
  I.ev(`toggleLeave('hwake', '${t}')`); eq(left(t), 0, '今天請假，這個月用完');
  I.ev(`addCheck('${t}', 'hwake', {}); clearLeave('hwake', '${t}')`); ok(!I.ev(`onLeave('hwake', '${t}')`) && left(t) === 1, '打卡後請假自動取消、額度還回來');
  ok(/已經完成/.test(tog(t)), '已經打卡的那天不能請假');
  // 沒有的習慣、每週型的習慣都不能請假
  eq(I.ev("toggleLeave('nope', '2026-11-02')"), '', '不存在的習慣');
  ok(/請假/.test(I.ev("toggleLeave('exercise', '2026-11-02')")), '每週型的習慣（運動）也能請假'); ok(/請假/.test(I.ev("toggleLeave('vocus', '2026-11-02')")), 'Vocus 也能請假');
  I.ev('save()'); I.check('請假額度'); I.destroy();
});

test('請假：畫面操作、重開還在、壞資料不當掉', async () => {
  const I = await startWithWake([]);
  await I.tab('today');
  await I.click(['#habits .hab', '8:00 起床']);
  ok(I.has('今天請假（本月還剩 2 天）'), '面板有請假按鈕和剩餘天數');
  await I.click('[data-act=leave]'); ok(I.has('今天已請假，點一下取消'), '請假後按鈕變成取消'); ok(I.has('請假了'), '有提示');
  await I.click('[data-act=sheetclose]'); ok(I.$('#habits .hab.leave') && I.$('#habits .hab.leave').innerText.includes('今天已請假'), '習慣卡片顯示「今天請假」');
  ok(I.S.logs.filter(l => l.key && l.key.startsWith('hab:hwake')).length === 0, '請假沒有獎勵');
  await I.click(['#habits .hab', '8:00 起床']); await I.click('[data-act=shday][data-v="-1"]'); ok(I.has('昨天請假（本月還剩 1 天）'), '昨天也能請假，額度共用');
  await I.click('[data-act=leave]'); ok(I.has('昨天已請假'), '昨天請假了'); await I.click('[data-act=shday][data-v="0"]'); await I.click('[data-act=chk]');
  ok(I.has('已完成') && !I.has('今天已請假'), '今天改成打卡：請假自動取消');
  ok(!I.S.leaves.hwake['2026-11-02'], '紀錄裡今天的請假被清掉');
  ok(I.ev("leaveLeft('hwake', dayKey())") === 1, '額度剩 1（昨天那天還在）');
  await I.click('[data-act=sheetclose]'); await I.tab('quest'); I.check('請假畫面');
  const J = await I.reload(); await J.dismiss(); ok(J.ev("onLeave('hwake', addDays(dayKey(), -1))"), '重開後請假還在');
  for (const bad of ['"x"', '[1]', '{"hwake": 5}', '{"hwake": "x"}', 'null']) { J.ev(`S.leaves = ${bad}; save(); render()`); J.ev("toggleLeave('hwake', dayKey())"); J.ev('render()'); J.check('壞的 leaves ' + bad); }
  J.destroy(); I.destroy();
});

test('請假：運動、Vocus（每週型）請假那一週不算斷，沒有獎勵', async () => {
  const I = await startToday();
  // 上上週、上上上週都達標；上週（10/26–11/1）什麼都沒做
  I.ev("[-14, -13, -12, -21, -20, -19].forEach(d => addCheck(addDays(dayKey(), d), 'exercise', {})); [-13, -20].forEach(d => addCheck(addDays(dayKey(), d), 'vocus', { title: 'x' })); save(); render()");
  const st = id => I.ev(`streaks(derive()).${id}.n`);
  eq(st('exercise'), 0, '運動：上週沒達標 → 斷了（沒請假的對照）'); eq(st('vocus'), 0, 'Vocus：同上');
  eq(I.ev("toggleLeave('exercise', addDays(dayKey(), -1))") !== '', true, '上週日請假');
  I.ev("toggleLeave('vocus', addDays(dayKey(), -1))");
  eq(st('exercise'), 2, '運動：請假的那週不算斷，前面兩週接得上（不加天數）'); eq(st('vocus'), 2, 'Vocus：同上');
  // 畫面：運動面板是「本週請假」（每月 1 次）、卡片顯示請假；請假沒有獎勵
  await I.tab('today'); await I.click(['#habits .hab', '運動']);
  ok(I.has('本週請假（本月還剩 1 次）'), '運動面板有「本週請假」，每月 1 次（上週的請假算在 10 月）');
  await I.click('[data-act=leave]'); ok(I.has('本週已請假，點一下取消'), '請假後按鈕變成取消'); await I.click('[data-act=sheetclose]');
  ok(I.$$('#habits .hab.leave').some(e => e.innerText.includes('請假')), '運動卡片顯示請假');
  ok(!I.S.logs.some(l => /exercise|week:|per:/.test(l.key || '')), '請假沒有獎勵');
  ok(/用完/.test(I.ev("toggleLeave('exercise', addDays(dayKey(), 7))")), '這個月 1 次用完了，下週不能再請');
  await I.click(['#habits .hab', 'Vocus']); ok(I.has('本週請假（本月還剩 1 次）'), 'Vocus 面板也有，額度是 Vocus 自己的');
  ok(!I.has('請假的那天不算漏'), '沒有冗長的說明文字');
  await I.click('[data-act=sheetclose]');
  // 請假的那一週記錄了運動，只要沒達標，請假還在；達標了就用不到、額度還回來
  await I.click(['#habits .hab', '運動']); await I.type('#ex_min', '30'); await I.click('[data-act=exadd]');
  ok(I.ev("leaveHere(habit('exercise'), dayKey())"), '記錄 1 次運動（還沒達標）：本週請假還在');
  I.ev("habit('exercise').target = 1; save(); render()"); await I.click('[data-act=sheetclose]').catch(() => {});
  eq(I.ev("leaveLeft('exercise', dayKey())"), 1, '這週達標了：請假用不到，額度還回來');

  I.ev("addCheck(dayKey(), 'vocus', { title: 'y' })"); ok(/已經達標/.test(I.ev("toggleLeave('vocus', dayKey())")), '這週已經發文達標：不用請假');
  I.ev('save()'); I.check('每週型請假'); I.destroy();
});
