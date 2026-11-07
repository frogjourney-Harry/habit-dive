// 共用的體驗回饋、備份與彈窗操作。
function introCard() {
  if (!S.introPending) return '';
  return `<div class="first-step"><p class="mini">輸入會自動儲存，這件事會留在你的日常清單。寫好後按下一步，領取小丑魚。</p><button class="pri" data-act="meetfish" ${filled(getPlan(dayKey())).length ? '' : 'disabled'}>下一步：領取小丑魚</button></div>`;
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
function rewardHistory() {
  const names = { check:'完成事項',habit:'習慣打卡',plan:'寫好清單',top3:'完成三件加碼',period:'習慣達標',weekly:'運動達標',anyhab:'完成習慣',pomo:'專注完成',login:'每日登入',welcome:'新手禮物',sum:'每日合計' };
  const logs = S.logs.filter(l => l.c > 0 && names[l.k]).slice(-12).reverse();
  return `<section class="px">${sh('獎勵紀錄', '')}<div class="mini">最近十二筆；午夜未領取的獎勵會自動入帳。</div>${logs.map(l=>`<div class="entry"><span class="sp">${esc(l.d)}・${names[l.k]}<small class="reward-state">${isPendingReward(l)?'待領取':l.auto?'已自動入帳':'已入帳'}</small></span><span class="coin">+${l.c}</span></div>`).join('') || '<div class="mini">完成第一件事後，這裡會留下獎勵紀錄。</div>'}</section>`;
}
function restoreBackup(candidate) {
  const previous = S;
  try {
    S = candidate; render();
    S.mtime = Math.max(Date.now(), (previous.mtime || 0) + 1);
    localStorage.setItem(KEY + '.before-import', JSON.stringify(previous));
    localStorage.setItem(KEY, JSON.stringify(S)); STORAGE_OK = true;
  } catch (err) { S = previous; render(); throw err; }
  UI.backupError = ''; if (typeof cloudSchedule === 'function') cloudSchedule();
}
function hasBackupUndo() { try { return !!localStorage.getItem(KEY + '.before-import'); } catch (_) { return false; } }
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
  return `<section class="px tutorial-resume">${tutorialProgress(3)}<b>${S.introCompleteNotice?'你已完成第一次餵食':'還差最後一步：試著餵魚'}</b><p class="mini">到大海完成這段導覽，再開始安排今天。</p><button data-act="seagoto">${S.introCompleteNotice?'查看導覽完成畫面':'繼續新手導覽'}</button></section>`;
}
function tutorialSeaContents() {
  return S.introCompleteNotice ? `<b>新手導覽完成！</b><p class="mini">你已認識習慣與清單，並撒下第一顆飼料。魚吃到飼料就會慢慢長大。</p><button class="pri" data-act="introfinish">完成導覽，回到今日</button>` : `${tutorialProgress(3)}<b>最後一步：餵食小丑魚</b><p class="mini">點一下水裡撒飼料，也可以按下方按鈕。每天有 10 顆免費飼料。</p><p class="mini">不用每天餵，牠們不會餓死，成長進度也不會倒退。餵食只是讓牠們長大。</p><button class="pri" data-act="feedkeyboard">試著撒一顆飼料</button>`;
}
function tutorialSeaCard() {
  return S.introFeedPending || S.introCompleteNotice ? `<section class="sea-guide" aria-live="polite">${tutorialSeaContents()}</section>` : '';
}
function markTutorialFed() {
  if (!S.introFeedPending) return;
  S.introFeedPending = false; S.introCompleteNotice = true; save();
  const guide = document.querySelector('.sea-guide'); if (guide) guide.innerHTML = tutorialSeaContents();
}