// 畫面：頂端列、今日、習慣面板、圖鑑、生物個體與水族箱、商店、紀錄、關於。
/* ========= 畫面 ========= */
const IN_APP = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger|Twitter|TikTok|musical_ly|Bytedance|KAKAOTALK|Snapchat|Pinterest/i.test(navigator.userAgent);
function renderStat(D = derive()) {
  const lv = levelOf(D.xp), lo = xpFor(lv), hi = xpFor(lv + 1), pct = (D.xp - lo) / (hi - lo) * 100;
  document.getElementById('stat').innerHTML = `
    <button class="lvchip" data-act="tab" data-v="log" title="再 ${hi - D.xp} XP 升到 Lv.${lv + 1}">Lv.${lv}<small>${RANKS[rankIdx(lv)][1]}</small><i class="xpbar"><b style="width:${pct}%"></b></i></button>
    <span class="coin">${D.coins.toLocaleString()}${COIN}</span>`;
}
function render() {
  const D = derive();
  renderStat(D);
  document.getElementById('banner').innerHTML = (STORAGE_OK ? '' : `<div class="banner warn">這個瀏覽器目前無法儲存紀錄（可能是無痕模式，或封鎖了網站資料）。紀錄只在這個分頁裡，關掉就會消失。到「更多」→「備份」可以先下載一份。</div>`) + (IN_APP && !UI.iabOk
    ? `<div class="banner row"><span class="sp">你正在 App 內建的瀏覽器裡開啟，這裡的紀錄跟 Chrome、Safari 是分開的。建議用右上角選單「用瀏覽器開啟」。</span><button class="ghost" data-act="iabok">知道了</button></div>` : '');
  const tabs = [['today', '今日'], ['quest', '任務'], ['tank', '大海'], ['shop', '商店'], ['log', '紀錄'], ['about', '更多']];
  const pendN = dailyTasks(D).filter(t => t.pend.length).length;
  document.getElementById('nav').innerHTML = tabs.map(([k, n]) => `<button class="${UI.tab === k ? 'sel' : ''}" data-act="tab" data-v="${k}">${n}${k === 'quest' && pendN ? `<i class="badge">${pendN}</i>` : ''}</button>`).join('');
  document.getElementById('main').innerHTML = ({ today, quest: quests, tank, shop, log, about })[UI.tab](D);
  document.body.classList.toggle('sea-on', seaOn()); document.documentElement.classList.toggle('sea-on', seaOn());
  if (UI.tab === 'tank') tankStart();
  for (const i of document.querySelectorAll('#main textarea, #main input:not([type]), #main input[type=text], #sheet input:not([type]), #sheet input[type=text]')) { i.setAttribute('autocomplete', 'off'); i.setAttribute('autocapitalize', 'off'); i.setAttribute('spellcheck', 'false'); }
  // 不是按鈕的可點元素（圖鑑格子、寶箱名稱、任務名稱…）：讓鍵盤和螢幕閱讀器也用得到
  for (const e of document.querySelectorAll('#main [data-act]')) if (!e.matches('button, input, select, a, [tabindex]')) { e.setAttribute('role', 'button'); e.setAttribute('tabindex', '0'); }
  for (const el of document.querySelectorAll('#six textarea.ptext')) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px'; }
  renderFocus();
  renderOnb();
}
const freqOpts = (h, sel) => (h.kind === 'custom' ? [[0, '每天']] : []).concat([[1, '每週'], [2, '每兩週']])
  .map(([v, n]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${n}</option>`).join('');
const targetOpts = sel => [1, 2, 3, 4, 5, 6, 7].map(n => `<option ${sel === n ? 'selected' : ''}>${n}</option>`).join('');

function habitEditor() {
  return `<section class="px">${sh('編輯習慣', 'HABITS', '<button class="pri" data-act="habdone">完成</button>')}
    <div class="mini">自訂習慣最多 ${CONFIG.maxCustom} 個。</div>
    ${S.habits.map((h, i) => h.off ? '' : `<div class="erow">
      <input class="sp" data-hf="n" data-hi="${i}" value="${esc(h.n)}" maxlength="20" placeholder="${h.kind === 'custom' ? '習慣名稱，例如：冥想' : '習慣名稱'}">
      <select data-hf="weeks" data-hi="${i}">${freqOpts(h, h.weeks)}</select>
      ${h.weeks ? `<span class="dim">至少</span><select data-hf="target" data-hi="${i}">${targetOpts(h.target)}</select><span class="dim">${esc(countWord(h))}</span>` : ''}
      <button class="ghost" data-act="habdel" data-v="${i}" title="刪除">✕</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button data-act="habadd" ${customCount() >= CONFIG.maxCustom ? 'disabled' : ''}>＋ 新增習慣 ${customCount()}/${CONFIG.maxCustom}</button>
      ${S.habits.filter(h => h.off && h.kind !== 'custom').map(h => `<button data-act="habrestore" data-v="${esc(h.id)}">加回 ${esc(h.n)}</button>`).join('')}</div>
    <div class="mini">每天的習慣漏一天就斷；每週／每兩週的習慣沒達標就斷。漏掉時會自動請假保住連勝：每天型每月 ${CONFIG.leavePerMonth} 天，每週型每月 ${CONFIG.leavePerMonthWeekly} 次，用完了再用商店的連勝保護卡。</div>
    </section>`;
}

/* ========= 每日任務 ========= */
const mdOf = k => k.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');   // 2026-11-02 → 11/2
// 任務就是會給獎勵的那些事；進度從紀錄算，獎勵是對應的 log（有 pend＝還沒領）
function dailyTasks(D) {
  const C = CONFIG.coins, X = CONFIG.xp;
  const d = dayKey(), d1 = addDays(d, 1), byKey = k => S.logs.filter(l => l.key === k), R = CONFIG.rewardRows;
  const checks = S.logs.filter(l => l.k === 'check' && l.d === d), completedRows = Math.min(R, filled(S.plans[d] || []).filter(x => x.done).length);
  const T = [
    { id: 'login', name: '每日登入', go: 'six', est: C.login, ex: X.login, logs: byKey('login:' + d) },
    // how＝一小句提示（名稱看得懂就不寫）；go＝點了跳到「今日」頁的哪一區
    // 今天或明天的清單都算「寫好清單」（寫兩份就領兩份，沒有加倍）；任意 R 件的打勾和「完成三件」加碼合成同一列
    { id: 'plan', name: '寫好清單', how: `今天或明天的都可以，寫至少 ${R} 件`, go: 'six', est: C.task, ex: X.plan, nx: `寫好清單（至少 ${R} 件）`, logs: [...byKey('plan:' + d), ...byKey('plan:' + d1)] },
    { id: 'rows', name: `完成 ${R} 件事`, how: `任意完成 ${R} 件有加碼`, go: 'six', n: completedRows, of: R, est: C.task * Math.max(R - checks.length, 0) + (byKey('top3:' + d).length ? 0 : C.top3), ex: X.check * Math.max(R - checks.length, 0) + (byKey('top3:' + d).length ? 0 : X.top3), logs: [...checks, ...byKey('top3:' + d)] },
    { id: 'anyhab', name: '任一個習慣打卡', go: 'habits', est: C.task, ex: X.anyhab, nx: '「習慣」區任選一張卡片打卡', logs: byKey('anyhab:' + d) },
    { id: 'pomo', name: `專注一段番茄鐘`, how: `滿 ${CONFIG.pomoRewardMin} 分鐘`, go: 'pomo', est: C.task, ex: X.pomo, nx: `專注一段番茄鐘（${CONFIG.pomoRewardMin} 分鐘）`, logs: byKey('pomo:' + d) },
  ];
  for (const h of activeHabits()) {
    const dayLogs = x => byKey(`hab:${h.id}:${x}`);
    if (!h.weeks) { T.push({ id: 'h_' + h.id, hab: true, name: h.n, how: onLeave(h.id, d) && !dayLogs(d).length ? '今天已請假' : '', go: 'habits', est: C.task, ex: h.kind === 'exercise' ? X.exercise : X.habit, logs: dayLogs(d) }); continue; }
    // 週期型（例如本週運動 3 天）：每次打卡和達標加碼合成一列，看得出這期的進度
    const p = periodKey(d, h.weeks), days = Array.from({ length: 7 * h.weeks }, (_, i) => addDays(p, i));
    const bonus = byKey(h.id === 'exercise' && h.weeks === 1 ? 'week:' + p : `per:${h.id}:${p}`);
    const left = Math.max(h.target - perCount(D, h, p), 0), last = !bonus.length;
    const est = left * C.task + (last ? C.period : 0);
    const ex = left * (h.kind === 'exercise' ? X.exercise : X.habit) + (last ? X.period : 0);
    T.push({ id: 'p_' + h.id, hab: true, week: true, est, ex, name: `${h.n}・${periodWord(h)} ${h.target} ${countWord(h)}`, go: 'habits',
      how: `${mdOf(p)}–${mdOf(days[days.length - 1])}`,
      n: Math.min(perCount(D, h, p), h.target), of: h.target, logs: [...days.flatMap(dayLogs), ...bonus] });
  }
  // 保險：今天待領取、卻不屬於任何任務的獎勵（例如習慣已刪除）一律放進「其他獎勵」，確保一定領得到
  const shown = new Set(T.flatMap(t => t.logs.map(l => l.id))), orphans = S.logs.filter(l => isPendingReward(l, d) && l.d === d && !shown.has(l.id));
  if (orphans.length) T.push({ id: 'misc', name: '其他獎勵', how: '', go: 'six', est: 0, ex: 0, logs: orphans });
  for (const t of T) {
    t.pend = t.logs.filter(l => isPendingReward(l, d));
    t.full = t.of ? t.n >= t.of : t.logs.length > 0;
    t.c = t.logs.reduce((a, l) => a + (l.c || 0), 0); t.xp = t.logs.reduce((a, l) => a + (l.xp || 0), 0);
  }
  return T;
}
function quests(D) {
  const T = dailyTasks(D), pend = T.flatMap(t => t.pend), pc = pend.reduce((a, l) => a + (l.c || 0), 0);
  // 拆成兩區：每日任務（清單、六件事、番茄鐘）和習慣養成（每天打卡＋本期目標）
  const { daily, done } = questCount(T);
  const base = T.filter(t => !t.hab), hab = T.filter(t => t.hab);
  const row = t => {
    const st = t.pend.length ? 'pend' : t.full ? 'got' : 'todo';
    // 按鈕一直都在，完成了才能按；金幣和經驗值寫在同一行
    const sum = k => t.pend.reduce((a, l) => a + (l[k] || 0), 0);
    const [c, xp] = st === 'pend' ? [sum('c'), sum('xp')] : st === 'got' ? [t.c, t.xp] : [t.est, t.ex];
    const amt = `+${c}${COIN}<small>+${xp} XP</small>`;
    const right = st === 'pend' ? `<button data-act="claim" data-v="${t.id}">領取 ${amt}</button>`
      : st === 'got' ? '<span class="qend">已完成</span>' : `<span class="qamt">${amt}</span>`;
    const sub = [st === 'todo' && t.how ? esc(t.how) : '', t.of && !t.full ? `<span class="qbar"><i style="width:${t.n / t.of * 100}%"></i></span>${t.n}/${t.of}` : ''].filter(Boolean).join('・');
    return `<div class="qc ${st}"><i class="qbox"></i>
      <div class="sp" ${st === 'todo' ? `data-act="goto" data-v="${t.go}"` : ''}><div class="qn">${esc(t.name)}</div>${sub ? `<small class="qhow">${sub}</small>` : ''}</div>
      ${right}</div>`;
  };
  const hd = hab.filter(t => t.full).length;
  return `<section class="px">${sh('每日任務', 'DAILY', `<span class="qcnt">${done}/${daily.length}</span>${pend.length ? `<button class="pri qall" data-act="claim" data-v="all">全部領取 +${pc}${COIN}</button>` : ''}`)}
      <div class="bar c qtop"><i style="width:${done / daily.length * 100}%"></i></div>${base.map(row).join('')}</section>
    ${hab.length ? `<section class="px">${sh('習慣養成', 'HABITS', `<span class="qcnt">${hd}/${hab.length}</span>`)}${hab.map(row).join('')}</section>` : ''}`;
}

// 首頁最上面一條：今天完成幾項、下一步做什麼（點了直接跳過去）、有幾份獎勵待領
// 每日任務完成幾項：只算「每日任務」那一區，任務頁和首頁共用
function questCount(T) { const daily = T.filter(t => !t.hab && t.id !== 'misc' && t.id !== 'login'); return { daily, done: daily.filter(t => t.full).length }; }
function nextStep(D, P) {
  const all = dailyTasks(D), { daily, done } = questCount(all), T = all.filter(t => !t.week && t.id !== 'login');
  // 下一步：照順序找還沒完成的
  const nx = T.find(t => !t.full);
  let label = '每日任務都完成了！';
  if (nx) {
    const i = P.findIndex(x => x.text.trim() && !x.done);
    label = nx.id === 'rows' ? (i < 0 ? nx.name : P[i].text.trim() ? `打勾第 ${i + 1} 件「${P[i].text.trim()}」` : `在六件事寫下第 ${i + 1} 件要做的事`)
      : nx.nx || nx.name;
  }
  return `<section class="px nextbar"><div class="row">
      <div class="sp" ${nx ? `data-act="goto" data-v="${nx.go}"` : ''}><small class="dim">每日任務 ${done}/${daily.length}${nx ? '・下一步' : ''}</small><div class="nx">${esc(label)}${nx ? ' ›' : ''}</div></div></div>
    <div class="bar c"><i style="width:${done / daily.length * 100}%"></i></div></section>`;
}
// 昨天有寫、沒打勾、而且還不在今天清單 P 裡的事（去掉重複）
function carryLeft(P) {
  const Y = S.plans[addDays(dayKey(), -1)] || [], have = new Set(P.map(x => x.text.trim()));
  return [...new Set(Y.filter(x => !x.done).map(x => x.text.trim()).filter(t => t && !have.has(t)))];
}
function today(D) {
  const st = streaks(D), td = dayKey(), d = viewDay(), P = getPlan(d);
  const claimed = D.claimed.has('plan:' + d);
  const chips = activeHabits().map(h => {
    const s = st[h.id], badge = s.n ? `<span class="streak">${s.n}<small>${h.weeks ? (h.weeks === 1 ? '週' : '次') : '天'}</small></span>` : '';
    let on, sub;
    if (h.weeks) {
      const p = periodKey(td, h.weeks), cnt = perCount(D, h, p);
      on = periodDone(D, h, p); sub = `${periodWord(h)} ${cnt}/${h.target} ${countWord(h)}`; if (!on && periodLeave(h, p)) sub += '・已請假';
    } else {
      on = dayDone(D, td, h.id); sub = on ? '今天 ✓' : onLeave(h.id, td) ? '今天已請假' : '今天還沒';
    }
    return `<button class="hab ${on ? 'on' : ''} ${!on && leaveHere(h, td) ? 'leave' : ''}" data-act="habtap" data-v="${esc(h.id)}">
      <div class="row"><span class="hn">${esc(h.n)}</span><span class="sp"></span>${badge}</div>
      <div class="hs">${esc(sub)}</div></button>`;
  }).join('');
  // 昨天（上一期）漏了：已經自動用掉假或保護卡的，告訴他還剩多少；都用完、連勝斷了的，也說一聲。今天做了就不再提
  const yd = addDays(td, -1), cards = freezeLeft(D);
  const risky = activeHabits().map(h => {
    const p = h.weeks ? addDays(periodKey(td, h.weeks), -7 * h.weeks) : yd;
    if (h.weeks ? perCount(D, h, periodKey(td, h.weeks)) : dayDone(D, td, h.id)) return '';
    const v = autoLeaveOf(h, p), when = h.weeks ? (h.weeks === 1 ? '上週' : '上兩週') : '昨天';
    if (v) return `<div class="mini riskrow">${when}漏了「${esc(h.n)}」，自動用掉 1 ${v === 'f' ? `張連勝保護卡（還剩 ${cards} 張）` : `${h.weeks ? '次' : '天'}假（本月還剩 ${leaveLeft(h.id, td)} ${h.weeks ? '次' : '天'}）`}，連勝保住了。</div>`;
    if (!h.weeks && yd >= S.strictFrom && !dayDone(D, yd, h.id) && !onLeave(h.id, yd) && habitChain(D, h, addDays(yd, -1)).n)
      return `<div class="warn">昨天漏了「${esc(h.n)}」，剩下的假和保護卡不夠補，連勝從今天重新開始。</div>`;
    return '';
  }).filter(Boolean);
  const hint = UI.pday < 0 ? '補登昨天：只算完成，沒有獎勵'
    : UI.pday > 0 ? `先寫好明天的（至少 ${CONFIG.rewardRows} 件），一樣算「寫好清單」`
    // 今天的提示只在剛開始用的前幾天出現（以前寫過清單的天數還不到 CONFIG.sixTipDays），之後只留日期
    : Object.keys(S.plans).filter(x => x < dayKey() && S.plans[x].some(it => it.text.trim())).length < CONFIG.sixTipDays
      ? `每天任意完成 ${CONFIG.rewardRows} 件有獎勵・按住編號上下拖曳排順序` : '';
  const favs = S.favs || [];
  // 常用：點一下填進第一個空格，不用每天重打
  const favBar = favs.length ? `<div class="favs"><small class="dim">常用</small>${favs.map((t, i) => `<span class="fav"><button class="ghost" data-act="usefav" data-v="${i}">${esc(t)}</button><button class="ghost x" data-act="delfav" data-v="${i}" title="從常用移除">×</button></span>`).join('')}</div>` : '';
  // 昨天沒做完的：在今天點一下帶過來（一件一件，或全部帶入），已經在今天清單裡的不再列出；今天寫滿了就不顯示
  const left = UI.pday === 0 ? carryLeft(P) : [];
  const carryBar = left.length && P.some(x => !x.text.trim()) ? `<div class="favs carry"><small class="dim">昨天沒做完</small>${left.map((t, i) => `<span class="fav"><button class="ghost" data-act="carry" data-v="${i}" title="帶到今天">＋ ${esc(t)}</button></span>`).join('')}${left.length > 1 ? '<button class="ghost carryall" data-act="carryall">全部帶入</button>' : ''}</div>` : '';
  const last = P.reduce((a, it, i) => it.text.trim() ? i : a, -1), shown = Math.min(P.length, Math.max(CONFIG.rewardRows, last + 1, UI.showRows || 0));
  UI.shownRows = shown;
  const introTarget = S.introNextTask && UI.pday === 0 ? P.findIndex(it => it.text.trim() && !it.done) : -1;
  const rows = P.slice(0, shown).map((it, i) => {
    const starred = it.text.trim() && favs.includes(it.text.trim());
    return `<div class="prow ${it.done ? 'done' : ''} ${i === introTarget ? 'intro-target' : ''}">
      <input type="checkbox" data-act="pdone" data-v="${i}" aria-label="完成第 ${i + 1} 件" ${it.done ? 'checked' : ''} ${UI.pday > 0 ? 'disabled title="明天才能打勾"' : ''}>
      <button class="ghost no ${UI.swap === i ? 'sel' : ''}" data-act="swap" data-v="${i}" title="按住拖曳排序，或點兩個編號交換">${i + 1}</button>
      <textarea class="ptext" rows="1" title="${esc(it.text)}" data-pf="text" data-i="${i}" aria-label="第 ${i + 1} 件事" maxlength="200" placeholder="${i === 0 ? '今天最重要的事' : ''}">${esc(it.text)}</textarea>
      <button class="ghost star" data-act="fav" data-v="${i}" title="${starred ? '從常用移除' : '存成常用'}">${starred ? '★' : '☆'}</button>
      ${UI.pday >= 0 ? `<button class="ghost pdel" data-act="prowdel" data-v="${i}" title="刪掉這件">✕</button>` : '<span class="pdel"></span>'}</div>`;
  }).join('');
  const T = S.timer && S.timer.segs ? S.timer : null, seg = T && T.segs[T.si], pm = pomoMin();
  const PRESETS = [25, 45, 60, 90], custom = UI.pomoCustom || !PRESETS.includes(pm);
  const todayPomo = S.logs.filter(l => l.k === 'pomo' && l.d === td).length;
  const timer = T ? ''
    : `<section class="px" id="pomo">${sh('番茄鐘', 'FOCUS', `<small class="dim">今天 ${todayPomo} 段</small>`)}
      <div class="mini">工作階段總時長（含休息）；每天第一段滿 25 分鐘的專注可領獎勵。</div><div class="pomo-set"><div class="presets">${PRESETS.map(m => `<button class="${pm === m && !custom ? 'sel' : ''}" data-act="pomoset" data-v="${m}">${m} 分</button>`).join('')}
          <button class="${custom ? 'sel' : ''}" data-act="pomocustom">${custom ? `${pm} 分` : '自訂'}</button></div>
        <div class="pomo-go">${custom ? `<input type="number" id="pomoMin" min="5" max="120" step="5" value="${pm}" title="總長度（分鐘）"><span class="dim">分</span>` : ''}
        <button data-act="start">開始專注</button></div></div>
      <div class="segs" id="pomoPlan">${segLine(null, sessionPlan(pm))}</div>
</section>`;
  const habits = UI.habEdit ? habitEditor() : `<section class="px" id="habits">${sh('習慣', 'HABITS', '<button class="ghost" data-act="habedit">編輯</button>')}
      <div class="habits">${chips || '<button class="wide" data-act="habedit">新增第一個習慣</button>'}</div>
      ${risky.join('')}</section>`;
  return `${UI.pday === 0 ? autoNoticeCard() + tutorialResumeCard() + (S.introPending ? '' : nextStep(D, P)) + backupNudge() : ''}${habits}
    <section class="px" id="six">${sh('最重要的六件事', 'TODAY', `<span class="seg-switch">${[[-1, '昨天'], [0, '今天'], [1, '明天']].map(([o, n]) => `<button class="${UI.pday === o ? 'sel' : ''}" data-act="pday" data-v="${o}">${n}</button>`).join('')}</span>`)}
      <div class="mini" style="margin:-2px 0 4px">${UI.pday < 0 ? '昨天 ' : UI.pday > 0 ? '明天 ' : '今天 '}${d.slice(5).replace('-', '/')}${hint ? '・' + hint : ''}</div>
      ${UI.pday >= 0 && !S.tipSix ? `<div class="tip row"><span class="sp">小技巧：按住編號拖曳可以排順序，點 ☆ 存成常用。</span><button class="ghost" data-act="tipsix">知道了</button></div>` : ''}
      ${UI.pday === 0 ? `<div class="mini">已完成 ${Math.min(filled(P).filter(it => it.done).length, CONFIG.rewardRows)}/${CONFIG.rewardRows} 件・任意完成 ${CONFIG.rewardRows} 件有加碼</div>` : ''}
      ${introTarget >= 0 ? '<p class="mini intro-task-hint">完成這件事後，回來打勾領獎勵。</p>' : ''}${UI.pday >= 0 ? carryBar + favBar : ''}${rows}${UI.planUndo && UI.planUndo.d === d ? '<button class="ghost" data-act="planundo">復原剛才刪除的事項</button>' : ''}
      ${shown < P.length && UI.pday >= 0 ? `<button class="ghost addrow" data-act="addrow">＋ 再加一件</button>` : ''}
      ${UI.pday < 0 || claimed ? '' : '<div class="row" style="margin-top:8px"><button class="pri" data-act="plansave">寫好了</button></div>'}</section>
    ${timer}`;
}

const segLine = (T, segs) => segs.map((x, i) => `<span class="${T && i < T.si ? 'past' : T && i === T.si ? 'now' : ''}">${x.m === 'break' ? '休息' : '專注'} ${x.min}</span>`).join('<span>›</span>');
// 專注中：蓋住整個畫面，只剩計時器和「結束」，專心做事，不能跑去玩遊戲
function renderFocus() {
  let el = document.getElementById('focus');
  if (!el) { el = document.createElement('div'); el.id = 'focus'; document.body.appendChild(el); }
  const T = S.timer && S.timer.segs ? S.timer : null;
  el.classList.toggle('hidden', !T); document.body.classList.toggle('focusing', !!T);
  if (!T) { el.innerHTML = ''; return; }
  const seg = T.segs[T.si], br = seg.m === 'break';
  el.innerHTML = `<div class="fbox">
    <div class="label">${br ? '休息' : '專注'}・${T.si + 1}/${T.segs.length}</div>
    <div class="fsprite">${stageImg(CR.clown, 2, 6)}</div>
    <div>${br ? '休息一下，站起來動一動' : '專注中，先把手機放下'}</div>
    <div class="clock" id="tclock">--:--</div><div class="bar c"><i id="tbar" style="width:0"></i></div>
    <div class="segs">${segLine(T, T.segs)}</div>
    <div class="row" style="justify-content:center;margin-top:14px">${br ? '<button class="pri" data-act="skipbreak">跳過休息</button>' : ''}<button class="fend" data-act="cancel">結束</button></div></div>`;
}

/* ========= 第一次打開的引導 ========= */
// 三步新手導覽：選習慣 → 第一件事 → 餵魚；Google 登入只供接續舊紀錄。
const onbCustomCount = () => customCount() + ONB_HABITS.filter(h => h.kind === 'custom' && (UI.onbSel || {})[h.id] && !habit(h.id)).length + ((UI.onbName || '').trim() ? 1 : 0);
const onbLabel = () => '下一步：建立第一件事';
function renderOnbButton() { const b = document.querySelector('#onbbox [data-act=onbdone]'); if (b) b.textContent = onbLabel(); }   // 打字時只換按鈕上的字，不重畫（輸入框會失去焦點）
function renderOnb() {
  let el = document.getElementById('onb');
  const firstTask = S.onb && S.introPending && !window.__noOnb;
  if (!needOnb() && !firstTask) { if (el) el.classList.add('hidden'); if (GAME_READY) startGame(); return; }   // 引導做完（或雲端換成做過引導的紀錄）：開始遊戲
  if (!el) { el = document.createElement('div'); el.id = 'onb'; el.className = 'ov'; el.innerHTML = '<div class="px modal" id="onbbox"></div>'; document.body.appendChild(el); }
  el.classList.remove('hidden');
  const step = UI.onbStep || 1, sel = UI.onbSel || {};
  let html;
  if (firstTask) html = introTasks();
  else if (step === 1) {
    if (UI.onbReturning) cloudWarm();
    html = `<h2>歡迎來到習慣深潛</h2><p>每天完成一點事，收集海洋生物。</p>
      ${UI.onbReturning ? `<div class="mini">登入後接續你的雲端紀錄。</div>${IN_APP ? '<div class="warn">App 內建瀏覽器無法登入，請用 Chrome 或 Safari 開啟。</div>' : `<button class="gbtn" data-act="login">${GOOGLE_G}${CLOUD.armed ? '再按一次，選擇 Google 帳戶' : '用 Google 帳戶登入'}</button>`}${CLOUD.error ? `<div class="warn">${esc(CLOUD.error)}</div>` : ''}<button class="ghost wide" data-act="onbback">返回</button>` : `<ol class="welcome-route"><li>選擇想養成的習慣</li><li>寫下第一件重要的事</li><li>認識小丑魚，試著餵食</li></ol><button class="pri wide" data-act="onbstart">開始新手導覽</button><div class="mini">不需註冊，紀錄先存在此瀏覽器。</div><div class="row intro-links">${FIREBASE_CONFIG ? '<button class="ghost" data-act="onbreturn">已有紀錄？登入接續</button>' : ''}</div>`}`;
  } else {
    html =`${tutorialProgress(1)}<h2>先選擇想養成的習慣</h2>
      ${CLOUD.user ? `<div class="mini" style="margin:0 0 6px">已綁定 ${esc(CLOUD.user.email || '')}</div>` : ''}
      <div class="onbgrid">${ONB_HABITS.map(h => `<button class="onbopt ${sel[h.id] ? 'sel' : ''}" data-act="onbpick" data-v="${h.id}" aria-pressed="${!!sel[h.id]}"><b>${esc(h.n)}</b><small>${esc(h.desc)}</small></button>`).join('')}</div>
      <div class="row onbcustom"><input class="sp" data-onb="name" maxlength="20" placeholder="自訂，例如：喝水" aria-label="自訂習慣名稱" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(UI.onbName || '')}"></div>
      <button class="pri wide" data-act="onbdone">${onbLabel()}</button>`;
  }
  const box = document.getElementById('onbbox');
  if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; }   // 內容沒變就不重畫，免得打字到一半失去焦點
}
function finishOnb() {
  const sel = UI.onbSel || {}, name = (UI.onbName || '').trim().slice(0, 20);
  if (onbCustomCount() > CONFIG.maxCustom) { toast(`自訂型的習慣最多 ${CONFIG.maxCustom} 個，少選一個吧`); return false; }
  const out = [], mk = o => { const old = S.habits.find(h => h.id === o.id); return old ? { ...old, off: false } : { id: o.id, e: o.e, n: o.n, kind: o.kind, weeks: o.weeks, target: o.target, ...(o.unit ? { unit: o.unit } : {}) }; };
  for (const o of ONB_HABITS) {
    if (sel[o.id]) out.push(mk(o));
    else if (o.kind === 'exercise') { const old = S.habits.find(h => h.id === o.id); if (old) out.push({ ...old, off: true }); }   // 運動沒選也留著（編輯畫面可以加回）；沒選的其他習慣直接不放進來
  }
  const mine = S.habits.filter(h => !ONB_HABITS.some(o => o.id === h.id));   // 引導以外、舊存檔裡自己加的習慣原樣保留
  if (name) mine.push({ id: 'h' + rid(), e: '⭐', n: name, kind: 'custom', weeks: 0, target: 1 });
  S.habits = [...out, ...mine];
  S.onb = true; S.introPending = !derive().claimed.has('welcome'); Object.assign(UI, { onbStep: 0, onbSel: null, onbName: '' });
  save(); render();
  return true;
}

/* ========= 習慣打卡面板 ========= */
// 每種運動要記的欄位不一樣：潛水記深度和潛點、登山記爬升；跑步、游泳會算配速。[欄位, 名稱, 單位, 間隔]
const EX_FIELDS = {
  '跑步': [['dist', '距離', 'km', .1], ['min', '時間', '分鐘', 1]],
  '游泳': [['m', '距離', '公尺', 50], ['min', '時間', '分鐘', 1]],
  '重訓': [['min', '時間', '分鐘', 1]],
  '潛水': [['depth', '最大深度', '公尺', 1], ['min', '潛水時間', '分鐘', 1], ['site', '潛點', '', 0]],
  '登山': [['dist', '距離', 'km', .1], ['gain', '爬升', '公尺', 10], ['min', '時間', '分鐘', 1]],
  '其他': [['min', '時間', '分鐘', 1]],
};
const fmtPace = sec => { const s = Math.round(sec); return `${Math.floor(s / 60)}'${pad(s % 60)}"`; };
const swimMeters = e => e.m || (e.type === '游泳' && e.dist ? e.dist * 1000 : 0);
function paceText(e) {
  if (!(e.min > 0)) return '';
  if (e.type === '跑步' && e.dist > 0) return `配速 ${fmtPace(e.min * 60 / e.dist)}/km`;
  if (e.type === '游泳' && swimMeters(e) > 0) return `配速 ${fmtPace(e.min * 60 / (swimMeters(e) / 100))}/100m`;
  return '';
}
function exText(e) {
  const parts = [e.type];
  if (e.type === '游泳') { if (swimMeters(e)) parts.push(`${swimMeters(e)} m`); }
  else if (e.dist) parts.push(`${e.dist} km`);
  if (e.depth) parts.push(`最大 ${e.depth} m`);
  if (e.gain) parts.push(`爬升 ${e.gain} m`);
  if (e.min) parts.push(`${e.min} 分`);
  parts.push(paceText(e), e.site, e.note);
  return parts.filter(Boolean).join('・');
}
function renderSheet() {
  const ov = document.getElementById('sheetov'), el = document.getElementById('sheet');
  if (!UI.sheet) { ov.classList.add('hidden'); return; }
  ov.classList.remove('hidden');
  if (UI.sheet.creature) {   // 圖鑑放大：介紹、三種成長外觀、擁有幾隻
    const c = CR[UI.sheet.creature], R = RARITY[c.r], P = pets(c.id), seen = seenStage(c.id);
    const big = Math.max(3, Math.min(8, Math.floor(110 / Math.max(...c.px.map(r => r.length)))));
    el.style.textAlign = 'center';
    el.innerHTML = `<div class="row"><span class="rar" style="background:${R.color}">${R.name}</span><span class="sp"></span><button class="ghost" data-act="sheetclose">✕</button></div>
      ${stageImg(c, seen, big, false, 'pop')}
      <h2>${c.name}</h2>${c.alias ? `<div class="alias">俗稱 ${c.alias}</div>` : ''}<p class="dim" style="margin:0 0 8px">${c.fact}</p>
      <div class="stages">${[1, 2, 3].map(s => `<div>${stageImg(c, s, 3, s > seen)}<small class="${s > seen ? 'dim' : ''}">${s > seen ? '？？？' : stageName(c, s)}</small></div>`).join('')}</div>
      <div class="mini">吃到 ${GROW[1]} 顆長成成體、${GROW[2]} 顆變成特殊型態</div><div class="mini">不用每天餵，牠們不會餓死，成長進度也不會倒退。</div>
      <div class="sub">${P.length ? `擁有 ${P.length}/${MAX_PETS} 隻` : derive().col[c.id] ? '都游走了，再抽到會回來。' : '還沒抽到，可以從商店的寶箱開出來。'}</div>`;
    return;
  }
  el.style.textAlign = '';
  const h = habit(UI.sheet.id); if (!h) { UI.sheet = null; renderSheet(); return; }
  const D = derive(), s = streaks(D)[h.id], day = UI.sheet.day, d = addDays(dayKey(), day), list = dayChecks(d, h.id);
  // 這一期的日期範圍，例如「本週（11/2–11/8）」
  const p0 = h.weeks && periodKey(dayKey(), h.weeks), md = mdOf;
  const goal = h.weeks ? `${h.weeks === 1 ? '每週' : '每兩週'} ${h.target} ${esc(countWord(h))}・${periodWord(h)}（${md(p0)}–${md(addDays(p0, 7 * h.weeks - 1))}）${perCount(D, h, p0)}/${h.target}` : '每天';
  let body;
  if (h.kind === 'exercise') {
    const type = UI.sheet.exType || ETAGS[0];
    body = `
      ${list.map((e, i) => `<div class="entry"><span class="sp">${esc(exText(e) || '運動')}</span><button class="ghost" data-act="chkdel" data-v="${i}">✕</button></div>`).join('')}
      <div class="form">
        <label class="ex-type"><span>運動類型</span><select id="exType">${ETAGS.map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        ${EX_FIELDS[type].map(([k, label, unit, step]) => `<label class="ex-field${step ? '' : ' full'}"><span>${label}${unit ? `（${unit}）` : ''}<small>選填</small></span><input id="ex_${k}" ${step ? `type="number" min="0" step="${step}" inputmode="decimal"` : 'maxlength="60"'} aria-label="${label}${unit ? `（${unit}）` : ''}" placeholder="${step ? '例如：' + (k === 'dist' ? '3' : '30') : label}"></label>`).join('')}
        <span class="dim" id="exPace" style="align-self:center"></span>
        <input id="ex_note" class="f-wide" maxlength="200" placeholder="備註">
      </div><div id="exError" class="warn" role="alert"></div><div class="mini">可直接記錄完成；距離、時間與備註皆為選填。</div><button class="pri wide" data-act="exadd">記錄這次${type}</button>`;
  } else body = list.length
      ? `<button class="wide" data-act="chk">✓ 已完成，點一下取消</button>`
      : `<button class="pri wide" data-act="chk">完成打卡</button>`;
  // 請假：每天型是「今天／昨天請假」（每月 2 天），每週型是「本週請假」整期（每月 1 次）；已經完成就不用請
  if (!(h.weeks ? periodDone(D, h, periodKey(d, h.weeks)) : list.length)) {
    const left = leaveLeft(h.id, d), unit = h.weeks ? '次' : '天';
    const who = h.weeks ? (periodKey(d, h.weeks) === p0 ? periodWord(h) : h.weeks === 1 ? '上週' : '上兩週') : day < 0 ? '昨天' : '今天';
    const auto = autoLeaveOf(h, h.weeks ? periodKey(d, h.weeks) : d);
    body += auto ? `<div class="mini" style="margin-top:8px">${who}漏了，自動用掉 1 ${auto === 'f' ? '張連勝保護卡' : unit + '假'}保住連勝；補打卡就會退回。</div>`
      : leaveHere(h, d) ? `<button class="wide" data-act="leave">${who}已請假，點一下取消</button>`
      : `<button class="wide" data-act="leave" ${left ? '' : 'disabled'}>${who}請假（本月還剩 ${left} ${unit}）</button>`;
  }
  el.innerHTML = `<div class="row"><b style="font-size:18px">${esc(h.n)}</b><span class="sp"></span><button class="ghost" data-act="sheetclose">✕</button></div>
    <div class="mini">${goal}${s.n ? `・連續 ${s.n} ${h.weeks ? (h.weeks === 1 ? '週' : '次') : '天'}` : ''}</div>
    <div class="row" style="margin-top:10px"><span class="seg-switch">${[[0, '今天'], [-1, '昨天']].map(([o, n]) => `<button class="${day === o ? 'sel' : ''}" data-act="shday" data-v="${o}">${n}</button>`).join('')}</span>
      <small class="dim">${day < 0 ? '補登只算連勝，沒有獎勵' : ''}</small></div>
    ${body}`;
}

/* ========= 其他頁面 ========= */
// input=true 時多一個輸入框，按確定回傳輸入的文字，按取消回傳 false
function ask(msg, yes = '確定', no = '取消', input = false) {
  const inp = document.getElementById('askin');
  document.getElementById('askmsg').textContent = msg;
  document.getElementById('askyes').textContent = yes;
  document.getElementById('askno').textContent = no;
  inp.classList.toggle('hidden', !input); inp.value = '';
  document.getElementById('askov').classList.remove('hidden');
  if (input) inp.focus();
  return new Promise(res => { ask.res = v => { document.getElementById('askov').classList.add('hidden'); ask.res = null; res(v && input ? inp.value.trim() : v); }; });
}

/* ========= 生物個體與成長 ========= */
// 每一隻生物＝一筆抽到牠的紀錄（log.drop）；放生的記在 S.released。每種最多養 MAX_PETS 隻
const MAX_PETS = 5;
const GROW = [0, 10, 30];                                  // 吃到幾顆：幼體 → 成體 → 特殊型態
const fedOf = key => (S.fed && S.fed[key]) || 0;
const stageOf = n => GROW.filter(t => n >= t).length;
const inTank = id => !(S.outTank && S.outTank[id]);
// 幫個體取的名字：存在 S.names（key 是個體 id），沒取名字就是空字串
const PET_NAME_MAX = 10;
const petName = id => { const n = S.names && typeof S.names === 'object' ? S.names[id] : ''; return typeof n === 'string' ? Array.from(n.trim()).slice(0, PET_NAME_MAX).join('') : ''; };
function setPetName(id, v) {
  if (!S.logs.some(l => l.id === id && l.drop)) return;
  if (!S.names || typeof S.names !== 'object') S.names = {};
  v = Array.from(String(v).trim()).slice(0, PET_NAME_MAX).join('');
  if (v) S.names[id] = v; else delete S.names[id];
  save();
}
function pets(sp) {
  return S.logs.filter(l => l.drop === sp && !(S.released && S.released[l.id])).map(l => ({ id: l.id, fed: fedOf(l.id) }));
}
// 圖鑑裡解鎖到第幾種外觀：看過的最高型態（放生了也算看過）
const seenStage = sp => Math.max(1, (S.seen && S.seen[sp]) || 1, ...pets(sp).map(p => stageOf(p.fed)));
// 三種外觀：幼體用各自的幼體圖（JUV）、成體是原圖、特殊型態換成各自的稀有配色（MORPH）
const stageUrl = {};
function stageImg(c, s, scale, sil = false, cls = '') {
  const key = c.id + s + sil;
  if (!stageUrl[key]) {
    const src = stageCanvas(c, s), cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const x = cv.getContext('2d'); x.drawImage(src, 0, 0);
    if (sil) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#1b3a60'; x.fillRect(0, 0, cv.width, cv.height); }
    stageUrl[key] = { src: cv.toDataURL(), w: cv.width, h: cv.height };
  }
  const u = stageUrl[key];
  return `<img class="sprite ${cls}" src="${u.src}" width="${u.w * scale}" height="${u.h * scale}" alt="">`;
}

function dex(D) {
  return `<section class="px">${sh('水下生物圖鑑', 'COLLECTION', `<span class="dim">${Object.keys(D.col).length} / ${CREATURES.length}</span><button data-act="tankview" data-v="">返回大海</button>`)}
    <div class="mini">點生物看介紹和成長型態。</div>
    ${RARITY.map((R, r) => `<div class="grp row"><span class="rar" style="background:${R.color}">${R.name}</span></div>
      <div class="dex">${CREATURES.filter(c => c.r === r).map(c => D.col[c.id]
        ? `<div class="cell" style="--rc:${R.color}" data-act="fact" data-v="${c.id}">${stageImg(c, seenStage(c.id), Math.min(5, Math.floor(100 / stageCanvas(c, seenStage(c.id)).width)))}<div class="nm">${c.name}</div><small>${pets(c.id).length} 隻</small></div>`
        : `<div class="cell no">${img(c.px, Math.min(5, Math.floor(100 / Math.max(...c.px.map(r => r.length)))), true)}<div class="nm dim">？？？</div><small>&nbsp;</small></div>`).join('')}</div>`).join('')}</section>`;
}

/* ========= 水族箱小遊戲 ========= */
// 你養的生物會在這裡游；點水面撒飼料，吃到的那一隻會長大
// 每種生物的體型（相對大小）與游速，照真實生物的感覺；第三個值＝在海底爬
const TANK_SPECIES = {
  clown: [1, .45], damsel: [.9, .6], butterfly: [1, .4], star: [1, .05, 1], hermit: [1, .18, 1], urchin: [1, .04, 1],
  turtle: [1.2, .2], octopus: [1.3, .25], nudi: [.9, .07, 1], lion: [1.3, .2], puffer: [1.1, .25], cuttle: [1, .35],
  seahorse: [1, .1], shark: [1.6, .7], moray: [1.3, .3], jelly: [1.3, .08], manta: [1.7, .35], mola: [1.8, .15],
  dolphin: [1.2, .9], whaleshark: [2.6, .2],
};
const SWIM = .5;   // 游動速度倍率（水族箱每格 3 像素，原本的速度看起來太快）
const STAGE_SCALE = [1, 1, 1.1];   // 幼體圖本身就比較小
const FEED = { free: 10, pack: 10, price: 30 };           // 每天免費 10 顆；商店 30 金幣買 10 顆
// 水族箱設定：哪幾隻放進去記在 S.outTank
const freeLeft = () => S.feedDay && S.feedDay.d === dayKey() ? Math.max(0, FEED.free - S.feedDay.used) : FEED.free;
const feedLeft = () => freeLeft() + (S.feed || 0);
// 新手提示：撒滿這麼多顆飼料以前，海中間會有一句說明（S.tossed＝總共撒過幾顆）
const FEED_TIP_UNTIL = 3, FEED_TIP = '點水裡撒飼料，魚吃到一定數量會長大';
const needFeedTip = () => (S.tossed || 0) < FEED_TIP_UNTIL;
function useFeed() {
  if (freeLeft() > 0) { if (!S.feedDay || S.feedDay.d !== dayKey()) S.feedDay = { d: dayKey(), used: 0 }; S.feedDay.used++; }
  else if ((S.feed || 0) > 0) S.feed--;
  else return false;
  S.tossed = (S.tossed || 0) + 1;
  save(); return true;
}
const TANK = { raf: 0 };
// 自由游動：每隻各自隨機挑一個目的地（左右上下都有可能）、用這一趟的速度游過去，到了偶爾停一下再挑下一個
function wander(f, dt, W, floorY) {
  const top = 2, bottom = floorY - f.h + 2, cx = f.x + f.w / 2;
  if (f.tx == null || f.wt <= 0) {
    const jelly = f.c.id === 'jelly';
    f.tx = jelly ? cx + (Math.random() - .5) * 60 : f.w / 2 + Math.random() * Math.max(1, W - f.w);
    f.ty = top + Math.random() * Math.max(1, bottom - top);
    f.pace = .45 + Math.random() * .9;            // 這一趟快一點或慢一點
    f.wt = 240 + Math.random() * 480;             // 太久沒到就換目的地
  }
  f.wt -= dt;
  let tvx = 0, tvy = 0;   // 想要的速度；實際速度 mx、my 慢慢追上去，起步、轉彎、停下都有緩衝
  if (f.rest > 0) f.rest -= dt;
  else {
    const dx = f.tx - cx, dy = f.ty - f.baseY, dist = Math.hypot(dx, dy);
    if (dist < 2) { f.tx = null; if (Math.random() < .35) f.rest = 30 + Math.random() * 150; }
    else {
      const sd = Math.abs(f.vx) * f.pace * (.3 + .7 * Math.min(1, dist / 16));   // 快到了會慢下來
      tvx = dx / dist * sd; tvy = dy / dist * sd * .6;   // 上下移動比左右慢一點
    }
  }
  steer(f, tvx, tvy, dt);
}
// 速度緩動：實際速度每一格往想要的速度靠一點，位置再用實際速度推進
function steer(f, tvx, tvy, dt, vertical = true) {
  const k = 1 - Math.pow(.94, dt);
  f.mx = (f.mx || 0) + (tvx - (f.mx || 0)) * k; f.my = (f.my || 0) + (tvy - (f.my || 0)) * k;
  f.x += f.mx * dt; if (vertical) f.baseY += f.my * dt;
  // 魚頭朝實際游的方向（不是朝目的地），掉頭時不會倒著滑
  if (vertical && Math.abs(f.mx) > Math.abs(f.vx) * .15) f.vx = Math.sign(f.mx) * Math.abs(f.vx);
}
// 海底工具列的飼料：小蝦圖示＋兩個標籤，今天免費的還剩幾顆（每天 FEED.free 顆）、買的還有幾顆
function tankFeedHTML() {
  const f = freeLeft(), b = S.feed || 0;
  return `${img(SHRIMP, 2, false, 'feedic')}<span class="fpills"><span class="fpill free${f ? '' : ' out'}" title="今天免費的飼料，每天 ${FEED.free} 顆">今日免費 ${f}/${FEED.free}</span><span class="fpill paid" title="用金幣買的飼料">已購 ${b}</span></span>`;
}
function tankEditor(D) {
  const owned = CREATURES.filter(c => pets(c.id).length);
  return `<section class="px">${sh('大海設定', 'SEA', '<button class="pri" data-act="tankdone">完成</button>')}
    <div class="mini">勾選要放進大海的個體；點「取名」，名字會跟著牠游。</div>
    ${owned.map(c => {
      const P = pets(c.id);
      return `<div class="tset"><div class="row"><b class="sp">${c.name}</b></div>
        ${P.map(p => `<div class="entry"><label class="row sp" style="gap:8px"><input type="checkbox" data-act="intank" data-v="${esc(p.id)}" ${inTank(p.id) ? 'checked' : ''}>
          ${stageImg(c, stageOf(p.fed), 3)}<small>${petName(p.id) ? `<b>${esc(petName(p.id))}</b>・` : ''}${stageName(c, stageOf(p.fed))}・吃了 ${p.fed} 顆</small></label>
          <button class="ghost" data-act="petname" data-v="${esc(p.id)}">${petName(p.id) ? '改名' : '取名'}</button>
          <button class="ghost" data-act="release" data-v="${esc(p.id)}">讓牠游走</button>
          ${UI.nameEdit === p.id ? `<div class="pname"><input data-nf="${esc(p.id)}" value="${esc(petName(p.id))}" maxlength="${PET_NAME_MAX}" placeholder="幫牠取個名字" aria-label="${esc(c.name)}的名字"><button class="pri" data-act="petnamedone">完成</button></div>` : ''}</div>`).join('')}</div>`;
    }).join('') || '<div class="dim">還沒有生物，到商店買寶箱吧。</div>'}</section>`;
}
function tank(D) {
  if (UI.tankEdit) return tankEditor(D);
  if (UI.tankView === 'dex') return dex(D);
  const n = CREATURES.filter(c => pets(c.id).some(p => inTank(p.id))).length;
  // 沒有框：畫布透明、填滿整個視窗，魚直接游在網站背景的海裡。
  // 海裡不放任何按鈕：飼料、補充、圖鑑、設定都在最下面一條不透明的工具列（跟分頁列連在一起），海和沙地停在它上面；新手（還沒撒滿 3 顆飼料）海中間有一句說明
  return `<div class="sea"><canvas id="tank" class="tank" aria-label="大海，點水裡撒飼料"></canvas>
    <div class="seahud seabar"><div id="feedInfo">${tankFeedHTML()}</div><span class="sp"></span>
      <button class="sr-only" data-act="feedkeyboard">撒一顆飼料</button><button class="feedbuy" data-act="buyfeed" title="用 ${FEED.price} 金幣買 ${FEED.pack} 顆飼料" aria-label="${FEED.pack} 顆飼料，${FEED.price} 金幣">+${FEED.pack}<span class="price">${FEED.price}${COIN}</span></button>
      <button data-act="tankview" data-v="dex" title="已解鎖 ${Object.keys(D.col).length} 種生物">圖鑑<i class="cnt">${Object.keys(D.col).length}</i></button><button data-act="tankedit">設定</button></div>
    ${tutorialSeaCard()}${!n ? '<div class="seaempty"><p>這片海還沒有展示生物</p><button data-act="tab" data-v="shop">前往商店</button><button data-act="tankedit">管理生物</button></div>' : ''}${needFeedTip() ? `<div class="seacoach" aria-live="polite"><i class="ring"></i><span>${FEED_TIP}</span></div>` : ''}</div>`;
}
// 大海畫面時：頁尾藏起來、整頁不捲動，海填滿整個視窗
const seaOn = () => UI.tab === 'tank' && !UI.tankEdit && UI.tankView !== 'dex';
// 量這台電腦的捲軸有多寬（手機是 0）：大海頁拿掉捲軸時，內容欄要往左挪半條，才跟其他頁對齊（見 style.css 的 html.sea-on）
function measureScrollbar() {
  const p = document.createElement('div'); p.className = 'sbprobe';
  p.style.cssText = 'position:absolute;top:-999px;width:100px;height:100px;overflow:scroll';
  document.body.appendChild(p);
  document.documentElement.style.setProperty('--sbw', (p.offsetWidth - p.clientWidth) + 'px'); p.remove();
}
measureScrollbar();
// 視窗大小改變（手機轉橫向、電腦拉視窗）時重新量水族箱，不然畫面會被拉扁；每一隻留在原位
let tankResizeTimer = 0;
window.addEventListener('resize', () => {
  measureScrollbar();
  clearTimeout(tankResizeTimer);
  tankResizeTimer = setTimeout(() => { if (UI.tab === 'tank' && !UI.tankEdit && UI.tankView !== 'dex' && document.getElementById('tank')) tankStart(); }, 120);
});
function tankStart() {
  cancelAnimationFrame(TANK.raf);
  const cv = document.getElementById('tank'); if (!cv) return;
  // 海填滿整個視窗；手機的分頁列固定在底下，海底工具列貼在它上面（電腦上貼在畫面最底下），沙地要在工具列上面才看得到
  const nav = document.getElementById('nav'), navFixed = getComputedStyle(nav).position === 'fixed', navH0 = navFixed ? nav.offsetHeight : 0;
  const bar = document.querySelector('.seabar'), navH = navH0 + (bar ? bar.offsetHeight : 0);
  // 工具列橫跨整個寬度，裡面的東西對齊內容欄
  const col = document.querySelector('.wrap').getBoundingClientRect(), padL = Math.max(12, col.left + 14) + 'px', padR = Math.max(12, innerWidth - col.right + 14) + 'px';
  if (bar) Object.assign(bar.style, { bottom: navH0 + 'px', paddingLeft: padL, paddingRight: padR });
  const W = Math.floor(cv.clientWidth / 3), H = Math.floor(cv.clientHeight / 3);   // 每一格固定 3 個螢幕像素，手機上也看得清楚
  // 畫布用裝置的實際像素畫（遊戲裡一格＝ K 個裝置像素），位置可以對到裝置像素：慢的魚不再一格一格跳
  const K = Math.round(3 * Math.min(3, Math.max(1, window.devicePixelRatio || 1))), rp = v => Math.round(v * K) / K;
  cv.width = W * K; cv.height = H * K; TANK.W = W; TANK.H = H;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const floorY = TANK.floorY = Math.max(40, Math.floor((cv.clientHeight - navH) / 3) - 16);   // 沙地（寄居蟹、海星這些海底生物走在上面）；底下的飼料列浮在沙地上
  const prev = new Map((TANK.fish || []).map(f => [f.key, f]));   // 重畫（例如買飼料）時，每一隻留在原位
  TANK.food = TANK.food || []; TANK.bub = TANK.bub || [];
  // 外觀和體型跟著型態走：物種大小 × 型態大小
  const look = f => {
    const st = stageOf(fedOf(f.key));
    f.st = st; f.s = stageCanvas(f.c, st);
    const sc = TANK_SPECIES[f.c.id][0] * STAGE_SCALE[st - 1];
    f.w = Math.round(f.s.width * sc); f.h = Math.round(f.s.height * sc);
  };
  TANK.fish = [];
  for (const c of CREATURES) {
    const P = pets(c.id), [, speed, ground] = TANK_SPECIES[c.id];
    P.forEach((p, i) => {
      if (!inTank(p.id)) return;
      const f = { c, key: p.id, no: i + 1, many: P.length > 1, name: petName(p.id), ground: !!ground, ph: Math.random() * 6, rest: 0,
        vx: speed * SWIM * (.8 + Math.random() * .4) * (Math.random() < .5 ? -1 : 1) };
      look(f);
      const q = prev.get(f.key);
      if (q) { f.vx = q.vx; f.ph = q.ph; f.rest = q.rest; f.mx = q.mx || 0; f.my = q.my || 0; f.x = Math.min(q.x, Math.max(0, W - f.w)); f.baseY = ground ? floorY - f.h + 2 : Math.min(q.baseY, floorY - f.h + 2); f.y = ground ? f.baseY : q.y; }
      else { f.x = Math.random() * Math.max(1, W - f.w); f.y = f.baseY = ground ? floorY - f.h + 2 : 6 + Math.random() * Math.max(1, floorY - f.h - 24); }
      TANK.fish.push(f);
    });
  }
  TANK.fish.sort((a, b) => b.w * b.h - a.w * a.h);   // 大的畫在後面，小的在前面
  // 海底的沙：顏色壓暗一點、邊緣起伏、往上淡淡地融進海水，不要像一條亮色的地板。只畫一次，每一格直接貼上去
  const sand = document.createElement('canvas'), sx = sand.getContext('2d'), FADE = 6;
  sand.width = W; sand.height = H - floorY + FADE;
  const hash = i => { const s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); };   // 固定的亂數：每次重畫長得一樣
  for (let i = 0; i < FADE; i++) { sx.fillStyle = `rgba(110,102,77,${(i + 1) / FADE * .22})`; sx.fillRect(0, i, W, 1); }
  for (let c = 0; c < W; c++) {
    const top = FADE + Math.round(Math.sin(c / 11) * .8 + Math.sin(c / 29 + 1) * .7);   // 平緩的沙丘
    sx.fillStyle = '#857a5b'; sx.fillRect(c, top, 1, 1);
    sx.fillStyle = '#6b634b'; sx.fillRect(c, top + 1, 1, 6);
    sx.fillStyle = '#58523f'; sx.fillRect(c, top + 7, 1, sand.height);
    if (hash(c) < .18) { sx.fillStyle = hash(c + .5) < .5 ? '#4a4435' : '#94896a'; sx.fillRect(c, top + 2 + Math.floor(hash(c + .3) * 9), 1, 1); }
  }
  for (let k = 0; k < Math.max(2, Math.floor(W / 70)); k++) {   // 幾顆石頭
    const rx = Math.floor(hash(k + 9) * (W - 8)), rw = 3 + Math.floor(hash(k + 3) * 4);
    sx.fillStyle = '#3e4a56'; sx.fillRect(rx, FADE - 1, rw, 3); sx.fillStyle = '#56636f'; sx.fillRect(rx + 1, FADE - 2, rw - 2, 1);
  }
  const weeds = Array.from({ length: Math.max(3, Math.floor(W / 60)) }, (_, i) => ({ x: 12 + i * (W - 24) / Math.max(1, Math.floor(W / 60) - 1), h: 18 + (i * 7) % 20 }));
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
    if (py >= floorY - 4) return;
    if (!useFeed()) { toast(`飼料用完了，明天會再送 ${FEED.free} 顆，也可以用金幣買`); return; }
    TANK.food.push({ x: px, y: py, vy: .25 }); ac(); SFX.tap();
    if (S.introFeedPending) { UI.introFoodPending = true; const guide = document.querySelector('.sea-guide'); if (guide) guide.innerHTML = tutorialSeaContents(); }
    const el = document.getElementById('feedInfo'); if (el) el.innerHTML = tankFeedHTML();
    if (!needFeedTip()) { const tip = document.querySelector('.seacoach'); if (tip) tip.remove(); }
  };
  let last = performance.now();
  const frame = now => {
    if (!document.body.contains(cv)) return;
    const dt = Math.min(3, (now - last) / 16.7); last = now;
    x.setTransform(K, 0, 0, K, 0, 0);
    // 背景：海水是透明的（直接看到網站背景的海），只畫沙地和海草
    x.clearRect(0, 0, W, H);
    x.drawImage(sand, 0, floorY - FADE);
    weeds.forEach((w, i) => { for (let j = 0; j < w.h; j += 3) { const sway = rp(Math.sin(now / 700 + i + j / 6) * 2); x.fillStyle = j % 6 ? '#38b764' : '#257179'; x.fillRect(w.x + sway, floorY - j, 3, 3); } });
    if (Math.random() < .03 * dt) TANK.bub.push({ x: Math.random() * W, y: floorY, s: 1 + Math.round(Math.random()) });
    TANK.bub = TANK.bub.filter(b => (b.y -= .5 * dt) > 0);
    x.fillStyle = 'rgba(180,240,255,.55)'; TANK.bub.forEach(b => x.fillRect(rp(b.x), rp(b.y), b.s, b.s));
    TANK.food.forEach(f => { if (f.y < floorY - 2) f.y += f.vy * dt; f.age = (f.age || 0) + dt; });
    TANK.food = TANK.food.filter(f => f.age < 1800);
    x.fillStyle = '#ef7d57'; TANK.food.forEach(f => x.fillRect(rp(f.x), rp(f.y), 2, 2));
    // 生物：飼料碰到身體就算吃到；吃到的那一隻會長大
    const eats = (f, p) => p.x >= f.x - 2 && p.x <= f.x + f.w + 2 && p.y >= f.y - 2 && p.y <= f.y + f.h + 2;
    for (const f of TANK.fish) {
      const sp0 = Math.abs(f.vx);
      let food = null, best = 1e9;
      for (const p of TANK.food) {
        if (f.ground && p.y < floorY - 3) continue;   // 海底生物只吃掉到地上的
        const dd = Math.hypot(p.x - (f.x + f.w / 2), p.y - (f.y + f.h / 2)); if (dd < best) { best = dd; food = p; }
      }
      if (food) {
        const dx = food.x - (f.x + f.w / 2), sp = Math.max(.12, sp0 * 1.8);   // 看到飼料會加速，但慢的還是慢
        f.tx = null; f.rest = 0;   // 吃完再重新找地方游
        const dy = food.y - (f.y + f.h / 2), ease = Math.min(1, Math.hypot(dx, dy) / 10);
        steer(f, Math.sign(dx) * sp * ease, f.ground ? 0 : Math.sign(dy) * sp * .8 * ease, dt, !f.ground);
        if (f.ground) f.vx = Math.abs(dx) > .5 ? Math.sign(dx) * sp0 : f.vx;
        if (eats(f, food)) {
          TANK.food.splice(TANK.food.indexOf(food), 1); SFX.eat();
          const before = stageOf(fedOf(f.key));
          S.fed = S.fed || {}; S.fed[f.key] = fedOf(f.key) + 1;
          markTutorialFed(f.key);
          const after = stageOf(fedOf(f.key));
          if (after > before) {
            S.seen = S.seen || {}; S.seen[f.c.id] = Math.max(S.seen[f.c.id] || 1, after);
            const cx = f.x + f.w / 2, by = f.y + f.h; look(f); f.x = cx - f.w / 2; if (f.ground) f.y = floorY - f.h + 2; else f.baseY = by - f.h;
            SFX.rank(); toast(`${f.name || f.c.name + (f.many ? ` ${f.no} 號` : '')}長成${stageName(f.c, after)}了！`);
          }
          save();
        }
      } else if (f.ground) {
        if (f.rest > 0) f.rest -= dt;
        else {
          if (Math.random() < .004 * dt) f.rest = 60 + Math.random() * 180;
          if (Math.random() < .003 * dt) f.vx = -f.vx;   // 偶爾掉頭
        }
        steer(f, f.rest > 0 ? 0 : f.vx, 0, dt, false);
      } else wander(f, dt, W, floorY);
      if (!f.ground) {
        f.baseY = Math.max(2, Math.min(floorY - f.h + 2, f.baseY));
        f.y = f.baseY + Math.sin(now / (f.c.id === 'jelly' ? 1600 : 900) + f.ph) * (f.c.id === 'jelly' ? 8 : 3);
      }
      if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx); f.mx = Math.max(0, f.mx || 0); } else if (f.x > W - f.w) { f.x = W - f.w; f.vx = -Math.abs(f.vx); f.mx = Math.min(0, f.mx || 0); }
      x.save();
      if (f.vx < 0) { x.translate(rp(f.x) + f.w, rp(f.y)); x.scale(-1, 1); x.drawImage(f.s, 0, 0, f.w, f.h); }
      else x.drawImage(f.s, rp(f.x), rp(f.y), f.w, f.h);
      x.restore();
    }
    // 有取名字的魚，頭上顯示名字（畫在所有魚的上面）
    x.font = '4.5px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineWidth = 1.2; x.lineJoin = 'round';
    for (const f of TANK.fish) {
      if (!f.name) continue;
      const tw = x.measureText(f.name).width, cx = Math.max(tw / 2 + 1, Math.min(W - tw / 2 - 1, f.x + f.w / 2)), ty = f.y > 7 ? f.y - 1.5 : f.y + f.h + 5;
      x.strokeStyle = 'rgba(8,24,48,.85)'; x.strokeText(f.name, rp(cx), rp(ty)); x.fillStyle = '#eaf2ff'; x.fillText(f.name, rp(cx), rp(ty));
    }
    if (!TANK.fish.length) { x.fillStyle = '#eaf2ff'; x.font = '10px monospace'; x.textAlign = 'center'; x.fillText('這片海還是空的', W / 2, H / 2); }
    TANK.raf = requestAnimationFrame(frame);
  };
  TANK.raf = requestAnimationFrame(frame);
}

