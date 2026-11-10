// Check releases without interrupting play; auto-apply only just after returning.
function releaseVersion(root = document) {
  const src = root.querySelector('script[src^="js/config.js?v="]')?.getAttribute('src');
  return src ? new URL(src, document.baseURI).searchParams.get('v') || '' : '';
}
const UPDATE = {
  current: releaseVersion(),
  next: '', checked: -Infinity, returnChecked: -Infinity, busy: false,
  hiddenAt: null, hiddenWall: null, epoch: 0, interactions: 0, reloading: false,
  now: () => performance.now(), reload: () => location.reload(), session: () => sessionStorage
};
const UPDATE_CHECK_MS = 30 * 60000, UPDATE_RETURN_CHECK_MS = 5 * 60000;
const UPDATE_AWAY_MS = 60000, UPDATE_RETURN_WINDOW_MS = 2000;
function showUpdate() {
  let box = document.getElementById('updateNotice');
  if (!box) { box = document.createElement('div'); box.id = 'updateNotice'; const anchor = document.getElementById('banner'); if (anchor) anchor.after(box); else document.body.prepend(box); }
  const html = UPDATE.next ? '<div class="banner row" role="status"><span class="sp">有新版本</span><button data-update>更新</button></div>' : '';
  if (box.innerHTML !== html) box.innerHTML = html;
}
function safeToUpdate() {
  if (document.visibilityState !== 'visible' || !navigator.onLine || !STORAGE_OK || S.timer || UI.sheet || UI.habEdit || UI.shopEdit || UI.nameEdit || UI.tankEdit || UI.planUndo || UI.onbReturning || UI.opened || Q.length || needOnb() || visibleDialog()) return false;
  if (CLOUD.pending || CLOUD.suspended || CLOUD.deleting || CLOUD.busy || CLOUD.authPending || CLOUD.choice || CLOUD.armed || (CLOUD.deleteArmed && CLOUD.deleteArmed === CLOUD.user?.uid && UI.tab === 'about') || CLOUD.writes?.size || CLOUD.pushPromise || CLOUD.pendingIntroLogin || CLOUD.trialSaveRequested) return false;
  if (document.activeElement?.matches('input,textarea,select,[contenteditable=true]')) return false;
  try { return JSON.stringify(JSON.parse(localStorage.getItem(KEY))) === JSON.stringify(S); }
  catch (_) { return false; }
}
function applyUpdate(manual = false, opportunity = null) {
  if (!UPDATE.next || UPDATE.reloading) return false;
  if (!manual && (!opportunity || opportunity.epoch !== UPDATE.epoch || opportunity.interactions !== UPDATE.interactions || UPDATE.now() - opportunity.at > UPDATE_RETURN_WINDOW_MS)) return false;
  if (!safeToUpdate()) { if (manual) toast('請先完成目前操作，並等待儲存與同步完成。'); return false; }
  try {
    // A failed/stale deployment must not cause a reload loop.
    const storage = UPDATE.session(), marker = KEY + '.update-attempt';
    let attempt = null; try { attempt = JSON.parse(storage.getItem(marker)); } catch (_) {}
    if (!manual && attempt?.version === UPDATE.next && Date.now() - attempt.time < 15 * 60000) return false;
    storage.setItem(marker, JSON.stringify({ version: UPDATE.next, time: Date.now() }));
    storage.setItem(KEY + '.update-view', JSON.stringify({ version: UPDATE.next, tab: UI.tab, scroll: scrollY, time: Date.now() }));
  } catch (_) { if (manual) toast('無法自動更新，請使用瀏覽器重新整理。'); return false; }
  UPDATE.reloading = true;
  try { UPDATE.reload(); setTimeout(() => { UPDATE.reloading = false; }, 5000); return true; }
  catch (_) { UPDATE.reloading = false; try { UPDATE.session().removeItem(KEY + '.update-view'); } catch (_) {} if (manual) toast('更新失敗，請使用瀏覽器重新整理。'); return false; }
}
async function checkUpdate(force = false, opportunity = null, returning = false) {
  if (UPDATE.busy || !/^\d{12}$/.test(UPDATE.current) || !navigator.onLine || document.visibilityState !== 'visible' || (!force && UPDATE.now() - UPDATE.checked < UPDATE_CHECK_MS)) return;
  UPDATE.checked = UPDATE.now(); if (returning) UPDATE.returnChecked = UPDATE.checked;
  UPDATE.busy = true;
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 10000);
  try {
    const url = new URL('index.html', document.baseURI); url.searchParams.set('_release', Date.now());
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: abort.signal });
    if (!response.ok) return;
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const next = releaseVersion(page);
    if (!/^\d{12}$/.test(next || '') || next <= UPDATE.current) return;
    UPDATE.next = next;
    if (document.visibilityState !== 'visible') return;
    showUpdate();
    if (opportunity) applyUpdate(false, opportunity);
  } catch (_) { /* Offline or failed checks leave current play untouched. */ }
  finally { clearTimeout(timeout); UPDATE.busy = false; }
}
function resumeUpdate(fromCache = false) {
  if (document.visibilityState !== 'visible') return;
  if (UPDATE.next) showUpdate();
  const now = UPDATE.now(), hiddenAt = UPDATE.hiddenAt;
  const away = UPDATE.hiddenWall === null ? now - hiddenAt : Math.max(0, Date.now() - UPDATE.hiddenWall);
  UPDATE.hiddenAt = null; UPDATE.hiddenWall = null;
  if (hiddenAt === null && !fromCache) return checkUpdate();
  const opportunity = hiddenAt !== null && away >= UPDATE_AWAY_MS
    ? { epoch: ++UPDATE.epoch, interactions: UPDATE.interactions, at: now } : null;
  if (opportunity && applyUpdate(false, opportunity)) return;
  if (now - UPDATE.returnChecked < UPDATE_RETURN_CHECK_MS) return;
  return checkUpdate(true, opportunity, true);
}
function updatePageHide() {
  if (UPDATE.hiddenAt === null) { UPDATE.hiddenAt = UPDATE.now(); UPDATE.hiddenWall = Date.now(); }
  UPDATE.epoch++;
}
function updateVisibility() {
  if (document.visibilityState === 'hidden') updatePageHide();
  else return resumeUpdate();
}
function restoreUpdateView() {
  let view;
  try { const storage = UPDATE.session(); view = JSON.parse(storage.getItem(KEY + '.update-view')); storage.removeItem(KEY + '.update-view'); }
  catch (_) { return false; }
  if (!view || !/^\d{12}$/.test(view.version || '') || !Number.isFinite(view.time) || Date.now() - view.time < 0 || Date.now() - view.time > 5 * 60000 || !['today', 'quest', 'tank', 'shop', 'log', 'about'].includes(view.tab)) return false;
  if (needOnb() || visibleDialog() || UI.sheet || UI.habEdit || UI.shopEdit || UI.tankEdit) return false;
  UI.tab = view.tab; render();
  const interactions = UPDATE.interactions;
  requestAnimationFrame(() => { if (UPDATE.interactions === interactions && UI.tab === view.tab && Number.isFinite(view.scroll)) window.scrollTo(0, Math.max(0, view.scroll)); });
  if (UPDATE.current >= view.version) toast('已更新到最新版本');
  return true;
}
for (const event of ['pointerdown', 'click', 'keydown', 'input', 'change', 'wheel', 'scroll']) document.addEventListener(event, () => { UPDATE.interactions++; }, { capture: true, passive: true });
document.addEventListener('click', event => { if (eventElement(event)?.closest('[data-update]')) applyUpdate(true); });
function updatePageShow(event) { if (event.persisted) return resumeUpdate(true); }
// Preview/test frames are isolated; their tests explicitly invoke the functions.
if (window.top === window.self && /^https?:$/.test(location.protocol)) {
  restoreUpdateView();
  if (document.visibilityState === 'hidden') updatePageHide();
  setTimeout(checkUpdate, 15000);
  setInterval(checkUpdate, 30000);
  document.addEventListener('visibilitychange', updateVisibility);
  window.addEventListener('pagehide', updatePageHide);
  window.addEventListener('pageshow', updatePageShow);
  window.addEventListener('online', () => checkUpdate(true));
}
