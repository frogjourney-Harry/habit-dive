// 雲端同步（選擇性）：用 Google 登入後，紀錄存到 Firebase，換手機、換瀏覽器都能接續。
// 沒看到登入畫面的人不會載入任何外部程式；看到登入畫面時先載入登入程式（不送出紀錄）；登入過的裝置下次打開會自動恢復登入。
// 資料放在 Firestore 的 users/{uid}，整份紀錄存成一個 JSON 字串；以 S.mtime（最後修改時間）決定哪一份比較新。
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CLOUD = { ready: false, loading: null, authKnown: false, user: null, last: 0, timer: 0, pending: false, error: '', session: 0, writes: new Set(), suspended: false };

// 帳號歸屬獨立存在本機，不因登出或雲端存檔內容而遺失。
const OWNER_KEY = KEY + '.owner';
const ACCOUNT_BACKUPS = ['.prelogin', '.cloud-before-choice', '.sync-backup', '.before-import', '.corrupt'];
const deletionKey = uid => KEY + '.deletion.' + encodeURIComponent(uid);
function cloudDeletionState(user = CLOUD.user) {
  if (!user) return null;
  if (CLOUD.dataRemoved === user.uid) return 'data-removed';
  try { return localStorage.getItem(deletionKey(user.uid)) || (CLOUD.deletedUid === user.uid ? 'pending' : null); }
  catch (_) { return 'unavailable'; }
}
const cloudSyncPaused = () => CLOUD.suspended || CLOUD.deleting || cloudDeletionPending();
function cloudDeletionPending() {
  return !!cloudDeletionState();
}
function cloudAccountActive() {
  if (!CLOUD.user || ((S.accountOwner || S.cloudUid) && (S.accountOwner || S.cloudUid) !== CLOUD.user.uid)) return false;
  try { const owner = localStorage.getItem(OWNER_KEY); return !owner || owner === CLOUD.user.uid; } catch (_) { return false; }
}
function selectAccount(uid) {
  const owner = S.cloudUid || S.accountOwner || localStorage.getItem(OWNER_KEY);
  if (owner && owner !== uid) {
    const accountKey = id => KEY + '.account.' + encodeURIComponent(id);
    const activeOwner = localStorage.getItem(OWNER_KEY);
    const files = Object.fromEntries(ACCOUNT_BACKUPS.map(suffix => [suffix, localStorage.getItem(KEY + suffix)]));
    const previousRaw = localStorage.getItem(accountKey(owner));
    const previous = previousRaw ? JSON.parse(previousRaw) : null;
    // 另一個分頁可能已先切換：共用的主存檔與復原檔此時已屬於新帳號。
    const currentRaw = activeOwner === uid ? localStorage.getItem(KEY) : null;
    const current = currentRaw ? JSON.parse(currentRaw) : null;
    if (!previous || (S.mtime || 0) >= (previous.s.mtime || 0))
      localStorage.setItem(accountKey(owner), JSON.stringify({ s: S, files: activeOwner === owner ? files : previous?.files || {} }));
    const raw = localStorage.getItem(accountKey(uid));
    const cached = current?.accountOwner === uid ? { s: current, files } : raw ? JSON.parse(raw) : null;
    const next = cached ? prepareBackup(cached.s) : migrate(blank());
    for (const suffix of ACCOUNT_BACKUPS) {
      const value = cached?.files?.[suffix];
      if (value != null) localStorage.setItem(KEY + suffix, value);
      else localStorage.removeItem(KEY + suffix);
    }
    S = next;
    // 草稿、彈窗、計時畫面與復原入口也不能帶進另一個帳號。
    for (const key of Object.keys(UI)) delete UI[key];
    Object.assign(UI, { tab: 'about', pday: 0, opened: false, sheet: null });
    Q.length = 0;
    if (ask.res) ask.res(false);
    for (const id of ['ov', 'sheetov', 'askov', 'focus']) document.getElementById(id)?.classList.add('hidden');
  }
  localStorage.setItem(OWNER_KEY, uid);
  S.accountOwner = uid;
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('暫時無法準備 Google 登入，請稍後重試。不登入也能繼續使用。'));
    document.head.appendChild(s);
  });
}
function cloudInit() {
  if (!FIREBASE_CONFIG) return Promise.resolve(false);
  if (CLOUD.loading) return CLOUD.loading;
  CLOUD.authKnown = false;
  return CLOUD.loading = (async () => {
    for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(FIREBASE_SDK + f);
    firebase.initializeApp(FIREBASE_CONFIG);
    CLOUD.ready = true;
    firebase.auth().onAuthStateChanged(async u => {
      CLOUD.authKnown = true;
      const request = CLOUD.trialSaveRequested, previousSession = CLOUD.session;
      CLOUD.trialSaveRequested = null; CLOUD.saveTrialFor = null;
      const session = ++CLOUD.session;
      CLOUD.deleteArmed = null; CLOUD.deleteContext = null;
      clearTimeout(CLOUD.timer);
      if (CLOUD.unsub) { CLOUD.unsub(); CLOUD.unsub = null; }
      CLOUD.choice = null; CLOUD.pending = false; CLOUD.base = null; CLOUD.last = 0; CLOUD.error = ''; CLOUD.writing = null;
      if (u) {
        try { selectAccount(u.uid); }
        catch (_) {
          CLOUD.user = null;
          await firebase.auth().signOut();
          CLOUD.error = '無法安全切換帳號，原紀錄已保留。請先下載備份並確認瀏覽器儲存空間。';
          render(); return;
        }
      } else if (S.cloudUid) {
        // 舊版資料也在失去登入時保留歸屬，避免下次誤認成試玩。
        try { localStorage.setItem(OWNER_KEY, S.cloudUid); S.accountOwner = S.cloudUid; } catch (_) {}
      }
      CLOUD.user = u;
      if (u) {
        if (request?.session === previousSession && (!request.owner || request.owner === u.uid)) CLOUD.saveTrialFor = u.uid;
        const first = S.cloudUid !== u.uid || !!S.cloudChoicePending;
        S.cloudUid = u.uid;
        if (first && hasProgress(S)) S.cloudChoicePending = true;
        save(false);
        if (cloudDeletionPending()) { CLOUD.error = '刪除尚未完成，請再次刪除帳號；同步已暫停'; render(); return; }
        await cloudPull(first);
        if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return;
        cloudListen();
      } else if (S.cloudUid) { delete S.cloudUid; save(false); }
      if (u && !S.onb) { UI.onbReturning = false; UI.onbStep = 1; }
      render();
    });
    return true;
  })().catch(e => { CLOUD.error = e.message; CLOUD.loading = null; render(); return false; });
}
const userDoc = () => firebase.firestore().collection('users').doc(CLOUD.user.uid);
// 雲端文件的版本：每次上傳的編號；舊版網頁寫的文件沒有編號，用修改時間代替
const verOf = d => d.wid || 'm' + (d.mtime || 0);
// 有沒有實際用過（新手寶箱不算）
const hasProgress = s => (s.logs || []).some(l => l.k !== 'welcome' && l.k !== 'login') || Object.keys(s.checks || {}).length > 0
  || Object.values(s.plans || {}).some(P => P.some(x => x.text && x.text.trim())) || (s.favs || []).length > 0 || !!s.shop;   // 寫過的六件事、常用、改過的獎勵也是使用者的資料
