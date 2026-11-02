// 遊戲規則：寶箱與獎勵、反悔時收回／還原、番茄鐘工作階段、寶箱與升級彈窗。
/* ========= 遊戲動作 ========= */
const UI = { tab: 'today', pday: 0, opened: false, sheet: null };
const Q = [];
const viewDay = () => addDays(dayKey(), UI.pday);
const BONUS = {
  welcome: '歡迎下水！送你一隻小丑魚',
  top3: '前三件事都完成了！',
  pubchest: '今天發布了文章！',
  period: '習慣達標！',
  weekly: '本週運動達標！',
};
const filled = P => P.filter(x => x.text.trim());
function getPlan(d) {
  return S.plans[d] || (S.plans[d] = Array.from({ length: 6 }, () => ({ text: '', cat: 'other', done: false, rw: false })));
}
const chestOf = id => CONFIG.chests.find(c => c.id === id);
// 照寶箱的機率抽稀有度，再從那個稀有度裡隨機挑一種（同稀有度每種機率相同）
function rollCreature(rates) {
  let x = Math.random() * rates.reduce((a, b) => a + b, 0), r = 0;
  while (x >= rates[r] && r < 4) { x -= rates[r]; r++; }
  const pool = CREATURES.filter(c => c.r === r);
  return pool[Math.floor(Math.random() * pool.length)];
}
// 完成事情的獎勵：XP 和金幣，先標成 pend（待領取），到「每日任務」按領取才入帳；當天沒領，隔天自動入帳（見 derive）
const GAIN = { n: 0, title: '' };
function grant(kind, tag, o = {}) {
  let xp = o.xp ?? CONFIG.xp[kind] ?? 0, c, crit = false;
  if (BONUS[kind]) c = CONFIG.coins[kind];
  else {
    c = CONFIG.coins.base + Math.floor(Math.random() * (CONFIG.coins.rand + 1));
    if (Math.random() < CONFIG.coins.critChance) { crit = true; c *= 2; }
  }
  const log = { id: rid(), t: Date.now(), d: o.d || dayKey(), k: kind, tag: tag || undefined, xp, c, key: o.key, crit: crit || undefined, ...o.extra };
  if (kind === 'welcome') return dropCreature(log, null, BONUS.welcome, 0, CR.clown);   // 新手禮物：一隻小丑魚
  log.pend = true;
  S.logs.push(log);
  GAIN.n++; GAIN.title = GAIN.title || o.title || BONUS[kind] || '';
  return log;
}
// 在 log 上抽一隻生物（log.id 就是這隻的身分），排進開箱彈窗；超過上限時接著問要放生哪一隻
// fixed：直接給這一隻（新手的小丑魚），不抽
function dropCreature(log, rates, title, tint = 0, fixed = null) {
  const D = derive(), cr = fixed || rollCreature(rates), isNew = !D.col[cr.id], dup = isNew ? 0 : CONFIG.dupCoins[cr.r];
  log.drop = cr.id; log.c = (log.c || 0) + dup;
  S.logs.push(log);
  Q.push({ title, cr, isNew, xp: log.xp || 0, c: log.c - dup, dup, tint, direct: !!fixed });
  if (pets(cr.id).length > MAX_PETS) Q.push({ release: cr.id, newId: log.id });
  return log;
}
// 商店買生物寶箱：金幣扣掉、開出生物（淺灘寶箱也可能開出飼料）
function buyChest(id) {
  const ch = chestOf(id);
  if (!ch || derive().coins < ch.price) { toast('金幣不夠'); return; }
  const log = { id: rid(), t: Date.now(), d: dayKey(), k: 'chest', name: ch.name, c: -ch.price, xp: 0 };
  if (Math.random() * 100 < ch.feed) {
    log.feedGot = CONFIG.chestFeed; S.logs.push(log);
    S.feed = (S.feed || 0) + CONFIG.chestFeed;
    Q.push({ title: ch.name, feed: CONFIG.chestFeed, tint: CONFIG.chests.indexOf(ch) });
  } else dropCreature(log, ch.rates, ch.name, CONFIG.chests.indexOf(ch));
  save(); render(); nextChest();
}
// 這一輪有新的待領取獎勵時，提示去每日任務領
function showGain() {
  if (!GAIN.n) return;
  toast(`${GAIN.title ? GAIN.title + '　' : ''}到「每日任務」領取獎勵`);
  Object.assign(GAIN, { n: 0, title: '' });
}
// 領取：把這些待領取的獎勵入帳，顯示拿到多少，檢查升級
function claim(logs) {
  logs = logs.filter(l => l.pend); if (!logs.length) return;
  const before = levelOf(derive().xp);
  let xp = 0, c = 0, crit = false;
  for (const l of logs) { delete l.pend; xp += l.xp || 0; c += l.c || 0; crit = crit || !!l.crit; }
  const after = levelOf(derive().xp);
  if (after > before && after > (S.lvSeen || 0)) { Q.push({ level: after, title: rankIdx(after) > rankIdx(before) ? RANKS[rankIdx(after)][1] : '' }); S.lvSeen = after; }
  ac(); SFX.buy(); toast(`+${xp} XP　+${c} 金幣${crit ? '（爆擊 ×2）' : ''}`);
  save(); render(); nextChest();
}
// 今天的獎勵（前三件、每個習慣的打卡、週期達標）跟著條件走：條件不再成立時把獎勵收進 S.held，
// 條件恢復時原封不動還回來（不重抽，避免用取消再打卡刷稀有生物）
function reconcile(allowGrant) {
  const d = dayKey(), P = S.plans[d] || [], R = CONFIG.rewardRows;
  S.held = S.held || {};
  // 前三格都要有寫內容、而且都打勾才算
  const conds = [['top3:' + d, 'top3', P.length >= R && P.slice(0, R).every(x => x.text.trim() && x.done)]];
  for (const h of activeHabits()) {
    const has = dayChecks(d, h.id).length > 0;
    if (h.kind === 'vocus') conds.push(['art:' + d, 'pubchest', has]);
    else conds.push([`hab:${h.id}:${d}`, 'habit', has, `${h.e} ${h.n} 打卡完成！`, h.kind === 'exercise' ? CONFIG.xp.exercise : CONFIG.xp.habit]);
    if (h.weeks && h.kind !== 'vocus') {
      const p = periodKey(d, h.weeks);
      conds.push([h.id === 'exercise' && h.weeks === 1 ? 'week:' + p : `per:${h.id}:${p}`, 'period',
        periodDone(derive(), h, p), `${h.e} ${h.n} ${periodWord(h)}達標！`]);
    }
  }
  for (const [key, kind, ok, title, xp] of conds) {
    const has = derive().claimed.has(key);
    if (ok && !has) {
      if (S.held[key]) { S.logs.push(S.held[key]); delete S.held[key]; }
      else if (allowGrant) grant(kind, null, { key, title, xp });
    } else if (!ok && has) {
      const i = S.logs.findIndex(l => l.key === key);
      if (i >= 0) S.held[key] = S.logs.splice(i, 1)[0];
    }
  }
}
// 做完 fn 之後檢查獎勵與升級，再存檔、顯示獎勵。補登昨天時 allowGrant=false：只還原、不發新獎勵
function reward(fn, allowGrant = true) {
  const before = levelOf(derive().xp);
  fn();
  reconcile(allowGrant);
  const after = levelOf(derive().xp);
  // 同一個等級只慶祝一次（取消再打勾讓等級掉下又回來時不重播）
  if (after > before && after > (S.lvSeen || 0)) { Q.push({ level: after, title: rankIdx(after) > rankIdx(before) ? RANKS[rankIdx(after)][1] : '' }); S.lvSeen = after; }
  save(); render(); renderSheet(); showGain(); nextChest();
}

