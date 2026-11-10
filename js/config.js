// 設定：番茄鐘、獎勵數值、內建習慣、稀有度、等級稱號。想調數值改這裡。
/* ========= 可自行調整的設定 ========= */
const CONFIG = {
  feedbackUrl: 'https://forms.gle/RwXYcmxtstLFPbf76',            // 填入公開的 HTTPS 回報表單連結後，更多頁會顯示回報入口
  pomodoroMin: 25,            // 一段專注的長度；使用者選的是「整段工作階段」的總長度（5–120 分）
  pomoRewardMin: 25,          // 專注滿這麼多分鐘才有獎勵
  breakMin: 5, longBreakMin: 15, longBreakEvery: 4,   // 工作階段中：每段專注後短休息，每 4 段長休息
  dayStartHour: 0,            // 依裝置當地時間，午夜 00:00 換日
  habitDays: 66,              // Lally et al. 2010：習慣自動化所需天數中位數
  maxCustom: 3,               // 自訂習慣最多幾個（不含內建的運動）
  xp:    { check: 10, habit: 10, exercise: 20, plan: 10, anyhab: 10, pomo: 10, period: 30, top3: 15, login: 5 },
  coins: { task: 15, period: 60, welcome: 60, top3: 30, login: 15 },   // 都是 15 的倍數，好記
  rewardRows: 3,              // 六件事每天任意完成幾件有獎勵，不受排列位置影響
  sixTipDays: 3,              // 六件事的操作提示（前幾件有獎勵、拖曳排序）：寫過清單滿這麼多天之後就不再顯示
  leavePerMonth: 2,           // 每天的習慣每個月可以請幾天假（請假的那天連勝不會中斷）
  leavePerMonthWeekly: 1,     // 每週/每兩週型的習慣（例如運動）每個月可以請幾次「這一期請假」
  freeze: { price: 150, max: 2 },   // 連勝保護卡：免費假用完、又漏掉時自動用掉一張；所有習慣共用，最多帶幾張
  coinsPerDay: 120,            // 紀錄不夠時，商店用這個速度估計「要努力幾天」
  // 生物寶箱：在商店用金幣買，一種稀有度一種寶箱，開出那個稀有度裡隨機一種生物。
  // rates＝普通 / 少見 / 稀有 / 史詩 / 傳說（%），feed＝開出飼料的機率（%，只有最便宜的普通寶箱有）
  chests: [
    { id: 'c0', name: '普通寶箱', price: 40,   feed: 25, rates: [100, 0, 0, 0, 0] },
    { id: 'c1', name: '少見寶箱', price: 100,  feed: 0,  rates: [0, 100, 0, 0, 0] },
    { id: 'c2', name: '稀有寶箱', price: 250,  feed: 0,  rates: [0, 0, 100, 0, 0] },
    { id: 'c3', name: '史詩寶箱', price: 600,  feed: 0,  rates: [0, 0, 0, 100, 0] },
    { id: 'c4', name: '傳說寶箱', price: 1500, feed: 0,  rates: [0, 0, 0, 0, 100] },
  ],
  chestFeed: 5,               // 普通寶箱開出飼料時給幾顆
  shop: [
    { id: 'tea',     icon: '🧋', name: '喝一杯手搖飲',       price: 300 },
    { id: 'episode', icon: '📺', name: '追一集劇',           price: 300 },
    { id: 'sweet',   icon: '🍰', name: '吃一份甜點',         price: 500 },
    { id: 'meal',    icon: '🍜', name: '吃一頓喜歡的餐廳',   price: 1200 },
    { id: 'buy',     icon: '🛍', name: '買一樣想要很久的東西', price: 3500 },
  ],
  // 六件事的分類（不算連勝）。使用者可在「習慣・編輯」自訂，存在 S.gcats
  generalCats: [
    { id: 'work',  e: '💼', n: '工作' },
    { id: 'study', e: '📚', n: '學習' },
    { id: 'write', e: '✍️', n: '寫作' },
    { id: 'life',  e: '🏠', n: '生活' },
    { id: 'other', e: '📌', n: '其他', ph: '今天最重要的事' },
  ],
};

// 內建習慣（可改名、刪除、加回）。weeks: 0 = 每天；1、2 = 每 1／2 週至少 target 天（有 unit 的用 unit 當單位）
// kind: exercise = 可記距離時間、custom = 自訂。六件事只是清單，不算連勝
const DEFAULT_HABITS = [
  { id: 'exercise', e: '🏃', n: '運動',   kind: 'exercise', weeks: 1, target: 3 },
];
// 第一次打開時讓人勾選的習慣（desc＝畫面上的說明）。運動有專屬功能；其他都是一般習慣，unit＝次數的單位
const ONB_HABITS = [
  { id: 'exercise', e: '🏃', n: '運動', kind: 'exercise', weeks: 1, target: 3, desc: '每週 3 天，時間和距離選填' },
  { id: 'write',    e: '📝', n: '寫作', kind: 'custom',   weeks: 1, target: 1, desc: '每週 1 天，寫一點也算' },
  { id: 'read',     e: '📚', n: '閱讀', kind: 'custom',   weeks: 1, target: 3, desc: '每週 3 天' },
  { id: 'meditate', e: '🧘', n: '冥想', kind: 'custom',   weeks: 0, target: 1, desc: '每天' },
];
const ETAGS = ['其他運動', '走路', '跑步', '騎車', '重訓', '伸展／瑜伽', '游泳'];
const RARITY = [
  { name: '普通', color: 'var(--r0)' }, { name: '少見', color: 'var(--r1)' }, { name: '稀有', color: 'var(--r2)' },
  { name: '史詩', color: 'var(--r3)' }, { name: '傳說', color: 'var(--r4)' },
];
// 等級稱號照潛水證照的進階路線：[從幾級開始, 稱號, 英文, 介紹]
const RANKS = [
  [1, '浮潛客', 'Snorkeler', '戴著面鏡和呼吸管在水面看魚，還不用背氣瓶。這是遊戲自己的稱號，不是證照。'],
  [3, '體驗潛水員', 'Discover Scuba', '還不是證照，是試潛：由潛水專業人員帶著，第一次背氣瓶在水下呼吸，到開放水域最深 12 公尺。'],
  [5, '開放水域潛水員', 'Open Water・OW', '第一張潛水證照。學會基本技巧，可以和潛伴一起潛到 18 公尺。'],
  [8, '進階潛水員', 'Advanced・AOW', '必做深潛和水下導航，再自選三種（像夜潛、放流潛水），可以潛到 30 公尺。'],
  [12, '救援潛水員', 'Rescue Diver', '學會預防意外，也會處理水下緊急狀況。不只顧好自己，也能照顧潛伴。'],
  [16, '潛水長', 'Divemaster・DM', '第一個專業等級。可以帶有證照的潛水員導潛、協助教練上課，但還不能自己教課。'],
  [20, '潛水教練', 'Instructor', '可以自己開課、發證照，從開放水域、進階、救援一路教到潛水長。'],
  [25, '技術潛水員', 'Tec Diver', '超出休閒潛水的範圍：潛超過 40 公尺、計畫好減壓停留，背雙瓶加減壓氣瓶、用混合氣體。'],
  [30, '深海探險家', 'Explorer', '往更深、更少人去過的海域前進。這是遊戲自己的稱號，不是證照。'],
  [40, '海洋傳說', 'Legend', '最高的稱號。能走到這裡，代表你已經把習慣養成生活的一部分。'],
];

