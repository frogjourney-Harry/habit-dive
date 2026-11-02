// 畫面：頂端列、今日、習慣面板、圖鑑、生物個體與水族箱、商店、紀錄、關於。
/* ========= 畫面 ========= */
const IN_APP = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent);
function renderStat(D = derive()) {
  const lv = levelOf(D.xp);
  document.getElementById('stat').innerHTML = `
    <button class="lvchip" data-act="tab" data-v="log" title="查看等級">Lv.${lv}<small>${RANKS[rankIdx(lv)][1]}</small></button>
    <span class="coin">${D.coins.toLocaleString()}${COIN}</span>`;
}
function render() {
  const D = derive();
  renderStat(D);
  document.getElementById('banner').innerHTML = IN_APP && !UI.iabOk
    ? `<div class="banner row"><span class="sp">你正在 App 內建的瀏覽器裡開啟，這裡的紀錄跟 Chrome、Safari 是分開的。建議用右上角選單「用瀏覽器開啟」。</span><button class="ghost" data-act="iabok">知道了</button></div>` : '';
  const tabs = [['today', '今日'], ['dex', '圖鑑'], ['tank', '水族箱'], ['shop', '商店'], ['log', '紀錄'], ['about', '關於']];
  document.getElementById('nav').innerHTML = tabs.map(([k, n]) => `<button class="${UI.tab === k ? 'sel' : ''}" data-act="tab" data-v="${k}">${n}</button>`).join('');
  document.getElementById('main').innerHTML = ({ today, dex, tank, shop, log, about })[UI.tab](D);
  if (UI.tab === 'tank') tankStart();
}