/* ========= 番茄鐘 ========= */
// 一段「專注工作階段」：選整段總長度，自動切成「專注 25 分＋休息」的段落；每天第一段專注滿 pomoRewardMin 分鐘有獎勵
const pomoMin = () => S.pomoMin || CONFIG.pomodoroMin;
function sessionPlan(total) {
  const segs = [];
  let rem = total, focusN = 0;
  while (rem > 0) {
    const f = Math.min(CONFIG.pomodoroMin, rem);
    segs.push({ m: 'focus', min: f }); rem -= f; focusN++;
    if (rem <= 0) break;
    const b = focusN % CONFIG.longBreakEvery === 0 ? CONFIG.longBreakMin : CONFIG.breakMin;
    if (rem <= b + 5) { segs[segs.length - 1].min += rem; break; }   // 只剩一點點就併進這段專注，不以休息收尾
    segs.push({ m: 'break', min: b }); rem -= b;
  }
  return segs;
}
function startTimer() {
  if (S.timer) return;
  ac();
  S.timer = { segs: sessionPlan(pomoMin()), si: 0, start: Date.now() };
  SFX.tap(); save(); render(); tick();
}
function finishSeg() {
  const T = S.timer, seg = T.segs[T.si], end = T.start + seg.min * 60e3, last = T.si === T.segs.length - 1;
  if (last) S.timer = null; else { T.si++; T.start = end; }
  const next = S.timer && S.timer.segs[S.timer.si];
  SFX.done();
  if (seg.m === 'focus') {
    const d = dayKey(end - 1);
    // 每天只有第一段（滿 pomoRewardMin 分鐘）有獎勵，之後的照樣記錄、算進累積時數
    if (seg.min >= CONFIG.pomoRewardMin && !derive().claimed.has('pomo:' + d)) reward(() => grant('pomo', null, { key: 'pomo:' + d, title: `專注 ${seg.min} 分鐘完成！`, d, extra: { min: seg.min } }));
    else { S.logs.push({ id: rid(), t: end, d, k: 'pomo', min: seg.min, xp: 0, c: 0 }); save(); render(); }
  } else { save(); render(); }
  toast(last ? '這段專注全部完成！' : next.m === 'break' ? `休息 ${next.min} 分鐘，起來走走吧` : `休息結束，繼續專注 ${next.min} 分鐘`);
}
function tick() {
  if (!S.timer) { document.title = '習慣深潛'; return; }
  let T = S.timer;
  if (!T.segs) S.timer = T = { segs: [{ m: T.mode === 'break' ? 'break' : 'focus', min: Math.round(T.dur / 60e3) }], si: 0, start: T.start };
  if (Date.now() >= T.start + T.segs[T.si].min * 60e3) {
    while (S.timer && Date.now() >= S.timer.start + S.timer.segs[S.timer.si].min * 60e3) finishSeg();
    return;
  }
  const seg = T.segs[T.si], dur = seg.min * 60e3, left = T.start + dur - Date.now();
  const txt = `${pad(Math.floor(left / 60000))}:${pad(Math.floor(left / 1000) % 60)}`;
  document.title = `${seg.m === 'break' ? '休息' : '專注'} ${txt}・習慣深潛`;
  const el = document.getElementById('tclock'); if (el) el.textContent = txt;
  const bar = document.getElementById('tbar'); if (bar) bar.style.width = (100 - left / dur * 100) + '%';
}

