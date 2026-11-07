// 雲端同步（選擇性）：用 Google 登入後，紀錄存到 Firebase，換手機、換瀏覽器都能接續。
// 沒看到登入畫面的人不會載入任何外部程式；看到登入畫面時先載入登入程式（不送出紀錄）；登入過的裝置下次打開會自動恢復登入。
// 資料放在 Firestore 的 users/{uid}，整份紀錄存成一個 JSON 字串；以 S.mtime（最後修改時間）決定哪一份比較新。
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CLOUD = { ready: false, loading: null, user: null, last: 0, timer: 0, pending: false, error: '' };

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('無法載入 ' + src));
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
      CLOUD.user = u;
      // 這台裝置第一次連到這個帳號（或換了帳號）才需要問要留哪一份；之前登入過的就照「誰比較新」自動同步
      if (CLOUD.unsub) { CLOUD.unsub(); CLOUD.unsub = null; }
      CLOUD.base = null;
      if (u) { const first = S.cloudUid !== u.uid || !!S.cloudChoicePending; S.cloudUid = u.uid; save(false); await cloudPull(first); cloudListen(); }
      else if (S.cloudUid) { delete S.cloudUid; save(false); }
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
  const timer = S.timer, old = S;
  const candidate = prepareBackup(cloud);
  if (hasProgress(old) && JSON.stringify(old) !== JSON.stringify(candidate)) localStorage.setItem(KEY + '.sync-backup', JSON.stringify({ t: Date.now(), s: old }));
  S = candidate; carryEditDrafts(old);
  if (keepTimer && !S.timer && timer) S.timer = timer;
  S.cloudUid = CLOUD.user.uid;
  save(false); render();
}
// 這台裝置登入前的紀錄：登入時一律改用雲端的，原本的另存在這裡，需要時可以還原
const PRE_KEY = KEY + '.prelogin';
function preLogin() { try { return JSON.parse(localStorage.getItem(PRE_KEY)); } catch (e) { return null; } }
// 拉雲端：first＝這台裝置剛登入。兩邊都有紀錄時直接用雲端的（不讓人誤選而蓋掉雲端），這台的另存一份
async function cloudPull(first) {
  if (!CLOUD.user || CLOUD.choice) return;
  try {
    const snap = await userDoc().get();
    if (!snap.exists) { await cloudPush(); return; }
    const cloud = JSON.parse(snap.data().data), cm = cloud.mtime || 0, lm = S.mtime || 0;
    CLOUD.base = verOf(snap.data());   // 目前知道的雲端版本；上傳時用來判斷雲端有沒有被別台改過
    if (cm === lm && !first) { CLOUD.last = Date.now(); CLOUD.pending = false; CLOUD.error = ''; renderCloud(); catchUp(); return; }
    if (!hasProgress(S)) { adopt(cloud, first); if (first) toast('已從雲端載入你的紀錄'); }
    else if (!hasProgress(cloud)) { await cloudPush(); if (CLOUD.error) return; }
    else if (first) {
      // 先保留兩份，再讓使用者選擇；選擇前不啟動任何上傳或採用快照。
      localStorage.setItem(PRE_KEY, JSON.stringify({ t: Date.now(), s: S }));
      localStorage.setItem(KEY + '.cloud-before-choice', JSON.stringify({ t: Date.now(), s: cloud }));
      S.cloudChoicePending = true; save(false); CLOUD.choice = { cloud, local: JSON.parse(JSON.stringify(S)) };
      UI.tab = 'about'; render(); return;
    }
    else if (cm > lm) adopt(cloud);
    else { await cloudPush(); if (CLOUD.error) return; }
    CLOUD.last = Date.now(); CLOUD.error = ''; renderCloud(); catchUp();
  } catch (e) { CLOUD.error = '同步失敗，稍後會再試'; renderCloud(); }
}
async function chooseCloud(source) {
  const choice = CLOUD.choice; if (!choice) return;
  CLOUD.choice = null; clearTimeout(CLOUD.timer); CLOUD.pending = false;
  if (source === 'local') {
    S = prepareBackup(choice.local); delete S.cloudChoicePending; S.cloudUid = CLOUD.user.uid; save(false); await cloudPush();
  } else adopt(choice.cloud, true);
  CLOUD.last = Date.now(); render(); catchUp();
}
function cloudChoiceBackup() { try { return JSON.parse(localStorage.getItem(KEY + '.cloud-before-choice')); } catch (_) { return null; } }
function syncBackup() { try { return JSON.parse(localStorage.getItem(KEY + '.sync-backup')); } catch (_) { return null; } }
async function cloudPush() {
  if (!CLOUD.user || CLOUD.choice) return;
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
      if (snap.exists && CLOUD.base != null && verOf(snap.data()) !== CLOUD.base) return snap.data();
      tx.set(ref, { data, mtime, wid, v: S.v, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return null;
    });
    if (newer) { CLOUD.base = verOf(newer); adopt(JSON.parse(newer.data)); toast('另一台裝置剛更新過，已換成最新的紀錄'); }
    else CLOUD.base = wid;
    CLOUD.last = Date.now(); CLOUD.error = '';
  } catch (e) { CLOUD.error = '同步失敗，稍後會再試'; CLOUD.pending = true; CLOUD.since = Date.now(); CLOUD.timer = setTimeout(cloudPush, 30000); }
  renderCloud();
}
// save() 之後呼叫：幾秒內的變動合併成一次上傳，省寫入次數。
// 連續操作時不能一直往後延（以前每存一次就重新等 3 秒，一直在用就一直沒上傳）：從第一個還沒上傳的變動算起，最多等 8 秒
function cloudSchedule() {
  if (!CLOUD.user || CLOUD.choice) return;
  const now = Date.now();
  if (!CLOUD.pending) { CLOUD.pending = true; CLOUD.since = now; }
  clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(cloudPush, Math.max(0, Math.min(3000, CLOUD.since + 8000 - now)));
}
// 即時接收別台裝置的變動：開著的頁面不用重新整理也會更新。這台還有沒上傳的變動時先不換，上傳時會檢查衝突
function cloudListen() {
  if (!CLOUD.user || CLOUD.unsub) return;
  CLOUD.unsub = userDoc().onSnapshot(snap => {
    if (CLOUD.choice || !snap.exists || (snap.metadata && snap.metadata.hasPendingWrites)) return;
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
  if (CLOUD.pending) await cloudPush();
  await firebase.auth().signOut(); toast('已登出，紀錄還留在這台裝置');
}
// 還原登入前這台裝置的紀錄（會取代雲端上的那一份）
async function cloudRestorePre() {
  const p = preLogin(); if (!p) return;
  if (!(await ask(`改用這台裝置登入前的紀錄？\n\n登入前：${summary(p.s)}\n目前（雲端）：${summary(S)}\n\n雲端的紀錄會被取代。`, '改用登入前的'))) return;
  S = migrate(Object.assign(blank(), p.s)); S.cloudUid = CLOUD.user.uid;
  localStorage.removeItem(PRE_KEY);
  save(); render(); toast('已改用登入前的紀錄');
}
function cloudDropPre() { localStorage.removeItem(PRE_KEY); renderCloud(); }
async function cloudDelete() {
  if (!(await ask('刪除雲端資料和帳號？\n雲端上的紀錄會永久刪除，這台裝置上的紀錄會保留。', '刪除'))) return;
  try {
    await userDoc().delete();
    try { await CLOUD.user.delete(); }
    catch (e) { if (e.code === 'auth/requires-recent-login') { await CLOUD.user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider()); await CLOUD.user.delete(); } else throw e; }
    toast('雲端資料和帳號已刪除');
  } catch (e) { toast('刪除失敗，請重新登入後再試'); }
}

// Google 的登入按鈕規範：一定要放原色、不變形的「G」標誌，白底
const GOOGLE_G = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

// 設定頁的「雲端同步」區塊
function cloudSection() {
  if (!FIREBASE_CONFIG) return '';
  let body;
  cloudWarm();
  if (CLOUD.choice) body = `<p>這台裝置與雲端各有一份紀錄，請選擇要接續哪一份。兩份都已另存備份。</p><p class="mini">雲端：${summary(CLOUD.choice.cloud)}<br>此裝置：${summary(CLOUD.choice.local)}</p><button data-act="cloudchoose" data-v="cloud">接續雲端紀錄</button><button data-act="cloudchoose" data-v="local">保留這次試玩</button>`; else if (CLOUD.user) body = `<div class="mini">已登入 ${esc(CLOUD.user.email || '')}</div>
      <div class="mini" id="cloudStatus">${cloudStatusText()}</div>
      ${preLogin() ? `<div class="mini" style="margin-top:8px">這台裝置登入前的紀錄（${summary(preLogin().s)}）另外存著。</div>
      <div class="row"><button data-act="prerestore">改用登入前的紀錄</button><button class="ghost" data-act="predrop">不需要，刪掉</button></div>` : ''}
      ${cloudChoiceBackup() ? '<button class="ghost" data-act="cloudbackuprestore">還原選擇前的雲端紀錄</button>' : ''}${syncBackup() ? '<div class="mini">同步前的本機紀錄已保留。</div><button class="ghost" data-act="syncbackuprestore">還原同步前的本機紀錄</button>' : ''}<div class="row" style="margin-top:6px"><button data-act="logout">登出</button><button class="ghost" data-act="clouddel">刪除雲端資料</button></div>`;
  else if (S.cloudUid && !CLOUD.ready) body = '<div class="mini">連線中…</div>';
  else if (IN_APP) body = '<div class="mini">在 App 內建瀏覽器裡無法用 Google 登入。請用 Chrome 或 Safari 開啟網站後登入，紀錄就能在各裝置同步。</div>';
  else body = `<div class="mini">登入後，換手機、換瀏覽器都能接續紀錄。不登入也能照常使用。</div>
      <button class="gbtn" data-act="login" ${CLOUD.busy ? 'disabled' : ''}>${GOOGLE_G}${CLOUD.busy ? '準備中…' : CLOUD.armed ? '再按一次，選擇 Google 帳戶' : '用 Google 帳戶登入'}</button>`;
  return `<section class="px" id="cloudBox">${sh('雲端同步', 'CLOUD')}${body}${CLOUD.error ? `<div class="warn">${esc(CLOUD.error)}</div><button data-act="cloudretry">重試同步</button>` : ''}</section>`;
}
function cloudStatusText() {
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
  if (!CLOUD.user || CLOUD.choice) return;
  if (document.visibilityState === 'hidden' && CLOUD.pending) cloudPush();
  if (document.visibilityState === 'visible') cloudPull(false);
});