const summary = s => { const D = deriveOf(s); return `Lv.${levelOf(D.xp)}・${D.coins} 金幣・${(s.logs || []).length} 筆紀錄`; };
function deriveOf(s) { const keep = S; S = s; try { return derive(); } finally { S = keep; } }

function adopt(cloud, keepTimer = false) {
  if (!cloudAccountActive()) throw new Error('帳號已在另一個分頁變更');
  const timer = S.timer, old = S;
  const candidate = prepareBackup(cloud);
  delete candidate.cloudChoicePending;
  if (hasProgress(old) && JSON.stringify(old) !== JSON.stringify(candidate)) localStorage.setItem(KEY + '.sync-backup', JSON.stringify({ t: Date.now(), s: old }));
  S = candidate; carryEditDrafts(old);
  if (keepTimer && !S.timer && timer) S.timer = timer;
  S.cloudUid = CLOUD.user.uid; S.accountOwner = CLOUD.user.uid;
  save(false); render();
}
// 這台裝置登入前的紀錄：登入時一律改用雲端的，原本的另存在這裡，需要時可以還原
const PRE_KEY = KEY + '.prelogin';
function preLogin() { if (!sameDataContext(dataContext())) return null; try { return JSON.parse(localStorage.getItem(PRE_KEY)); } catch (e) { return null; } }
// 登入以雲端紀錄為準；只有帳號沒有雲端存檔時才詢問是否儲存試玩。
async function cloudPull(first) {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.choice) return;
  first = first || !!S.cloudChoicePending;
  if (!first && (CLOUD.pending || (CLOUD.pushSession === CLOUD.session && CLOUD.pushPromise))) { await cloudPush(); return; }
  const session = CLOUD.session;
  try {
    const snap = await userDoc().get();
    if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return;
    if (!snap.exists) {
      if (CLOUD.saveTrialFor === CLOUD.user.uid) {
        CLOUD.saveTrialFor = null; delete S.cloudChoicePending;
        S.introNextTask = getPlan(dayKey()).some(it => it.text.trim() && !it.done); save(false);
        await cloudPush();
        if (session === CLOUD.session && cloudAccountActive()) { UI.tab = 'today'; render(); scrollToIntroTask(); }
        return;
      }
      if (first && hasProgress(S)) {
        localStorage.setItem(PRE_KEY, JSON.stringify({ t: Date.now(), s: S }));
        S.cloudChoicePending = true; save(false);
        CLOUD.choice = { kind: 'new', local: JSON.parse(JSON.stringify(S)) };
        UI.tab = 'about'; render(); return;
      }
      delete S.cloudChoicePending; save(false); await cloudPush(); return;
    }
    CLOUD.saveTrialFor = null;
    const cloud = prepareBackup(JSON.parse(snap.data().data)), cm = cloud.mtime || 0, lm = S.mtime || 0;
    const previousBase = CLOUD.base;
    CLOUD.base = verOf(snap.data());   // 目前知道的雲端版本；上傳時用來判斷雲端有沒有被別台改過
    if (first) {
      if (hasProgress(S)) localStorage.setItem(PRE_KEY, JSON.stringify({ t: Date.now(), s: S }));
      adopt(cloud); toast('已載入你的雲端紀錄');
    }
    else if (cm === lm) { if (previousBase !== CLOUD.base) adopt(cloud); CLOUD.last = Date.now(); CLOUD.pending = false; CLOUD.error = ''; renderCloud(); catchUp(); cloudListen(); return; }
    else if (!hasProgress(S)) adopt(cloud);
    else if (cm > lm) adopt(cloud);
    else { await cloudPush(); if (CLOUD.error) return; }
    if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return;
    CLOUD.last = Date.now(); CLOUD.error = ''; renderCloud(); catchUp(); cloudListen();
  } catch (e) { if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return; CLOUD.error = '同步失敗，稍後會再試'; renderCloud(); }
}
async function chooseCloud(source) {
  const choice = CLOUD.choice, context = dataContext();
  if (!choice || choice.kind !== 'new' || !CLOUD.user || !['local', 'fresh'].includes(source)) return;
  try {
    const candidate = source === 'local' ? prepareBackup(choice.local) : migrate({ ...blank(), introPending: true });
    delete candidate.cloudChoicePending;
    CLOUD.choice = null; clearTimeout(CLOUD.timer); CLOUD.pending = false;
    S = candidate; S.cloudUid = context.uid; S.accountOwner = context.uid; save(false); await cloudPush();
    if (!sameDataContext(context)) return;
    render(); catchUp();
  } catch (_) { if (sameDataContext(context)) { CLOUD.error = '無法儲存這份紀錄，請重新選擇或下載備份'; render(); } }
}
function cloudChoiceBackup() { if (!sameDataContext(dataContext())) return null; try { return JSON.parse(localStorage.getItem(KEY + '.cloud-before-choice')); } catch (_) { return null; } }
function syncBackup() { if (!sameDataContext(dataContext())) return null; try { return JSON.parse(localStorage.getItem(KEY + '.sync-backup')); } catch (_) { return null; } }
function cloudPush() {
  if (CLOUD.suspended || cloudDeletionPending()) return Promise.resolve();
  if (CLOUD.pushSession === CLOUD.session && CLOUD.pushPromise) return CLOUD.pushPromise;
  const promise = pushCloudNow();
  CLOUD.pushSession = CLOUD.session; CLOUD.pushPromise = promise; CLOUD.writes.add(promise);
  renderCloudStatus();
  const done = () => { CLOUD.writes.delete(promise); if (CLOUD.pushPromise === promise) CLOUD.pushPromise = null; renderCloudStatus(); };
  promise.then(done, done);
  return promise;
}
async function pushCloudNow() {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.choice || S.cloudChoicePending || (S.accountOwner && S.accountOwner !== CLOUD.user.uid)) return;
  const session = CLOUD.session, base = CLOUD.base, version = S.v;
  clearTimeout(CLOUD.timer); CLOUD.pending = false;
  const data = JSON.stringify(S);
  // 文件上限是 1 MiB（以位元組算）；中文一個字 3 位元組，所以不能用字元數
  const bytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(data).length : data.length * 3;
  if (bytes > 1000000) { CLOUD.error = '紀錄太大，暫時無法同步'; renderCloud(); return; }
  try {
    // 上傳前先看雲端：上次同步之後被別台裝置改過，就不蓋掉它，改用雲端的最新版。
    // 用每次上傳各自的編號（wid）判斷「是不是我上次看到的那一版」，不用修改時間：兩台剛好在同一毫秒存檔時，時間會一樣
    const ref = userDoc(), mtime = S.mtime || 0, wid = CLOUD.writing = rid();
    const result = await firebase.firestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (CLOUD.suspended || session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return { kind: 'paused' };
      if (snap.exists && (base == null || verOf(snap.data()) !== base)) return { kind: 'newer', data: snap.data() };
      tx.set(ref, { data, mtime, wid, v: version, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { kind: 'written' };
    });
    if (session !== CLOUD.session || !cloudAccountActive()) return;
    if (result.kind === 'written') CLOUD.base = wid;
    if (result.kind === 'paused' || (result.kind === 'newer' && cloudSyncPaused())) { CLOUD.pending = true; if (!cloudSyncPaused()) cloudSchedule(); return; }
    if (cloudSyncPaused()) return;
    if (result.kind === 'newer') { adopt(JSON.parse(result.data.data)); CLOUD.base = verOf(result.data); toast('另一台裝置剛更新過，已換成最新的紀錄'); }
    CLOUD.last = Date.now(); CLOUD.error = '';
  } catch (e) { if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return; CLOUD.error = '同步失敗，稍後會再試'; CLOUD.pending = true; CLOUD.since = Date.now(); CLOUD.timer = setTimeout(cloudPush, 30000); }
  renderCloud(); if (!CLOUD.error) cloudListen();
}
// save() 之後呼叫：幾秒內的變動合併成一次上傳，省寫入次數。
// 連續操作時不能一直往後延（以前每存一次就重新等 3 秒，一直在用就一直沒上傳）：從第一個還沒上傳的變動算起，最多等 8 秒
function cloudSchedule() {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.choice || S.cloudChoicePending || (S.accountOwner && S.accountOwner !== CLOUD.user.uid)) return;
  const now = Date.now();
  if (!CLOUD.pending) { CLOUD.pending = true; CLOUD.since = now; }
  clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(cloudPush, Math.max(0, Math.min(3000, CLOUD.since + 8000 - now)));
  renderCloudStatus();
}
// 即時接收別台裝置的變動：開著的頁面不用重新整理也會更新。這台還有沒上傳的變動時先不換，上傳時會檢查衝突
function cloudListen() {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.unsub) return;
  const session = CLOUD.session;
  CLOUD.unsub = userDoc().onSnapshot(snap => {
    if (CLOUD.suspended || !cloudAccountActive() || cloudDeletionPending() || session !== CLOUD.session || S.cloudChoicePending || CLOUD.choice || !snap.exists || (snap.metadata && snap.metadata.hasPendingWrites)) return;
    const d = snap.data(), ver = verOf(d);
    // 已經看過的版本、這台自己剛寫上去的、或這台還有沒上傳的變動（上傳時會處理衝突）：都不換
    if (ver === CLOUD.base || (d.wid && d.wid === CLOUD.writing) || CLOUD.pending) return;
    try {
      adopt(JSON.parse(d.data)); CLOUD.base = ver;
      CLOUD.last = Date.now(); CLOUD.error = ''; renderCloud(); catchUp();
    } catch (_) { CLOUD.error = '無法讀取雲端紀錄，目前本機紀錄已保留'; renderCloud(); }
  }, () => {
    if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return;
    const unsubscribe = CLOUD.unsub; CLOUD.unsub = null; if (unsubscribe) unsubscribe();
    CLOUD.error = '即時同步中斷，請重試同步'; renderCloud();
  });
}
const WEBKIT = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android|Edg|OPR/.test(navigator.userAgent));
// 看得到登入按鈕時就先把登入程式載好：Safari 只讓「按下去的那一瞬間」開彈出視窗，按了才開始載就來不及，要按第二次
function cloudWarm() { if (FIREBASE_CONFIG && !IN_APP && !CLOUD.loading && !CLOUD.error && !CLOUD.user) cloudInit(); }
async function cloudLogin(saveTrial = false) {
  if (CLOUD.suspended) { toast('正在處理帳號，請稍候'); return; }
  if (IN_APP) { toast('App 內建瀏覽器無法用 Google 登入，請用 Chrome 或 Safari 開啟'); return; }
  if (saveTrial) { const context = dataContext(); CLOUD.pendingIntroLogin = { owner: context.owner || context.localOwner }; }
  if (!CLOUD.ready) {   // 還沒載好（網路慢、剛打開）
    if (WEBKIT) {   // iPhone、Mac Safari：載好之後要使用者再按一次，彈出視窗才不會被擋
      CLOUD.busy = true; renderCloud();
      const okLoad = await cloudInit(); CLOUD.busy = false; CLOUD.armed = !!okLoad; renderCloud();
      if (!okLoad) { CLOUD.pendingIntroLogin = null; toast('無法連線到登入服務，請稍後再試'); } return;
    }
    if (!(await cloudInit())) { CLOUD.pendingIntroLogin = null; toast('無法連線到登入服務，請稍後再試'); return; }
  }
  CLOUD.armed = false;
  if (CLOUD.pendingIntroLogin) CLOUD.trialSaveRequested = { ...CLOUD.pendingIntroLogin, session: CLOUD.session };
  CLOUD.pendingIntroLogin = null;
  const p = new firebase.auth.GoogleAuthProvider();
  CLOUD.authPending = true;
  try { await firebase.auth().signInWithPopup(p); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await firebase.auth().signInWithRedirect(p);
    else { CLOUD.trialSaveRequested = null; CLOUD.pendingIntroLogin = null; if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('登入失敗。如果在無痕模式，請改用一般分頁再試一次'); }
  } finally { CLOUD.authPending = false; }
}
async function cloudLogout() {
  CLOUD.pendingIntroLogin = null; CLOUD.trialSaveRequested = null; CLOUD.saveTrialFor = null;
  const context = dataContext();
  if (CLOUD.pending) await cloudPush();
  if (!sameDataContext(context)) return;
  await firebase.auth().signOut(); toast('已登出，紀錄還留在這台裝置');
}
// 還原登入前這台裝置的紀錄（會取代雲端上的那一份）
async function cloudRestorePre() {
  const p = preLogin(), context = dataContext(); if (!p || !CLOUD.user) return;
  if (!(await ask(`改用這台裝置登入前的紀錄？\n\n登入前：${summary(p.s)}\n目前（雲端）：${summary(S)}\n\n雲端的紀錄會被取代。`, '改用登入前的'))) return;
  if (restoreWithFeedback(p.s, context, '已改用登入前的紀錄')) {
    try { localStorage.removeItem(PRE_KEY); renderBackupSection(true); }
    catch (_) { toast('已還原，但無法刪除登入前的備份'); }
  }
}
function cloudDropPre() {
  if (!sameDataContext(dataContext())) { toast('帳號已變更，請重新操作'); return; }
  try {
    localStorage.removeItem(PRE_KEY);
    document.getElementById('preloginBackup')?.remove();
    document.querySelector('#backupSection > summary')?.focus({ preventScroll: true });
    toast('已刪除此備份，目前進度不受影響');
  } catch (_) { toast('備份刪除失敗，原備份仍保留'); }
}
async function cloudDelete() {
  const user = CLOUD.user, context = dataContext(); if (!user || CLOUD.suspended || CLOUD.deleting) return;
  if (!(await ask('刪除雲端資料和帳號？\n雲端上的紀錄會永久刪除，本機紀錄仍會保留。請先登出其他裝置，避免重新上傳。', '刪除'))) return;
  if (!sameDataContext(context) || !CLOUD.user || CLOUD.user.uid !== user.uid) { toast('帳號已變更，請重新確認'); return; }
  CLOUD.deleteArmed = user.uid; CLOUD.deleteContext = context; renderCloud();
}
function cloudDeleteConfirmed() {
  const user = CLOUD.user;
  if (!user || CLOUD.deleting || CLOUD.deleteArmed !== user.uid || !sameDataContext(CLOUD.deleteContext)) { CLOUD.deleteArmed = null; renderCloud(); return; }
  const ref = userDoc(), wasPending = CLOUD.pending, previousTime = S.mtime;
  CLOUD.deleteArmed = null;
  // Called directly from the verification button's click, before any await/render.
  let verification;
  try { verification = user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider()); }
  catch (error) { verification = Promise.reject(error); }
  return finishCloudDelete(user, ref, verification, wasPending, previousTime);
}
async function finishCloudDelete(user, ref, verification, wasPending, previousTime) {
  const context = dataContext(); CLOUD.suspended = true; CLOUD.deleting = true; clearTimeout(CLOUD.timer); CLOUD.pending = false;
  if (CLOUD.unsub) { CLOUD.unsub(); CLOUD.unsub = null; }
  renderCloud();
  try {
    // Authenticate before deleting any records. Cancelling the popup leaves data intact.
    await verification;
    if (!sameDataContext(context)) throw new Error('account-changed');
    await Promise.all([...(CLOUD.writes || [])].map(task => task.catch(() => {})));
    if (!sameDataContext(context)) throw new Error('account-changed');
    // Keep a per-account, local-only pause across reloads if deletion partially fails.
    try { localStorage.setItem(deletionKey(user.uid), cloudDeletionState(user) === 'data-removed' ? 'data-removed' : 'pending'); }
    catch (_) { throw { code: 'storage/delete-marker' }; }
    CLOUD.deletedUid = user.uid;
    await ref.delete();
    CLOUD.dataRemoved = user.uid;
    localStorage.setItem(deletionKey(user.uid), 'data-removed');
    if (!sameDataContext(context)) throw new Error('account-changed');
    await user.delete();
    try { localStorage.removeItem(deletionKey(user.uid)); } catch (_) {}
    CLOUD.deletedUid = null; CLOUD.dataRemoved = null;
    if (CLOUD.user && CLOUD.user.uid !== user.uid) return;
    if (CLOUD.user && CLOUD.user.uid === user.uid) CLOUD.user = null;
    if (S.cloudUid === user.uid) delete S.cloudUid;
    if (S.accountOwner === user.uid) delete S.accountOwner;
    if (localStorage.getItem(OWNER_KEY) === user.uid) localStorage.removeItem(OWNER_KEY);
    CLOUD.error = ''; CLOUD.base = null; CLOUD.last = 0; CLOUD.pending = false; save(false);
    toast('雲端資料和帳號已刪除');
  } catch (e) {
    if (!sameDataContext(context)) return;
    if (e.code === 'storage/delete-marker') {
      CLOUD.error = '無法儲存刪除暫停狀態，本次未執行新的刪除。請先下載備份並排除瀏覽器儲存空間問題。';
    } else if (cloudDeletionState(user)) {
      CLOUD.error = cloudDeletionState(user) === 'data-removed' ? '雲端遊戲紀錄已刪除，但帳號尚未刪除。同步已暫停，請重試刪除或登出。' : '刪除尚未完成，同步已暫停。請重試刪除或登出。';
    } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      CLOUD.error = ''; toast('已取消刪除，雲端資料未刪除');
    } else if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      CLOUD.error = '刪除前需要重新驗證。請允許彈出視窗，或改用一般 Safari／Chrome 分頁登入後重試刪除；雲端資料尚未刪除。';
    } else { CLOUD.error = '未能完成刪除驗證，雲端資料未刪除。請稍後重試。'; }
  } finally {
    CLOUD.deleting = false; CLOUD.suspended = false;
    if (CLOUD.user && !cloudSyncPaused()) {
      if (!sameDataContext(context)) await cloudPull(!!S.cloudChoicePending);
      else { cloudListen(); if (CLOUD.pending || wasPending || S.mtime !== previousTime) cloudSchedule(); }
    }
    renderCloud();
  }
}
async function resumeCloudSync() {
  const user = CLOUD.user, state = cloudDeletionState(), context = dataContext();
  if (!user || !state || CLOUD.deleting) return;
  const message = state === 'data-removed' ? '取消刪除並恢復同步？\n雲端遊戲紀錄已移除；恢復後會用本機紀錄重新建立雲端資料。' : '取消刪除並恢復同步？\n將重新檢查雲端；若紀錄已移除，會重新上傳本機紀錄。';
  if (!(await ask(message, '恢復同步'))) return;
  if (!sameDataContext(context) || !CLOUD.user || CLOUD.user.uid !== user.uid || CLOUD.deleting) { toast('帳號已變更，請重新確認'); return; }
  try {
    localStorage.removeItem(deletionKey(user.uid)); CLOUD.deletedUid = null; CLOUD.dataRemoved = null; CLOUD.error = '';
    if (state === 'data-removed') CLOUD.base = null;
    await cloudPull(false); renderCloud();
  } catch (_) { CLOUD.error = '無法恢復同步，請稍後重試。'; renderCloud(); }
}

