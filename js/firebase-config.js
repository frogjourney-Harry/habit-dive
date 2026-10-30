// Firebase 設定：在 Firebase 控制台「專案設定 → 一般 → 你的應用程式」複製 firebaseConfig 貼在這裡。
// 這段設定本來就是公開的（不是密碼），資料安全靠 firestore.rules 保護：每個人只能讀寫自己的資料。
// 設成 null 時不會出現登入功能，網站也不會連到任何外部服務。
const FIREBASE_CONFIG = null;