/* ========= 寶箱彈窗 ========= */
const COIN = '<i class="cn" aria-label="金幣"></i>';
const sh = (title, tag, right = '') => `<div class="sh"><b>${title}</b><em>${tag}</em><span class="sp"></span>${right}</div>`;
function nextChest() {
  if (UI.opened) return;
  const it = Q.shift(), ov = document.getElementById('ov'), m = document.getElementById('modal');
  if (!it) { ov.classList.add('hidden'); return; }
  UI.opened = true; UI.cur = it; ov.classList.remove('hidden');
  if (it.release) {
    const c = CR[it.release], P = pets(c.id);
    if (P.length <= MAX_PETS) { UI.opened = false; nextChest(); return; }
    m.innerHTML = `<h2>${c.name}已經有 ${MAX_PETS} 隻了</h2><p class="dim">每種最多養 ${MAX_PETS} 隻，選一隻放生回大海。</p>
      ${P.map(p => `<div class="entry" style="text-align:left">${stageImg(c, stageOf(p.fed), 2)}
        <span class="sp">${p.id === it.newId ? '<b class="new">新抽到的</b>・' : ''}${stageName(c, stageOf(p.fed))}・吃了 ${p.fed} 顆</span>
        <button class="${p.id === it.newId ? 'pri' : ''}" data-act="releasepick" data-v="${p.id}">放生</button></div>`).join('')}`;
    return;
  }
  if (it.level !== undefined) {
    m.innerHTML = `<div class="label">LEVEL UP</div><div class="big-lv pop" style="margin:10px 0"><span>Lv.</span>${it.level}</div>
      ${it.title ? `<h2>取得稱號：${it.title}</h2>` : `<p class="dim">${RANKS[rankIdx(it.level)][1]}</p>`}
      <button class="pri" data-act="close">繼續</button>`;
    SFX.rank(); return;
  }
  // 新手的小丑魚直接出現，不用開箱
  if (it.direct) { openChest(); return; }
  // 商店買的生物寶箱
  m.innerHTML = `<h2>${esc(it.title)}</h2><div style="filter:${CHEST_TINT[it.tint || 0]}">${img(CHEST, 9, false, 'shake')}</div><p class="dim">點一下打開寶箱</p>
    <button class="pri" data-act="openchest">開啟</button>`;
  SFX.shake();
}
function openChest() {
  const it = UI.cur, cr = it.cr;
  if (it.feed) {
    document.getElementById('modal').innerHTML = `<div class="feedpile pop">${'<i></i>'.repeat(it.feed)}</div>
      <h2>飼料 ${it.feed} 顆</h2><div class="dim" style="font-size:15px">這次開出的是飼料，拿去水族箱餵魚吧。</div>
      <button class="pri" data-act="close">${Q.length ? `下一個（還有 ${Q.length}）` : '收下'}</button>`;
    SFX.open(0); return;
  }
  const R = RARITY[cr.r];
  document.getElementById('modal').innerHTML = `${it.direct ? `<h2>${esc(it.title)}</h2>` : ''}
    <div><span class="rar" style="background:${R.color}">${R.name}</span></div>
    ${stageImg(cr, 1, Math.min(10, Math.floor(160 / stageCanvas(cr, 1).width)), false, 'pop' + (cr.r >= 3 ? ' glow' + cr.r : ''))}
    <h2>${cr.name} <small>幼體</small> ${it.isNew ? '<span class="new">NEW</span>' : ''}</h2>
    <div class="dim" style="font-size:15px">${cr.fact}</div>
    ${it.xp || it.c > 0 ? `<div class="gain">${it.xp ? `<span style="color:var(--xp)">+${it.xp} XP</span>　` : ''}${it.c > 0 ? `<span class="coin">+${it.c}${COIN}</span>` : ''}</div>` : ''}
    ${it.dup ? `<div class="dim" style="font-size:14px">已經有這種了，另外送 ${it.dup} 金幣</div>` : ''}
    <button class="pri" data-act="close">${Q.length ? `下一個（還有 ${Q.length}）` : '收下'}</button>`;
  SFX.open(cr.r);
}

