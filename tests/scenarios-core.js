// 核心流程：每日循環、獎勵上限與取消、換日、週期、習慣、六件事
const rewardLogs = I => I.S.logs.filter(l => l.k === 'check');
async function startToday(o = {}) { const I = await boot({ state: mkState(o.state), ...o }); await I.dismiss(); return I; }

test('全新使用者：歡迎彈窗、60 金幣、沒有 Vocus 習慣', async () => {
  const I = await boot({ seed: {} });
  ok(!I.$('#ov').classList.contains('hidden'), '第一次進來應該跳出歡迎彈窗');
  ok(I.has('小丑魚'), '歡迎彈窗要寫小丑魚');
  I.check('剛進來');
  await I.dismiss();
  eq(I.coins(), 60, '歡迎禮物 60 金幣');
  ok(!I.has('Vocus') && !I.has('發文節奏'), '不會問 Vocus 發文節奏');
  eq(I.S.habits.map(h => h.id), ['exercise'], '內建習慣只有運動');
  const I2 = await I.reload(); await I2.dismiss();
  eq(I2.coins(), 60, '重開後金幣還是 60（不會再送一次歡迎禮物）');
  eq(I2.S.logs.filter(l => l.k === 'welcome').length, 1, '歡迎禮物只有一筆');
  ok(!I2.has('Vocus'), '重開後也沒有 Vocus');
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
  await I.habit('運動'); await I.type('#ex_min', '30'); await I.click('[data-act=exadd]'); ok(!I.UI.sheet,'運動成功後自動收起');
  ok(I.S.logs.some(l => l.key === 'hab:exercise:' + D0), '運動打卡有獎勵');
  ok(I.S.logs.some(l => l.key === 'anyhab:' + D0), '任一習慣要有獎勵');
  const before = I.coins(), pendC = I.S.logs.filter(l => l.pend).reduce((a, l) => a + l.c, 0), pendXp = I.S.logs.filter(l => l.pend).reduce((a, l) => a + l.xp, 0), x0 = I.xp();
  eq(before, 60, '領之前金幣不變');
  await I.claimAll();
  eq(I.coins(), 60 + pendC, '領取後金幣 = 原本 + 待領總和');
  eq(I.xp(), x0 + pendXp, '領取後 XP 對得上');
  eq(I.pendCount(), 0, '領完沒有待領取');
  ok(!I.$('#nav .badge'), '領完分頁數字消失');
  ok(!I.$('.qall'), '領完「全部領取」消失');
  const done = I.$$('.qc.got').length; ok(done >= 4, '已完成的任務要顯示已完成：' + done);
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
  await I.click('.shop [data-act=buyfeed]'); // -30
  await I.dismiss();
  await I.click('[data-act=buychest][data-v=c0]'); await I.dismiss(); // -40
  const c = I.coins(); ok(c >= 0, '花完之後金幣 ' + c);
  await I.tab('today'); await I.tick(0);    // 取消打勾，收回 15
  ok(I.coins() >= 0, `取消打卡後金幣不可為負，現在是 ${I.coins()}`);
  I.check('取消打卡'); I.destroy();
});

test('寫好清單的規則：至少 3 件、明天一樣算、不能重複領', async () => {
  const I = await startToday();
  await I.plan(['A', 'B']); await I.saveList();
  eq(I.S.logs.filter(l => l.k === 'plan').length, 0, '只寫 2 件不能按寫好了');
  await I.plan(['A', 'B', 'C']); await I.saveList();
  const p = I.S.logs.find(l => l.key === 'plan:' + D0); ok(p && p.c === 15 && p.xp === 10, '今天的清單 15 金幣 10 XP');
  ok(!I.$('#six [data-act=plansave]'), '寫好之後按鈕消失');
  await I.plan(['X', 'Y', 'Z'], 1); await I.saveList();
  const t = I.S.logs.find(l => l.key === 'plan:2026-11-03'); ok(t && t.c === 15 && t.xp === 10, '提前寫明天不加倍：' + JSON.stringify(t));
  eq(I.S.logs.filter(l => l.k === 'plan').length, 2, '兩份清單獎勵');
await I.tab('quest'); eq(I.$$('.qc .qn').map(e => e.innerText).filter(x => /清單|完成 3 件/.test(x)), ['寫好清單', '完成 3 件事'], '任務只有兩列：寫好清單（今天明天都算）、任意 3 件事（含完成三件加碼）'); ok(!I.has('×2'), '沒有加倍的字樣'); await I.tab('today');
  I.check('清單');
  // 隔天：「寫好今天的清單」已經完成，不用再寫
  await I.advance(24 * 3600e3); const J = await I.reload(); await J.dismiss();
  await J.tab('quest');
  const row = J.$$('.qc').find(e => e.innerText.includes('寫好清單')); ok(row && row.classList.contains('got') || row && row.classList.contains('pend'), '隔天「寫好清單」要算完成');
  J.check('隔天'); J.destroy(); I.destroy();
});

