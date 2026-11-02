// 設定：番茄鐘、獎勵數值、內建習慣、稀有度、等級稱號。想調數值改這裡。
/* ========= 可自行調整的設定 ========= */
const CONFIG = {
  pomodoroMin: 25,            // 一段專注的長度；使用者選的是「整段工作階段」的總長度（5–120 分）
  pomoRewardMin: 20,          // 專注滿這麼多分鐘才有獎勵
  breakMin: 5, longBreakMin: 15, longBreakEvery: 4,   // 工作階段中：每段專注後短休息，每 4 段長休息
  dayStartHour: 4,            // 凌晨 4 點前都算「前一天」
  habitDays: 66,              // Lally et al. 2010：習慣自動化所需天數中位數
  maxCustom: 3,               // 自訂習慣最多幾個（不含內建的六件事、Vocus、運動）
  xp:    { check: 10, habit: 10, exercise: 20, plan: 10, pomo: 10, pubchest: 30, period: 30, top3: 15 },
  coins: { base: 8, rand: 8, critChance: 0.1, period: 60, welcome: 60, top3: 30, pubchest: 40 },
  rewardRows: 3,              // 六件事每天只有前幾項打勾有獎勵，其餘只做紀錄
  coinsPerDay: 90,            // 紀錄不夠時，商店用這個速度估計「要努力幾天」
  // 生物寶箱：在商店用金幣買。rates＝普通 / 少見 / 稀有 / 史詩 / 傳說（%），feed＝開出飼料的機率（%）
  chests: [
    { id: 'shallow', name: '淺灘寶箱', price: 40,  feed: 25, rates: [85, 15, 0, 0, 0] },
    { id: 'reef',    name: '珊瑚礁寶箱', price: 100, feed: 0,  rates: [45, 40, 15, 0, 0] },
    { id: 'deep',    name: '深海寶箱', price: 250, feed: 0,  rates: [0, 45, 42, 12, 1] },
    { id: 'abyss',   name: '傳說寶箱', price: 600, feed: 0,  rates: [0, 0, 50, 44, 6] },
  ],
  chestFeed: 5,               // 淺灘寶箱開出飼料時給幾顆
  dupCoins: [2, 5, 15, 40, 100],         // 抽到重複生物時換成的金幣
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

// 內建習慣（可改名、刪除、加回）。weeks: 0 = 每天；1、2 = 每 1／2 週至少 target 天（Vocus 是篇）
// kind: vocus = 記錄發布的文章、exercise = 可記距離時間、custom = 自訂。六件事只是清單，不算連勝
const DEFAULT_HABITS = [
  { id: 'vocus',    e: '✍️', n: 'Vocus',  kind: 'vocus',    weeks: 1, target: 1 },
  { id: 'exercise', e: '🏃', n: '運動',   kind: 'exercise', weeks: 1, target: 3 },
];
const ETAGS = ['跑步', '游泳', '重訓', '潛水', '登山', '其他'];
const RARITY = [
  { name: '普通', color: 'var(--r0)' }, { name: '少見', color: 'var(--r1)' }, { name: '稀有', color: 'var(--r2)' },
  { name: '史詩', color: 'var(--r3)' }, { name: '傳說', color: 'var(--r4)' },
];
// 等級稱號照潛水證照的進階路線：[從幾級開始, 稱號]
const RANKS = [
  [1, '浮潛客'], [3, '體驗潛水員'], [5, '開放水域潛水員'], [8, '進階潛水員'], [12, '救援潛水員'],
  [16, '潛水長'], [20, '潛水教練'], [25, '技術潛水員'], [30, '深海探險家'], [40, '海洋傳說'],
];

