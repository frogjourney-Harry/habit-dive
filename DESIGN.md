---
version: 2
name: 習慣深潛 Habit Dive
description: 晴天在海裡往上看的感覺。每一頁上方是一條藍水頁首；下方是白色、無框的內容卡片，靠留白和字的層次分組。像素圖只用在內容（生物、寶箱、飼料、道具、logo），介面本身是平滑的。日常畫面只有三種顏色會跳出來：海洋藍（動作和進度）、綠（完成）、金（金幣和獎勵）。

colors:
  # 頁首與大海
  hero-top: "#3290c6"
  hero-mid: "#2079b4"
  hero-bottom: "#17639a"
  sea-deep: "#0f4672"
  on-hero: "#ffffff"
  on-hero-muted: "rgba(255,255,255,.72)"
  # 內容區
  canvas: "#eef3f7"
  surface: "#ffffff"
  fill: "#f1f5f9"
  fill-pressed: "#e6edf3"
  field: "#ffffff"
  hairline: "#e2e8ee"
  hairline-strong: "#c9d3dd"
  # 文字
  ink: "#13212f"
  ink-muted: "#5d6b7a"
  ink-subtle: "#6e7b89"
  # 角色（日常只會出現前三種）
  primary: "#0b6bcb"
  primary-pressed: "#0a5cae"
  on-primary: "#ffffff"
  success: "#278a5d"
  on-success: "#ffffff"
  coin: "#9a6512"
  coin-fill: "#f2b84b"
  on-coin: "#3a2a05"
  warning: "#d9653b"
  # 稀有度（只在生物、寶箱、圖鑑）
  rarity-common: "#94b0c2"
  rarity-uncommon: "#38b764"
  rarity-rare: "#41a6f6"
  rarity-epic: "#b267e6"
  rarity-legendary: "#ffcd75"

typography:
  title:
    fontFamily: PingFang TC, Noto Sans TC, Microsoft JhengHei UI
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  body:
    fontFamily: PingFang TC, Noto Sans TC, Microsoft JhengHei UI
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  ui:
    fontFamily: PingFang TC, Noto Sans TC, Microsoft JhengHei UI
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  caption:
    fontFamily: PingFang TC, Noto Sans TC, Microsoft JhengHei UI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  stat:
    fontFamily: PingFang TC, Noto Sans TC, Microsoft JhengHei UI
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: 0
    fontFeature: tabular-nums
  clock:
    fontFamily: PingFang TC, Noto Sans TC, Microsoft JhengHei UI
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: 0
    fontFeature: tabular-nums

rounded:
  sm: 8px
  md: 10px
  lg: 12px
  xl: 18px
  modal: 20px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  card-padding: 18px
  card-gap: 14px
  hero-height: 150px   # 電腦版 190px
  hero-clearance: 8px

components:
  hero:
    backgroundColor: "linear-gradient({colors.hero-top}, {colors.hero-mid}, {colors.hero-bottom})"
    textColor: "{colors.on-hero}"
    height: "{spacing.hero-height}"
  wordmark:
    textColor: "{colors.on-hero}"
    typography: "{typography.title}"
    fontWeight: 700
  level-chip:
    backgroundColor: "rgba(255,255,255,.18)"
    textColor: "{colors.on-hero}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
  tab-bar-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.ui}"
    borderTop: "1px {colors.hairline}"
  tab-bar-mobile-active:
    textColor: "{colors.primary}"
    indicator: "2px top line {colors.primary}"
  tab-bar-desktop:
    textColor: "{colors.on-hero-muted}"
    typography: "{typography.ui}"
  tab-bar-desktop-active:
    textColor: "{colors.on-hero}"
    indicator: "2px underline {colors.on-hero}"
  tab-badge:
    backgroundColor: "{colors.coin-fill}"
    textColor: "{colors.on-coin}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.ui}"
    fontWeight: 600
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-secondary-pressed:
    backgroundColor: "{colors.fill-pressed}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    typography: "{typography.ui}"
  button-disabled:
    opacity: 0.4
  segmented:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.md}"
    padding: 3px
  segmented-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    shadow: "0 1px 3px rgba(15,40,70,.12)"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-padding}"
    shadow: "0 1px 2px rgba(15,40,70,.05), 0 6px 20px rgba(15,40,70,.06)"
  tile:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: 10px 0
    divider: "1px {colors.hairline}"
  check:
    size: 22px
    rounded: "{rounded.full}"
    border: "1.5px {colors.hairline-strong}"
  check-done:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-success}"
  check-claimable:
    backgroundColor: "{colors.coin-fill}"
  progress:
    height: 6px
    trackColor: "{colors.hairline}"
    barColor: "{colors.primary}"
    rounded: "{rounded.full}"
  pill:
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px 9px
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    border: "1px {colors.hairline}"
    rounded: "{rounded.md}"
  input-focus:
    border: "1px {colors.primary}"
    ring: "3px {colors.primary} @ 22%"
  toggle:
    backgroundColor: "{colors.hairline}"
    rounded: "{rounded.full}"
  toggle-on:
    backgroundColor: "{colors.success}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.ui}"
    rounded: "{rounded.full}"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.modal}"
    overlay: "rgba(8,20,35,.45) + blur(4px)"
  sea-toolbar:
    backgroundColor: "{colors.surface}"
    borderTop: "1px {colors.hairline}"
