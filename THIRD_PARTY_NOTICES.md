# 素材與第三方來源

本文件列出專案使用的第三方來源，不將整個遊戲改為開源，也不將第三方商標宣告為本專案所有。更新日期：2026-11-12。

## 生物像素圖

生物以 JavaScript 像素資料繪製，部分由 AI 輔助、人工檢查及修改。AI 生成不代表當然享有著作權，也不是第三方權利的保證。新繪圖的來源及採用狀態見 [本次稽核](docs/rights-audit-2026-11-12.md)。

## 配色

基礎配色參考 GrafxKid 的 [Sweetie 16](https://lospec.com/palette-list/sweetie-16)，另有物種配色。未使用該頁的範例圖。來源頁未確認獨立授權聲明，因此不將其標示為 CC0。

## Google 登入標誌

登入按鈕的 `img/google-g.png` 取自 Google 官方 [品牌規範](https://developers.google.com/identity/branding-guidelines) 所提供的 [G 圖檔](https://developers.google.com/static/identity/images/g-logo.png)。Google 標誌屬 Google；僅用於辨識 Google 登入，不表示 Google 贊助或背書本遊戲。

下載檔案 SHA-256：`D1CE9C2AF0B10A7333ABC99BC706F9A6A199E5B65BF3E3009624F076B8638E6A`。

## Firebase

本遊戲從 Google CDN 載入 Firebase JavaScript SDK 10.12.2，未將 SDK 原始碼複製進專案。SDK 的 Apache 2.0 與其內含元件聲明，依 [該版本完整 LICENSE](https://github.com/firebase/firebase-js-sdk/blob/firebase%4010.12.2/LICENSE) 適用；不把整個 SDK 的所有元件簡化為單一授權。

## 字型與聲音

介面使用裝置系統字型，未散布字型檔。音效由 Web Audio 振盪器產生，未發現外部錄音或音樂檔。這是來源盤點，不是音樂相似性鑑定。

## 文件與設計參考

`DESIGN.md` 記錄一般介面設計參考，不使用參考產品的品牌或畫面素材。設計文件格式參考 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)；上游採 [MIT](https://github.com/VoltAgent/awesome-design-md/blob/main/LICENSE)。本文件不授予本遊戲整體 MIT 授權。遊戲稱號僅是遊戲進度，不代表潛水證照、專業資格或任何證照機構認可。
