# 上線前素材來源稽核（2026-11-12）

基準：`a646593`；工作分支：`codex/rights-audit`。這是工程面的素材盤點與降低風險措施，並非律師法律意見、商標檢索報告或「絕無侵權」保證。

## 已確認的問題與使用者決定

先前已發布的翻車魚與鯨鯊新稿，生成封包曾包含下列照片，正式版當時未補相應來源／授權說明：

- Fred Hsu：[翻車魚照片](https://commons.wikimedia.org/wiki/File:Mola_mola_ocean_sunfish_Monterey_Bay_Aquarium_1.jpg)，CC BY-SA 3.0。
- ZacWolf：[鯨鯊照片](https://commons.wikimedia.org/wiki/File:Male_whale_shark_at_Georgia_Aquarium_crop.jpg)，CC BY-SA 2.5。

同批歷史生成還包含 NASA 公眾領域的[瓶鼻海豚照片](https://commons.wikimedia.org/wiki/File:Bottlenose_Dolphin_KSC04pd0178_(cropped).jpg)；後續補齊家族的封包又包含 NOAA 的[海豚全身照片](https://unsplash.com/photos/dolphin-in-body-of-water-NsvzdXtvyio)，該來源頁標示 Public Domain。公開版海豚三型態也屬這段照片參考流程，並非從未輸入照片。所有九型態在版本 202611121430 一併替換，避免把單一照片與特定像素的關係說成已獲法律證實。

未散布照片本身，不足以直接排除改作風險；是否構成受保護表達的改作須個案判斷。使用者選擇重新繪製，沒有同意把整個遊戲或這批素材改授權 CC BY-SA。

為避免跨家族參考的來源不清，重繪範圍是翻車魚、海豚、鯨鯊共九型態。最初準備的公眾領域照片候選，因使用者後續希望完全自行生成，**不作為最終新稿的輸入**。不能把那輪照片候選誤列成純文字生成。

生成流程：先用 imagegen 從文字生成原創概念對照圖，沒有提供輸入圖片。再另開不保留會話、工具停用的 Claude 呼叫，只提供這張新生成的概念圖、文字解剖特徵與像素規格；不提供任何照片、舊像素列、舊截圖。不把概念圖冒充實際生物照片。版本 202611121430 納入完整九型態重繪；實際部署結果以 GitHub Pages 的對應工作紀錄為準。

概念圖 SHA-256：`814EE56F391169387EB287A8980A3C17953B2B465621D9108EA3AA3DA243C5C4`。本機保存 `size-preview/original-concept-20261112.png` 與完整 prompt `size-preview/original-concept-prompt.txt`。重繪輸入封包文字另存唯一檔名 `reviews/20261112-134845-7fb5be3e.concept-prompt.txt`；此資料不含玩家存檔、帳號或 Firebase 設定。

未採用：較早的公眾領域照片輸入批次回傳格式錯誤；另一輪純文字初稿輪廓過扁，不作定稿。這兩輪與本次原創概念圖輔助生成分開記錄，不能混稱同一來源。

重新繪製只能處理後續版本，不能溯及宣稱歷史版本、既有 Git 提交與過去公開行為已自動獲得授權。歷史來源紀錄繼續保留。使用者後續要求清除紅嘴版本的 Git 歷史，因此僅修正含紅嘴素材的提交與其後代，不據此宣稱過去公開行為不存在。如權利人提出疑義，仍須處理。

## 盤點結果

| 項目 | 發現與處理 |
|---|---|
| 三家族九型態 | 版本 202611121430 納入獨立重繪，原創概念圖輔助；未把舊稿僅換色或縮放稱為原創重繪。使用者已要求發布 |
| 其他17種51型態 | 保留原碼內像素列；尚無完整逐張生成來源證明，不宣稱全數完成法律清查 |
| favicon／分享卡 | 本專案生物像素與文字渲染，未發現第三方照片；不是全面反向圖片搜尋 |
| Google G | 將舊內嵌標誌換成官方提供的現行圖檔，記錄來源及雜湊；沒有宣稱已通過 Google 品牌驗證 |
| 潛水稱號 | 移除將遊戲路線稱為 PADI 證照路線的敘述，補遊戲稱號不是實際資格；不變更玩家存檔 |
| 字型 | 系統字型，未散布字型檔 |
| 音效 | Web Audio 合成，未發現外部音樂／錄音素材 |
| Firebase／配色／其他第三方 | 見 THIRD_PARTY_NOTICES.md；不冒稱作者擁有第三方權利 |

## 法律與來源依據

- 智慧財產局：[參照照片繪畫的著作權問題](https://www.tipo.gov.tw/tw/copyright/774-5057.html)。自然物本身與照片的受保護表達應區分，不能只看是否附原照片。
- 智慧財產局：[AI 生成內容與著作權](https://www.tipo.gov.tw/tw/copyright/692-34252.html)。AI 生成及服務商輸出條款不等於第三方權利清除。
- [Anthropic 消費者條款](https://www.anthropic.com/legal/consumer-terms)：應以實際使用帳戶適用條款為準；未讀取私人帳務，也不假稱已確認方案。
- [Google 登入品牌規範](https://developers.google.com/identity/branding-guidelines)。

## 尚不能保證的範圍

未完成遊戲名稱在各市場的正式商標檢索、設計專利檢索、所有圖稿與所有既有作品的相似性鑑定。不能宣稱「沒有任何著作權或設計疑慮」。新圖也不應標示為完全無著作權／公眾領域，除非另有明確且有效的權利處分；本次使用者要求是避免第三方素材授權負擔，並非放棄自己依法享有的權利。

## 發行素材與驗證

- Claude 回傳：`reviews/20261112-134845-7fb5be3e.concept-candidate.json`，SHA-256 `3E8B206A6ADB354E41BBC02A4AEBA34D12759462F042A6DC90DB35BE240DC7AC`。以上封包、圖與 prompt 路徑是僅保存在本機的紀錄，不是線上下載連結。
- Codex 檢查九型態並排、顏色碼、列寬、透明外列，修正短列尾端的透明補齊；沒有以舊像素稿作修正基底。使用者已要求先發布；不宣稱已驗證科學精確度。
- 最終九圖的 DPR2 與 DPR3 整合測試各180次斷言、0失敗；驗證原本佔位、吃食框與其他17種51型態像素保持一致。
- 真393px iframe：九張圖、概念圖皆載入，無橫向溢位，無 Firebase 腳本。實際管理頁：11張縮圖載入、無縮小取樣、無錯誤，假雲端設定為 null。
- 早期 manta／turtle／lion／moray 等本機重設計試稿未套入本次九圖替換；原有海鰻沙底行為修正不屬素材重畫。
- 本機入口：`http://localhost:8776/size-preview/original-preview.html`。不讀寫玩家存檔。
- 使用者於 2026-11-12 明確要求發布。發行版本為 `202611121430`，相對於先前 `a646593` 替換九型態、補來源頁與官方 Google G；不改玩家存檔。發布前進行 Claude 複核，部署狀態以 GitHub Pages 工作紀錄為準。

最後一輪完整回歸：194/194項、3138次斷言、0失敗。稱號文字後續僅做說明性調整，未改等級與門檻。

本次精確發布清單：index.html、README.md、css/style.css、js/config.js、js/creatures.js、js/game.js、js/sync.js、js/views.js、img/google-g.png、credits.html、THIRD_PARTY_NOTICES.md、docs/rights-audit-2026-11-12.md。其餘 docs、reviews、size-preview 與協作資料不包含在本次發行。

## 後續嘴型與尾鰭修正（版本 202611121511）
使用者確認翻車魚三型態嘴巴採上下兩排白色、中間深黑；長翻車魚保留長形、後端改平截；鯨鯊尾鰭加厚並收攏。這些是本次原創像素稿的人工修改，未加入外部參考照片。
使用者另明確要求重寫先前紅嘴版本歷史。受影響的原提交為2b6ecde；只修正該提交的翻車魚嘴型，保留其他檔案、功能、作者與更早歷史。main與codex/rights-audit採帶預期舊SHA檢查的更新；不保證GitHub快取、舊SHA網址或他人副本同步消失。完整原歷史僅保存在未公開的本機復原備份。
