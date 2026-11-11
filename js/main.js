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
function finishHabitEntry() {
  UI.sheet = null; UI.tab = 'today'; UI.pday = 0; UI.showRows = 0; UI.swap = null;
}
const eventElement = event => event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
const navTouch = { down: null, suppress: [], fallback: null, firing: false };
const navTouchButton = event => eventElement(event)?.closest('#nav button[data-act="tab"]');
function rememberNavTouch(down, x, y) {
  navTouch.suppress = navTouch.suppress.filter(item => item.until >= performance.now()).slice(-7);
  navTouch.suppress.push({ key: down.key, x, y, until: performance.now() + 800 });
}
// Mobile tabs activate at touch-up; WebKit's later synthetic click is optional.
// Keep the existing click route for keyboard, mouse and accessibility.
document.addEventListener('pointerdown', event => {
  const previous = navTouch.down; navTouch.down = null; navTouch.fallback = null;
  if (event.pointerType === 'touch' && event.isPrimary === false) {
    if (previous) rememberNavTouch(previous, previous.x, previous.y);
    return;
  }
  const button = navTouchButton(event);
  if (!button || event.pointerType !== 'touch' || getComputedStyle(button.parentElement).position !== 'fixed') {
    navTouch.suppress = event.pointerType === 'touch' ? navTouch.suppress.map(item => ({ ...item, navOnly: true })) : [];
    return;
  }
  navTouch.down = { id: event.pointerId, key: button.dataset.v, x: event.clientX, y: event.clientY, distance: 0, at: performance.now() };
}, { capture: true, passive: true });
document.addEventListener('pointermove', event => {
  const down = navTouch.down; if (!down || event.pointerId !== down.id) return;
  down.distance = Math.max(down.distance, Math.hypot(event.clientX - down.x, event.clientY - down.y));
}, { capture: true, passive: true });
document.addEventListener('pointerup', event => {
  const down = navTouch.down; if (!down || event.pointerId !== down.id) return;
  navTouch.down = null;
  const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('#nav button[data-act="tab"]');
  const distance = Math.max(down.distance, Math.hypot(event.clientX - down.x, event.clientY - down.y));
  if (hit && hit.dataset.v === down.key && !hit.disabled && distance <= 12 && performance.now() - down.at <= 700) {
    rememberNavTouch(down, event.clientX, event.clientY);
    navTouch.firing = true; try { hit.click(); } finally { navTouch.firing = false; }
  } else if ((hit && hit.dataset.v !== down.key) || distance > 24) rememberNavTouch(down, event.clientX, event.clientY);
  else {
    navTouch.suppress = navTouch.suppress.filter(item => item.key !== down.key);
    navTouch.fallback = { key: down.key, until: performance.now() + 800 };
  }
}, { capture: true, passive: true });
document.addEventListener('pointercancel', event => {
  const down = navTouch.down;
  if (down && event.pointerId !== down.id) return;
  if (down) rememberNavTouch(down, event.clientX, event.clientY);
  navTouch.down = null; navTouch.fallback = null;
}, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { navTouch.down = null; navTouch.suppress = []; navTouch.fallback = null; } });
window.addEventListener('click', event => {
  if (navTouch.firing || event.detail === 0) return;
  navTouch.suppress = navTouch.suppress.filter(item => item.until >= performance.now());
  const button = navTouchButton(event);
  if (navTouch.fallback && navTouch.fallback.until >= performance.now() && button?.dataset.v === navTouch.fallback.key) {
    rememberNavTouch(navTouch.fallback, event.clientX, event.clientY); navTouch.fallback = null; return;
  }
  const index = navTouch.suppress.findIndex(item => button?.dataset.v === item.key || (!item.navOnly && Math.hypot(event.clientX - item.x, event.clientY - item.y) <= 24));
  if (index >= 0) {
    navTouch.suppress.splice(index, 1); event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);

document.addEventListener('click', async e => {
  const b = eventElement(e)?.closest('[data-act]'); if (!b) return;
  const v = b.dataset.v, context = dataContext();
  if (UI.renderedState && UI.renderedState !== S && b.closest('#main') && b.dataset.act !== 'tab') {
    render(); toast('資料已更新，請重新操作'); return;
  }
  switch (b.dataset.act) {
    case 'tab': CLOUD.deleteArmed = null; CLOUD.deleteContext = null; if (UI.shopEdit) finishShop(); if (UI.habEdit) finishHabits(); closeTankSelection(); UI.tankView = ''; UI.logView = ''; UI.swap = null; UI.tab = v; if (v === 'today') { UI.pday = 0; UI.showRows = 0; } render(); window.scrollTo(0, 0); break;
    case 'pday': UI.pday = +v; UI.swap = null; UI.showRows = 0; render(); break;
    case 'prowdel': {
      const d = viewDay(), P = getPlan(d), index = +v, item = P[index];
      if (UI.pday < 0 || !item) break;
      UI.planUndo = { d, index, item: JSON.parse(JSON.stringify(item)) };
      P.splice(index, 1); P.push({ text: '', cat: 'other', done: false, rw: false });
      UI.showRows = Math.max(3, UI.shownRows - 1);
      reward(() => {}, UI.pday === 0); toast('已刪除，可在清單下方復原'); break;
    }
    case 'planundo': {
      const u = UI.planUndo; if (!u || u.d !== viewDay()) break;
      const P = getPlan(u.d);
      if (P[5].text.trim()) { toast('請先空出一格，再復原刪除'); break; }
      P.pop(); P.splice(u.index, 0, u.item); UI.planUndo = null;
      reward(() => {}, UI.pday === 0); break;
    }
    case 'addrow': UI.showRows = UI.shownRows + 1; render(); document.querySelector(`[data-pf="text"][data-i="${UI.showRows - 1}"]`)?.focus(); break;
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
    case 'tipsix': S.tipSix = true; save(); render(); break;
    case 'pomocustom': UI.pomoCustom = true; render(); document.getElementById('pomoMin')?.focus(); break;
    case 'pomoset': S.pomoMin = +v; UI.pomoCustom = false; save(); render(); break;
    case 'cancel': {
      const T = S.timer, early = T && T.si === 0 && Date.now() - T.start < 60e3;   // 剛開始一分鐘內，多半是按錯或不想用，直接結束不用再問
      if (early || await ask('結束這段工作階段？\n目前這段專注不會有獎勵，已完成的段落會保留。', '結束', '繼續')) { S.timer = null; save(); render(); tick(); }
      break;
    }
    case 'askyes': ask.res && ask.res(true); break;
    case 'askno': ask.res && ask.res(false); break;
    case 'habtap':
      UI.sheet = { id: v, day: 0 }; renderSheet(); break;
    case 'shday': if (stashExerciseDraft() === false) break; UI.sheet.day = +v; renderSheet(); break;
    case 'sheetclose': UI.sheet = null; renderSheet(); break;
    case 'chk': {
      const d = sheetDay(), id = UI.sheet.id, today = UI.sheet.day === 0;
      if (dayChecks(d, id).length) { while (dayChecks(d, id).length) delCheck(d, id, 0); }
      else { addCheck(d, id, {}); clearLeave(id, d); ac(); SFX.tap(); finishHabitEntry(); }
      reward(() => {}, today); break;
    }
    case 'leave': { const msg = toggleLeave(UI.sheet.id, sheetDay()); save(); render(); renderSheet(); if (msg) toast(msg); break; }
    case 'exadd': {
      const type = document.getElementById('exType').value, e = { type };
      if (!ETAGS.includes(type)) { document.getElementById('exError').textContent = '請選擇運動類型。'; break; }
      if (stashExerciseDraft() === false) break;
      let error = '', firstInvalid = null;
      for (const [k, label, unit] of EX_FIELDS[type]) {
        const input = document.getElementById('ex_' + k), v = input.value.trim();
        input.removeAttribute('aria-invalid');
        if (!v) continue;
        const n = Number(v);
        if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(v) && Number.isFinite(n) && n > 0 && n <= EX_LIMITS[k]) e[k] = n;
        else { input.setAttribute('aria-invalid', 'true'); firstInvalid = firstInvalid || input; error = error || `${label}請填大於 0、不超過 ${EX_LIMITS[k]} ${unit}的數字，或留空。`; }
      }
      const note = document.getElementById('ex_note').value.trim().slice(0, 200); if (note) e.note = note;
      if (error) { document.getElementById('exError').textContent = error; firstInvalid.focus(); return; }
      const d = sheetDay(), today = UI.sheet.day === 0;
      addCheck(d, UI.sheet.id, e); ac(); SFX.tap(); finishHabitEntry();
      reward(() => {}, today); break;
    }
    case 'chkdel': {
      const current = dayChecks(sheetDay(), UI.sheet.id)[+v];
      if (b.dataset.entry !== JSON.stringify(current)) { stashExerciseDraft(); renderSheet(); toast('紀錄已更新，請重新選擇'); break; }
      delCheck(sheetDay(), UI.sheet.id, +v); reward(() => {}, false); break;
    }
    case 'habedit': UI.habEdit = true; render(); break;
    case 'habdone': finishHabits(); render(); toast('習慣已更新'); break;
    case 'habadd':
      if (customCount() >= CONFIG.maxCustom) break;
      S.habits.push({ id: 'h' + rid(), e: '⭐', n: '', kind: 'custom', weeks: 0, target: 1 }); save(); render(); break;
    case 'habdel': {
      const h = S.habits[+v]; if (!h) break;
      if (!(await ask(`刪除習慣「${h.n || '（未命名）'}」？\n過去的紀錄會保留，只是不再顯示和計算。`, '刪除'))) break;
      h.off = true; save(); render(); break;
    }
    case 'habrestore': { const h = S.habits.find(x => x.id === v); if (!h) break; h.off = false; save(); render(); break; }
    case 'gcatadd': S.gcats.push({ id: 'g' + rid(), e: '🔖', n: '' }); save(); render(); break;
    case 'gcatdel': S.gcats[+v].off = true; save(); render(); break;
    case 'onbstart': UI.onbStep = 2; renderOnb(); break;
    case 'onbreturn': UI.onbReturning = true; renderOnb(); break;
    case 'onbback': UI.onbReturning = false; renderOnb(); break;
    case 'onbskip': UI.onbStep = 2; renderOnb(); break;
    case 'onbpick': {
      const sel = UI.onbSel || (UI.onbSel = {});
      sel[v] = !sel[v];
      if (sel[v] && onbCustomCount() > CONFIG.maxCustom) { sel[v] = false; toast(`自訂型的習慣最多 ${CONFIG.maxCustom} 個`); }
      renderOnb(); break;
    }
    case 'onbdone': finishOnb(); break;
    case 'shopedit': S.shop = shopItems().map(x => ({ ...x })); UI.shopEdit = true; render(); break;
    case 'shopadd': S.shop = S.shop || []; S.shop.push({ id: 'c' + Date.now(), icon: '🎁', name: '', price: 100 }); save(); render(); break;
    case 'shopdel': if (S.shop) S.shop.splice(+v, 1); save(); render(); break;
    case 'shopdone': finishShop(); render(); toast('商店已更新'); break;
    case 'openchest': openChest(); break;
    case 'close': UI.opened = false; nextChest(); break;
    case 'mute':
      S.mute = !S.mute; save(); render();
      if (!S.mute) { ac(); SFX.tap(); }
      toast(S.mute ? '音效已關閉' : '音效已開啟'); break;
    case 'logview': UI.logView = v; UI.rkOpen = null; render(); window.scrollTo(0, 0); break;
    case 'rkopen': UI.rkOpen = UI.rkOpen === +v ? null : +v; render(); break;
    case 'seeranks': UI.opened = false; UI.tankEdit = false; UI.tankView = ''; UI.tab = 'log'; UI.logView = 'ranks'; render(); window.scrollTo(0, 0); nextChest(); break;
    case 'chestpool':UI.chestOpen = UI.chestOpen === v ? '' : v; render(); break;
    case 'fact': UI.sheet = { creature: v }; renderSheet(); break;
    case 'pdone': {
      const it = getPlan(viewDay())[v];
      if (UI.pday > 0) break;
      if (!it.text.trim()) { toast('先寫下這件事'); render(); break; }
      it.done = !it.done;
      if (it.done && UI.pday === 0) S.introNextTask = false;
      if (it.done) { ac(); SFX.tap(); }
      reward(() => {}, UI.pday === 0);
      break;
    }
    case 'plansave': {
      const d = viewDay();
      if (filled(getPlan(d)).length < CONFIG.rewardRows) { toast(`至少寫下 ${CONFIG.rewardRows} 件事`); break; }
      if (d < dayKey() || derive().claimed.has('plan:' + d)) break;
      const ahead = d > dayKey();
      ac(); reward(() => grant('plan', null, { key: 'plan:' + d, title: ahead ? '明天的清單寫好了！' : '今天的清單寫好了！' })); break;
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
    case 'clouddeleteconfirm': cloudDeleteConfirmed(); break;
    case 'clouddeleteback': CLOUD.deleteArmed = null; renderCloud(); break;
    case 'clouddeletioncancel': resumeCloudSync(); break;
    case 'prerestore': cloudRestorePre(); break;
    case 'predrop': cloudDropPre(); break;
    case 'tankedit': beginTankSelection(); render(); break;
    case 'tankfilterclear': UI.tankFilters = { location: '', growth: '', species: '' }; applyTankFilters(); document.querySelector('[data-tank-filter]')?.focus(); break;
    case 'selectopen': openTankFilter(v); break;
    case 'selectpick': {
      const select = document.getElementById(b.dataset.selectId);
      if (!select || select.disabled || ![...select.options].some(option => option.value === v && !option.disabled)) break;
      closeTankFilter(); select.value = v;
      select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true }));
      const current = document.getElementById(select.id), wrapper = current?.closest('.native-dropdown');
      if (wrapper) {
        const trigger = wrapper.querySelector('[data-tank-filter]'), text = current.selectedOptions[0]?.textContent || '';
        trigger.querySelector('.filter-value').textContent = text; trigger.setAttribute('aria-label', trigger.getAttribute('aria-label').split('：')[0] + '：' + text);
        for (const option of wrapper.querySelectorAll('[data-act=selectpick]')) { const selected = option.dataset.v === current.value; option.setAttribute('aria-checked', String(selected)); option.querySelector('.filter-check').textContent = selected ? '✓' : ''; }
        trigger.focus();
      }
      break;
    }
    case 'tankfilteropen':
      if (UI.tankEdit && TANK_FILTER_LABELS[v]) { b.focus(); openTankFilter(v); }
      break;
    case 'tankfilterpick': {
      const key = b.dataset.key;
      if (!UI.tankEdit || !key || !tankFilterOptions(key).some(([value]) => value === v)) break;
      UI.tankFilters[key] = v; applyTankFilters(); closeTankFilter(true); break;
    }
    case 'seamanage': UI.opened = false; UI.tab = 'tank'; UI.tankView = ''; beginTankSelection(); render(); nextChest(); break;
    case 'tankview': UI.tankView = v; render(); window.scrollTo(0, 0); break;
    // 任務頁點未完成的任務：跳到「今日」頁對應的區塊（六件事、習慣、番茄鐘）
    case 'goto': { const [id, pd] = v.split(':'); UI.tab = 'today'; UI.pday = +pd || 0; render(); const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); } break;
    case 'intank': {
      if (!UI.tankEdit) { b.checked = false; break; }
      if (UI.tankDraftState !== S || !tankOwned().some(l => l.id === v)) { tankSelectionDraft(); render(); toast('資料已更新，請重新確認選擇'); break; }
      const draft = tankSelectionDraft();
      if (b.checked && !draft.includes(v)) {
        if (draft.length >= TANK_LIMIT) { toast(`已選滿 ${TANK_LIMIT} 隻，先取消一隻再替換`); refreshTankSelection(); break; }
        draft.push(v);
      } else if (!b.checked) UI.tankDraft = draft.filter(id => id !== v);
      refreshTankSelection(); break;
    }
    case 'release': {
      const state = S, lg = tankOwned().find(l => l.id === v), c = lg && CR[lg.drop]; if (!c) break;
      const p = pets(c.id).find(x => x.id === v), st = p ? `（${stageName(c, stageOf(p.fed))}，吃了 ${p.fed} 顆）` : '';
      const nm = petName(v);
      if (!(await ask(`讓這隻${c.name}${nm ? `「${nm}」` : ''}${st}永久游走？\n放走後無法復原，圖鑑紀錄會保留。只想換展示生物，取消勾選留在收藏即可。`, '讓牠游走'))) break;
      if (S !== state || !releaseTankPet(v)) { toast('資料已更新，請重新確認生物'); render(); break; }
      save(); render(); renderSheet(); toast(`${nm || c.name}游走了`); break;
    }
    case 'releasepick': {
      const lg = S.logs.find(l => l.id === v), nm = petName(v);
      const current = UI.cur;
      if (!current || !current.release || current.releaseState !== S || !lg || lg.drop !== current.release || !releaseTankPet(v)) {
        UI.opened = false;
        if (current && current.release && pets(current.release).length > MAX_PETS) Q.unshift({release:current.release,newId:current.newId});
        render(); nextChest(); toast('資料已更新，請重新確認生物'); break;
      }
      save();
      UI.opened = false; render(); nextChest(); toast(`${nm || CR[lg.drop].name}游走了`); break;
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
    case 'carry': case 'carryall': {   // 昨天沒做完的帶到今天：填進今天的空格（分類一起帶過來），格子不夠就帶到滿為止
      const P = getPlan(dayKey()), left = carryLeft(P), Y = S.plans[addDays(dayKey(), -1)] || [];
      const pick = b.dataset.act === 'carryall' ? left : [left[+v]].filter(Boolean);
      let n = 0;
      for (const t of pick) {
        const slot = P.find(x => !x.text.trim()); if (!slot) break;
        Object.assign(slot, { text: t, cat: (Y.find(x => x.text.trim() === t) || {}).cat || 'other', done: false }); n++;
      }
      if (!n) { toast('六格都寫滿了'); break; }
      UI.showRows = Math.max(UI.showRows || 0, P.reduce((a, x, i) => x.text.trim() ? i + 1 : a, 0));
      save(); render(); toast(n < pick.length ? `帶入 ${n} 件，六格寫滿了` : `帶入 ${n} 件`); break;
    }
    case 'petname': {
      UI.nameEdit = UI.nameEdit === v ? null : v; render();
      const i = document.querySelector('input[data-nf]'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) {} }
      break;
    }
    case 'petnamedone': UI.nameEdit = null; render(); break;
    case 'tankcancel': closeTankSelection(); render(); break;
    case 'tankdone': {
      if (!UI.tankEdit) break;
      if (UI.tankDraftState !== S) { tankSelectionDraft(); render(); toast('資料已更新，請確認展示選擇後再完成'); break; }
      if (!setTankSelection(tankSelectionDraft())) { toast(`最多展示 ${TANK_LIMIT} 隻，請重新選擇`); break; }
      save(); closeTankSelection(); render(); toast('大海已更新'); break;
    }
    case 'buyfeed': {
      if (derive().coins < FEED.price) { toast(`金幣不夠，飼料要 ${FEED.price} 金幣`); break; }
      S.logs.push({ id: rid(), t: Date.now(), d: dayKey(), k: 'redeem', name: `飼料 ${FEED.pack} 顆`, c: -FEED.price });
      S.feed = (S.feed || 0) + FEED.pack; save(); SFX.buy(); toast(`買了 ${FEED.pack} 顆飼料`);
      if (UI.tab === 'tank') { renderStat(); const el = document.getElementById('feedInfo'); if (el) el.innerHTML = tankFeedHTML(); }
      else render();
      break;
    }
    case 'buyfreeze': {
      const D = derive(), F = CONFIG.freeze;
      if (freezeLeft(D) >= F.max) { toast(`保護卡最多帶 ${F.max} 張`); break; }
      if (D.coins < F.price) { toast(`金幣不夠，保護卡要 ${F.price} 金幣`); break; }
      S.logs.push({ id: rid(), t: Date.now(), d: dayKey(), k: 'redeem', name: '連勝保護卡', freeze: 1, c: -F.price });
      save(); catchUp(); render(); SFX.buy(); toast('🛡 買了一張連勝保護卡'); break;   // 昨天剛漏掉的話，馬上補上
    }
    case 'meetfish':
      if (!introTasksReady()) { toast('先寫下今天的一件事'); break; }
      UI.tab = 'today'; UI.pday = 0;
      S.introPending = false; S.introFeedPending = true;
      if (!derive().claimed.has('welcome')) reward(() => grant('welcome', null, { key: 'welcome' }));
      else { save(); render(); }
      break;
    case 'introbackup':
      if (!S.introCompleteNotice || !FIREBASE_CONFIG || CLOUD.user || IN_APP) break;
      S.introCompleteNotice = false; S.backupNudgeDismissed = true; save();
      UI.tab = 'about'; render(); cloudLogin(true); break;
    case 'introfinish': S.backupNudgeDismissed = true; S.introCompleteNotice = false; S.introNextTask = getPlan(dayKey()).some(it => it.text.trim() && !it.done); save(); UI.tab = 'today'; render(); scrollToIntroTask(); break;
    case 'seagoto': UI.opened = false; UI.tab = 'tank'; closeTankSelection(); UI.tankView = ''; render(); nextChest(); break;
    case 'backuplater': S.backupNudgeDismissed = true; save(); render(); break;
    case 'backupinvite': UI.tab = 'about'; render(); document.getElementById('cloudBox')?.scrollIntoView(); break;
    case 'cloudbackuprestore': { const backup = cloudChoiceBackup(); if (backup && await ask('改用選擇前的雲端紀錄？目前紀錄會先另存備份。', '還原雲端紀錄')) { restoreWithFeedback(backup.s, context, '已還原備份'); } break; }
    case 'cloudchoose': chooseCloud(v); break;
    case 'syncbackuprestore': { const backup = syncBackup(); if (backup && await ask('改用同步前的本機紀錄？目前的紀錄會先另存備份。', '還原本機紀錄')) { restoreWithFeedback(backup.s, context, '已還原備份'); } break; }
    case 'cloudretry': if (!CLOUD.ready) { CLOUD.error = ''; cloudInit(); } else if (CLOUD.pending) cloudPush(); else cloudPull(false); break;
    case 'autodismiss': S.autoSeen = dayKey(); UI.autoNotice = null; save(); render(); break;
    case 'feedkeyboard': {
      const cv = document.getElementById('tank'); if (!cv) break;
      const r = cv.getBoundingClientRect(), fish = S.introFeedPending && TANK.fish?.find(f => f.c.id === 'clown');
      const x = fish ? (fish.x + fish.w / 2) / TANK.W : .5, y = fish ? (fish.y + fish.h / 2) / TANK.H : .4;
      cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * x, clientY: r.top + r.height * y })); break;
    }
    case 'backupundo': {
      let stored; try { stored = JSON.parse(localStorage.getItem(KEY + '.before-import')); } catch (_) {}
      if (!stored || !(await ask('復原上次還原前的紀錄？目前紀錄也會另存一份。', '復原'))) break;
      restoreWithFeedback(stored, context, '已復原上次還原');
      break;
    }
    case 'copydiagnostics': copyDiagnostics(); break;
    case 'import': document.getElementById('importFile').click(); break;
  }
});
// 鍵盤：Enter／空白鍵可以「按」不是按鈕的可點元素（見 views.js render）
document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && !/^(BUTTON|INPUT|SELECT|A)$/.test(t.tagName)) { e.preventDefault(); t.click(); }
});
// 點彈窗外面的暗色區域就關閉面板
document.getElementById('sheetov').addEventListener('click', e => { if (e.target.id === 'sheetov') { UI.sheet = null; renderSheet(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI.tankFilterOpen) { e.preventDefault(); closeTankFilter(true); return; }
  if ((e.key === 'Enter' || e.key === 'Escape') && e.target.dataset && e.target.dataset.nf) { e.preventDefault(); UI.nameEdit = null; render(); return; }
  if (!document.getElementById('askov').classList.contains('hidden') && ask.res) {
    if (e.key === 'Enter') { e.preventDefault(); ask.res(true); }
    if (e.key === 'Escape') { e.preventDefault(); ask.res(false); }
  } else if (e.key === 'Escape' && UI.sheet) { UI.sheet = null; renderSheet(); }
});
// 六件事拖曳排序：按住編號往上或往下拖，放開就移到那個位置（只點一下還是「點兩個編號交換」）
const DRAG = { i: null, y0: 0, moved: false, to: null, until: 0, mids: [] };
const DRAG_REACH = .3;   // 拖過相鄰那一列的 30% 就換過去（以前要拖過一半以上），不用拖得很剛好
document.addEventListener('pointerdown', e => {
  const b = eventElement(e)?.closest('#six .prow .no'); if (!b || UI.pday < 0) return;
  const mids = [...document.querySelectorAll('#six .prow')].map(r => { const q = r.getBoundingClientRect(); return q.top + q.height / 2; });   // 還沒移動時每一列的中心
  Object.assign(DRAG, { i: +b.dataset.v, y0: e.clientY, moved: false, to: +b.dataset.v, mids });
  try { b.setPointerCapture(e.pointerId); } catch (_) {}
});
document.addEventListener('pointermove', e => {
  if (DRAG.i == null) return;
  if (!DRAG.moved && Math.abs(e.clientY - DRAG.y0) < 8) return;
  DRAG.moved = true;
  const rows = [...document.querySelectorAll('#six .prow')], m = DRAG.mids, c = m[DRAG.i] + e.clientY - DRAG.y0;   // c＝被拖的那一列現在的中心
  let to = DRAG.i;
  if (c >= m[to]) while (to < m.length - 1 && c > m[to] + DRAG_REACH * (m[to + 1] - m[to])) to++;   // 往下拖
  else while (to > 0 && c < m[to] - DRAG_REACH * (m[to] - m[to - 1])) to--;                       // 往上拖
  DRAG.to = to;
  rows.forEach((r, k) => { r.classList.toggle('drag', k === DRAG.i); r.classList.toggle('over', k === DRAG.to && k !== DRAG.i); });
  rows[DRAG.i].style.transform = `translateY(${e.clientY - DRAG.y0}px)`;
});
document.addEventListener('pointerup', () => {
  if (DRAG.i == null) return;
  const { i, to, moved } = DRAG; DRAG.i = null;
  if (!moved) return;
  releaseTouchRender();
  DRAG.until = performance.now() + 350;   // 拖完放開時緊接著的 click 不要再當成「點編號交換」（觸控拖曳不會有 click，所以只擋一下子）
  if (to === i) { render(); return; }
  const P = getPlan(viewDay()); P.splice(to, 0, P.splice(i, 1)[0]); UI.swap = null;
  reward(() => {}, UI.pday === 0); toast(`移到第 ${to + 1} 件`);
});
document.addEventListener('pointercancel', () => { if (DRAG.i == null) return; DRAG.i = null; render(); });   // 系統中斷了手勢：放棄這次拖曳，回到原位
document.addEventListener('click', e => { if (performance.now() < DRAG.until && eventElement(e)?.closest('.prow .no')) { DRAG.until = 0; e.stopPropagation(); e.preventDefault(); } }, true);
// 基本下拉清單：不開彈窗，方向鍵移焦點，Escape／Tab收起。
document.addEventListener('keydown', e => {
  const target = eventElement(e), trigger = target?.closest('[data-tank-filter]');
  if (trigger && ['ArrowDown','ArrowUp'].includes(e.key)) {
    e.preventDefault(); if (UI.tankFilterOpen !== trigger.dataset.tankFilter) openTankFilter(trigger.dataset.tankFilter);
    const options = [...document.querySelectorAll(`[data-filter-menu="${UI.tankFilterOpen}"] button`)];
    (e.key === 'ArrowUp' ? options.at(-1) : options[0])?.focus(); return;
  }
  if (!UI.tankFilterOpen) return;
  if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); closeTankFilter(true); return; }
  if (!target?.closest('.filter-menu')) return;
  const options = [...document.querySelectorAll(`[data-filter-menu="${UI.tankFilterOpen}"] button`)], index = options.indexOf(target.closest('button'));
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : ['ArrowDown','ArrowRight'].includes(e.key) ? (index + 1) % options.length : ['ArrowUp','ArrowLeft'].includes(e.key) ? (index + options.length - 1) % options.length : -1;
  if (next >= 0) { e.preventDefault(); options[next].focus(); }
});
document.addEventListener('click', e => { if (UI.tankFilterOpen && !eventElement(e)?.closest('.tank-filter-control')) closeTankFilter(); });
document.addEventListener('focusin', e => { if (UI.tankFilterOpen && !eventElement(e)?.closest('.tank-filter-control')) closeTankFilter(); });
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
  if (el.id === 'exType') { if (stashExerciseDraft() === false) return; const draft = exerciseDraft(); if (!draft) return; draft.type = ETAGS.includes(el.value) ? el.value : ETAGS[0]; renderSheet(); return; }
  if (el.id && el.id.startsWith('ex_')) {
    stashExerciseDraft();
    const g = k => { const i = document.getElementById('ex_' + k); return i ? +i.value : 0; };
    const p = document.getElementById('exPace');
    if (p) p.textContent = paceText({ type: document.getElementById('exType').value, dist: g('dist'), m: g('m'), min: g('min') });
    return;
  }
  if (el.dataset.introIndex !== undefined) {
    const index = Number(el.dataset.introIndex);
    if (!S.introPending || !Number.isInteger(index) || index < 0 || index > 2) return;
    getPlan(dayKey())[index].text = el.value.slice(0, 200); save();
    const button = document.querySelector('#onb [data-act=meetfish]'); if (button) button.disabled = !introTasksReady();
    const box = document.getElementById('onbbox'); if (box) box.dataset.h = introTasks();
    return;
  }
  if (el.dataset.onb) { UI.onbName = el.value; renderOnbButton(); return; }
  if (el.dataset.nf) { setPetName(el.dataset.nf, el.value); return; }
  if (el.dataset.sf) { const it = S.shop && S.shop[el.dataset.si]; if (it) { it[el.dataset.sf] = el.dataset.sf === 'price' ? +el.value : el.value; save(); } return; }
  if (el.dataset.gf) { const g = S.gcats && S.gcats[el.dataset.gi]; if (g) { g[el.dataset.gf] = el.value; save(); } return; }
  if (el.dataset.hf) {
    const h = S.habits[el.dataset.hi], f = el.dataset.hf;
    if (!h) return;
    h[f] = f === 'weeks' || f === 'target' ? +el.value : el.value;
    save(); if (f === 'weeks') render();
    return;
  }
  if (i === undefined || !el.dataset.pf) return;
  const it = getPlan(viewDay())[i];
  it[el.dataset.pf] = el.value; if (el.tagName === 'TEXTAREA') { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px'; } const firstButton = document.querySelector('[data-act=meetfish]'); if (firstButton) firstButton.disabled = !filled(getPlan(dayKey())).length;
  if (el.dataset.pf === 'cat') render();
  save();
});
document.getElementById('importFile').addEventListener('change', async e => {
  const context = dataContext();
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    if (f.size > 10 * 1024 * 1024) throw new Error('備份檔過大');
    const j = JSON.parse(await f.text());
    if (!sameDataContext(context)) { toast('帳號已變更，請重新選擇檔案'); return; }
    const candidate = prepareBackup(j);
    if (await ask(`備份檔有 ${j.logs.length} 筆紀錄，目前有 ${S.logs.length} 筆。\n還原會取代目前紀錄，取代前會先保留一份本機副本。\n確定還原？`, '還原')) {

      if (restoreBackup(candidate, context)) toast('已還原');
    }
  } catch (err) { UI.backupError = err.message === '備份檔過大' ? '檔案超過 10 MiB，請選擇較小的備份。' : err.name === 'QuotaExceededError' ? '此裝置的儲存空間不足，原紀錄已保留。請先下載備份。' : '這不是有效的備份檔，或資料無法還原；目前紀錄已保留。'; renderBackupSection(true); toast(UI.backupError); }
});

