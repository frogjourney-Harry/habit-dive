// Check the same-origin release; reload only after saved, idle play.
function releaseVersion(root = document) {
  const src = root.querySelector('script[src^="js/config.js?v="]')?.getAttribute('src');
  return src ? new URL(src, document.baseURI).searchParams.get('v') || '' : '';
}
const UPDATE = {
  current: releaseVersion(),
  next: '', checked: 0, busy: false, activity: Date.now(),
  reload: () => location.reload(), session: () => sessionStorage
};
function showUpdate() {
  let box = document.getElementById('updateNotice');
  if (!box) { box = document.createElement('div'); box.id = 'updateNotice'; const anchor = document.getElementById('banner'); if (anchor) anchor.after(box); else document.body.prepend(box); }
  box.innerHTML = UPDATE.next ? '<div class="banner row" role="status"><span class="sp">有新版本，閒置時會自動更新。</span><button data-update>立即更新</button></div>' : '';
}
function safeToUpdate() {
  if (document.visibilityState !== 'visible' || !navigator.onLine || !STORAGE_OK || S.timer || UI.sheet || UI.habEdit || UI.shopEdit || UI.nameEdit || UI.tankEdit || UI.planUndo || UI.onbReturning || UI.opened || Q.length || needOnb() || visibleDialog()) return false;
  if (CLOUD.pending || CLOUD.suspended || CLOUD.deleting || CLOUD.busy || CLOUD.authPending || CLOUD.choice || CLOUD.armed || (CLOUD.deleteArmed && CLOUD.deleteArmed === CLOUD.user?.uid && UI.tab === 'about') || CLOUD.writes?.size || CLOUD.pushPromise || CLOUD.pendingIntroLogin || CLOUD.trialSaveRequested) return false;
  if (document.activeElement?.matches('input,textarea,select,[contenteditable=true]')) return false;
  try { return JSON.stringify(JSON.parse(localStorage.getItem(KEY))) === JSON.stringify(S); }
  catch (_) { return false; }
}
function applyUpdate(manual = false) {
  if (!UPDATE.next || (!manual && Date.now() - UPDATE.activity < 60000)) return false;
  if (!safeToUpdate()) { if (manual) toast('請先完成目前操作，並等待儲存與同步完成。'); return false; }
  try {
    // A failed/stale deployment must not cause a reload loop.
    const marker = KEY + '.update-attempt';
    if (UPDATE.session().getItem(marker) === UPDATE.next) { if (manual) toast('已嘗試更新，請稍後再重新整理。'); return false; }
    UPDATE.session().setItem(marker, UPDATE.next);
  } catch (_) { if (manual) toast('無法自動更新，請使用瀏覽器重新整理。'); return false; }
  UPDATE.reload(); return true;
}
async function checkUpdate(force = false) {
  if (UPDATE.busy || !/^\d{12}$/.test(UPDATE.current) || !navigator.onLine || document.visibilityState !== 'visible' || (!force && Date.now() - UPDATE.checked < 1800000)) return;
  UPDATE.checked = Date.now(); UPDATE.busy = true;
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 10000);
  try {
    const url = new URL('index.html', document.baseURI); url.searchParams.set('_release', Date.now());
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: abort.signal });
    if (!response.ok) return;
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const next = releaseVersion(page);
    if (!/^\d{12}$/.test(next || '') || next <= UPDATE.current) return;
    UPDATE.next = next; showUpdate(); applyUpdate();
  } catch (_) { /* Offline or failed checks leave current play untouched. */ }
  finally { clearTimeout(timeout); UPDATE.busy = false; }
}
for (const event of ['pointerdown', 'keydown', 'input', 'wheel', 'scroll']) document.addEventListener(event, () => { UPDATE.activity = Date.now(); }, { capture: true, passive: true });
document.addEventListener('click', event => { if (event.target.closest('[data-update]')) applyUpdate(true); });
// Preview/test frames are isolated; their tests explicitly invoke the functions.
if (window.top === window.self && /^https?:$/.test(location.protocol)) {
  setTimeout(checkUpdate, 15000);
  setInterval(() => { checkUpdate(); applyUpdate(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { UPDATE.activity = Date.now(); checkUpdate(); } });
  window.addEventListener('online', () => checkUpdate(true));
}