---

# 習慣深潛 DESIGN.md

這份文件是網站所有畫面的設計規格。改任何 UI 之前先讀這份；顏色、字級、圓角、間距、陰影一律從上面的 tokens 取，不另外發明新的值。元件目錄在 `design-preview.html`，可以直接打開看每個 token 的實際樣子。

## Overview

習慣深潛是天天打開、會點很多次的習慣遊戲。設計目標是：**點很多次也不累，每次打開都想看看海裡的魚**。

每一頁都由兩層組成。上層是**頁首**：手機約 150px、電腦約 190px 高的藍水漸層，名稱、等級、金幣（電腦版還有分頁）疊在上面，底部是一條直線，不加裝飾。下層是**內容**：白色卡片往上蓋住頁首的下緣，卡片沒有外框，靠陰影、留白和字的粗細分出層次。大海頁是例外，整個畫面都是海。

這個結構參考 Forest（彩色頁首加淺色內容）、Duolingo 2026 年的分頁改版（各頁頁首一致、用留白取代外框）、Finch（上方是寵物的場景，下方是今天的清單），以及 Habitica（像素圖只用在內容）。

**Key Characteristics:**
- 每頁上方一條藍水頁首（`{components.hero}`），只放名稱、等級、金幣，不放會動的東西。
- 白色、無框的內容卡片（`{components.card}`），往上蓋住頁首下緣。
- 日常畫面只有三種顏色會跳出來：`{colors.primary}`（動作、進度）、`{colors.success}`（完成）、`{colors.coin-fill}`（金幣、獎勵）。
- 一個畫面最多一個實心主要按鈕（`{components.button-primary}`）。
- 像素圖只用在內容，介面是平滑的，沒有任何像素裝飾。
- 全站一種字體，六種字級，數字等寬。

## Colors

### Brand & Accent
- **海洋藍**（`{colors.primary}` — #0b6bcb）：唯一的動作色。用在主要按鈕、進度條、選取中的手機分頁、輸入框 focus。
- **頁首藍**（`{colors.hero-top}` → `{colors.hero-bottom}`）：只用在頁首、大海頁和專注畫面的背景，不進到內容卡片裡。

### Surface
- `{colors.canvas}`（#eef3f7）：頁面底色，帶一點藍的淺灰。
- `{colors.surface}`（#ffffff）：內容卡片、彈窗、手機分頁列、大海工具列。
- `{colors.fill}`（#f1f5f9）：卡片裡的小單位（磚塊）、次要按鈕、分段切換的底。
- `{colors.hairline}`：清單列之間的分隔線、進度條的軌道。

### Text
- `{colors.ink}`：標題和內文。
- `{colors.ink-muted}`：說明文字、次要按鈕以外的文字動作。
- `{colors.ink-subtle}`：最次要的資訊、placeholder、卡片裡的分組小標題。

### Semantic
- **綠**（`{colors.success}`）：只表示「已完成」：打勾、達標、開關打開。
- **金**（`{colors.coin}` 文字、`{colors.coin-fill}` 圖示和底色）：只表示金幣和獎勵，包括分頁上的待領取數字，不當按鈕顏色。
- **橘**（`{colors.warning}`）：只用在警告，例如連勝快斷了。很少出現。
- **稀有度色**（`{colors.rarity-*}`）：只用在生物、寶箱、圖鑑，日常頁面不會出現。

## Typography