test('換日：沒領的隔天自動入帳；午夜 00:00 換日', async () => {
  const Z = await startToday();   // 換日判斷另開一個（來回跳時間會多發當天的登入獎勵，不要混進後面的金額）
  const f = async t => { await Z.setTime(t); return Z.ev('dayKey()'); };
  eq(await f(ts(2026, 11, 2, 23, 59)), '2026-11-02', '23:59 還是當天');
  eq(await f(ts(2026, 11, 3, 0, 0)), '2026-11-03', '00:00 換日');
  eq(await f(ts(2026, 11, 3, 3, 59)), '2026-11-03', '凌晨已算新的一天');
  Z.destroy();
  const I = await startToday();
  await I.plan(['A', 'B', 'C']); await I.tick(0);
  eq(I.coins(), 60, '還沒領');
  await I.setTime(ts(2026, 11, 2, 23, 59));
  eq(I.coins(), 60, '23:59 還是同一天，還沒領的不入帳');
  await I.setTime(ts(2026, 11, 3, 0, 0));
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

test('舊存檔的 Vocus 習慣：設定過或打過卡的改成一般習慣，預設帶的直接移除', async () => {
  const V = { id: 'vocus', e: '✍️', n: 'Vocus', kind: 'vocus', weeks: 1, target: 2 }, EXH = { id: 'exercise', e: '🏃', n: '運動', kind: 'exercise', weeks: 1, target: 3 };
  // 用過的：今天發過文、獎勵還沒領，前一天也有一篇；本週請過假
  const I = await boot({ state: mkState({ v: 7, vocusSet: true, habits: [V, EXH], checks: { [D0]: { vocus: [{ t: 1, title: 'a' }, { t: 2 }] }, '2026-11-01': { vocus: [{ t: 1 }] } },
    logs: [mkState().logs[0], { id: 'p1', t: 1, d: D0, k: 'pubchest', key: 'art:' + D0, xp: 30, c: 30, pend: true }, { id: 'p2', t: 1, d: '2026-11-01', k: 'pubchest', key: 'art:2026-11-01', xp: 30, c: 30 }] }) }); await I.dismiss();
  const h = I.S.habits.find(x => x.id === 'vocus');
  eq([h.kind, h.unit, h.weeks, h.target, h.n], ['custom', '篇', 1, 2, 'Vocus'], '改成一般習慣，名稱和節奏照舊，單位是篇');
  ok(!('vocusSet' in I.S), '舊的設定旗標拿掉'); eq(I.S.v, 8, '存檔版本 8');
  ok(!I.S.logs.some(l => l.k === 'pubchest' || /^art:/.test(l.key || '')), '舊的發文獎勵紀錄改成一般習慣的格式');
  eq(I.S.logs.filter(l => l.key === 'hab:vocus:' + D0).length, 1, '今天的打卡獎勵沒有重複發');
  eq(I.coins(), 60 + 30, '已入帳的金幣不變（昨天那份），今天的還待領');
  eq(I.S.checks[D0].vocus.length, 2, '打卡紀錄原樣保留');
  await I.tab('today'); ok(I.has('本週 1/2 天'), '週期改算天數（今天兩篇算一天）：' + I.$('#habits').innerText.replace(/\s+/g, ' '));
  await I.habit('Vocus'); ok(I.$('#sheet [data-act=chk]') && !I.$('#artTitle'), '面板是一般的打卡按鈕，沒有文章標題欄');
  await I.click('#sheet [data-act=sheetclose]'); await I.tab('log'); ok(!I.has('篇文章'), '紀錄頁不再有「篇文章」的統計');
  I.check('轉換後'); I.destroy();
  // 預設帶的（沒設定節奏、沒打過卡）：直接移除，不再出現發文節奏的問題
  const J = await boot({ state: mkState({ v: 7, vocusSet: false, habits: [V, EXH] }) }); await J.dismiss();
  eq(J.S.habits.map(x => x.id), ['exercise'], '預設的 Vocus 習慣被移除'); await J.tab('today'); ok(!J.has('Vocus') && !J.has('發文節奏'), '畫面上沒有 Vocus');
  J.check('移除後'); J.destroy();
});

test('習慣新增、刪除、頻率、上限、空白名稱', async () => {
  const I = await startToday();
  await I.click('#habits [data-act=habedit]');
  for (let i = 0; i < 3; i++) await I.click('[data-act=habadd]');
  ok(I.$('[data-act=habadd]').disabled, '自訂習慣滿 3 個要停用新增按鈕');
  const names = I.$$('[data-hf=n]'); eq(names.length >= 4, true, '編輯畫面有 4 個習慣');
  await I.type(names[names.length - 3], '看書'); await I.type(names[names.length - 2], '<img src=x onerror=window.__xss=1>');
  await I.type(names[names.length - 1], '   ');
  await I.click('[data-act=habdone]');
  const act = I.S.habits.filter(h => !h.off).map(h => h.n);
  ok(act.includes('看書'), '新習慣有加入'); ok(!act.includes('   ') && act.length === 3, '空白名稱的習慣要被拿掉：' + act.join('|'));
  ok(!I.win.__xss, 'XSS：習慣名稱不能執行程式');
  ok(I.$$('#habits img').length === 0, '習慣名稱裡的 HTML 不能變成元素');
  await I.click(['#habits .hab', '看書']); await I.click('[data-act=chk]'); await I.dismiss();
  ok(I.S.logs.some(l => l.key === `hab:${I.S.habits.find(h => h.n === '看書').id}:${D0}`), '自訂習慣打卡有獎勵');
  await I.click('#sheet [data-act=sheetclose]').catch(() => {});
  await I.click('#habits [data-act=habedit]');
  const del = I.$$('[data-act=habdel]'); await I.click(del[del.length - 3]);   // 刪掉「看書」之前的那個或最後一個
  await I.dismiss(); ok(I.has('漏掉時會自動請假保住連勝：每天型每月 2 天，每週型每月 1 次，用完了再用商店的連勝保護卡'), '編輯畫面的規則說明有提到請假'); await I.click('[data-act=habdone]');
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
  await I.click(['.qc [data-act=goto], .qc .sp[data-act=goto]', '寫好清單'].length ? '.qc .sp[data-act=goto]' : '');
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

test('六件事拖曳：把手看得到、前幾天有提示、手勢被中斷會回到原位', async () => {
  const I = await boot({ state: mkState({ plans: { [D0]: [{ text: 'a', done: false, cat: 'other' }, { text: 'b', done: false, cat: 'other' }, { text: 'c', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }, { text: '', done: false, cat: 'other' }] } }) }); await I.dismiss();
  let no = I.$('#six .prow .no');
  ok(I.win.getComputedStyle(no, '::after').content !== 'none', '編號旁邊有拖曳把手（點點）');
  ok(I.has('按住編號上下拖曳'), '剛開始用：有拖曳提示');
  { const P = d => [{ text: 'x', done: false, cat: 'other' }, ...Array.from({ length: 5 }, () => ({ text: '', done: false, cat: 'other' }))];
    const J = await boot({ state: mkState({ plans: { '2026-10-30': P(), '2026-10-31': P(), '2026-11-01': P() } }) }); await J.dismiss();
    ok(!J.has('按住編號上下拖曳') && J.has('11/02'), '寫過 3 天清單之後只留日期，不再顯示提示'); J.destroy(); }
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
  I.ev("toggleLeave('hwake', addDays(dayKey(), -1))");
  eq(streakOf(I).n, 4, '昨天也請假：連勝還在');
  I.ev("addCheck(dayKey(), 'hwake', {})"); eq(streakOf(I).n, 5, '今天做了就 +1');
  I.ev('save()'); I.check('請假連勝'); I.destroy();
});

test('漏一天就斷：漏掉時自動用掉當月的假，補打卡就退回', async () => {
  const I = await startWithWake([-4, -3, -2]);   // 連續 3 天，昨天沒做
  I.ev("S.strictFrom = addDays(dayKey(), -30)");   // 新規則從一個月前就開始
  eq(streakOf(I).n, 0, '新規則：昨天漏了就斷（還沒自動請假前）');
  I.ev('catchUp()');
  eq(I.ev("leavesOf('hwake')[addDays(dayKey(), -1)]"), 'a', '開 App 時自動幫昨天請假');
  eq(streakOf(I).n, 3, '連勝保住'); eq(I.ev("leaveLeft('hwake', dayKey())"), 1, '本月的假少一天');
  await I.tab('today'); const row = () => I.$$('#habits .riskrow').find(e => e.innerText.includes('8:00 起床'));
  ok(row() && row().innerText.includes('昨天漏了「8:00 起床」，自動用掉 1 天假（本月還剩 1 天），連勝保住了'), '首頁說明用掉了假：' + (row() && row().innerText));
  ok(/自動補上/.test(I.ev("toggleLeave('hwake', addDays(dayKey(), -1))")) && I.ev("onLeave('hwake', addDays(dayKey(), -1))"), '自動補的假不能取消');
  await I.click(['#habits .hab', '8:00 起床']); await I.click('[data-act=shday][data-v="-1"]');
  ok(I.has('昨天漏了，自動用掉 1 天假保住連勝'), '面板也寫出來');
  await I.click('[data-act=chk]');
  ok(!I.ev("onLeave('hwake', addDays(dayKey(), -1))") && I.ev("leaveLeft('hwake', dayKey())") === 2, '補打卡昨天：假退回');
  eq(streakOf(I).n, 4, '連勝 4 天'); ok(!I.UI.sheet,'補打卡成功後自動收起'); ok(!row(), '提醒消失');
  I.check('自動請假'); I.destroy();
});

test('連勝保護卡：假用完了自動用卡、補打卡退卡、不夠補就一張都不用', async () => {
  const I = await startWithWake([-4, -3, -2]);
  I.ev("S.strictFrom = addDays(dayKey(), -30); S.leaves = { hwake: { [addDays(dayKey(), 1)]: 1, [addDays(dayKey(), 2)]: 1 } }; S.logs.push({ id: 'cx', t: 2, d: dayKey(), k: 'bonus', c: 500, xp: 0 }); save(); render(); catchUp()");
  eq(streakOf(I).n, 0, '本月的假用完、又沒有卡：連勝斷了');
  await I.tab('today'); ok(I.has('昨天漏了「8:00 起床」，剩下的假和保護卡不夠補，連勝從今天重新開始'), '首頁說連勝斷了');
  await I.tab('shop'); ok(I.has('目前有 0 / 2 張'), '商店顯示 0 張');
  const c0 = I.coins(); await I.click('[data-act=buyfreeze]'); eq(I.coins(), c0 - 150, '扣 150 金幣');
  eq(I.ev("leavesOf('hwake')[addDays(dayKey(), -1)]"), 'f', '買了卡：馬上補上昨天'); eq(I.ev('freezeLeft()'), 0, '卡用掉了'); eq(streakOf(I).n, 3, '連勝接回來');
  ok(I.has('消費紀錄') && I.$$('.px').some(e => e.innerText.includes('消費紀錄') && e.innerText.includes('連勝保護卡')), '消費紀錄有保護卡');
  await I.tab('today'); ok(I.has('自動用掉 1 張連勝保護卡（還剩 0 張），連勝保住了'), '首頁說用了卡');
  I.ev("addCheck(addDays(dayKey(), -1), 'hwake', {}); clearLeave('hwake', addDays(dayKey(), -1)); save(); render()");
  eq(I.ev('freezeLeft()'), 1, '補打卡昨天：卡退回來');
  await I.tab('shop'); await I.click('[data-act=buyfreeze]'); eq(I.ev('freezeLeft()'), 2, '買第二張');
  ok(I.$('[data-act=buyfreeze]').disabled, '最多 2 張：按鈕不能按'); ok(I.has('目前有 2 / 2 張'), '商店顯示 2 張');
  I.check('保護卡'); I.destroy();
  // 連漏三天、只有兩張卡（10 月、11 月的免費假都用完了）：補不完就一張都不用
  const J = await startWithWake([-6, -5, -4]);
  J.ev("S.strictFrom = addDays(dayKey(), -30); S.leaves = { hwake: { '2026-10-01': 1, '2026-10-02': 1, [addDays(dayKey(), 1)]: 1, [addDays(dayKey(), 2)]: 1 } }; S.logs.push({ id: 'f1', t: 2, d: dayKey(), k: 'redeem', name: '連勝保護卡', freeze: 1, c: -150 }, { id: 'f2', t: 3, d: dayKey(), k: 'redeem', name: '連勝保護卡', freeze: 1, c: -150 }, { id: 'cy', t: 1, d: dayKey(), k: 'bonus', c: 300, xp: 0 }); save(); render(); catchUp()");
  eq(J.ev('freezeLeft()'), 2, '缺口 3 天、卡只有 2 張：不浪費'); eq(streakOf(J).n, 0, '連勝斷了');
  J.ev("S.leaves.hwake['2026-10-02'] = undefined; delete S.leaves.hwake['2026-10-02']; save(); catchUp()");   // 10 月多出 1 天免費假
  eq(J.ev('freezeLeft()'), 0, '1 天免費假＋2 張卡剛好補完'); eq(streakOf(J).n, 3, '連勝保住');
  J.check('補不完'); J.destroy();
});

test('自動請假：每週型漏掉的那一期也會自動補', async () => {
  const I = await startToday();
  I.ev("[-14, -13, -12, -21, -20, -19].forEach(d => addCheck(addDays(dayKey(), d), 'exercise', {})); S.strictFrom = addDays(dayKey(), -30); save(); render(); catchUp()");
  eq(I.ev("leavesOf('exercise')[addDays(dayKey(), -7)]"), 'a', '上週沒達標：自動用掉這個月的 1 次');
  eq(I.ev('streaks(derive()).exercise.n'), 2, '連勝保住');
  await I.tab('today'); ok(I.has('上週漏了「運動」，自動用掉 1 次假'), '首頁說明');
  I.check('每週自動請假'); I.destroy();
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
  ok(/請假/.test(I.ev("toggleLeave('exercise', '2026-11-02')")), '每週型的習慣（運動）也能請假');
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
  ok(!I.UI.sheet,'完成打卡後回今日'); await I.tab('quest'); I.check('請假畫面');
  const J = await I.reload(); await J.dismiss(); ok(J.ev("onLeave('hwake', addDays(dayKey(), -1))"), '重開後請假還在');
  for (const bad of ['"x"', '[1]', '{"hwake": 5}', '{"hwake": "x"}', 'null']) { J.ev(`S.leaves = ${bad}; save(); render()`); J.ev("toggleLeave('hwake', dayKey())"); J.ev('render()'); J.check('壞的 leaves ' + bad); }
  J.destroy(); I.destroy();
});

test('請假：運動、寫作（每週型）請假那一週不算斷，沒有獎勵', async () => {
  const I = await boot({ state: mkState({ habits: [{ id: 'exercise', e: '🏃', n: '運動', kind: 'exercise', weeks: 1, target: 3 }, { id: 'write', e: '📝', n: '寫作', kind: 'custom', unit: '篇', weeks: 1, target: 1 }] }) }); await I.dismiss();
  // 上上週、上上上週都達標；上週（10/26–11/1）什麼都沒做
  I.ev("[-14, -13, -12, -21, -20, -19].forEach(d => addCheck(addDays(dayKey(), d), 'exercise', {})); [-13, -20].forEach(d => addCheck(addDays(dayKey(), d), 'write', {})); save(); render()");
  const st = id => I.ev(`streaks(derive()).${id}.n`);
  eq(st('exercise'), 0, '運動：上週沒達標 → 斷了（沒請假的對照）'); eq(st('write'), 0, '寫作：同上');
  eq(I.ev("toggleLeave('exercise', addDays(dayKey(), -1))") !== '', true, '上週日請假');
  I.ev("toggleLeave('write', addDays(dayKey(), -1))");
  eq(st('exercise'), 2, '運動：請假的那週不算斷，前面兩週接得上（不加天數）'); eq(st('write'), 2, '寫作：同上');
  // 畫面：運動面板是「本週請假」（每月 1 次）、卡片顯示請假；請假沒有獎勵
  await I.tab('today'); await I.click(['#habits .hab', '運動']);
  ok(I.has('本週請假（本月還剩 1 次）'), '運動面板有「本週請假」，每月 1 次（上週的請假算在 10 月）');
  await I.click('[data-act=leave]'); ok(I.has('本週已請假，點一下取消'), '請假後按鈕變成取消'); await I.click('[data-act=sheetclose]');
  ok(I.$$('#habits .hab.leave').some(e => e.innerText.includes('請假')), '運動卡片顯示請假');
  ok(!I.S.logs.some(l => /exercise|week:|per:/.test(l.key || '')), '請假沒有獎勵');
  ok(/用完/.test(I.ev("toggleLeave('exercise', addDays(dayKey(), 7))")), '這個月 1 次用完了，下週不能再請');
  await I.click(['#habits .hab', '寫作']); ok(I.has('本週請假（本月還剩 1 次）'), '寫作面板也有，額度是寫作自己的');
  ok(!I.has('請假的那天不算漏'), '沒有冗長的說明文字');
  await I.click('[data-act=sheetclose]');
  // 請假的那一週記錄了運動，只要沒達標，請假還在；達標了就用不到、額度還回來
  await I.click(['#habits .hab', '運動']); await I.type('#ex_min', '30'); await I.click('[data-act=exadd]');
  ok(I.ev("leaveHere(habit('exercise'), dayKey())"), '記錄 1 次運動（還沒達標）：本週請假還在');
  I.ev("habit('exercise').target = 1; save(); render()"); await I.click('[data-act=sheetclose]').catch(() => {});
  eq(I.ev("leaveLeft('exercise', dayKey())"), 1, '這週達標了：請假用不到，額度還回來');

  I.ev("addCheck(dayKey(), 'write', {})"); ok(/已經達標/.test(I.ev("toggleLeave('write', dayKey())")), '這週已經寫作達標：不用請假');
  I.ev('save()'); I.check('每週型請假'); I.destroy();
});

test('六件事：昨天沒做完的帶到今天（一件一件或全部帶入）', async () => {
  const Y = '2026-11-01', row = (text, done = false, cat = 'other') => ({ text, done, cat, rw: done });
  const blank = () => row('');
  const I = await boot({ state: mkState({ plans: {
    [Y]: [row('寫報告', false, 'work'), row('回信', true), row('整理房間'), row('看書'), blank(), blank()],
    [D0]: [row('看書'), blank(), blank(), blank(), blank(), blank()] } }) }); await I.dismiss();
  await I.tab('today');
  const tags = () => I.$$('#six [data-act=carry]').map(b => b.innerText.replace('＋', '').trim());
  eq(tags(), ['寫報告', '整理房間'], '列出昨天沒打勾的（已完成的「回信」和今天已經有的「看書」不列）');
  ok(I.$('#six [data-act=carryall]'), '兩件以上有「全部帶入」');
  ok(!I.$('.nextbar button'), '下一步卡片沒有領取按鈕（只導去任務頁）');
  await I.click(['#six [data-act=carry]', '整理房間']);
  eq(I.S.plans[D0].map(x => x.text), ['看書', '整理房間', '', '', '', ''], '點一件：帶到第一個空格');
  eq(tags(), ['寫報告'], '帶過的不再列出'); ok(!I.$('#six [data-act=carryall]'), '只剩一件時不顯示「全部帶入」');
  await I.click('#six [data-act=carry]');
  eq(I.S.plans[D0][2], { text: '寫報告', done: false, cat: 'work', rw: false }, '分類一起帶過來、沒有打勾');
  ok(!I.$('#six .carry'), '都帶完了，整列消失');
  ok(!I.S.logs.some(l => l.key === 'plan:' + D0), '帶入不算寫好清單（還是要自己按寫好了）');
  await I.click('#six [data-act=pday][data-v="-1"]'); ok(!I.$('#six .carry'), '昨天的頁面不顯示');
  I.check('帶入昨天'); I.destroy();
  // 全部帶入，格子不夠時帶到滿
  const full = await boot({ state: mkState({ plans: {
    [Y]: ['a', 'b', 'c'].map(t => row(t)).concat([blank(), blank(), blank()]),
    [D0]: ['1', '2', '3', '4'].map(t => row(t)).concat([blank(), blank()]) } }) }); await full.dismiss();
  await full.tab('today'); await full.click('#six [data-act=carryall]');
  eq(full.S.plans[D0].map(x => x.text), ['1', '2', '3', '4', 'a', 'b'], '全部帶入：填滿剩下的格子'); ok(full.has('六格寫滿了'), '提示有幾件帶不進來');
  ok(!full.$('#six .carry'), '寫滿了就不再顯示'); full.destroy();
});

test('任意三件：後三列先完成、交換位置與反覆勾選不多領', async () => {
  const I = await startToday();
  await I.plan(['A', 'B', 'C', 'D', 'E', 'F']);
  for (const i of [5, 3, 4]) await I.tick(i);
  eq(rewardLogs(I).length, 3, '後三列各有獎勵');
  eq(rewardLogs(I).reduce((n, l) => n + l.c, 0), 45, '三件共 45 金幣');
  ok(I.S.logs.some(l => l.key === 'top3:' + D0), '任意完成三件有 30 金幣加碼');
  await I.tab('quest');
  const row = I.$$('.qc').find(e => e.innerText.includes('完成 3 件事'));
  ok(row && row.classList.contains('pend'), '任務顯示完成並可領獎');
  await I.tab('today');
  await I.tick(5); await I.tick(5);
  await I.click('#six [data-act=swap][data-v="0"]');
  await I.click('#six [data-act=swap][data-v="5"]');
  for (const i of [1, 2]) await I.tick(i);
  eq(rewardLogs(I).length, 3, '交換位置後仍最多三份');
  await I.claimAll(); const coins = I.coins();
  await I.tab('today'); await I.tick(0); await I.tick(0);
  eq(I.coins(), coins, '領過再勾不重複入帳');
  I.check('任意三件'); I.destroy();
});

test('提前寫清單：忘按寫好了隔天補發，已自動入帳的不再顯示領取', async () => {
  const I = await startToday();
  await I.plan(['明天 A', '明天 B', '明天 C'], 1);
  ok(!I.S.logs.some(l => l.key === 'plan:2026-11-03'), '未按寫好了');
  await I.advance(24 * 3600e3); const J = await I.reload(); await J.dismiss();
  const logs = () => J.S.logs.filter(l => l.key === 'plan:2026-11-03');
  eq(logs().length, 1, '隔天補發清單獎勵');
  await J.claimAll(); const coins = J.coins();
  J.ev('catchUp(); catchUp()');
  eq(logs().length, 1, '重複補檢查不重發');
  eq(J.coins(), coins, '不重複加金幣');
  J.destroy(); I.destroy();

  const A = await startToday();
  await A.plan(['A', 'B', 'C'], 1); await A.saveList();
  await A.advance(24 * 3600e3); const B = await A.reload(); await B.dismiss();
  const before = B.coins(); await B.tab('quest');
  const row = B.$$('.qc').find(e => e.innerText.includes('寫好清單'));
  ok(row && row.classList.contains('got'), '昨天未領的清單已自動入帳，顯示已完成');
  ok(row && !row.querySelector('[data-act=claim]'), '不顯示無效的領取按鈕');
  await B.claimAll();
  eq(B.coins() - before, 15, '只增加今天登入的 15 金幣');
  B.check('提前寫清單'); B.destroy(); A.destroy();
});
test('獎勵狀態一致：昨天自動入帳的獎勵不能再領，重複傳入不重複計算', async () => {
  const I = await startToday();
  I.ev("S.logs.push({ id: 'old-pending', d: addDays(dayKey(), -1), k: 'plan', key: 'plan:' + addDays(dayKey(), -1), c: 15, xp: 10, pend: true }); save(); render()");
  const before = I.coins();
  I.ev("claim(S.logs.filter(l => l.id === 'old-pending'))");
  eq(I.coins(), before, '已自動入帳不再領一次');
  ok(I.ev("!isPendingReward(S.logs.find(l => l.id === 'old-pending'))"), '昨天待領標記不再算可領');
  await I.plan(['A', 'B', 'C']); await I.tick(0);
  const c = I.coins();
  I.ev("const log = S.logs.find(l => l.k === 'check' && l.d === dayKey()); claim([log, log])");
  eq(I.coins(), c + 15, '相同紀錄傳入兩次只入帳一次');
  I.check('統一獎勵狀態'); I.destroy();
});
test('上線體驗：換件和刪除後，清單、任務與待領獎勵一致', async () => {
 const I=await startToday(); await I.plan(['A','B','C','D','E','F']);
 for(const i of [0,1,2]) await I.tick(i);
 await I.tick(0); await I.tick(3);
 eq(I.ev("getPlan(dayKey()).filter(x=>x.done).length"),3,'換件後完成三件');
 eq(rewardLogs(I).length,3,'換件後仍有三份獎勵');
 eq(I.ev("dailyTasks(derive()).find(t=>t.id==='rows').n"),3,'任務進度一致');
 await I.click('[data-act=prowdel][data-v="3"]');
 eq(rewardLogs(I).length,2,'刪除未領項目後只剩兩份');
 ok(!I.S.logs.some(l=>l.key==='top3:'+D0),'未領加碼收回');
 await I.click('[data-act=planundo]'); eq(rewardLogs(I).length,3,'復原恢復三份');
 await I.claimAll(); const c=I.coins(); await I.tab('today');
 for(const i of [1,2,3]) await I.tick(i);
 for(const i of [0,4,5]) await I.tick(i);
 eq(I.coins(),c,'已領後換件不多領'); eq(rewardLogs(I).length,3,'總份數維持上限');
 I.check('換件刪除復原'); I.destroy();
});

test('上線體驗：今日返回今天，運動錯誤留在欄位，彈窗管理焦點', async () => {
 const I=await startToday(); await I.click('[data-act=pday][data-v="-1"]'); await I.tab('shop'); await I.tab('today');
 eq(I.UI.pday,0,'主導覽今日回到今天');
 await I.habit('運動'); await I.type('#exType','跑步'); await flush(6);
 eq(I.$('#sheetov').getAttribute('role'),'dialog','面板有 dialog 語意');
 ok(I.$('#sheetov').contains(I.doc.activeElement),'焦點進入面板');
 ok(I.$('#ex_dist').labels.length,'距離有固定標題');
 await I.type('#ex_dist','-1'); await I.click('[data-act=exadd]');
 eq((I.S.checks[D0]||{}).exercise,undefined,'非法數字不悄悄新增紀錄');
 ok(I.$('#exError').textContent.includes('大於 0'),'保留錯誤說明');
 const stops=I.ev("dialogStops(document.getElementById('sheetov'))");
 stops[stops.length-1].focus(); I.doc.activeElement.dispatchEvent(new I.win.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
 ok(I.$('#sheetov').contains(I.doc.activeElement),'Tab 焦點留在面板');
 await I.click('[data-act=sheetclose]'); I.check('表單焦點'); I.destroy();
});

test('上線體驗：同步失敗不顯示已同步，隱私在創作者內容前', async () => {
 const I=await startToday(); I.ev("CLOUD.user={uid:'test',email:'test@example.com'};CLOUD.last=Date.now();CLOUD.error='同步失敗，稍後會再試';UI.tab='about';render()");
 ok(I.$('#cloudStatus').textContent.includes('尚未同步'),'顯示本機已存而未同步');
 ok(!I.$('#main').textContent.includes('已同步'),'沒有矛盾的已同步承諾');
 ok(I.$('[data-act=cloudretry]'),'可重試');
 const titles=I.$$('.more-detail > summary').map(x=>x.textContent);
 ok(titles.includes('隱私說明') && titles.indexOf('隱私說明')<titles.indexOf('關於習慣深潛'),'隱私有獨立入口並在創作者內容前');
 eq(I.$$('.more-detail[open]').length,0,'說明預設收合');
 await I.click('.more-links .more-detail > summary');
 ok(I.$('.more-links .more-detail').open && I.has('需要每天餵魚嗎？'),'展開常見問題可讀取餵食說明');
 await I.click('.more-links .more-detail > summary');
 ok(!I.$('.more-links .more-detail').open,'可以再次收合');
 I.destroy();
});
test('上線體驗：長清單可換行與診斷資訊不包含私人紀錄', async () => {
 const I=await startToday({width:320}); const text='這是一段需要完整閱讀的每日任務內容'.repeat(6);
 await I.plan([text]); const el=I.$('#six .ptext'); eq(el.tagName,'TEXTAREA','長內容可多行'); ok(el.offsetHeight>44,'輸入後會展開');
 eq(el.value,text,'文字完整保留'); const info=I.ev('diagnosticsText()');
 ok(!info.includes(text) && !info.includes('@test'),'診斷不含清單與Email');
 ok(info.includes('瀏覽器') && info.includes('畫面'),'只提供排查環境資訊');
 I.check('長文字'); I.destroy();
});
