# 習慣深潛 Habit Dive

像素風格的習慣養成遊戲。每天寫下最重要的事、維持習慣的連勝，完成後獲得金幣與經驗值，用來開啟寶箱、收集水下生物，並依真實潛水證照的進階路線逐步升級。

線上版本：<https://frogjourney-harry.github.io/habit-dive/>

本專案為純靜態網站，不需要建置工具或後端伺服器。資料預設只存放在使用者的瀏覽器中，雲端同步為選用功能。

## 目錄

- [功能](#功能)
- [快速開始](#快速開始)
- [本機開發](#本機開發)
- [專案結構](#專案結構)
- [設計規格](#設計規格)
- [設定](#設定)
- [雲端同步](#雲端同步)
- [測試](#測試)
- [部署](#部署)
- [資料與隱私](#資料與隱私)
- [授權](#授權)

## 功能

**每日規劃**

- 每天最多列出六件最重要的事，前三項完成可獲得獎勵，順序可拖曳調整。
- 每日任務集中領取金幣與經驗值，未領取的獎勵會在隔天自動入帳。
- 每日首次開啟可領取登入獎勵。
- 內建番茄鐘工作階段，依設定自動安排短休息與長休息。

**習慣與連勝**

- 支援每天、每週與每兩週的習慣週期，內建運動、寫作、閱讀、冥想，也可自訂。
- 漏掉一期時，會先使用當月的免費請假額度，用完後再使用連勝保護卡，避免連勝中斷。事先知道要休息時也可以主動請假。

**收集與成長**

- 20 種水下生物，分為五種稀有度，每種都有幼體、成體與特殊型態。
- 在商店以金幣購買寶箱，抽到重複的生物會換成金幣。
- 水族箱會顯示已收集的生物，可餵食、命名，也可以讓牠游走。
- 共 10 個等級稱號，依 PADI 證照路線設計，從浮潛客到海洋傳說，並附上每個稱號的說明。
- 獎勵商店可自訂項目與價格，把遊戲金幣兌換成現實生活中的獎勵。

**資料管理**

- 支援備份匯出與匯入。
- 可選擇以 Google 帳號登入，在多個裝置間同步紀錄。

## 快速開始

直接開啟[線上版本](https://frogjourney-harry.github.io/habit-dive/)即可使用，不需要註冊。第一次開啟時，可以選擇是否綁定 Google 帳號，再勾選想養成的習慣。

## 本機開發

專案沒有相依套件與建置步驟，以任一靜態檔案伺服器開啟專案根目錄即可：

```bash
git clone https://github.com/frogjourney-Harry/habit-dive.git
cd habit-dive
python -m http.server 8000
```

接著在瀏覽器開啟 `http://localhost:8000/`。

`js/` 內的檔案為一般的 script，依 `index.html` 中的順序載入，並共用全域變數。

## 專案結構

```
.
├── index.html             頁面骨架
├── DESIGN.md              設計規格：顏色、字級、元件與規則
├── design-preview.html    元件目錄：DESIGN.md 每個 token 的實際樣子
├── css/
│   └── style.css          所有樣式，手機版樣式位於檔案最後
├── js/
│   ├── config.js          可調整的數值、內建習慣、稀有度、等級稱號
│   ├── creatures.js       像素圖、生物資料、成長型態與配色
│   ├── core.js            日期、存檔與資料轉換、狀態推導、音效
│   ├── game.js            寶箱與獎勵、番茄鐘、彈出視窗
│   ├── views.js           各頁面的畫面
│   ├── firebase-config.js Firebase 網頁設定
│   ├── sync.js            選用的 Google 登入與雲端同步
│   └── main.js            事件處理與啟動流程
├── img/                   網站圖示
├── tests/                 瀏覽器端自動測試
├── firestore.rules        Firestore 安全規則
└── bump.sh                更新靜態資源的版本號
```

## 設計規格

介面的顏色、字級、圓角、間距和元件樣式都寫在 [DESIGN.md](DESIGN.md)，格式參考 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) 的 DESIGN.md 寫法。修改介面前請先讀這份文件；用瀏覽器開啟 `design-preview.html` 可以看到每個元件的實際樣子。

像素圖的配色以 [Sweetie 16](https://lospec.com/palette-list/sweetie-16) 調色盤（GrafxKid）為基礎，再依真實物種調整。所有生物、寶箱、道具的像素圖都是本專案自行繪製。

## 設定

遊戲數值集中於 `js/config.js`，修改後重新整理頁面即可生效。常用的設定如下：

| 設定 | 說明 |
|---|---|
| `CONFIG.dayStartHour` | 一天的起始時間，在此之前的紀錄都算前一天 |
| `CONFIG.xp`、`CONFIG.coins` | 各項行為給予的經驗值與金幣 |
| `CONFIG.leavePerMonth` | 每天型習慣每月可請假的天數 |
| `CONFIG.leavePerMonthWeekly` | 每週型習慣每月可請假的次數 |
| `CONFIG.freeze` | 連勝保護卡的價格與持有上限 |
| `CONFIG.chests` | 各種寶箱的價格與機率 |
| `CONFIG.shop` | 預設的獎勵商店項目 |
| `ONB_HABITS` | 第一次開啟時可選擇的習慣 |
| `RANKS` | 等級稱號、解鎖等級與說明 |

## 雲端同步

雲端同步使用 Firebase Authentication（Google 登入）與 Cloud Firestore。只有在使用者選擇登入時才會載入 Firebase 相關程式。

每位使用者的資料存放於 `users/{uid}` 單一文件中，`firestore.rules` 限制使用者只能讀寫自己的文件。

若要部署到自己的 Firebase 專案：

1. 在 Firebase 主控台建立專案，啟用 Authentication 的 Google 登入方式，並建立 Firestore 資料庫。
2. 將網頁應用程式的設定填入 `js/firebase-config.js`。
3. 將 `firestore.rules` 的內容發布到 Firestore 的規則頁面。
4. 在 Authentication 的「已授權網域」中加入你的網站網域。
5. 建議在 Google Cloud 主控台中，將 API 金鑰限制為你的網站網址與 Firebase 相關 API。

`firebase-config.js` 中的 API 金鑰是 Firebase 網頁應用程式的公開識別碼，不屬於機密資訊。資料的安全性由 Firestore 安全規則與金鑰限制負責。

## 測試

`tests/index.html` 是在瀏覽器中執行的端對端測試。每個測試都會在獨立的 iframe 中載入實際的網頁，使用獨立的儲存空間、可控制的模擬時鐘與模擬的 Firebase，透過真實的點擊操作進行驗證，並檢查元素是否被其他元素遮擋。

測試涵蓋範圍包括：

- 每日流程、獎勵上限、換日與週期計算
- 番茄鐘、寶箱、商店與水族箱
- 舊版資料遷移、損毀存檔的處理、備份的匯入與匯出
- 多分頁同時開啟、雲端同步（包含離線與多裝置情境）
- 執行環境差異（無音效引擎、無痕模式、App 內建瀏覽器、舊版瀏覽器語法）
- 各種螢幕寬度下的版面與無障礙
- 隨機操作搭配不變量檢查

執行方式：啟動本機伺服器後，開啟以下網址。

| 網址 | 說明 |
|---|---|
| `/tests/index.html?auto` | 執行全部測試 |
| `/tests/index.html?run=關鍵字` | 只執行名稱符合關鍵字的測試 |
| `/tests/index.html?seeds=1-20&steps=300` | 調整隨機操作測試的組數與步數 |

## 部署

本專案透過 GitHub Pages 從 `main` 分支部署。推送前請先執行：

```bash
sh bump.sh
```

這個指令會更新 `index.html` 中 CSS 與 JavaScript 檔案的版本參數，確保使用者的瀏覽器載入最新版本，而不是快取中的舊檔案。

## 資料與隱私

- 未登入時，所有資料只存放在瀏覽器的 localStorage，不會傳送到任何伺服器。清除瀏覽資料或更換裝置會導致紀錄遺失，建議定期使用備份功能。
- 使用 Google 登入時，只會取用帳號名稱與電子郵件，紀錄會同步到 Firestore。
- 登入後可以隨時刪除雲端資料與帳號。

## 授權

本專案目前尚未指定開源授權，著作權由作者保留。
