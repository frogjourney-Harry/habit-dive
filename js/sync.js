// 雲端同步（選擇性）：用 Google 登入後，紀錄存到 Firebase，換手機、換瀏覽器都能接續。
// 沒看到登入畫面的人不會載入任何外部程式；看到登入畫面時先載入登入程式（不送出紀錄）；登入過的裝置下次打開會自動恢復登入。
// 資料放在 Firestore 的 users/{uid}，整份紀錄存成一個 JSON 字串；以 S.mtime（最後修改時間）決定哪一份比較新。
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CLOUD = { ready: false, loading: null, user: null, last: 0, timer: 0, pending: false, error: '', session: 0, writes: new Set(), suspended: false };

// 帳號歸屬獨立存在本機，不因登出或雲端存檔內容而遺失。
const OWNER_KEY = KEY + '.owner';
const ACCOUNT_BACKUPS = ['.prelogin', '.cloud-before-choice', '.sync-backup', '.before-import', '.corrupt'];
const deletionKey = uid => KEY + '.deletion.' + encodeURIComponent(uid);
function cloudDeletionPending() {
  if (!CLOUD.user) return false;
  if (CLOUD.deletedUid === CLOUD.user.uid) return true;
  try { return !!localStorage.getItem(deletionKey(CLOUD.user.uid)); } catch (_) { return true; }
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
  return CLOUD.loading = (async () => {
    for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js']) await loadScript(FIREBASE_SDK + f);
    firebase.initializeApp(FIREBASE_CONFIG);
    CLOUD.ready = true;
    firebase.auth().onAuthStateChanged(async u => {
      const session = ++CLOUD.session;
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
      if (first && hasProgress(S)) {
        localStorage.setItem(PRE_KEY, JSON.stringify({ t: Date.now(), s: S }));
        S.cloudChoicePending = true; save(false);
        CLOUD.choice = { kind: 'new', local: JSON.parse(JSON.stringify(S)) };
        UI.tab = 'about'; render(); return;
      }
      delete S.cloudChoicePending; save(false); await cloudPush(); return;
    }
    const cloud = JSON.parse(snap.data().data), cm = cloud.mtime || 0, lm = S.mtime || 0;
    const previousBase = CLOUD.base;
    CLOUD.base = verOf(snap.data());   // 目前知道的雲端版本；上傳時用來判斷雲端有沒有被別台改過
    if (first) {
      if (hasProgress(S)) localStorage.setItem(PRE_KEY, JSON.stringify({ t: Date.now(), s: S }));
      adopt(cloud); toast('已載入你的雲端紀錄');
    }
    else if (cm === lm) { if (previousBase !== CLOUD.base) adopt(cloud); CLOUD.last = Date.now(); CLOUD.pending = false; CLOUD.error = ''; renderCloud(); catchUp(); return; }
    else if (!hasProgress(S)) adopt(cloud);
    else if (cm > lm) adopt(cloud);
    else { await cloudPush(); if (CLOUD.error) return; }
    if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return;
    CLOUD.last = Date.now(); CLOUD.error = ''; renderCloud(); catchUp();
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
  const done = () => { CLOUD.writes.delete(promise); if (CLOUD.pushPromise === promise) CLOUD.pushPromise = null; };
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
    const newer = await firebase.firestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return null;
      if (snap.exists && (base == null || verOf(snap.data()) !== base)) return snap.data();
      tx.set(ref, { data, mtime, wid, v: version, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return null;
    });
    if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return;
    if (newer) { CLOUD.base = verOf(newer); adopt(JSON.parse(newer.data)); toast('另一台裝置剛更新過，已換成最新的紀錄'); }
    else CLOUD.base = wid;
    CLOUD.last = Date.now(); CLOUD.error = '';
  } catch (e) { if (session !== CLOUD.session || !cloudAccountActive() || cloudDeletionPending()) return; CLOUD.error = '同步失敗，稍後會再試'; CLOUD.pending = true; CLOUD.since = Date.now(); CLOUD.timer = setTimeout(cloudPush, 30000); }
  renderCloud();
}
// save() 之後呼叫：幾秒內的變動合併成一次上傳，省寫入次數。
// 連續操作時不能一直往後延（以前每存一次就重新等 3 秒，一直在用就一直沒上傳）：從第一個還沒上傳的變動算起，最多等 8 秒
function cloudSchedule() {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.choice || S.cloudChoicePending || (S.accountOwner && S.accountOwner !== CLOUD.user.uid)) return;
  const now = Date.now();
  if (!CLOUD.pending) { CLOUD.pending = true; CLOUD.since = now; }
  clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(cloudPush, Math.max(0, Math.min(3000, CLOUD.since + 8000 - now)));
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
    CLOUD.base = ver; adopt(JSON.parse(d.data));
    CLOUD.last = Date.now(); CLOUD.error = ''; renderCloud(); catchUp();
  }, () => {});
}
const WEBKIT = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android|Edg|OPR/.test(navigator.userAgent));
// 看得到登入按鈕時就先把登入程式載好：Safari 只讓「按下去的那一瞬間」開彈出視窗，按了才開始載就來不及，要按第二次
function cloudWarm() { if (FIREBASE_CONFIG && !IN_APP && !CLOUD.loading && !CLOUD.error && !CLOUD.user) cloudInit(); }
async function cloudLogin() {
  if (CLOUD.suspended) { toast('正在處理帳號，請稍候'); return; }
  if (IN_APP) { toast('App 內建瀏覽器無法用 Google 登入，請用 Chrome 或 Safari 開啟'); return; }
  if (!CLOUD.ready) {   // 還沒載好（網路慢、剛打開）
    if (WEBKIT) {   // iPhone、Mac Safari：載好之後要使用者再按一次，彈出視窗才不會被擋
      CLOUD.busy = true; renderCloud();
      const okLoad = await cloudInit(); CLOUD.busy = false; CLOUD.armed = !!okLoad; renderCloud();
      if (!okLoad) toast('無法連線到登入服務，請稍後再試'); return;
    }
    if (!(await cloudInit())) { toast('無法連線到登入服務，請稍後再試'); return; }
  }
  CLOUD.armed = false;
  const p = new firebase.auth.GoogleAuthProvider();
  try { await firebase.auth().signInWithPopup(p); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await firebase.auth().signInWithRedirect(p);
    else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('登入失敗。如果在無痕模式，請改用一般分頁再試一次');
  }
}
async function cloudLogout() {
  const context = dataContext();
  if (CLOUD.pending) await cloudPush();
  if (!sameDataContext(context)) return;
  await firebase.auth().signOut(); toast('已登出，紀錄還留在這台裝置');
}
// 還原登入前這台裝置的紀錄（會取代雲端上的那一份）
async function cloudRestorePre() {
  const p = preLogin(), context = dataContext(); if (!p || !CLOUD.user) return;
  if (!(await ask(`改用這台裝置登入前的紀錄？\n\n登入前：${summary(p.s)}\n目前（雲端）：${summary(S)}\n\n雲端的紀錄會被取代。`, '改用登入前的'))) return;
  if (restoreBackup(prepareBackup(p.s), context)) { localStorage.removeItem(PRE_KEY); render(); toast('已改用登入前的紀錄'); }
}
function cloudDropPre() { if (!sameDataContext(dataContext())) return; localStorage.removeItem(PRE_KEY); renderCloud(); }
async function cloudDelete() {
  const context = dataContext(), user = CLOUD.user;
  if (!user || CLOUD.suspended || !(await ask('刪除雲端資料和帳號？\n雲端上的紀錄會永久刪除，這台裝置上的紀錄會保留。', '刪除')) || !sameDataContext(context)) return;
  CLOUD.suspended = true;
  ++CLOUD.session; clearTimeout(CLOUD.timer); CLOUD.pending = false;
  if (CLOUD.unsub) { CLOUD.unsub(); CLOUD.unsub = null; }
  const deletion = dataContext(), ref = userDoc(); let removed = false;
  try {
    // 等待已送出的寫入結束，再刪除；舊回應不得排入新的重試。
    await Promise.allSettled([...CLOUD.writes]);
    if (!sameDataContext(deletion)) return;
    await user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    if (!sameDataContext(deletion)) return;
    localStorage.setItem(deletionKey(user.uid), 'pending'); CLOUD.deletedUid = user.uid;
    await ref.delete(); removed = true;
    if (!sameDataContext(deletion)) return;
    await user.delete();
    if (sameDataContext(deletion)) await firebase.auth().signOut();
    toast('雲端資料和帳號已刪除');
  } catch (_) {
    if (sameDataContext(deletion)) {
      CLOUD.error = removed ? '雲端紀錄已刪除，但帳號尚未刪除，請重試刪除帳號' : cloudDeletionPending() ? '刪除尚未完成，請再次刪除帳號；同步已暫停' : '未完成刪除，請重新登入後再試';
      renderCloud();
    }
  } finally { CLOUD.suspended = false; if (!removed && sameDataContext(deletion)) cloudListen(); }
}

