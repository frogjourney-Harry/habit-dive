// 共用的體驗回饋、備份與彈窗操作。
const introTasksReady = () => getPlan(dayKey()).slice(0, 3).some(it => it.text.trim());
function introTasks() {
  return `${tutorialProgress(2)}<h2>今天最重要的事</h2>
    <p class="mini">三格中填寫一格，就能領取小丑魚。</p>
    <div class="onb-tasks">${getPlan(dayKey()).slice(0, 3).map((it, i) => `<label><span class="mini">第 ${i + 1} 件事</span><textarea class="ptext" rows="1" maxlength="200" data-intro-index="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${i === 0 ? '例如：閱讀五頁書' : '也可以稍後再填'}">${esc(it.text)}</textarea></label>`).join('')}</div>
    <button class="pri wide" data-act="meetfish" ${introTasksReady() ? '' : 'disabled'}>領取小丑魚</button>`;
}
function backupNudge() {
  if (!FIREBASE_CONFIG || CLOUD.user || S.backupNudgeDismissed || S.introPending || !S.logs.some(l => ['check','habit','pomo'].includes(l.k) && !l.pend)) return '';
  return `<section class="px"><b>想在其他裝置接著玩？</b><p class="mini">可用 Google 備份紀錄。未備份時，清除瀏覽資料可能讓紀錄消失。</p><button data-act="backupinvite">登入備份</button><button class="ghost" data-act="backuplater">稍後</button></section>`;
}
function settlePastRewards() {
  const today = dayKey(); let changed = false;
  for (const l of S.logs) if (l.pend && l.d < today) { delete l.pend; l.auto = true; changed = true; }
  UI.autoNotice = null; const unseen = S.logs.filter(l => l.auto && l.d < today && (!S.autoSeen || l.d >= S.autoSeen));
  if (unseen.length && S.autoSeen !== today) UI.autoNotice = { c: unseen.reduce((n,l)=>n+(l.c||0),0), xp: unseen.reduce((n,l)=>n+(l.xp||0),0) };
  return changed;
}
function autoNoticeCard() {
  const n = UI.autoNotice; if (!n) return '';
  return `<section class="px" role="status"><b>先前未領的獎勵已自動入帳</b><div>+${n.c} 金幣・+${n.xp} XP</div><button class="ghost" data-act="tab" data-v="log">查看來源</button><button class="ghost" data-act="autodismiss">知道了</button></section>`;
}
// 保留最近十二筆的查閱範圍，首頁只露出少量紀錄。
function compactHistory(rows, count) {
  return rows.slice(0, count).join('') + (rows.length > count
    ? `<details class="more-detail"><summary>查看較早的 ${rows.length - count} 筆</summary>${rows.slice(count).join('')}</details>` : '');
}
function rewardHistory() {
  const names = { check:'完成事項',habit:'習慣打卡',plan:'寫好清單',top3:'完成三件加碼',period:'習慣達標',weekly:'運動達標',anyhab:'完成習慣',pomo:'專注完成',login:'每日登入',welcome:'新手禮物',sum:'每日合計' };
  const logs = S.logs.filter(l => l.c > 0 && names[l.k]).slice(-12).reverse();
  const rows = logs.map(l=>`<div class="entry"><span class="sp">${esc(l.d)}・${names[l.k]}<small class="reward-state">${isPendingReward(l)?'待領取':l.auto?'已自動入帳':'已入帳'}</small></span><span class="coin">+${l.c}</span></div>`);
  return `<section class="px">${sh('獎勵紀錄', '')}${compactHistory(rows, 3) || '<div class="mini">完成第一件事後，這裡會留下獎勵紀錄。</div>'}</section>`;
}
// 非同步讀檔與確認操作只對開始操作時的帳號有效。
function dataContext() {
  let localOwner = null; try { localOwner = localStorage.getItem(KEY + '.owner'); } catch (_) {}
  return { session: CLOUD.session, uid: CLOUD.user?.uid || null, owner: S.accountOwner || S.cloudUid || null, localOwner };
}
function sameDataContext(context) {
  if (context.session !== CLOUD.session || context.uid !== (CLOUD.user?.uid || null) || context.owner !== (S.accountOwner || S.cloudUid || null)) return false;
  try { const owner = localStorage.getItem(KEY + '.owner'); return owner === context.localOwner && (!context.owner || !owner || context.owner === owner); } catch (_) { return false; }
}
// 只更新備份內容，保留展開狀態與焦點，避免同步狀態變動打斷操作。
function renderBackupSection(open) {
  const previous = document.getElementById('backupSection'); if (!previous) return;
  const action = previous.contains(document.activeElement) ? document.activeElement.dataset.act : null;
  const focused = previous.contains(document.activeElement);
  const template = document.createElement('template'); template.innerHTML = manualBackupSection();
  const next = template.content.firstElementChild;
  next.open = (open ?? previous.open) || !!UI.backupError;
  if (previous.outerHTML === next.outerHTML) return;
  previous.replaceWith(next);
  if (focused) (action && next.querySelector(`[data-act="${action}"]`) || next.querySelector('summary')).focus({ preventScroll: true });
}
function restoreWithFeedback(data, context, message) {
  try { if (restoreBackup(prepareBackup(data), context)) { toast(message); return true; } }
  catch (_) { UI.backupError = '無法還原這份備份，目前紀錄已保留。'; renderBackupSection(true); toast(UI.backupError); }
  return false;
}
function restoreBackup(candidate, context = dataContext()) {
  if (!sameDataContext(context)) { toast('帳號已變更，請重新操作'); return false; }
  // 備份只還原遊戲資料；不還原來源帳號的登入身分與待選狀態。
  delete candidate.cloudUid; delete candidate.accountOwner; delete candidate.cloudChoicePending;
  if (context.owner) candidate.accountOwner = context.owner;
  if (context.uid) candidate.cloudUid = context.uid;
  const previous = S, backupOpen = document.getElementById('backupSection')?.open;
  try {
    S = candidate; render();
    S.mtime = Math.max(Date.now(), (previous.mtime || 0) + 1);
    localStorage.setItem(KEY + '.before-import', JSON.stringify(previous));
    localStorage.setItem(KEY, JSON.stringify(S)); STORAGE_OK = true;
  } catch (err) { S = previous; render(); renderBackupSection(backupOpen); throw err; }
  UI.backupError = ''; renderBackupSection(backupOpen);
  if (typeof cloudSchedule === 'function') cloudSchedule();
  return true;
}
function hasBackupUndo() { if (!sameDataContext(dataContext())) return false; try { return !!localStorage.getItem(KEY + '.before-import'); } catch (_) { return false; } }
function diagnosticsText() { return `習慣深潛 ${document.querySelector('script[src*="config.js"]')?.src.split('?v=')[1] || '本機版'}\n瀏覽器：${navigator.userAgent}\n畫面：${innerWidth} × ${innerHeight}\n連線：${navigator.onLine ? '線上' : '離線'}`; }
async function copyDiagnostics() {
  const t = diagnosticsText();
  try { await navigator.clipboard.writeText(t); toast('已複製版本與瀏覽器資訊，不包含清單或帳號'); }
  catch (_) { UI.diagnostics = t; render(); }
}
// 以可見的最上層彈窗為作用範圍；重畫保持相同欄位，關閉回原入口。
let activeDialog = null, dialogReturn = null;
function visibleDialog() { return ['askov','onb','ov','sheetov','focus'].map(id=>document.getElementById(id)).find(e=>e && !e.classList.contains('hidden')); }
const dialogStops = root => [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(e=>e.getClientRects().length);
function syncDialogFocus() {
  const next = visibleDialog();
  if (next === activeDialog) {
    if (next && !next.contains(document.activeElement)) (dialogStops(next)[0] || next).focus();
    return;
  }
  if (next) {
    if (!activeDialog) dialogReturn = document.activeElement;
    activeDialog = next;
    next.setAttribute('role','dialog'); next.setAttribute('aria-modal','true'); next.setAttribute('tabindex','-1');
    const heading=next.querySelector('h2,b,.label'); next.setAttribute('aria-label', heading?.textContent || '確認操作');
    (dialogStops(next)[0] || next).focus();
  } else {
    activeDialog = null;
    if (dialogReturn?.isConnected) dialogReturn.focus();
    else if (dialogReturn?.dataset?.act) document.querySelector(`[data-act="${dialogReturn.dataset.act}"]${dialogReturn.dataset.v ? `[data-v="${CSS.escape(dialogReturn.dataset.v)}"]` : ''}`)?.focus();
    dialogReturn = null;
  }
}
new MutationObserver(syncDialogFocus).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
document.addEventListener('keydown',e=>{
  const root=visibleDialog(); if (!root) return;
  if(e.key==='Tab') {
    const stops=dialogStops(root), first=stops[0], last=stops[stops.length-1];
    if (!first) { e.preventDefault(); root.focus(); }
    else if (!root.contains(document.activeElement) || (e.shiftKey && document.activeElement===first)) { e.preventDefault(); (e.shiftKey?last:first).focus(); }
    else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); }
  }
},true);
function tutorialProgress(step) {
  const labels = ['選擇習慣', '建立第一件事', '餵食小丑魚'];
  return `<div class="tutorial-progress"><div class="tutorial-label">新手導覽 · 第 ${step} 步，共 3 步</div><ol aria-label="新手導覽進度">${labels.map((label,i)=>`<li class="${i+1===step?'current':i+1<step?'complete':''}" ${i+1===step?'aria-current="step"':''}><span>${i+1<step?'✓':i+1}</span>${label}</li>`).join('')}</ol></div>`;
}
function tutorialResumeCard() {
  if (!S.introFeedPending && !S.introCompleteNotice) return '';
  return `<section class="px tutorial-resume">${tutorialProgress(3)}<b>${S.introCompleteNotice?'小丑魚已長大':'最後一步：把小丑魚餵大'}</b><p class="mini">到大海餵小丑魚，看牠長大。你也可以先安排今天。</p><button data-act="seagoto">${S.introCompleteNotice?'查看導覽完成畫面':'繼續新手導覽'}</button></section>`;
}
function scrollToIntroTask() { document.querySelector('#six .intro-target')?.scrollIntoView({ block: 'center' }); }
function tutorialSeaContents() {
  if (UI.introCelebration) return '<b>小丑魚長大了！</b><p class="mini">你已把第一隻幼魚養成成體。</p>';
  if (S.introCompleteNotice) {
    if (FIREBASE_CONFIG && !CLOUD.user && !IN_APP) {
      cloudWarm();
      return `<b>新手導覽完成！</b><p>要把進度存到 Google 帳號嗎？</p><p class="mini">已有雲端紀錄會接續原進度。</p>${loginPrivacyNotice()}<button class="pri" data-act="introbackup">用 Google 儲存進度</button><button class="ghost" data-act="introfinish">先玩看看</button>`;
    }
    return '<b>新手導覽完成！</b><p class="mini">小丑魚已長成成體，接著依自己的步調玩吧。</p><button class="pri" data-act="introfinish">完成導覽，回到今日</button>';
  }
  return '';
}
function tutorialSeaCard() {
  return S.introCompleteNotice ? `<section class="sea-guide" aria-live="polite">${tutorialSeaContents()}</section>` : '';
}
function markTutorialFed(petId) {
  const pet = S.logs.find(l => l.k === 'welcome' && l.drop === 'clown');
  if (!S.introFeedPending || petId !== pet?.id || stageOf(fedOf(petId)) < 2) return;
  S.introFeedPending = false; S.introCompleteNotice = true;
  const celebration = UI.introCelebration = {}, context = dataContext();
  document.querySelector('.seacoach')?.remove();
  const guide = document.querySelector('.sea-guide');
  if (guide) guide.innerHTML = tutorialSeaContents();
  else document.querySelector('.sea')?.insertAdjacentHTML('beforeend', tutorialSeaCard());
  // 吃到飼料的實際結果由水族箱迴圈保存；長成成體後先留一段時間看見成果。
  setTimeout(() => {
    if (UI.introCelebration !== celebration) return;
    delete UI.introCelebration;
    if (!sameDataContext(context) || !S.introCompleteNotice) return;
    const current = document.querySelector('.sea-guide'); if (current) current.innerHTML = tutorialSeaContents();
  }, 1200);
}