// Google 的登入按鈕規範：一定要放原色、不變形的「G」標誌，白底
const GOOGLE_G = '<img src="img/google-g.png" width="18" height="18" alt="" aria-hidden="true">';

function loginPrivacyNotice() {
  return '<div class="login-privacy" role="note"><p>Google 登入用於辨識帳號，遊戲紀錄會備份至 Firebase，供跨裝置同步。不登入也能玩。</p><a href="privacy.html" target="_blank" rel="noopener">隱私說明 ↗</a></div>';
}

// 設定頁的「雲端同步」區塊
function cloudSection() {
  if (!FIREBASE_CONFIG) return '<div id="cloudBox"><p class="mini">紀錄會自動儲存在此瀏覽器，清除瀏覽資料可能遺失紀錄。</p></div>';
  let body;
  cloudWarm();
  if (CLOUD.deleting) body = '<p class="mini" role="status">正在刪除雲端資料與帳號，本機紀錄會保留。</p>';
  else if (CLOUD.user && CLOUD.deleteArmed === CLOUD.user.uid) body = '<p class="mini">請驗證 Google 帳號，再永久刪除雲端資料。本機紀錄會保留。</p><div class="row"><button class="pri" data-act="clouddeleteconfirm">驗證 Google 帳號並刪除</button><button class="ghost" data-act="clouddeleteback">取消</button></div>';
  else if (cloudDeletionState()) body = '<p class="mini">刪除作業尚未完成，同步已暫停，本機紀錄仍保留。</p><div class="row"><button data-act="clouddel">重試刪除</button><button class="ghost" data-act="clouddeletioncancel">取消刪除</button><button class="ghost" data-act="logout">登出</button></div>';
  else if (CLOUD.choice) body = `<p>這個帳號還沒有雲端紀錄，要儲存這次試玩進度嗎？</p><p class="mini">${summary(CLOUD.choice.local)}</p><button class="pri" data-act="cloudchoose" data-v="local">儲存試玩進度</button><button data-act="cloudchoose" data-v="fresh">從頭開始</button>`; else if (CLOUD.user) body = `<div class="mini">已登入 ${esc(CLOUD.user.email || '')}</div>
      <div class="mini" id="cloudStatus">${cloudStatusText()}</div>
      <div class="row" style="margin-top:6px"><button data-act="logout">登出</button><button class="ghost" data-act="clouddel">刪除雲端資料</button></div>`;
  else if (S.cloudUid && !CLOUD.ready) body = '<div class="mini">連線中…</div>';
  else if (IN_APP) body = '<div class="mini">在 App 內建瀏覽器裡無法用 Google 登入。請用 Chrome 或 Safari 開啟網站後登入，紀錄就能在各裝置同步。</div>';
  else body = `${loginPrivacyNotice()}
      <button class="gbtn" data-act="login" ${CLOUD.busy ? 'disabled' : ''}>${GOOGLE_G}${CLOUD.busy ? '準備中…' : CLOUD.armed ? '再按一次，選擇 Google 帳戶' : '用 Google 帳戶登入'}</button>`;
  return `<div id="cloudBox">${body}${CLOUD.error ? `<div class="warn">${esc(CLOUD.error)}</div>${cloudSyncPaused() ? '' : '<button data-act="cloudretry">重試同步</button>'}` : ''}</div>`;
}
function cloudStatusText() {
  if (CLOUD.user && !cloudAccountActive()) return '帳號已在另一個分頁變更，請重新整理';
  if (!STORAGE_OK) return '此裝置無法儲存，請立即下載備份';
  if (cloudSyncPaused()) return '刪除作業尚未完成，雲端同步已暫停';
  if (CLOUD.error) return '已儲存在此裝置，尚未同步到雲端';
  if (CLOUD.choice) return '請選擇要接續的紀錄';
  if (CLOUD.pending) return '已儲存在此裝置，等待同步…';
  if (CLOUD.pushSession === CLOUD.session && CLOUD.pushPromise) return '同步中…';
  return CLOUD.last ? `已同步・${new Date(CLOUD.last).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : '同步中…';
}
// 只重畫雲端區塊（狀態、錯誤訊息），不動整個頁面
function renderCloudStatus() { const el = document.getElementById('cloudStatus'); if (el) el.textContent = cloudStatusText(); }
function renderCloud() { const el = document.getElementById('cloudBox'); if (el) el.outerHTML = cloudSection(); renderBackupSection(); renderOnb(); }

// 專注中每 30 秒看一下雲端：在別台裝置按了「結束」，這台也會跟著結束
setInterval(() => { if (CLOUD.user && S.timer && document.visibilityState === 'visible') cloudPull(false); }, 30e3);
// 切到別的 App 前先把還沒上傳的存上去；切回來時看看別的裝置有沒有更新
document.addEventListener('visibilitychange', () => {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.choice) return;
  if (document.visibilityState === 'hidden' && CLOUD.pending) cloudPush();
  if (document.visibilityState === 'visible') cloudPull(false);
});