const freqOpts = (h, sel) => (h.kind === 'custom' ? [[0, '每天']] : []).concat([[1, '每週'], [2, '每兩週']])
  .map(([v, n]) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${n}</option>`).join('');
const targetOpts = sel => [1, 2, 3, 4, 5, 6, 7].map(n => `<option ${sel === n ? 'selected' : ''}>${n}</option>`).join('');

function habitEditor() {
  return `<section class="px">${sh('編輯習慣', 'HABITS', '<button class="pri" data-act="habdone">完成</button>')}
    <div class="mini">圖示可以貼任何 emoji（Windows：Win ＋ .）。自訂習慣最多 ${CONFIG.maxCustom} 個。</div>
    ${S.habits.map((h, i) => h.off ? '' : `<div class="erow">
      <input data-hf="e" data-hi="${i}" value="${esc(h.e)}" style="width:52px;text-align:center" title="圖示">
      <input class="sp" data-hf="n" data-hi="${i}" value="${esc(h.n)}" placeholder="${h.kind === 'custom' ? '習慣名稱，例如：冥想' : '習慣名稱'}">
      <select data-hf="weeks" data-hi="${i}">${freqOpts(h, h.weeks)}</select>
      ${h.weeks ? `<span class="dim">至少</span><select data-hf="target" data-hi="${i}">${targetOpts(h.target)}</select><span class="dim">${countWord(h)}</span>` : ''}
      <button class="ghost" data-act="habdel" data-v="${i}" title="刪除">✕</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button data-act="habadd" ${customCount() >= CONFIG.maxCustom ? 'disabled' : ''}>＋ 新增習慣 ${customCount()}/${CONFIG.maxCustom}</button>
      ${S.habits.filter(h => h.off && h.kind !== 'custom').map(h => `<button data-act="habrestore" data-v="${h.id}">加回 ${esc(h.e)} ${esc(h.n)}</button>`).join('')}</div>
    <div class="mini">每天的習慣漏兩天才斷；每週／每兩週的習慣沒達標就斷。</div>
    </section>`;
}

/* ========= 每日任務 ========= */
// 任務就是會給獎勵的那些事；進度從紀錄算，獎勵是對應的 log（有 pend＝還沒領）
function dailyTasks(D) {
  const d = dayKey(), byKey = k => S.logs.filter(l => l.key === k), R = CONFIG.rewardRows;
  const checks = S.logs.filter(l => l.k === 'check' && l.d === d);
  const T = [
    { id: 'plan', name: '寫好今天的清單', logs: byKey('plan:' + d) },
    { id: 'rows', name: `完成前 ${R} 件事`, n: checks.length, of: R, logs: checks },
    { id: 'top3', name: `前 ${R} 件都完成`, logs: byKey('top3:' + d) },
  ];
  for (const h of activeHabits())
    T.push({ id: 'h_' + h.id, name: `${h.e} ${h.n}${h.kind === 'vocus' ? ' 發文' : ' 打卡'}`, logs: byKey(h.kind === 'vocus' ? 'art:' + d : `hab:${h.id}:${d}`) });
  T.push({ id: 'pomo', name: `專注一段番茄鐘`, logs: byKey('pomo:' + d) });
  // 週期達標（例如本週運動 3 天）
  for (const h of activeHabits()) if (h.weeks && h.kind !== 'vocus') {
    const p = periodKey(d, h.weeks), key = h.id === 'exercise' && h.weeks === 1 ? 'week:' + p : `per:${h.id}:${p}`;
    T.push({ id: 'p_' + h.id, week: true, name: `${h.e} ${h.n}・${periodWord(h)} ${h.target} 天`, n: Math.min(perCount(D, h, p), h.target), of: h.target, logs: byKey(key) });
  }
  for (const t of T) {
    t.pend = t.logs.filter(l => l.pend);
    t.full = t.of ? t.n >= t.of : t.logs.length > 0;
    t.c = t.logs.reduce((a, l) => a + (l.c || 0), 0); t.xp = t.logs.reduce((a, l) => a + (l.xp || 0), 0);
  }
  return T;
}
function quests(D) {
  const T = dailyTasks(D), pend = T.flatMap(t => t.pend), doneN = T.filter(t => t.full && !t.pend.length).length;
  const row = t => {
    const st = t.pend.length ? 'pend' : t.full ? 'got' : 'todo';
    const bar = t.of ? `<span class="qbar"><i style="width:${t.n / t.of * 100}%"></i></span><small>${t.n}/${t.of}</small>` : '';
    const right = t.pend.length ? `<button class="pri" data-act="claim" data-v="${t.id}">領取</button>`
      : t.logs.length ? `<small class="dim">已領 +${t.c}${COIN}</small>` : '';
    return `<div class="quest ${st}"><span class="qk">${t.full || t.pend.length ? '✓' : ''}</span><span class="sp">${esc(t.name)}</span>${bar}${right}</div>`;
  };
  const daily = T.filter(t => !t.week), week = T.filter(t => t.week);
  return `<section class="px">${sh('每日任務', 'DAILY', pend.length > 1 ? `<button class="pri" data-act="claim" data-v="all">全部領取</button>` : `<small class="dim">${doneN}/${T.length}</small>`)}
    ${daily.map(row).join('')}${week.length ? `<div class="divider">本期</div>${week.map(row).join('')}` : ''}
    <div class="mini">完成的任務按「領取」拿金幣和 XP；忘了領，隔天會自動入帳。</div></section>`;
}

function today(D) {
  const st = streaks(D), td = dayKey(), d = viewDay(), P = getPlan(d);
  const claimed = D.claimed.has('plan:' + d), doneN = filled(P).filter(x => x.done).length;
  const chips = activeHabits().map(h => {
    const s = st[h.id], badge = s.n ? `<span class="streak">${s.n}<small>${h.weeks ? (h.weeks === 1 ? '週' : '次') : '天'}</small></span>` : '';
    let on, sub;
    if (h.weeks) {
      const p = periodKey(td, h.weeks), cnt = perCount(D, h, p);
      on = periodDone(D, h, p); sub = `${periodWord(h)} ${cnt}/${h.target} ${countWord(h)}`;
    } else {
      on = dayDone(D, td, h.id); sub = on ? '今天 ✓' : '今天還沒';
    }
    return `<button class="hab ${on ? 'on' : ''}" data-act="habtap" data-v="${h.id}">
      <div class="row"><span class="hn">${esc(h.e)} ${esc(h.n)}</span><span class="sp"></span>${badge}</div>
      <div class="hs">${sub}</div></button>`;
  }).join('');
  const risky = activeHabits().filter(h => st[h.id].risk).map(h => h.n);
  const V = habit('vocus');
  const setup = S.vocusSet || !V ? '' : `<section class="px">${sh('Vocus 發文節奏', 'SETUP')}
      <div class="mini">不用每天發。選一個做得到的節奏，之後可以在「習慣・編輯」修改。</div>
      <div class="row" style="margin-top:8px">每 <select id="vW"><option value="1">1 週</option><option value="2">2 週</option></select>
        至少 <select id="vT">${targetOpts(1)}</select> 篇
        <button class="pri" data-act="vcfg">確定</button></div></section>`;
  const hint = UI.pday < 0 ? '補登昨天：只算完成，沒有獎勵。'
    : UI.pday > 0 ? '先寫好明天的清單，寫好就有獎勵。'
    : `前 ${CONFIG.rewardRows} 件完成有金幣。點編號可以換順序，點 ☆ 存成常用。`;
  const favs = S.favs || [];
  // 常用：點一下填進第一個空格，不用每天重打
  const favBar = favs.length ? `<div class="favs"><small class="dim">常用</small>${favs.map((t, i) => `<span class="fav"><button class="ghost" data-act="usefav" data-v="${i}">${esc(t)}</button><button class="ghost x" data-act="delfav" data-v="${i}" title="從常用移除">×</button></span>`).join('')}</div>` : '';
  const rows = P.map((it, i) => {
    const divider = i === CONFIG.rewardRows ? '<div class="divider">以下只做紀錄</div>' : '';
    const starred = it.text.trim() && favs.includes(it.text.trim());
    return `${divider}<div class="prow ${it.done ? 'done' : ''}">
      <input type="checkbox" data-act="pdone" data-v="${i}" ${it.done ? 'checked' : ''} ${UI.pday > 0 ? 'disabled title="明天才能打勾"' : ''}>
      <button class="ghost no ${UI.swap === i ? 'sel' : ''}" data-act="swap" data-v="${i}" title="點兩個編號交換順序">${i + 1}</button>
      <input class="ptext" data-pf="text" data-i="${i}" value="${esc(it.text)}" placeholder="${i === 0 ? '今天最重要的事' : ''}">
      <button class="ghost star" data-act="fav" data-v="${i}" title="${starred ? '從常用移除' : '存成常用'}">${starred ? '★' : '☆'}</button></div>`;
  }).join('');
  const T = S.timer && S.timer.segs ? S.timer : null, seg = T && T.segs[T.si], pm = pomoMin();
  const todayPomo = S.logs.filter(l => l.k === 'pomo' && l.d === td).length;
  const segLine = segs => segs.map((x, i) => `<span class="${T && i < T.si ? 'past' : T && i === T.si ? 'now' : ''}">${x.m === 'break' ? '休息' : '專注'} ${x.min}</span>`).join('<span>›</span>');
  const timer = T ? `<section class="px timer">
      <div class="label">${seg.m === 'break' ? 'BREAK' : 'FOCUS'}・${T.si + 1}/${T.segs.length}</div>
      <div>${seg.m === 'break' ? '休息中' : '專注中'}</div>
      <div class="clock" id="tclock">--:--</div><div class="bar c"><i id="tbar" style="width:0"></i></div>
      <div class="segs">${segLine(T.segs)}</div>
      ${seg.m === 'break' ? '<button class="ghost" data-act="skipbreak">跳過休息</button>' : ''}<button class="ghost" data-act="cancel">結束</button></section>`
    : `<section class="px">${sh('番茄鐘', 'FOCUS', `<small class="dim">今天 ${todayPomo} 段</small>`)}
      <div class="pomo-set"><div class="presets">${[25, 45, 60, 90].map(m => `<button class="${pm === m ? 'sel' : ''}" data-act="pomoset" data-v="${m}">${m} 分</button>`).join('')}</div>
        <div class="pomo-go"><input type="number" id="pomoMin" min="5" max="120" step="5" value="${pm}" title="自訂總長度（分鐘）"><span class="dim">分</span>
        <button class="pri" data-act="start">開始專注</button></div></div>
      <div class="segs" id="pomoPlan">${segLine(sessionPlan(pm))}</div>
      <div class="mini">每天第一段專注滿 ${CONFIG.pomoRewardMin} 分鐘有獎勵。</div></section>`;
  const habits = UI.habEdit ? habitEditor() : `<section class="px">${sh('習慣', 'HABITS', '<button class="ghost" data-act="habedit">編輯</button>')}
      <div class="habits">${chips}</div>
      ${risky.length ? `<div class="warn">昨天漏了 ${esc(risky.join('、'))}，今天做到就不會斷。</div>` : ''}</section>`;
  return `${setup}${quests(D)}${habits}
    <section class="px" id="six">${sh('最重要的六件事', 'TODAY', `<span class="seg-switch">${[[-1, '昨天'], [0, '今天'], [1, '明天']].map(([o, n]) => `<button class="${UI.pday === o ? 'sel' : ''}" data-act="pday" data-v="${o}">${n}</button>`).join('')}</span>`)}
      <div class="mini" style="margin:-2px 0 4px">${d.slice(5).replace('-', '/')}・${hint}</div>
      ${UI.pday >= 0 ? favBar : ''}${rows}
      <div class="row" style="margin-top:8px">${UI.pday < 0 ? '' : claimed ? '<span class="done-tag">✓ 清單已寫好</span>' : '<button class="pri" data-act="plansave">寫好了</button>'}
        <span class="sp"></span><small>完成 ${doneN}/${filled(P).length}</small></div></section>
    ${timer}`;
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
      <h2>${c.name}</h2><p class="dim" style="margin:0 0 8px">${c.fact}</p>
      <div class="stages">${[1, 2, 3].map(s => `<div>${stageImg(c, s, 3, s > seen)}<small class="${s > seen ? 'dim' : ''}">${s > seen ? '？？？' : stageName(c, s)}</small></div>`).join('')}</div>
      <div class="mini">吃到 ${GROW[1]} 顆長成成體、${GROW[2]} 顆變成特殊型態</div>
      <div class="sub">${P.length ? `擁有 ${P.length}/${MAX_PETS} 隻` : '都放生了，再抽到會回來。'}</div>`;
    return;
  }
  el.style.textAlign = '';
  const h = habit(UI.sheet.id); if (!h) { UI.sheet = null; renderSheet(); return; }
  const D = derive(), s = streaks(D)[h.id], day = UI.sheet.day, d = addDays(dayKey(), day), list = dayChecks(d, h.id);
  // 這一期的日期範圍，例如「本週（11/2–11/8）」
  const p0 = h.weeks && periodKey(dayKey(), h.weeks), md = k => k.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
  const goal = h.weeks ? `${h.weeks === 1 ? '每週' : '每兩週'} ${h.target} ${countWord(h)}・${periodWord(h)}（${md(p0)}–${md(addDays(p0, 7 * h.weeks - 1))}）${perCount(D, h, p0)}/${h.target}` : '每天';
  let body;
  if (h.kind === 'exercise') {
    const type = UI.sheet.exType || ETAGS[0];
    body = `
      ${list.map((e, i) => `<div class="entry"><span class="sp">${esc(exText(e) || '運動')}</span><button class="ghost" data-act="chkdel" data-v="${i}">✕</button></div>`).join('')}
      <div class="form">
        <select id="exType">${ETAGS.map(t => `<option ${t === type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        ${EX_FIELDS[type].map(([k, label, unit, step]) => step
          ? `<input id="ex_${k}" class="f-num" type="number" min="0" step="${step}" placeholder="${label}${unit ? `（${unit}）` : ''}">`
          : `<input id="ex_${k}" class="f-wide" placeholder="${label}">`).join('')}
        <span class="dim" id="exPace" style="align-self:center"></span>
        <input id="ex_note" class="f-wide" placeholder="備註">
      </div><button class="pri wide" data-act="exadd">記錄這次${type}</button>`;
  } else if (h.kind === 'vocus') body = `
      ${list.map((e, i) => `<div class="entry"><span class="sp">${esc(e.title || '（無標題）')}</span><button class="ghost" data-act="chkdel" data-v="${i}">✕</button></div>`).join('')}
      <div class="form"><input id="artTitle" class="f-wide" placeholder="發布的文章標題（可留空）"></div>
      <button class="pri wide" data-act="artadd">記錄發布的文章</button>`;
  else body = list.length
      ? `<button class="wide" data-act="chk">✓ 已完成，點一下取消</button>`
      : `<button class="pri wide" data-act="chk">完成打卡</button>`;
  el.innerHTML = `<div class="row"><b style="font-size:18px">${esc(h.e)} ${esc(h.n)}</b><span class="sp"></span><button class="ghost" data-act="sheetclose">✕</button></div>
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
function pets(sp) {
  return S.logs.filter(l => l.drop === sp && !(S.released && S.released[l.id])).map(l => ({ id: l.id, fed: fedOf(l.id) }));
}
// 圖鑑裡解鎖到第幾種外觀：看過的最高型態（放生了也算看過）
const seenStage = sp => Math.max(1, (S.seen && S.seen[sp]) || 1, ...pets(sp).map(p => stageOf(p.fed)));
// 三種外觀：幼體用各自的幼體圖（JUV）、成體是原圖、特殊型態換成各自的稀有配色（MORPH）
const stageCv = {};
function stageCanvas(c, s) {
  const key = c.id + s; if (stageCv[key]) return stageCv[key];
  const rows = s === 1 ? JUV[c.id] : s === 3 && MORPH[c.id].px ? MORPH[c.id].px : c.px;
  const map = { ...(SPECIES_PAL[c.id] || {}), ...(s === 3 ? MORPH[c.id].map : {}) };
  const cv = document.createElement('canvas'); cv.width = Math.max(...rows.map(r => r.length)); cv.height = rows.length;
  const x = cv.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.' || !PAL[ch]) return;
    x.fillStyle = map[ch] || PAL[ch]; x.fillRect(i, j, 1, 1);
  }));
  return stageCv[key] = cv;
}
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
  return `<section class="px">${sh('水下生物圖鑑', 'COLLECTION', `<span class="dim">${Object.keys(D.col).length} / ${CREATURES.length}</span>`)}
    <div class="mini">生物從商店的寶箱抽到。點已收集的生物看介紹和成長型態。</div>
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
  turtle: [1.7, .2], octopus: [1.3, .25], nudi: [.9, .07, 1], lion: [1.3, .2], puffer: [1.1, .25], cuttle: [1.3, .35],
  seahorse: [1, .1], shark: [2.3, .7], moray: [1.8, .3], jelly: [1.3, .08], manta: [2.1, .35], mola: [2.3, .15],
  dolphin: [2.2, .9], whaleshark: [3.3, .2],
};
const STAGE_SCALE = [1, 1, 1.1];   // 幼體圖本身就比較小
const FEED = { free: 3, pack: 10, price: 30 };            // 每天免費 3 顆；商店 30 金幣買 10 顆
// 水族箱設定：哪幾隻放進去記在 S.outTank
const freeLeft = () => S.feedDay && S.feedDay.d === dayKey() ? Math.max(0, FEED.free - S.feedDay.used) : FEED.free;
const feedLeft = () => freeLeft() + (S.feed || 0);
function useFeed() {
  if (freeLeft() > 0) { if (!S.feedDay || S.feedDay.d !== dayKey()) S.feedDay = { d: dayKey(), used: 0 }; S.feedDay.used++; }
  else if ((S.feed || 0) > 0) S.feed--;
  else return false;
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
  if (f.rest > 0) { f.rest -= dt; return; }
  const dx = f.tx - cx, dy = f.ty - f.baseY, dist = Math.hypot(dx, dy);
  if (dist < 2) { f.tx = null; if (Math.random() < .35) f.rest = 30 + Math.random() * 150; return; }
  const step = Math.min(dist, Math.abs(f.vx) * f.pace * dt);
  f.x += dx / dist * step; f.baseY += dy / dist * step * .6;   // 上下移動比左右慢一點
  if (Math.abs(dx) > 2) f.vx = Math.sign(dx) * Math.abs(f.vx);
}
function tankFeedText() {
  const f = freeLeft(), b = S.feed || 0;
  return `飼料：今天免費 ${f}/${FEED.free}${b ? `・另有 ${b} 顆` : ''}`;
}
function tankEditor(D) {
  const owned = CREATURES.filter(c => pets(c.id).length);
  return `<section class="px">${sh('水族箱設定', 'AQUARIUM', '<button class="pri" data-act="tankdone">完成</button>')}
    <div class="mini">勾選要放進水族箱的個體，不想養的可以放生。</div>
    ${owned.map(c => {
      const P = pets(c.id);
      return `<div class="tset"><div class="row"><b class="sp">${c.name}</b></div>
        ${P.map(p => `<div class="entry"><label class="row sp" style="gap:8px"><input type="checkbox" data-act="intank" data-v="${p.id}" ${inTank(p.id) ? 'checked' : ''}>
          ${stageImg(c, stageOf(p.fed), 3)}<small>${stageName(c, stageOf(p.fed))}・吃了 ${p.fed} 顆</small></label>
          <button class="ghost" data-act="release" data-v="${p.id}">放生</button></div>`).join('')}</div>`;
    }).join('') || '<div class="dim">還沒有生物，到商店買寶箱吧。</div>'}</section>`;
}
function tank(D) {
  if (UI.tankEdit) return tankEditor(D);
  const n = CREATURES.filter(c => pets(c.id).some(p => inTank(p.id))).length;
  return `<section class="px">${sh('水族箱', 'AQUARIUM', `<span class="dim">${n} 種生物</span><button class="ghost" data-act="tankedit">設定</button>`)}
    <canvas id="tank" class="tank"></canvas>
    <div class="row" style="margin-top:8px"><span class="dim" id="feedInfo">${tankFeedText()}</span><span class="sp"></span>
      <button data-act="buyfeed">買飼料 ${FEED.pack} 顆・${FEED.price}${COIN}</button></div>
    <div class="mini">點水面撒飼料，吃到的那一隻會長大（幼體 → 成體 → 特殊型態）。想知道誰是誰，到圖鑑看。</div></section>`;
}
function tankStart() {
  cancelAnimationFrame(TANK.raf);
  const cv = document.getElementById('tank'); if (!cv) return;
  const W = Math.max(240, Math.floor(cv.clientWidth / 2)), H = Math.floor(cv.clientHeight / 2);   // 以 2 倍像素畫，維持像素感
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const floorY = H - 16;
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
      const f = { c, key: p.id, no: i + 1, many: P.length > 1, ground: !!ground, ph: Math.random() * 6, rest: 0,
        vx: speed * (.8 + Math.random() * .4) * (Math.random() < .5 ? -1 : 1) };
      look(f);
      const q = prev.get(f.key);
      if (q) { f.vx = q.vx; f.ph = q.ph; f.rest = q.rest; f.x = Math.min(q.x, Math.max(0, W - f.w)); f.baseY = ground ? floorY - f.h + 2 : Math.min(q.baseY, floorY - f.h + 2); f.y = ground ? f.baseY : q.y; }
      else { f.x = Math.random() * Math.max(1, W - f.w); f.y = f.baseY = ground ? floorY - f.h + 2 : 6 + Math.random() * Math.max(1, floorY - f.h - 24); }
      TANK.fish.push(f);
    });
  }
  TANK.fish.sort((a, b) => b.w * b.h - a.w * a.h);   // 大的畫在後面，小的在前面
  const weeds = Array.from({ length: Math.max(3, Math.floor(W / 60)) }, (_, i) => ({ x: 12 + i * (W - 24) / Math.max(1, Math.floor(W / 60) - 1), h: 18 + (i * 7) % 20 }));
  cv.onclick = e => {
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
    if (py >= floorY - 4) return;
    if (!useFeed()) { toast('飼料用完了，明天會再送 3 顆，也可以用金幣買'); return; }
    TANK.food.push({ x: px, y: py, vy: .25 }); ac(); SFX.tap();
    const el = document.getElementById('feedInfo'); if (el) el.textContent = tankFeedText();
  };
  let last = performance.now();
  const frame = now => {
    if (!document.body.contains(cv)) return;
    const dt = Math.min(3, (now - last) / 16.7); last = now;
    // 背景：一層層的海水、沙地、海草
    const bands = ['#1d5a8c', '#174c7a', '#123f68', '#0e3356', '#0b2846'];
    bands.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, Math.floor(i * floorY / bands.length), W, Math.ceil(floorY / bands.length) + 1); });
    x.fillStyle = '#c2a36b'; x.fillRect(0, floorY, W, H - floorY);
    x.fillStyle = '#a3864f'; for (let i = 0; i < W; i += 7) x.fillRect(i, floorY + 3 + (i % 3), 2, 2);
    weeds.forEach((w, i) => { for (let j = 0; j < w.h; j += 3) { const sway = Math.round(Math.sin(now / 700 + i + j / 6) * 2); x.fillStyle = j % 6 ? '#38b764' : '#257179'; x.fillRect(w.x + sway, floorY - j, 3, 3); } });
    if (Math.random() < .03 * dt) TANK.bub.push({ x: Math.random() * W, y: floorY, s: 1 + Math.round(Math.random()) });
    TANK.bub = TANK.bub.filter(b => (b.y -= .5 * dt) > 0);
    x.fillStyle = 'rgba(180,240,255,.55)'; TANK.bub.forEach(b => x.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s));
    TANK.food.forEach(f => { if (f.y < floorY - 2) f.y += f.vy * dt; f.age = (f.age || 0) + dt; });
    TANK.food = TANK.food.filter(f => f.age < 1800);
    x.fillStyle = '#ef7d57'; TANK.food.forEach(f => x.fillRect(Math.round(f.x), Math.round(f.y), 2, 2));
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
        const dx = food.x - (f.x + f.w / 2), sp = Math.max(.12, sp0 * 1.8) * dt;   // 看到飼料會加速，但慢的還是慢
        f.x += Math.sign(dx) * Math.min(Math.abs(dx), sp);
        if (Math.abs(dx) > .5) f.vx = Math.sign(dx) * sp0;
        f.tx = null; f.rest = 0;   // 吃完再重新找地方游
        if (!f.ground) { const dy = food.y - (f.y + f.h / 2); f.baseY += Math.sign(dy) * Math.min(Math.abs(dy), sp * .8); }
        if (eats(f, food)) {
          TANK.food.splice(TANK.food.indexOf(food), 1); SFX.eat();
          const before = stageOf(fedOf(f.key));
          S.fed = S.fed || {}; S.fed[f.key] = fedOf(f.key) + 1;
          const after = stageOf(fedOf(f.key));
          if (after > before) {
            S.seen = S.seen || {}; S.seen[f.c.id] = Math.max(S.seen[f.c.id] || 1, after);
            const cx = f.x + f.w / 2, by = f.y + f.h; look(f); f.x = cx - f.w / 2; if (f.ground) f.y = floorY - f.h + 2; else f.baseY = by - f.h;
            SFX.rank(); toast(`${f.c.name}${f.many ? ` ${f.no} 號` : ''}長成${stageName(f.c, after)}了！`);
          }
          save();
        }
      } else if (f.ground) {
        if (f.rest > 0) f.rest -= dt;
        else {
          f.x += f.vx * dt;
          if (Math.random() < .004 * dt) f.rest = 60 + Math.random() * 180;
          if (Math.random() < .003 * dt) f.vx = -f.vx;   // 偶爾掉頭
        }
      } else wander(f, dt, W, floorY);
      if (!f.ground) {
        f.baseY = Math.max(2, Math.min(floorY - f.h + 2, f.baseY));
        f.y = f.baseY + Math.sin(now / (f.c.id === 'jelly' ? 1600 : 900) + f.ph) * (f.c.id === 'jelly' ? 8 : 3);
      }
      if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx); } else if (f.x > W - f.w) { f.x = W - f.w; f.vx = -Math.abs(f.vx); }
      x.save();
      if (f.vx < 0) { x.translate(Math.round(f.x) + f.w, Math.round(f.y)); x.scale(-1, 1); x.drawImage(f.s, 0, 0, f.w, f.h); }
      else x.drawImage(f.s, Math.round(f.x), Math.round(f.y), f.w, f.h);
      x.restore();
    }
    if (!TANK.fish.length) { x.fillStyle = '#eaf2ff'; x.font = '10px monospace'; x.textAlign = 'center'; x.fillText('水族箱是空的', W / 2, H / 2); }
    TANK.raf = requestAnimationFrame(frame);
  };
  TANK.raf = requestAnimationFrame(frame);
}