// 另一個分頁存了新的紀錄：這一頁跟上（正在打字就等放開輸入框再重畫，免得打到一半被洗掉）
let syncPending = false;
function refreshFromStorage() {
  if (!syncFromStorage()) return;
  renderStat(); renderFocus();   // 上方的金幣、等級和專注畫面不受輸入框影響，馬上更新
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { syncPending = true; return; }
  render(); renderSheet(); tick();
}
window.addEventListener('storage', e => {
  if (!e.key || e.key === KEY) refreshFromStorage();
  if (!e.key || ACCOUNT_BACKUPS.some(suffix => e.key === KEY + suffix)) renderBackupSection();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshFromStorage(); });
document.addEventListener('focusout', () => { if (syncPending) { syncPending = false; setTimeout(() => { render(); if (!UI.sheet || habit(UI.sheet.id)?.kind !== 'exercise') renderSheet(); tick(); }, 0); } });

/* ========= 啟動 ========= */
// 新手禮物、恢復雲端登入、補發每日獎勵：一次性，引導做完才開始
let GAME_STARTED = false, GAME_READY = false;
function startGame() {
  if (GAME_STARTED) return; GAME_STARTED = true;
  if (!S.introPending && !derive().claimed.has('welcome')) { grant('welcome', null, { key: 'welcome' }); save(); render(); nextChest(); }
  // 這台裝置之前登入過雲端同步，就自動恢復登入
  if (S.cloudUid) cloudInit(); else catchUp();
}
(function init() {
  document.getElementById('logo').innerHTML = img(CR.clown.px, 3);
  const bub = document.getElementById('bubbles');
  for (let i = 0; i < 10; i++) {
    const s = 3 + (i % 3) * 2;
    bub.insertAdjacentHTML('beforeend', `<i style="left:${(i * 37 + 7) % 100}%;width:${s}px;height:${s}px;animation-duration:${9 + (i * 7) % 11}s;animation-delay:-${(i * 3) % 13}s"></i>`);
  }
  if (compactIfLarge()) save(false);   // 存檔太大時先瘦身（見 core.js）
  render(); tick();
  setInterval(tick, 500);
  GAME_READY = true;
  if (!needOnb()) startGame();   // 第一次打開要先做引導（選習慣、綁定 Google），做完才會 startGame（render 會在引導結束時接手）
  // 跨過換日時間時重新整理畫面
  let lastDay = dayKey();
  setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); render(); } }, 30e3);
})();