// Google 的登入按鈕規範：一定要放原色、不變形的「G」標誌，白底
const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

// 設定頁的「雲端同步」區塊
function cloudSection() {
  if (!FIREBASE_CONFIG) return '<div id="cloudBox"><p class="mini">紀錄會自動儲存在此瀏覽器，清除瀏覽資料可能遺失紀錄。</p></div>';
  let body;
  cloudWarm();
  if (CLOUD.choice) body = `<p>這個帳號還沒有雲端紀錄，要儲存這次試玩進度嗎？</p><p class="mini">${summary(CLOUD.choice.local)}</p><button class="pri" data-act="cloudchoose" data-v="local">儲存試玩進度</button><button data-act="cloudchoose" data-v="fresh">從頭開始</button>`; else if (CLOUD.user) body = `<div class="mini">已登入 ${esc(CLOUD.user.email || '')}</div>
      <div class="mini" id="cloudStatus">${cloudStatusText()}</div>
      <div class="row" style="margin-top:6px"><button data-act="logout">登出</button><button class="ghost" data-act="clouddel">刪除雲端資料</button></div>`;
  else if (S.cloudUid && !CLOUD.ready) body = '<div class="mini">連線中…</div>';
  else if (IN_APP) body = '<div class="mini">在 App 內建瀏覽器裡無法用 Google 登入。請用 Chrome 或 Safari 開啟網站後登入，紀錄就能在各裝置同步。</div>';
  else body = `<div class="mini">登入後，換手機、換瀏覽器都能接續紀錄。不登入也能照常使用。</div>
      <button class="gbtn" data-act="login" ${CLOUD.busy ? 'disabled' : ''}>${GOOGLE_G}${CLOUD.busy ? '準備中…' : CLOUD.armed ? '再按一次，選擇 Google 帳戶' : '用 Google 帳戶登入'}</button>`;
  return `<div id="cloudBox">${body}${CLOUD.error ? `<div class="warn">${esc(CLOUD.error)}</div><button data-act="cloudretry">重試同步</button>` : ''}</div>`;
}
function cloudStatusText() {
  if (CLOUD.user && !cloudAccountActive()) return '帳號已在另一個分頁變更，請重新整理';
  if (!STORAGE_OK) return '此裝置無法儲存，請立即下載備份';
  if (CLOUD.error) return '已儲存在此裝置，尚未同步到雲端';
  if (CLOUD.choice) return '請選擇要接續的紀錄';
  if (CLOUD.pending) return '已儲存在此裝置，等待同步…';
  return CLOUD.last ? `已同步・${new Date(CLOUD.last).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : '同步中…';
}
// 只重畫雲端區塊（狀態、錯誤訊息），不動整個頁面
function renderCloud() { const el = document.getElementById('cloudBox'); if (el) el.outerHTML = cloudSection(); renderOnb(); }

// 專注中每 30 秒看一下雲端：在別台裝置按了「結束」，這台也會跟著結束
setInterval(() => { if (CLOUD.user && S.timer && document.visibilityState === 'visible') cloudPull(false); }, 30e3);
// 切到別的 App 前先把還沒上傳的存上去；切回來時看看別的裝置有沒有更新
document.addEventListener('visibilitychange', () => {
  if (CLOUD.suspended || !cloudAccountActive() || !CLOUD.user || cloudDeletionPending() || CLOUD.choice) return;
  if (document.visibilityState === 'hidden' && CLOUD.pending) cloudPush();
  if (document.visibilityState === 'visible') cloudPull(false);
});