### Font Family
全站使用系統內建的黑體：iPhone 和 Mac 是蘋方（PingFang TC），Windows 是微軟正黑體，有安裝 Noto Sans TC 的裝置會用它。不載入網路字型，離線也能正常顯示，也不會多一個外部連線。數字一律 `tabular-nums`，金幣和計時跳動時才不會晃。

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.title}` | 17px | 600 | 1.35 | 卡片標題、彈窗標題；品牌名稱用同一級但字重 700 |
| `{typography.body}` | 15px | 400 | 1.6 | 內文、清單列標題、輸入框 |
| `{typography.ui}` | 14px | 500 | 1.4 | 按鈕、分頁、標籤 |
| `{typography.caption}` | 12px | 400 | 1.4 | 說明、進度文字、卡片裡的分組小標題 |
| `{typography.stat}` | 28px | 600 | 1.1 | 大數字：金幣總數、等級、連續天數 |
| `{typography.clock}` | 56px | 600 | 1.0 | 番茄鐘倒數 |

### Principles
- 層級靠字級和粗細，不靠顏色和外框。
- 區塊標題只用中文，**不加英文小標**（HABITS、TODAY 這類），不用全大寫，不拉開字距。
- 一張卡片裡最多三種字級。

### Note on Font Substitutes
三種字型的粗細和字寬都很接近，不需要針對個別裝置調整。最後的備援是 `system-ui`。

## Layout

### Spacing System
只用 `{spacing.xxs}` 到 `{spacing.xl}`（4、8、12、16、24、32px）。卡片內距 `{spacing.card-padding}`，卡片之間 `{spacing.card-gap}`。

### Grid & Container
- 內容欄最寬 720px，置中。左右邊距：手機 10px、電腦 16px。
- 頁首 `{spacing.hero-height}` 高（電腦版 190px）；內容緊接在名稱（電腦版是分頁）下方 `{spacing.hero-clearance}` 開始，所以第一張卡片會蓋住頁首的下半部。
- 習慣磚塊兩欄；圖鑑手機三欄、電腦自動填滿。

### Whitespace Philosophy
用留白分組，不用外框分組。同一張卡片裡的小分組用 `{typography.caption}` 灰字小標題，例如商店的「生物寶箱」「連勝保護」。每一頁由上到下：頁首 → 這一頁最重要的一件事 → 其他內容 → 設定類的東西。

### Responsive Strategy

#### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Desktop | > 600px | 分頁在頁首裡、名稱下方；內容欄 720px 置中 |
| Mobile | ≤ 600px | 分頁列固定在畫面最下方；卡片內距和邊距縮小 |
| Narrow | ≤ 340px | 隱藏次要的小圖示（例如飼料旁的小蝦），讓工具列維持一行 |

#### Touch Targets
手機上可以點的東西至少 34px 高，打勾圈的點擊範圍至少 36×36px（圖形本身 22px）。

#### Collapsing Strategy
- 番茄鐘的分鐘選項在手機上排成五等分一列。
- 大海工具列放不下時，飼料的兩個標籤（FREE、PAID）改成上下疊。
- 統計格子從自動填滿改成兩欄。

#### Image Behavior
像素圖一律整數倍放大（2 倍或 3 倍），`image-rendering: pixelated`，不做非整數縮放，否則像素會糊掉。

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | `{colors.canvas}` 底色 | 頁面背景 |
| 1 | `{colors.surface}` ＋ card 陰影 | 內容卡片 |
| 1.5 | `{colors.fill}` 底色，沒有陰影 | 卡片裡的磚塊、次要按鈕 |
| 2 | `{colors.surface}` ＋ 半透明深藍遮罩 | 彈窗、底部面板 |
| 3 | toast 陰影 | 提示訊息 |

不用邊框表現層次。同一個畫面最多兩層浮在上面，例如面板加提示訊息。

### Decorative Depth
- 頁首的藍水漸層是唯一的裝飾性景深；生物只在大海頁游。
- 內容區不用漸層、不用發光效果。

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 8px | 小格子（日曆、熱度圖） |
| `{rounded.md}` | 10px | 按鈕、輸入框、分段切換 |
| `{rounded.lg}` | 12px | 磚塊、統計格子 |
| `{rounded.xl}` | 18px | 內容卡片 |
| `{rounded.modal}` | 20px | 彈窗 |
| `{rounded.full}` | 9999px | 打勾圈、標籤、開關、提示訊息、分頁上的數字 |

### Sprite Geometry
像素圖保持原本的方塊，不加圓角、不加陰影、不裁切。放在清單列左邊時，置中在一個 36px 寬的欄位裡，讓每一列的文字都對齊。

## Components

### Navigation
- **手機**（`{components.tab-bar-mobile}`）：固定在畫面最下方，白底，上緣 1px 分隔線。選中的分頁是海洋藍文字加上方 2px 線。
- **電腦**（`{components.tab-bar-desktop}`）：在頁首裡，白字 72% 透明度；選中的分頁全白，加 2px 白色底線。
- **待領取數字**（`{components.tab-badge}`）：金色圓點加深色數字，跟分頁文字同一行。

### Buttons
- `{components.button-primary}`：每個畫面最多一個，放在這一頁最重要的動作上（例如「寫好了」「全部領取」「開始專注」）。
- `{components.button-secondary}`：其他按鈕，包括清單列右邊的「領取」「購買」。
- `{components.button-ghost}`：文字型動作，例如「編輯」「取消」「＋ 再加一件」。
- `{components.segmented}`：昨天／今天／明天、番茄鐘分鐘數。選中的那一個是灰底上浮起一塊白（`{components.segmented-active}`），不用黑底。
- 停用狀態一律 40% 透明度（`{components.button-disabled}`）。

### Inputs & Forms
- `{components.input}`：白底、1px 細框、圓角 10px；focus 時框變海洋藍，外加 3px 淡藍光暈。
- 打勾一律用圓形的 `{components.check}`。任務、習慣、六件事都一樣，不混用方形 checkbox。
- 開關（`{components.toggle}`）：膠囊形，打開是綠色，圓點是白色。

### Cards & Containers
- `{components.card}`：每個區塊一張，卡片裡不再放有框的卡片。
- `{components.tile}`：習慣、統計數字、圖鑑格子。習慣磚塊只放兩行：名稱、本週進度。有連勝時，名稱右邊加一個小金色數字；不放進度條。
- `{components.list-row}`：任務、商店、紀錄、設定。左邊是打勾圈或像素圖，中間是標題加灰色說明，右邊是數值或按鈕，列與列之間 1px 分隔線。任務列右邊只顯示金幣數量，XP 放在領取後的提示訊息裡。

### Signature Components
- **頁首**（`{components.hero}`）：藍水漸層，底部是直線，上面只有名稱、等級、金幣（電腦版加分頁）。不放生物、不放動畫，海裡的生物留給大海頁。
- **大海工具列**（`{components.sea-toolbar}`）：白底，飼料標籤加三個次要按鈕，維持一行。
- **開寶箱彈窗**（`{components.modal}`）：生物像素圖放大 5 倍置中，下面是名稱、一句介紹，加一個主要按鈕。
- **提示訊息**（`{components.toast}`）：深色膠囊，畫面下方置中。

### Examples (illustrative)
- **任務列**：`{components.check-claimable}`＋「寫好清單」＋灰字「今天或明天的都可以」＋右邊 `{components.button-secondary}`「領取 +15」。
- **商店列**：像素寶箱＋「稀有寶箱」＋灰字「已收集 2/4」＋金色價格＋「購買」。
- **設定列**：「音效」＋右邊 `{components.toggle}`。

## Do's and Don'ts

### Do
- 像素圖只用在內容：生物、寶箱、小蝦、道具、logo，整數倍放大。道具也要畫成像素圖，例如連勝保護卡用像素盾牌，不用表情符號。
- 會動的東西只放在大海頁；其他頁面保持安靜，動畫只用在回饋（例如領取時金幣飛出去），並尊重系統的「減少動態效果」設定。
- 一個畫面只放一個 `{components.button-primary}`。
- 數字用 `tabular-nums`。
- 新元件先查這份文件有沒有現成的；沒有就先在這裡新增，再寫程式。

### Don't
- 不在按鈕、卡片、輸入框上用像素邊框。舊版的 `box-shadow` 四邊框要全部拿掉，頁首和內容之間也不加像素浪花。
- 不在內容卡片裡用藍色漸層。
- 不用金色、綠色、橘色當按鈕。
- 不加英文小標、不用全大寫。
- 不在卡片裡再套有邊框的卡片。
- 同一件事不要有兩種樣子（例如方形和圓形打勾混用）。

## Agent Prompt Guide

改這個網站的 UI 時：
1. 先讀這份 DESIGN.md，把用到的 tokens 寫成 CSS 變數再引用，不直接寫色碼。
2. 新畫面套用「頁首一片海＋白色卡片」的結構；大海頁例外。
3. 交出去之前檢查：有沒有超過一個主要按鈕？有沒有像素邊框？有沒有英文小標？有沒有第四種會跳出來的顏色？
4. 用 `design-preview.html` 對照元件樣子，用 `tests/ui-preview.html` 看手機和電腦兩種寬度，最後跑 `tests/index.html?auto` 的測驗。

## 上線前互動規則（2026-11-06）
- 新手主流程為選習慣 → 建立第一件事 → 餵魚，三步皆顯示「新手導覽」及目前步驟；習慣可留空，但選擇畫面不可藏在次要連結。Google 登入只供接續紀錄，有領獎進度後才提醒備份。
- 表單標題與單位固定顯示，選填欄位清楚標示；錯誤留在原欄位，不默默忽略。
- 待領獎勵可隨完成項目調整；已領獎勵不重複給。刪除支援復原。
- 同步失敗不得顯示本次「已同步」，清楚區分本機儲存與雲端狀態。
- 彈窗使用 dialog 語意與焦點管理；減少動態設定涵蓋開箱與專注裝飾。
- 隱私、備份與使用協助位於創作者內容之前。資訊文案允許選取複製。