// 商店項目由使用者自己設定，存在 S.shop；沒設定過就用 CONFIG.shop 當預設
const shopItems = () => (S.shop || CONFIG.shop).filter(x => String(x.name || '').trim())
  .map(x => ({ ...x, price: Math.max(1, Math.round(+x.price) || 1) }));
function finishShop() {
  S.shop = S.shop.filter(x => x.name.trim()).map(x => ({ ...x, icon: String(x.icon).trim() || '🎁', price: Math.max(1, Math.round(+x.price) || 1) }));
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
const CHEST_TINT = ['grayscale(1) brightness(1.15)', 'hue-rotate(80deg)', 'hue-rotate(170deg)', 'hue-rotate(230deg) saturate(1.3)', 'saturate(1.5) brightness(1.15)'];
// 寶箱說明：開出哪個稀有度、有幾種可能，例如「普通生物 6 種隨機一種・25% 開出飼料」
function chestOdds(ch) {
  const r = ch.rates.findIndex(p => p > 0), n = CREATURES.filter(c => c.r === r).length;
  return `${RARITY[r].name}生物 ${n} 種${n > 1 ? '隨機一種' : ''}${ch.feed ? `・${ch.feed}% 開出飼料` : ''}`;
}
function shop(D) {
  const hist = S.logs.filter(l => l.k === 'redeem').slice(-8).reverse();
  if (UI.shopEdit) return `<section class="px shop">${sh('編輯獎勵', 'REWARDS', '<button class="pri" data-act="shopdone">完成</button>')}
    <div class="mini">設定你真的想要的獎勵。參考：每天大約能賺 60–90 金幣。</div>
    ${S.shop.map((it, i) => `<div class="it">
      <input data-sf="icon" data-si="${i}" value="${esc(it.icon)}" style="width:52px;text-align:center" title="圖示（可貼 emoji）">
      <input class="sp" data-sf="name" data-si="${i}" value="${esc(it.name)}" placeholder="獎勵名稱，例如：吃甜點（100 元內）">
      <input type="number" min="1" data-sf="price" data-si="${i}" value="${it.price}" style="width:90px">${COIN}
      <button class="ghost" data-act="shopdel" data-v="${i}" title="刪除">✕</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button data-act="shopadd">＋ 新增獎勵</button></div></section>`;
  const since = addDays(dayKey(), -13), recent = S.logs.filter(l => l.d >= since && l.c > 0 && l.k !== 'welcome');
  const activeDays = new Set(recent.map(l => l.d)).size;
  const rate = activeDays >= 5 ? Math.max(10, Math.round(recent.reduce((a, l) => a + l.c, 0) / 14)) : CONFIG.coinsPerDay;
  const daysFor = p => Math.max(1, Math.ceil(p / rate));
  const items = [...shopItems()].sort((a, b) => a.price - b.price), next = items.find(it => it.price > D.coins);
  return `<section class="px shop">${sh('生物寶箱', 'CHESTS')}
    <div class="mini">開出的生物會放進水族箱，飼料拿去餵牠們長大。每種最多養 ${MAX_PETS} 隻，抽到重複的另外送金幣。</div>
    ${CONFIG.chests.map((ch, i) => `<div class="it chest"><span class="ic" style="filter:${CHEST_TINT[i]}">${img(CHEST, 2)}</span>
      <span class="sp">${ch.name}<br><small>${chestOdds(ch)}</small></span>
      <span class="price">${ch.price}${COIN}</span><button class="pri" data-act="buychest" data-v="${ch.id}" ${D.coins < ch.price ? 'disabled' : ''}>購買</button></div>`).join('')}
    <div class="it chest"><span class="ic">🦐</span><span class="sp">飼料 ${FEED.pack} 顆<br><small>每天另有免費 ${FEED.free} 顆・目前還有 ${feedLeft()} 顆</small></span>
      <span class="price">${FEED.price}${COIN}</span><button class="pri" data-act="buyfeed" ${D.coins < FEED.price ? 'disabled' : ''}>購買</button></div></section>
  <section class="px shop">${sh('獎勵商店', 'REWARDS', '<button class="ghost" data-act="shopedit">編輯</button>')}
    <div class="mini">你可以自行設定想要的獎勵。${activeDays >= 5 ? `最近 14 天平均每天賺 ${rate} 金幣。` : `目前以每天約 ${rate} 金幣估算。`}</div>
    ${next ? `<div class="goal"><div class="label">NEXT GOAL</div>
      <div class="row"><span>${esc(next.icon)} ${esc(next.name)}</span><span class="sp"></span><span class="coin">${D.coins} / ${next.price}${COIN}</span></div>
      <div class="bar c"><i style="width:${Math.max(0, D.coins / next.price * 100)}%"></i></div>
      <div class="mini">大約還要 ${daysFor(next.price - D.coins)} 天</div></div>` : ''}
    ${items.length ? '' : '<div class="dim" style="margin-top:8px">還沒有獎勵，按「編輯」新增。</div>'}
    ${items.map(it => `<div class="it"><span class="ic">${esc(it.icon)}</span><span class="sp">${esc(it.name)}</span>
      <span class="price">${it.price}${COIN}</span>
      ${D.coins >= it.price ? `<button class="pri" data-act="redeem" data-v="${it.id}">兌換</button>`
        : `<span class="dim need">約 ${daysFor(it.price - D.coins)} 天</span>`}</div>`).join('')}
  </section>
  <section class="px">${sh('兌換紀錄', 'HISTORY')}${hist.length ? hist.map(l => `<div class="row"><span class="dim">${l.d}</span><span>${esc(l.name)}</span><span class="sp"></span><span class="price">${l.c}${COIN}</span></div>`).join('') : '<div class="dim">還沒有兌換過。</div>'}</section>`;
}

// 最近的打卡紀錄（含運動細節、文章標題）
function recentEntries() {
  const out = [];
  for (const [d, C] of Object.entries(S.checks)) for (const [id, arr] of Object.entries(C)) for (const e of arr) out.push({ d, id, t: e.t || 0, e });
  return out.sort((a, b) => b.d.localeCompare(a.d) || b.t - a.t);
}
function entryText(r) {
  const h = S.habits.find(x => x.id === r.id) || { e: '•', n: r.id };
  const body = r.id === 'vocus' ? `發布：${r.e.title || '（無標題）'}` : r.id === 'exercise' ? (exText(r.e) || '運動') : `${h.n} ✓`;
  return `${h.e} ${body}`;
}

function log(D) {
  const lv = levelOf(D.xp), ri = rankIdx(lv), nxt = RANKS[ri + 1], lo = xpFor(lv), hi = xpFor(lv + 1);
  const td = dayKey(), H = activeHabits();
  // 「有打卡的日子」＝當天有完成任何事：習慣打卡、六件事打勾、寫好清單、完成一段番茄鐘
  const actDays = new Set(Object.keys(D.days).filter(k => H.some(h => D.days[k][h.id])));
  for (const [d, P] of Object.entries(S.plans)) if (P.some(x => x.done && x.text.trim())) actDays.add(d);
  for (const l of S.logs) if (l.k === 'plan' || l.k === 'pomo') actDays.add(l.d);
  const active = k => actDays.has(k);
  const allDays = [...actDays].filter(k => k <= td).sort();
  let curRun = 0; for (let k = active(td) ? td : addDays(td, -1); active(k); k = addDays(k, -1)) curRun++;
  let best = 0, run = 0, prevDay = null;
  for (const k of allDays) { run = prevDay && addDays(prevDay, 1) === k ? run + 1 : 1; best = Math.max(best, run); prevDay = k; }
  const daysOf = k => Object.values(D.days).filter(x => x[k]).length;
  const rec = recentEntries();
  const runs = rec.filter(r => r.id === 'exercise' && r.e.type === '跑步' && r.e.dist > 0), runKm = runs.reduce((a, r) => a + +r.e.dist, 0);
  const pomos = S.logs.filter(l => l.k === 'pomo'), pomoHours = pomos.reduce((a, l) => a + (l.min || CONFIG.pomodoroMin), 0) / 60;
  return `<section class="px">${sh('等級', 'LEVEL')}
    <div class="row"><div class="big-lv"><span>Lv.</span>${lv}</div><div><b>${RANKS[ri][1]}</b><div class="mini" style="margin:0">共 ${D.xp} XP</div></div></div>
    <div class="bar"><i style="width:${Math.max(0, Math.min(100, (D.xp - lo) / (hi - lo) * 100))}%"></i></div>
    <div class="mini">升到 Lv.${lv + 1} 還差 ${hi - D.xp} XP${nxt ? `・Lv.${nxt[0]} 成為「${nxt[1]}」` : ''}</div></section>
  <section class="px">${sh('打卡紀錄', 'ACTIVITY')}
    <div class="streakbox"><div><small>目前連續</small><b>${curRun}</b><small>天</small></div>
      <div><small>最長連續</small><b>${best}</b><small>天</small></div><div><small>總共打卡</small><b>${allDays.length}</b><small>天</small></div></div></section>
  <section class="px">${sh('最近習慣紀錄', 'RECENT HABIT')}
    ${rec.length ? rec.slice(0, 12).map(r => `<div class="entry"><span class="dim" style="flex:none">${r.d.slice(5).replace('-', '/')}</span><span class="sp">${esc(entryText(r))}</span></div>`).join('')
      : '<div class="dim">點「今日」的習慣卡片打卡，就會記在這裡。</div>'}</section>
  <section class="px">${sh('累積', 'TOTALS')}<div class="stat">
    ${H.map(h => h.kind === 'vocus' ? `<div><small>${esc(h.e)} ${esc(h.n)}</small><b>${D.articles}</b><small>篇文章</small></div>`
      : `<div><small>${esc(h.e)} ${esc(h.n)}</small><b>${daysOf(h.id)}</b><small>天</small></div>`).join('')}
    <div><small>番茄鐘</small><b>${pomos.length}</b><small>段・${pomoHours.toFixed(1)} 小時</small></div>
    <div><small>跑步總距離</small><b>${runKm.toFixed(1)}</b><small>km・${runs.length} 次</small></div>
    <div><small>潛水</small><b>${rec.filter(r => r.id === 'exercise' && r.e.type === '潛水').length}</b><small>支</small></div>
  </div></section>
  ${cloudSection()}
  <section class="px">${sh('設定與備份', 'SETTINGS')}
    <label class="switch"><button class="toggle ${S.mute ? '' : 'on'}" data-act="mute" role="switch" aria-checked="${!S.mute}" aria-label="音效"><i></i></button><span>音效</span></label>
    <div class="mini" style="margin-top:12px">${CLOUD.user ? '紀錄已同步到雲端。也可以另外下載一份備份檔。' : '紀錄只存在這個瀏覽器。換手機、換瀏覽器或清除瀏覽資料就會消失，請定期備份。'}</div>
    <div class="row" style="margin-top:6px"><button data-act="export">備份</button><button data-act="import">還原</button></div></section>`;
}

// 關於頁
const SALON = { name: 'Frog Journey｜兩棲類的冒險生活', url: 'https://vocus.cc/salon/frog-journey',
  desc: '一個真的去過、住過、做過的人的第一手紀錄。登山、潛水、旅居，還有一路上的成長。' };
const ABOUT_LINKS = [
  { title: '潛水日誌 #1｜印尼・Nusa Penida・Manta Point：5 隻鬼蝠魟從頭頂飛過', sub: '圖鑑裡的鬼蝠魟，就是從這裡來的', url: 'https://vocus.cc/article/6a8ec287fd897800012e765a' },
  { title: '潛水日誌 #2｜印尼・Nusa Penida・Crystal Bay：沒看到翻車魚！', sub: '想抽到翻車魚？先看看我在海裡等了多久', url: 'https://vocus.cc/article/6ad986a9fd89780001033212' },
  { title: 'OW 潛水考照心得｜課程都在學什麼？我的完整考照紀錄', sub: '從零開始學潛水的紀錄', url: 'https://vocus.cc/article/6a45ddadfd89780001dff50b' },
];
function about() {
  return `<section class="px">${sh('關於習慣深潛', 'ABOUT')}
    <p>嗨，我是 Harry，喜歡潛水，也在努力每週寫文章。這個遊戲是我為了讓自己持續寫作和運動而做的：每天寫下最重要的事，完成就賺金幣，用金幣開寶箱，收集我在海裡遇過（或還在等）的生物。</p>
    <p class="dim">從浮潛客一路升到潛水教練的稱號、圖鑑裡的鬼蝠魟和翻車魚，都來自我的潛水經驗。希望它也能陪你一點一點往前進。</p></section>
  <section class="px">${sh('我的沙龍', 'SALON')}
    <div class="salon"><b style="font-size:17px">${SALON.name}</b><p class="dim" style="margin:6px 0 12px">${SALON.desc}</p>
      <a href="${SALON.url}" target="_blank" rel="noopener"><button class="pri" style="margin:0">前往沙龍 ↗</button></a></div></section>
  <section class="px">${sh('推薦文章', 'READ')}
    ${ABOUT_LINKS.map(l => `<a class="link" href="${l.url}" target="_blank" rel="noopener">
      <span class="sp"><b>${esc(l.title)}</b><br><small>${esc(l.sub)}</small></span><span class="dim">↗</span></a>`).join('')}</section>
  <section class="px">${sh('資料與隱私', 'PRIVACY')}
    <div class="mini">沒登入時，紀錄只存在你自己的瀏覽器裡，不會上傳到任何地方。</div>
    ${FIREBASE_CONFIG ? `<div class="mini">如果你選擇用 Google 登入，紀錄（六件事、打卡、遊戲進度）會存到 Google 的 Firebase 雲端，用來在不同裝置間同步。只會取得你的 Google 名稱和 email 來辨識帳號，不會發信、不會發文，也看不到你的其他 Google 資料。資料庫規則讓每個人只能讀寫自己的資料；身為網站管理者，我在技術上看得到資料庫，但不會查看或使用你的紀錄。你隨時可以在「紀錄 → 雲端同步」刪除雲端資料和帳號。</div>` : ''}
    <div class="mini">本工具為個人作品，與方格子 vocus 官方無關。</div></section>`;
}

