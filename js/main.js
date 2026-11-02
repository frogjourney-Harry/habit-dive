// 事件與啟動：所有按鈕、輸入框、匯入，以及頁面載入時的初始化。
/* ========= 事件 ========= */
function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2600);
}
async function exportBackup() {
  const name = `習慣深潛-備份-${dayKey()}.json`, json = JSON.stringify(S, null, 1);
  const file = new File([json], name, { type: 'application/json' });
  // 手機優先用分享選單（可存到檔案、雲端硬碟）；不支援時改用下載
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '習慣深潛備份' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(IN_APP ? '如果沒有下載，請改用 Chrome 或 Safari 開啟再備份' : '備份檔已下載');
}
function sheetDay() { return addDays(dayKey(), UI.sheet.day); }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case 'tab': if (UI.shopEdit) finishShop(); if (UI.habEdit) finishHabits(); UI.tankEdit = false; UI.tankView = ''; UI.swap = null; UI.tab = v; render(); window.scrollTo(0, 0); break;
    case 'pday': UI.pday = +v; UI.swap = null; render(); break;
    // 六件事換順序：先點一個編號，再點另一個編號，兩件交換
    case 'swap': {
      const P = getPlan(viewDay()), i = +v, j = UI.swap;
      if (j == null) { UI.swap = i; render(); toast('再點另一個編號交換'); break; }
      UI.swap = null;
      if (i === j) { render(); break; }
      [P[i], P[j]] = [P[j], P[i]];
      reward(() => {}, UI.pday === 0); toast(`第 ${j + 1} 件和第 ${i + 1} 件換好了`); break;
    }
    case 'buychest': buyChest(v); break;
    // 每日任務：領取一項或全部
    case 'claim': claim(v === 'all' ? dailyTasks(derive()).flatMap(t => t.pend) : (dailyTasks(derive()).find(t => t.id === v) || { pend: [] }).pend); break;
    case 'iabok': UI.iabOk = true; render(); break;
    case 'start': startTimer(); break;
    case 'skipbreak': {
      const T = S.timer;
      if (T && T.segs[T.si].m === 'break') { T.start = Date.now() - T.segs[T.si].min * 60e3; tick(); }
      break;
    }
    case 'pomoset': S.pomoMin = +v; save(); render(); break;
    case 'cancel':
      if (await ask('結束這段工作階段？\n目前這段專注不會有獎勵，已完成的段落會保留。', '結束', '繼續')) { S.timer = null; save(); render(); tick(); }
      break;
    case 'askyes': ask.res && ask.res(true); break;
    case 'askno': ask.res && ask.res(false); break;
    case 'habtap':
      UI.sheet = { id: v, day: 0 }; renderSheet(); break;
    case 'shday': UI.sheet.day = +v; renderSheet(); break;
    case 'sheetclose': UI.sheet = null; renderSheet(); break;
    case 'chk': {
      const d = sheetDay(), id = UI.sheet.id;
      if (dayChecks(d, id).length) { while (dayChecks(d, id).length) delCheck(d, id, 0); }
      else { addCheck(d, id, {}); ac(); SFX.tap(); }
      reward(() => {}, UI.sheet.day === 0); break;
    }
    case 'exadd': {
      const type = document.getElementById('exType').value, e = { type };
      for (const [k, , , step] of EX_FIELDS[type]) {
        const v = document.getElementById('ex_' + k).value.trim();
        if (v) e[k] = step ? +v : v;
      }
      const note = document.getElementById('ex_note').value.trim(); if (note) e.note = note;
      UI.sheet.exType = type;
      addCheck(sheetDay(), 'exercise', e); ac(); SFX.tap();
      reward(() => {}, UI.sheet.day === 0); break;
    }
    case 'artadd':
      addCheck(sheetDay(), 'vocus', { title: document.getElementById('artTitle').value.trim() || undefined }); ac(); SFX.tap();
      reward(() => {}, UI.sheet.day === 0); break;
    case 'chkdel': delCheck(sheetDay(), UI.sheet.id, +v); reward(() => {}, false); break;
    case 'habedit': UI.habEdit = true; render(); break;
    case 'habdone': finishHabits(); render(); toast('習慣已更新'); break;
    case 'habadd':
      if (customCount() >= CONFIG.maxCustom) break;
      S.habits.push({ id: 'h' + rid(), e: '⭐', n: '', kind: 'custom', weeks: 0, target: 1 }); save(); render(); break;
    case 'habdel': {
      const h = S.habits[+v];
      if (!(await ask(`刪除習慣「${h.e} ${h.n || '（未命名）'}」？\n過去的紀錄會保留，只是不再顯示和計算。`, '刪除'))) break;
      h.off = true; save(); render(); break;
    }
    case 'habrestore': { const h = S.habits.find(x => x.id === v); h.off = false; save(); render(); break; }
    case 'gcatadd': S.gcats.push({ id: 'g' + rid(), e: '🔖', n: '' }); save(); render(); break;
    case 'gcatdel': S.gcats[+v].off = true; save(); render(); break;
    case 'vcfg': {
      const V = habit('vocus');
      V.weeks = +document.getElementById('vW').value; V.target = +document.getElementById('vT').value;
      S.vocusSet = true; save(); render(); toast(`設定好了：每 ${V.weeks} 週至少 ${V.target} 篇`); break;
    }
    case 'shopedit': S.shop = shopItems().map(x => ({ ...x })); UI.shopEdit = true; render(); break;
    case 'shopadd': S.shop.push({ id: 'c' + Date.now(), icon: '🎁', name: '', price: 100 }); save(); render(); break;
    case 'shopdel': S.shop.splice(+v, 1); save(); render(); break;
    case 'shopdone': finishShop(); render(); toast('商店已更新'); break;
    case 'openchest': openChest(); break;
    case 'close': UI.opened = false; nextChest(); break;
    case 'mute':
      S.mute = !S.mute; save(); render();
      if (!S.mute) { ac(); SFX.tap(); }
      toast(S.mute ? '音效已關閉' : '音效已開啟'); break;
    case 'fact': UI.sheet = { creature: v }; renderSheet(); break;
    case 'pdone': {
      const d = viewDay(), it = getPlan(d)[v], c = catOf(it.cat);
      if (UI.pday > 0) break;
      if (!it.text.trim()) { toast('先寫下這件事'); render(); break; }
      it.done = !it.done;
      if (it.done) ac();
      // 只有「今天」打勾才有獎勵；一天最多 rewardRows 件（換順序也不能多拿）。勾錯取消時獎勵先收進 it.held，再勾回來原封不動還回去
      reward(() => {
        if (UI.pday !== 0) { if (it.done) SFX.tap(); return; }
        if (!it.done) {
          let i = S.logs.findIndex(l => it.lid && l.id === it.lid);
          if (i < 0 && it.rw) {
            const linked = new Set(Object.values(S.plans).flat().map(x => x.lid).filter(Boolean));
            for (let j = S.logs.length - 1; j >= 0; j--) {
              const l = S.logs[j];
              if (l.k === 'check' && l.d === d && l.tag === c.n && !linked.has(l.id)) { i = j; break; }
            }
          }
          if (i >= 0) { it.lid = S.logs[i].id; it.held = S.logs.splice(i, 1)[0]; toast('已取消，這一項的獎勵先收回（再勾回來會還你）'); }
          return;
        }
        if (it.held) { S.logs.push(it.held); delete it.held; SFX.tap(); toast('已恢復這一項的獎勵'); return; }
        if (it.rw || +v >= CONFIG.rewardRows || getPlan(d).filter(x => x.rw).length >= CONFIG.rewardRows) { SFX.tap(); return; }
        it.rw = true;
        it.lid = grant('check', c.n, { title: `✔ ${it.text}`, xp: CONFIG.xp.check }).id;
      }, UI.pday === 0);
      break;
    }
    case 'plansave': {
      const d = viewDay();
      if (!filled(getPlan(d)).length) { toast('至少寫下一件重要的事'); break; }
      ac(); reward(() => grant('plan', null, { key: 'plan:' + d, d, title: '今天的清單寫好了！' })); break;
    }
    case 'redeem': {
      const it = shopItems().find(x => x.id === v);
      if (derive().coins < it.price || !(await ask(`用 ${it.price} 金幣兌換「${it.name}」？`, '兌換'))) break;
      S.logs.push({ id: rid(), t: Date.now(), d: dayKey(), k: 'redeem', name: it.name, c: -it.price });
      save(); render(); SFX.buy(); toast(`${it.icon} 兌換成功，去享受吧！`); break;
    }
    case 'export': exportBackup(); break;
    case 'login': cloudLogin(); break;
    case 'logout': cloudLogout(); break;
    case 'clouddel': cloudDelete(); break;
    case 'prerestore': cloudRestorePre(); break;
    case 'predrop': cloudDropPre(); break;
    case 'tankedit': UI.tankEdit = true; render(); break;
    case 'tankview': UI.tankView = v; render(); window.scrollTo(0, 0); break;
    case 'intank': S.outTank = S.outTank || {}; if (b.checked) delete S.outTank[v]; else S.outTank[v] = true; save(); break;
    case 'release': {
      const lg = S.logs.find(l => l.id === v), c = lg && CR[lg.drop]; if (!c) break;
      const p = pets(c.id).find(x => x.id === v), st = p ? `（${stageName(c, stageOf(p.fed))}）` : '';
      if (!(await ask(`放生這隻${c.name}${st}？\n牠會回到大海，不會再出現在水族箱。圖鑑的收集紀錄會保留。`, '放生'))) break;
      S.released = S.released || {}; S.released[v] = true; save(); render(); renderSheet(); toast(`${c.name}回到大海了`); break;
    }
    case 'releasepick': {
      const lg = S.logs.find(l => l.id === v);
      S.released = S.released || {}; S.released[v] = true; save();
      UI.opened = false; render(); nextChest(); toast(`${CR[lg.drop].name}回到大海了`); break;
    }
    case 'fav': {
      const it = getPlan(viewDay())[v], t = it.text.trim();
      if (!t) { toast('先寫下內容，再存成常用'); break; }
      S.favs = S.favs || [];
      if (S.favs.includes(t)) S.favs = S.favs.filter(x => x !== t);
      else { if (S.favs.length >= 12) { toast('常用最多 12 個'); break; } S.favs.push(t); toast('已存成常用'); }
      save(); render(); break;
    }
    case 'usefav': {
      const P = getPlan(viewDay()), t = S.favs[+v], slot = P.find(x => !x.text.trim());
      if (P.some(x => x.text.trim() === t)) { toast('這件已經在清單裡了'); break; }
      if (!slot) { toast('六格都寫滿了'); break; }
      slot.text = t; save(); render(); break;
    }
    case 'delfav': S.favs.splice(+v, 1); save(); render(); break;
    case 'tankdone': UI.tankEdit = false; render(); toast('水族箱已更新'); break;
    case 'buyfeed': {
      if (derive().coins < FEED.price) { toast(`金幣不夠，飼料要 ${FEED.price} 金幣`); break; }
      S.logs.push({ id: rid(), t: Date.now(), d: dayKey(), k: 'redeem', name: `飼料 ${FEED.pack} 顆`, c: -FEED.price });
      S.feed = (S.feed || 0) + FEED.pack; save(); SFX.buy(); toast(`買了 ${FEED.pack} 顆飼料`);
      if (UI.tab === 'tank') { renderStat(); const el = document.getElementById('feedInfo'); if (el) el.textContent = tankFeedText(); }
      else render();
      break;
    }
    case 'import': document.getElementById('importFile').click(); break;
  }
});
// 點彈窗外面的暗色區域就關閉面板
document.getElementById('sheetov').addEventListener('click', e => { if (e.target.id === 'sheetov') { UI.sheet = null; renderSheet(); } });
document.addEventListener('keydown', e => {
  if (!document.getElementById('askov').classList.contains('hidden') && ask.res) {
    if (e.key === 'Enter') { e.preventDefault(); ask.res(true); }
    if (e.key === 'Escape') { e.preventDefault(); ask.res(false); }
  } else if (e.key === 'Escape' && UI.sheet) { UI.sheet = null; renderSheet(); }
});
// 輸入框只存資料不重畫，避免打字時失去焦點
document.addEventListener('input', e => {
  const el = e.target, i = el.dataset.i;
  if (el.id === 'pomoMin') {
    const m = Math.round(+el.value);
    if (m >= 5 && m <= 120) {
      S.pomoMin = m; save();
      const p = document.getElementById('pomoPlan');
      if (p) p.innerHTML = sessionPlan(m).map(x => `<span>${x.m === 'break' ? '休息' : '專注'} ${x.min}</span>`).join('<span>›</span>');
    }
    return;
  }
  if (el.id === 'exType') { UI.sheet.exType = el.value; renderSheet(); return; }
  if (el.id && el.id.startsWith('ex_')) {
    const g = k => { const i = document.getElementById('ex_' + k); return i ? +i.value : 0; };
    const p = document.getElementById('exPace');
    if (p) p.textContent = paceText({ type: document.getElementById('exType').value, dist: g('dist'), m: g('m'), min: g('min') });
    return;
  }
  if (el.dataset.sf) { S.shop[el.dataset.si][el.dataset.sf] = el.dataset.sf === 'price' ? +el.value : el.value; save(); return; }
  if (el.dataset.gf) { S.gcats[el.dataset.gi][el.dataset.gf] = el.value; save(); return; }
  if (el.dataset.hf) {
    const h = S.habits[el.dataset.hi], f = el.dataset.hf;
    h[f] = f === 'weeks' || f === 'target' ? +el.value : el.value;
    save(); if (f === 'weeks') render();
    return;
  }
  if (i === undefined || !el.dataset.pf) return;
  const it = getPlan(viewDay())[i];
  it[el.dataset.pf] = el.value;
  if (el.dataset.pf === 'cat') render();
  save();
});
document.getElementById('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!Array.isArray(j.logs)) throw 0;
    if (await ask(`備份檔有 ${j.logs.length} 筆紀錄，目前有 ${S.logs.length} 筆。\n確定用備份取代目前資料？`, '還原')) {
      S = migrate(Object.assign(blank(), j)); save(); render(); toast('已還原');
    }
  } catch (err) { toast('這不是有效的備份檔'); }
});

/* ========= 啟動 ========= */
(function init() {
  document.getElementById('logo').innerHTML = img(CR.clown.px, 3);
  const bub = document.getElementById('bubbles');
  for (let i = 0; i < 10; i++) {
    const s = 3 + (i % 3) * 2;
    bub.insertAdjacentHTML('beforeend', `<i style="left:${(i * 37 + 7) % 100}%;width:${s}px;height:${s}px;animation-duration:${9 + (i * 7) % 11}s;animation-delay:-${(i * 3) % 13}s"></i>`);
  }
  render(); tick();
  setInterval(tick, 500);
  if (!derive().claimed.has('welcome')) { grant('welcome', null, { key: 'welcome' }); save(); render(); nextChest(); }
  // 這台裝置之前登入過雲端同步，就自動恢復登入
  if (S.cloudUid) cloudInit();
  // 跨過換日時間時重新整理畫面
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); render(); } }, 30e3);
})();
