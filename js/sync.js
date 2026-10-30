// 雲端同步（選擇性）：用 Google 登入後，紀錄存到 Firebase，換手機、換瀏覽器都能接續。
// 沒登入過的人不會載入任何外部程式；登入過的裝置下次打開會自動恢復登入。
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
      if (u) { const first = S.cloudUid !== u.uid; S.cloudUid = u.uid; save(false); await cloudPull(first); }
      else if (S.cloudUid) { delete S.cloudUid; save(false); }
      render();
    });
    return true;
  })().catch(e => { CLOUD.error = e.message; CLOUD.loading = null; render(); return false; });
}
const userDoc = () => firebase.firestore().collection('users').doc(CLOUD.user.uid);
// 有沒有實際用過（新手寶箱不算）
const hasProgress = s => (s.logs || []).some(l => l.k !== 'welcome') || Object.keys(s.checks || {}).length > 0;
const summary = s => { const D = deriveOf(s); return `Lv.${levelOf(D.xp)}・${D.coins} 金幣・${(s.logs || []).length} 筆紀錄`; };
function deriveOf(s) { const keep = S; S = s; try { return derive(); } finally { S = keep; } }

function adopt(cloud) {
  const timer = S.timer;
  S = migrate(Object.assign(blank(), cloud));
  if (!S.timer && timer) S.timer = timer;
  S.cloudUid = CLOUD.user.uid;
  save(false); render();
}
// 拉雲端：first＝這台裝置剛登入，兩邊都有紀錄而且不一樣時，讓使用者選要留哪一份
async function cloudPull(first) {
  if (!CLOUD.user) return;
  try {
    const snap = await userDoc().get();
    if (!snap.exists) { await cloudPush(); return; }
    const cloud = JSON.parse(snap.data().data), cm = cloud.mtime || 0, lm = S.mtime || 0;
    if (cm === lm) { CLOUD.last = Date.now(); renderCloud(); return; }
    if (!hasProgress(S)) { adopt(cloud); toast('已從雲端載入你的紀錄'); }
    else if (!hasProgress(cloud)) await cloudPush();
    else if (first) {
      const useCloud = await ask(`雲端和這台裝置都有紀錄：\n\n雲端：${summary(cloud)}\n這台裝置：${summary(S)}\n\n要保留哪一份？另一份會被取代。`, '用雲端的', '用這台裝置的');
      if (useCloud) { adopt(cloud); toast('已改用雲端的紀錄'); } else await cloudPush();
    }
    else if (cm > lm) adopt(cloud);
    else await cloudPush();
    CLOUD.last = Date.now(); CLOUD.error = ''; renderCloud();
  } catch (e) { CLOUD.error = '同步失敗，稍後會再試'; renderCloud(); }
}
async function cloudPush() {
  if (!CLOUD.user) return;
  clearTimeout(CLOUD.timer); CLOUD.pending = false;
  const data = JSON.stringify(S);
  if (data.length > 900000) { CLOUD.error = '紀錄太大，暫時無法同步'; renderCloud(); return; }
  try {
    await userDoc().set({ data, mtime: S.mtime || 0, v: S.v, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    CLOUD.last = Date.now(); CLOUD.error = '';
  } catch (e) { CLOUD.error = '同步失敗，稍後會再試'; CLOUD.pending = true; }
  renderCloud();
}
// save() 之後呼叫：幾秒內的變動合併成一次上傳，省寫入次數
function cloudSchedule() {
  if (!CLOUD.user) return;
  CLOUD.pending = true; clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(cloudPush, 3000);
}
async function cloudLogin() {
  if (IN_APP) { toast('App 內建瀏覽器無法用 Google 登入，請用 Chrome 或 Safari 開啟'); return; }
  if (!(await cloudInit())) { toast('無法連線到登入服務，請稍後再試'); return; }
  const p = new firebase.auth.GoogleAuthProvider();
  try { await firebase.auth().signInWithPopup(p); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await firebase.auth().signInWithRedirect(p);
    else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') toast('登入失敗，請再試一次');
  }
}
async function cloudLogout() {
  if (CLOUD.pending) await cloudPush();
  await firebase.auth().signOut(); toast('已登出，紀錄還留在這台裝置');
}
async function cloudDelete() {
  if (!(await ask('刪除雲端資料和帳號？\n雲端上的紀錄會永久刪除，這台裝置上的紀錄會保留。', '刪除'))) return;
  try {
    await userDoc().delete();
    try { await CLOUD.user.delete(); }
    catch (e) { if (e.code === 'auth/requires-recent-login') { await CLOUD.user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider()); await CLOUD.user.delete(); } else throw e; }
    toast('雲端資料和帳號已刪除');
  } catch (e) { toast('刪除失敗，請重新登入後再試'); }
}

// 設定頁的「雲端同步」區塊
function cloudSection() {
  if (!FIREBASE_CONFIG) return '';
  let body;
  if (CLOUD.user) body = `<div class="mini">已登入 ${esc(CLOUD.user.email || '')}</div>
      <div class="mini" id="cloudStatus">${cloudStatusText()}</div>
      <div class="row" style="margin-top:6px"><button data-act="logout">登出</button><button class="ghost" data-act="clouddel">刪除雲端資料</button></div>`;
  else if (S.cloudUid && !CLOUD.ready) body = '<div class="mini">連線中…</div>';
  else if (IN_APP) body = '<div class="mini">在 App 內建瀏覽器裡無法用 Google 登入。請用 Chrome 或 Safari 開啟網站後登入，紀錄就能在各裝置同步。</div>';
  else body = `<div class="mini">登入後紀錄會存到雲端，換手機、換瀏覽器都能接續，也不怕資料不見。不登入也能照常使用。</div>
      <button class="pri" data-act="login" style="margin-top:8px">用 Google 登入</button>`;
  return `<section class="px">${sh('雲端同步', 'CLOUD')}${body}${CLOUD.error ? `<div class="warn">${esc(CLOUD.error)}</div>` : ''}</section>`;
}
function cloudStatusText() {
  if (CLOUD.pending) return '同步中…';
  return CLOUD.last ? `已同步・${new Date(CLOUD.last).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : '同步中…';
}
function renderCloud() { const el = document.getElementById('cloudStatus'); if (el) el.textContent = cloudStatusText(); }

// 切到別的 App 前先把還沒上傳的存上去；切回來時看看別的裝置有沒有更新
document.addEventListener('visibilitychange', () => {
  if (!CLOUD.user) return;
  if (document.visibilityState === 'hidden' && CLOUD.pending) cloudPush();
  if (document.visibilityState === 'visible') cloudPull(false);
});