// 商店項目由使用者自己設定，存在 S.shop；沒設定過就用 CONFIG.shop 當預設
const shopItems = () => (S.shop || CONFIG.shop).filter(x => String(x.name || '').trim())
  .map(x => ({ ...x, price: Math.max(1, Math.round(+x.price) || 1) }));
function finishShop() {
  S.shop = (Array.isArray(S.shop) ? S.shop : shopItems()).filter(x => x.name.trim()).map(x => ({ ...x, icon: String(x.icon).trim() || '🎁', price: Math.max(1, Math.round(+x.price) || 1) }));
  UI.shopEdit = false; save();
}
function finishHabits() {
  for (const c of S.gcats) if (!String(c.e).trim()) c.e = '🔖';
  for (const c of S.gcats) if (!c.n.trim()) { if (c.id === 'other') c.n = '其他'; else c.off = true; }
  for (const h of S.habits) if (!String(h.e).trim()) h.e = '⭐';
  for (const h of S.habits) if (!h.n.trim()) {
    if (h.kind === 'custom') h.off = true;
    else h.n = DEFAULT_HABITS.find(x => x.id === h.id).n;
  }
  UI.habEdit = false; save();
}
// 五種寶箱照稀有度上色：灰、綠、藍、紫、金
// 寶箱說明：開出哪個稀有度、有幾種可能，例如「普通生物 6 種隨機一種・25% 開出飼料」
const chestPool = ch => CREATURES.filter(c => c.r === ch.rates.findIndex(p => p > 0));
// 寶箱第二行：收集進度；點一下展開能抽到的生物（一次只展開一個）
function chestOdds(ch, D) {
  const pool = chestPool(ch), got = pool.filter(c => D.col[c.id]).length;
  return `已收集 ${got}/${pool.length}${ch.feed ? `・${ch.feed}% 開出飼料` : ''}`;
}
function shop(D) {
  if (UI.shopEdit && !Array.isArray(S.shop)) S.shop = shopItems().map(x => ({ ...x }));
  const hist = S.logs.filter(l => l.k === 'redeem' || l.k === 'chest').slice(-5).reverse();   // 兌換和買寶箱，只留最近 5 筆
  const histName = l => l.name || '寶箱';
  if (UI.shopEdit) return `<section class="px shop">${sh('編輯獎勵', 'REWARDS', '<button class="pri" data-act="shopdone">完成</button>')}
    <div class="mini">設定你真的想要的獎勵。參考：每天大約能賺 ${CONFIG.coinsPerDay} 金幣。</div>
    ${S.shop.map((it, i) => `<div class="it">
      <input data-sf="icon" data-si="${i}" aria-label="圖示" maxlength="8" value="${esc(it.icon)}" style="width:52px;text-align:center" title="圖示（可貼 emoji）">
      <input class="sp" data-sf="name" data-si="${i}" aria-label="獎勵名稱" maxlength="40" value="${esc(it.name)}" placeholder="獎勵名稱，例如：吃甜點（100 元內）">
      <input type="number" min="1" data-sf="price" data-si="${i}" aria-label="價格" value="${esc(it.price)}" style="width:90px">${COIN}
      <button class="ghost" data-act="shopdel" data-v="${i}" title="刪除">✕</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button data-act="shopadd">＋ 新增獎勵</button></div></section>`;
  const since = addDays(dayKey(), -13), recent = S.logs.filter(l => l.d >= since && l.c > 0 && l.k !== 'welcome');
  const activeDays = new Set(recent.map(l => l.d)).size;
  const rate = activeDays >= 5 ? Math.max(10, Math.round(recent.reduce((a, l) => a + l.c, 0) / 14)) : CONFIG.coinsPerDay;
  const daysFor = p => Math.max(1, Math.ceil(p / rate));
  const items = [...shopItems()].sort((a, b) => a.price - b.price), next = items.find(it => it.price > D.coins);
  return `<section class="px shop">${sh('生物寶箱', 'CHESTS')}
    <div class="mini">抽到的生物會游進你的大海。每種最多養 ${MAX_PETS} 隻；超過時可選擇讓哪一隻游走。</div>
    ${CONFIG.chests.map((ch, i) => `<div class="it chest"><span class="ic">${img(chestPx(i), 2)}</span>
      <span class="sp" data-act="chestpool" data-v="${ch.id}">${ch.name}<span class="more">${UI.chestOpen === ch.id ? '▴' : '▾'}</span><br><small>${chestOdds(ch, D)}</small></span>
      <span class="price">${ch.price}${COIN}</span><button data-act="buychest" data-v="${ch.id}" ${D.coins < ch.price ? 'disabled' : ''}>購買</button>
      ${UI.chestOpen !== ch.id ? '' : `<div class="cpool">${chestPool(ch).map(c => `<button class="ghost ${D.col[c.id] ? '' : 'new'}" data-act="fact" data-v="${c.id}" title="${c.name}">${stageImg(c, 2, 2)}<small>${c.name}</small></button>`).join('')}</div>`}</div>`).join('')}
    <div class="it chest"><span class="ic">${img(SHRIMP, 2)}</span><span class="sp">飼料 ${FEED.pack} 顆<br><small>每天另有免費 ${FEED.free} 顆・目前還有 ${feedLeft()} 顆</small></span>
      <span class="price">${FEED.price}${COIN}</span><button data-act="buyfeed" ${D.coins < FEED.price ? 'disabled' : ''}>購買</button></div></section>
  <section class="px shop">${sh('連勝保護', 'STREAK')}
    <div class="mini">免費假用完時自動補上漏掉的一天，最多帶 ${CONFIG.freeze.max} 張。</div>
    <div class="it"><span class="ic">${img(SHIELD, 2)}</span><span class="sp">連勝保護卡<br><small>目前有 ${freezeLeft(D)} / ${CONFIG.freeze.max} 張</small></span>
      <span class="price">${CONFIG.freeze.price}${COIN}</span><button data-act="buyfreeze" ${D.coins < CONFIG.freeze.price || freezeLeft(D) >= CONFIG.freeze.max ? 'disabled' : ''}>購買</button></div></section>
  <section class="px shop">${sh('獎勵商店', 'REWARDS', '<button class="ghost" data-act="shopedit">編輯</button>')}
    <div class="mini">由你自行安排的生活獎勵，非平台提供商品。</div><div class="mini">${activeDays >= 5 ? `最近 14 天平均每天賺 ${rate} 金幣。` : `目前以每天約 ${rate} 金幣估算。`}</div>
    ${items.length ? '' : '<div class="dim" style="margin-top:8px">還沒有獎勵，按「編輯」新增。</div>'}
    ${items.map(it => `<div class="it ${it === next ? 'next' : ''}"><span class="ic">${esc(it.icon)}</span><span class="sp">${esc(it.name)}</span>
      <span class="price">${esc(it.price)}${COIN}</span>
      ${D.coins >= it.price ? `<button data-act="redeem" data-v="${esc(it.id)}">兌換</button>`
        : `<span class="dim need">約 ${daysFor(it.price - D.coins)} 天</span>`}
      ${it === next ? `<div class="nextbar2"><small>下一個目標・${D.coins} / ${esc(it.price)}</small><div class="bar c"><i style="width:${Math.max(0, D.coins / it.price * 100)}%"></i></div></div>` : ''}</div>`).join('')}
  </section>
  <section class="px">${sh('消費紀錄', 'HISTORY', '<small class="dim">近五筆</small>')}${hist.length ? hist.map(l => `<div class="row"><span class="dim">${esc(l.d)}</span><span>${esc(histName(l))}</span><span class="sp"></span><span class="price">${esc(l.c)}${COIN}</span></div>`).join('') : '<div class="dim">還沒有消費過。</div>'}</section>`;
}

// 最近的打卡紀錄（含運動細節、文章標題）
function recentEntries() {
  const out = [];
  for (const [d, C] of Object.entries(S.checks)) for (const [id, arr] of Object.entries(C)) for (const e of arr) out.push({ d, id, t: e.t || 0, e });
  return out.sort((a, b) => b.d.localeCompare(a.d) || b.t - a.t);
}
function entryText(r) {
  const h = S.habits.find(x => x.id === r.id) || { n: r.id };
  const body = r.id === 'exercise' ? (exText(r.e) || '運動') : `${h.n} ✓`;
  return body;
}

// 稱號頁：從水面一路往下潛，越深的稱號越後面
const RANK_DEPTH = ['水面', '12 m', '18 m', '30 m', '', '', '', '40 m+', '', ''];
function ranks(D) {
  const lv = levelOf(D.xp), ri = rankIdx(lv), nxt = RANKS[ri + 1];
  const pct = nxt ? Math.max(0, Math.min(100, (D.xp - xpFor(RANKS[ri][0])) / (xpFor(nxt[0]) - xpFor(RANKS[ri][0])) * 100)) : 100;
  return `<section class="px">${sh('潛水稱號', 'RANKS', `<span class="dim">${ri + 1} / ${RANKS.length}</span><button data-act="logview" data-v="">返回紀錄</button>`)}
    <div class="mini">跟著潛水證照（PADI）的進階路線往下潛，點稱號看介紹。</div>
    <div class="dive">${RANKS.map(([at, name, en, desc], i) => {
      // 每個稱號一行：名稱和等級；只有目前的稱號和點開的那一個才顯示英文名稱和介紹，不然太密
      const st = i < ri ? 'got' : i === ri ? 'cur' : 'lock', open = i === ri || UI.rkOpen === i;
      return `<div class="rk ${st}${open ? ' open' : ''}" data-act="rkopen" data-v="${i}" aria-expanded="${open}">
        <div class="rkd">${RANK_DEPTH[i] || ''}</div><i class="rkn"></i>
        <div class="sp"><div class="rkt"><b>${name}</b>${st === 'cur' ? '<em>你在這裡</em>' : ''}<span class="sp"></span><span class="rklv">Lv.${at}</span></div>
          ${open ? `<small class="en">${en}</small><p>${desc}</p>` : ''}
          ${st === 'cur' && nxt ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="mini">再 ${xpFor(nxt[0]) - D.xp} XP 成為「${nxt[1]}」</div>` : ''}</div></div>`;
    }).join('')}</div></section>`;
}

function log(D) {
  if (UI.logView === 'ranks') return ranks(D);
  const lv = levelOf(D.xp), ri = rankIdx(lv), nxt = RANKS[ri + 1], lo = xpFor(lv), hi = xpFor(lv + 1);
  const td = dayKey(), H = activeHabits();
  // 「有打卡的日子」＝當天有完成任何事：習慣打卡、六件事打勾、寫好清單、完成一段番茄鐘
  const actDays = new Set(Object.keys(D.days).filter(k => H.some(h => D.days[k][h.id])));
  for (const [d, P] of Object.entries(S.plans)) if (P.some(x => x.done && x.text.trim())) actDays.add(d);
  for (const d of Object.keys(S.doneDays || {})) actDays.add(d);   // 瘦身後的舊六件事只剩「那天有做事」
  for (const l of S.logs) if (l.k === 'plan' || l.k === 'pomo' || (l.k === 'sum' && (l.plan || l.pomo))) actDays.add(l.d);
  const active = k => actDays.has(k);
  const allDays = [...actDays].filter(k => k <= td).sort();
  let curRun = 0; for (let k = active(td) ? td : addDays(td, -1); active(k); k = addDays(k, -1)) curRun++;
  let best = 0, run = 0, prevDay = null;
  for (const k of allDays) { run = prevDay && addDays(prevDay, 1) === k ? run + 1 : 1; best = Math.max(best, run); prevDay = k; }
  const daysOf = k => Object.values(D.days).filter(x => x[k]).length;
  const rec = recentEntries();
  const runs = rec.filter(r => r.id === 'exercise' && r.e.type === '跑步' && r.e.dist > 0), runKm = runs.reduce((a, r) => a + +r.e.dist, 0);
  const pomos = S.logs.filter(l => l.k === 'pomo'), pomoSums = S.logs.filter(l => l.k === 'sum' && l.pomo);
  const pomoCount = pomos.length + pomoSums.reduce((a, l) => a + l.pomo, 0);
  const pomoHours = (pomos.reduce((a, l) => a + (l.min || CONFIG.pomodoroMin), 0) + pomoSums.reduce((a, l) => a + (l.pomoMin || 0), 0)) / 60;
  return `<section class="px">${sh('等級', 'LEVEL')}
    <div class="row"><div class="big-lv"><span>Lv.</span>${lv}</div><div><b>${RANKS[ri][1]}</b><div class="mini" style="margin:0">共 ${D.xp} XP</div></div></div>
    <div class="bar"><i style="width:${Math.max(0, Math.min(100, (D.xp - lo) / (hi - lo) * 100))}%"></i></div>
    <div class="mini">升到 Lv.${lv + 1} 還差 ${hi - D.xp} XP${nxt ? `・Lv.${nxt[0]} 成為「${nxt[1]}」` : ''}</div>
    <div class="mini xphow" data-act="tab" data-v="quest">經驗值靠完成任務拿，每項寫在「任務」頁 ›</div>
    <button class="ghost rkbtn" data-act="logview" data-v="ranks">所有稱號・已拿到 ${ri + 1} / ${RANKS.length} ›</button></section>
  <section class="px">${sh('打卡紀錄', 'ACTIVITY')}
    <div class="streakbox"><div><small>目前連續</small><b>${curRun}</b><small>天</small></div>
      <div><small>最長連續</small><b>${best}</b><small>天</small></div><div><small>總共打卡</small><b>${allDays.length}</b><small>天</small></div></div></section>
  ${rewardHistory()}<section class="px">${sh('最近習慣紀錄', 'RECENT HABIT')}
    ${rec.length ? compactHistory(rec.slice(0, 12).map(r => `<div class="entry"><span class="dim" style="flex:none">${r.d.slice(5).replace('-', '/')}</span><span class="sp">${esc(entryText(r))}</span></div>`), 5)
      : '<div class="dim">點「今日」的習慣卡片打卡，就會記在這裡。</div>'}</section>
  <section class="px">${sh('累積', 'TOTALS')}${(tot => tot ? `<div class="stat">${tot}</div>` : '<div class="dim">完成任務後，累積的數字會出現在這裡。</div>')([
    ...H.map(h => daysOf(h.id) && `<div><small>${esc(h.n)}</small><b>${daysOf(h.id)}</b><small>天</small></div>`),
    pomoCount && `<div><small>番茄鐘</small><b>${pomoCount}</b><small>段・${pomoHours.toFixed(1)} 小時</small></div>`,
    runs.length && `<div><small>跑步總距離</small><b>${runKm.toFixed(1)}</b><small>km・${runs.length} 次</small></div>`,
  ].filter(Boolean).join(''))}</section>`;
}

// 關於頁
const SALON = { name: 'Frog Journey｜兩棲類的冒險生活', url: 'https://vocus.cc/salon/frog-journey',
  desc: '一個真的去過、住過、做過的人的第一手紀錄。登山、潛水、旅居，還有一路上的成長。' };
const ABOUT_LINKS = [
  { title: '潛水日誌 #1｜印尼・Nusa Penida・Manta Point：5 隻鬼蝠魟從頭頂飛過', sub: '圖鑑裡的鬼蝠魟，就是從這裡來的', url: 'https://vocus.cc/article/6a8ec287fd897800012e765a' },
  { title: '潛水日誌 #2｜印尼・Nusa Penida・Crystal Bay：沒看到翻車魚！', sub: '想抽到翻車魚？先看看我在海裡等了多久', url: 'https://vocus.cc/article/6ad986a9fd89780001033212' },
  { title: '潛水日誌 #3｜印尼・Nusa Penida・PED：蘇眉魚、桶狀海綿與一整片珊瑚花園', sub: '珊瑚、大魚、小生物通通有的一潛', url: 'https://vocus.cc/article/6ae17a47fd89780001bf3b6f' },
  { title: 'OW 潛水考照心得｜課程都在學什麼？我的完整考照紀錄', sub: '從零開始學潛水的紀錄', url: 'https://vocus.cc/article/6a45ddadfd89780001dff50b' },
];
function manualBackupSection() {
  return `<details class="more-detail manual-backup" id="backupSection" ${UI.backupError ? 'open' : ''}><summary>手動備份與還原</summary><div class="more-content">
      <p class="mini">需要另存一份紀錄或從檔案復原時再使用，平常不必手動操作。</p>
      ${preLogin() ? `<div id="preloginBackup"><p class="mini">登入前的本機紀錄（${summary(preLogin().s)}）已另存備份，還原會取代目前帳號的雲端進度。</p><div class="row"><button data-act="prerestore">還原登入前的紀錄</button><button class="ghost" data-act="predrop">刪除此備份</button></div></div>` : ''}
      ${cloudChoiceBackup() ? '<button class="ghost" data-act="cloudbackuprestore">還原選擇前的雲端紀錄</button>' : ''}
      ${syncBackup() ? '<button class="ghost" data-act="syncbackuprestore">還原同步前的本機紀錄</button>' : ''}
      <div class="row"><button data-act="export">下載備份</button><button data-act="import">從檔案還原</button></div>
      ${hasBackupUndo() ? '<button class="ghost" data-act="backupundo">復原上次還原</button>' : ''}
      ${UI.backupError ? `<div class="warn" role="alert">${esc(UI.backupError)}</div>` : ''}
    </div></details>`;
}
// 「更多」：常用操作直接顯示，協助與關於按需展開。
function about() {
  return `<div class="more-page">
  <section class="px">${sh('資料與同步', '')}
    ${cloudSection()}
    ${manualBackupSection()}
  </section>
  <section class="px">${sh('設定', '')}<label class="switch more-sound"><span>音效</span><button class="toggle ${S.mute ? '' : 'on'}" data-act="mute" role="switch" aria-checked="${!S.mute}" aria-label="音效"><i></i></button></label></section>
  <section class="px more-links">${sh('協助', '')}
    <details class="more-detail"><summary>常見問題</summary><div class="more-content">
      <h3>需要每天餵魚嗎？</h3><p class="mini">不用，生物不會餓死或退化，餵食只會幫助成長。</p>
      <h3>獎勵什麼時候領？</h3><p class="mini">六件事每天任意完成三件可獲獎勵，請到「任務」領取。每天午夜 00:00 換日，未領獎勵會自動入帳，可在「紀錄」查看來源。</p>
    </div></details>
    <details class="more-detail" ${UI.diagnostics ? 'open' : ''}><summary>回報問題</summary><div class="more-content">
      <p class="mini">回報時可附上診斷資訊，僅含版本、瀏覽器、畫面大小與連線狀態，不包含清單、Email 或帳號資料。</p><button data-act="copydiagnostics">複製診斷資訊</button>
      ${UI.diagnostics ? `<textarea readonly aria-label="診斷資訊">${esc(UI.diagnostics)}</textarea>` : ''}
      ${/^https:\/\//.test(CONFIG.feedbackUrl || '') ? `<a class="link" href="${esc(CONFIG.feedbackUrl)}" target="_blank" rel="noopener">回報問題／提供建議 ↗</a>` : ''}
    </div></details>
  </section>
  <section class="px more-links">${sh('關於', '')}
    <details class="more-detail"><summary>隱私說明</summary><div class="more-content">
      <p class="mini">未登入時，紀錄只存在此瀏覽器。登出後，本機紀錄仍會保留；切換帳號不會帶入另一個帳號的紀錄。共用裝置請留意，登出不會清除本機資料。</p>
      ${FIREBASE_CONFIG ? '<p class="mini">Google 登入用於辨識帳號，紀錄會存到 Firebase 供跨裝置同步。一般使用者只能存取自己的資料；我不會查看或使用你的紀錄。可在上方刪除雲端資料與帳號。</p>' : ''}
    </div></details>
    <details class="more-detail"><summary>關於習慣深潛</summary><div class="more-content">
      <p>我是 Harry，喜歡潛水。這個遊戲是我為了持續寫作和運動做的；稱號、鬼蝠魟和翻車魚，都來自我的潛水經驗。</p>
      <h3>我的沙龍</h3><div class="salon"><b>${SALON.name}</b><p class="dim">${SALON.desc}</p><a class="link" href="${SALON.url}" target="_blank" rel="noopener">前往沙龍 ↗</a></div>
      <h3>推薦文章</h3>${ABOUT_LINKS.map(l=>`<a class="link" href="${l.url}" target="_blank" rel="noopener"><span class="sp"><b>${esc(l.title)}</b><br><small>${esc(l.sub)}</small></span><span>↗</span></a>`).join('')}
    </div></details>
  </section></div>`;
}
