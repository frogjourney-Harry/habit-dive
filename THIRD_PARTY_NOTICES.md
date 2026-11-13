# 素材與第三方來源

本文件列出專案使用的第三方來源，不將整個遊戲改為開源，也不將第三方商標宣告為本專案所有。更新日期：2026-11-13。玩家可由[素材與來源頁](credits.html)閱讀摘要並開啟授權全文。

## 生物像素圖

生物以 JavaScript 像素資料繪製，部分由 AI 輔助、人工檢查及修改。維護者於2026-11-13確認早期17種由 Claude 協助生成；完整原始輸入與外部參考紀錄尚未取得，不將工具名稱當成第三方授權證明。現行20種60型態的版本、來源確認方式與像素指紋見[素材清冊](docs/asset-provenance.md)；較新九型態的生成與修改流程見[先前稽核](docs/rights-audit-2026-11-12.md)。

## 配色

基礎配色參考 GrafxKid 的 [Sweetie 16](https://lospec.com/palette-list/sweetie-16)，另有物種配色。未使用該頁的範例圖。來源頁未確認獨立授權聲明，因此不將其標示為 CC0。

## Google 登入標誌

登入按鈕的 `img/google-g.png` 取自 Google 官方 [品牌規範](https://developers.google.com/identity/branding-guidelines) 所提供的 [G 圖檔](https://developers.google.com/static/identity/images/g-logo.png)。Google 標誌屬 Google；僅用於辨識 Google 登入，不表示 Google 贊助或背書本遊戲。

下載檔案 SHA-256：`D1CE9C2AF0B10A7333ABC99BC706F9A6A199E5B65BF3E3009624F076B8638E6A`。

## Firebase

本遊戲從 Google CDN 載入 Firebase JavaScript SDK 10.12.2，未將 SDK 原始碼複製進專案。隨專案保留[上游完整 LICENSE 原文](licenses/firebase-10.12.2-LICENSE.txt)，包含 Apache 2.0 及 Protocol Buffers 的 BSD 3-Clause 與 Copyright 2008 Google Inc. 聲明；不把所有元件簡化為單一授權。[上游來源](https://github.com/firebase/firebase-js-sdk/blob/firebase%4010.12.2/LICENSE)。CDN SDK 本身隨附的其他聲明仍依原樣適用。

## 字型與聲音

介面使用裝置系統字型，未散布字型檔。音效由 Web Audio 振盪器產生，未發現外部錄音或音樂檔。這是來源盤點，不是音樂相似性鑑定。

## 文件與設計參考

`DESIGN.md` 記錄一般介面設計參考，不使用參考產品的品牌或畫面素材。設計文件格式參考 [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)；隨專案保留 [MIT 授權原文](licenses/awesome-design-md-MIT.txt)，包含 Copyright (c) 2026 VoltAgent 與完整許可、條件、免責文字。本文件不授予本遊戲整體 MIT 授權。遊戲稱號僅是遊戲進度，不代表潛水證照、專業資格或任何證照機構認可。

授權檔的下載來源、日期與 SHA-256 見 [licenses/README.md](licenses/README.md)。
