// 生物：像素圖、圖鑑資料、三種成長型態（幼體 JUV／成體／特殊型態 MORPH）與每種生物的實際顏色。
/* ========= 像素圖 ========= */
const PAL = { k:'#1a1c2c', w:'#f4f4f4', o:'#ef7d57', y:'#ffcd75', b:'#41a6f6', n:'#3b5dc9', c:'#73eff7',
  g:'#38b764', G:'#257179', P:'#b267e6', r:'#e43b44', s:'#94b0c2', S:'#566c86', t:'#a0703c', K:'#2a2016', 2:'#c58a22' };   // 2＝深金（傳說寶箱的鐵條）
const FISH = [
  '.....kkkk....',
  '...kkAAAAkk..',
  'kk.kAAAAAAAk.',
  'kAkAAAAAAAkAk',
  'kAAAAAAAAAAAk',
  'kAkAAAAAAAAk.',
  'kk.kAAAAAAk..',
  '...kkAAAAk...',
  '.....kkkk....',
];
function fish(body, stripes = {}, top) {
  const rows = FISH.map(r => [...r].map((ch, i) => ch === 'A' ? (stripes[i] || body) : ch).join(''));
  return top ? [top, ...rows] : rows;
}
const CHEST = ['.kkkkkkkkkk.','kttttttttttk','kttttttttttk','kyyyyyyyyyyk','ktttkyyktttk',
  'ktttkyyktttk','kttttkkttttk','kttttttttttk','kyyyyyyyyyyk','.kkkkkkkkkk.'];
// 每種稀有度的寶箱：箱身和鐵條換成那個稀有度的顏色（普通是木頭配銀條，其他配金條，傳說是金箱配深金條）
const CHEST_COLORS = [['t', 's'], ['g', 'y'], ['b', 'y'], ['P', 'y'], ['y', '2']];
const chestPx = r => { const [body, band] = CHEST_COLORS[r] || CHEST_COLORS[0]; return CHEST.map(row => row.replace(/[ty]/g, ch => ch === 't' ? body : band)); };

// 連勝保護卡的像素盾牌
const SHIELD = ['..kkkkk..', '.kbbbbbk.', 'kbbwbbbbk', 'kbbwbbbbk', 'kbbbbbbbk', '.kbbbbbk.', '..kbbbk..', '...kbk...', '....k....'];
const SHRIMP = ['k.k.............','.k.k............','..kkkkkkk.......','..kwkooooookk....','..kkoowooooooook.','...koooooooooookk','....kkoooooookk.k','......kokokokk...','.......k.k.k.....'];

const CREATURES = [
  { id:'clown', name:'小丑魚', r:0, fact:'住在海葵裡，出生時全是雄性。', px: fish('o', {4:'w', 8:'w'}) },
  { id:'damsel', name:'藍魔鬼雀鯛', r:0, fact:'珊瑚礁上最常見的亮藍色小魚。', px: fish('b', {1:'c', 2:'c'}) },
  { id:'butterfly', name:'蝴蝶魚', r:0, fact:'多半成對生活，在礁石間一起覓食。', px: ['........kkkkkkk', '......kkyyyyyyykk', '.....kyyyyyyyyyyyk', '....kyyyykkyyyyyykk', 'kkk.kyyyykkyyyyyykyk', 'kyykkyyyyyyyyyyyywyyk', 'kyyyyyyyyyyyyyyyykyyykk', 'kyyyyyyyyyyyyyyyykyyykk', 'kyykkyyyyyyyyyyyykyyk', 'kkk.kyyyyyyyyyyyykyk', '....kyyyyyyyyyyyykk', '.....kyyyyyyyyyyyk', '......kkyyyyyyykk', '........kkkkkkk'] },
  { id:'star', name:'海星', r:0, fact:'沒有腦，斷掉的腕還能再長回來。', px: ['......k......','.....kok.....','.....kok.....','....koook....','kkkkkoyokkkkk','kooooyyyooook','.kkooyyyookk.','...koooook...','..kooo.oook..','..koo...ook..','.koo.....ook.','.kk.......kk.'] },
  { id:'hermit', name:'寄居蟹', r:0, fact:'長大就要換更大的殼——跟習慣一樣。', px: ['............kk','...........ktk','..........kttk','.........kkkkk','........kttttk','.......kwttttk','......kkkkkkkk','.....kttttttttk','.k.k.ktttttttttk','.r.r.kkkkkkkkkkk','krrrrrrkttttttk','kwrrrrrrkkkkkk','krrkrrrrrk','.kk.krkrkrk','....k.k.k.k'] },
  { id:'urchin', name:'海膽', r:0, fact:'下水時最該注意別踩到的傢伙。', px: ['k....k....k','.k...k...k.','..k.kPk.k..','...kPPPk...','kkkPPPPPkkk','...kPPPk...','..k.kPk.k..','.k...k...k.','k....k....k'] },
  { id:'turtle', name:'綠蠵龜', alias:'海龜', r:1, fact:'休息時可以閉氣好幾個小時。', px: ['......kkkkkk','....kkGgGgGgkk','...kGgGgGgGgGgk','..kGgGgGgGgGgGgk..kk','..kyyyyyyyyyyyyykggk','.kkkkkkkkkkkkkkkgkgk','kgk.......kgggkkggk','.k.......kgggk.kk','........kgggk','.........kkk'] },
  { id:'octopus', name:'章魚', r:1, fact:'三顆心臟、藍色的血。', px: ['...kkkkk...','..krrrrrk..','.krrrrrrrk.','.krwkrwkrk.','.krrrrrrrk.','..krrrrrk..','.krkrkrkrk.','kr.kr.kr.rk','k..k..k...k'] },
  { id:'nudi', name:'海蛞蝓', alias:'海兔', r:1, fact:'微距攝影的最愛，配色一隻比一隻浮誇。', px: ['..o.o...o.o.o','.kPPPkkkkPPPk','kPPwPPPPPPPPk','kPPPPPwPPPPPk','.kyyyyyyyyyk.','..kkkkkkkkk..'] },
  { id:'lion', name:'獅子魚', r:1, fact:'很美，但背鰭有毒，看就好。', px: fish('r', {3:'w', 5:'w', 7:'w', 9:'w'}, '...r.r.r.r...') },
  { id:'puffer', name:'河豚', r:1, fact:'受到威脅時會吸水膨脹成一顆球。', px: ['..k..k..k..','...kkkkk...','..kyyyyyk..','.kyyyyykyk.','kkyyyyyyyyk','kyywwwwwyyk','.kwwwwwwwk.','..kkkkkkk..'] },
  { id:'cuttle', name:'烏賊', r:1, fact:'能在一瞬間改變膚色與紋路。', px: ['..kkkkkkkkkkk','.kwwwwwwwwwwwk','kwssswsssswsskk','kssswssswsssswwk','kswssssswssssswkk.s.s','ksssswssswsssskkssss','kswssssswsssskkss.s.s','.kwwwwwwwwwwwk','..kkkkkkkkkkk'] },
  { id:'seahorse', name:'海馬', r:2, fact:'由爸爸懷孕、生下寶寶。', px: ['..kkk...','.kyyyk..','.kykyyyk','..kyykk.','..kyyk..','.kyyyk..','kyyyyk..','kyyyk...','.kyyk...','..kyk...','.kyk....','.kk.....'] },
  { id:'shark', name:'白鰭鯊', alias:'白鰭礁鯊', r:2, fact:'白天常趴在礁洞底下休息。', px: ['..........kk............','.........kwk............','........kSSk............','kk.....kSSSSkkkkkk......','kwk.kkkSSSSSSSSSSSkkk...','.kSkSSSSSSSSSSSSSSSSkSk.','..kSSSSSSSSSSSSSSSSSSSSk','.kSkwwwwwwwwwwwwwwwwwwk.','kwk.kkkkSkkkkkSkkkkkk...','kk......kk....k.........'] },
  { id:'moray', name:'海鰻', alias:'錢鰻、海鱔', r:2, fact:'嘴巴一開一合是在呼吸，不是要咬你。', px: ['....................kkkkk.....','..................kkgggggkk...','.kkkkkkkkkkkkkkkkkgggwkggggk..','kgggyggggggyggggggggyggggggwwk','kgggggggyggggggggygggggggkk...','kggyggggggggyggggggggygggkk...','.kkgggygggggggyggggggggggwwk..','...kkkkkkkkkkkkkkkkkkkkkkkk...'] },
  { id:'jelly', name:'水母', r:2, fact:'沒有腦也沒有心臟，已在海裡活了五億年。', px: ['...kkkkk...','..kcccccck.','.kcwcccccck','kccccccccck','kkkkkkkkkkk','.c.c.c.c.c.','.c..c.c..c.','..c.c..c.c.','..c..c.c...','.c...c..c..'] },
  { id:'manta', name:'鬼蝠魟', alias:'魔鬼魚', r:3, fact:'Nusa Penida Manta Point 的明星，翼展可達 7 公尺。', px: ['.........kk..........', '........knnk.........', '........knnnk........', '.......knnnnnkk......', '......knnnnnnnnk.....', '......knnnnnnwnnk.kk.', '.....knnnnnnnnnnnkk..', 'kkkkknnnnnnnnnnnnnnk.', '.....knnnnnnnnnnnkk..', '......knnnnnnwnnk.kk.', '......knnnnnnnnk.....', '.......knnnnnkk......', '........knnnk........', '........knnk.........', '.........kk..........'] },
  { id:'mola', name:'翻車魚', r:3, fact:'Crystal Bay 的夢幻魚種，世界最重的硬骨魚。', px: ['.....k.........', '....kSk........', '...kSSk........', '...kSSkkkkk....', '..kkSSSSSSSkk..', '.kSSSSsSSSsSSk.', 'ksSsSsSsssSskwk', '.ksscsssssscsk.', '.kssssscssSssk', 'kkcscscscscscsk', '.kccccwccSccwck.', '..kkcccccwccckk.', '...kSSkkkkk....', '...kSSk........', '....kSk........', '.....k.........'] },
  { id:'dolphin', name:'海豚', r:3, fact:'睡覺時只讓半邊大腦休息。', px: ['..........kk','.........kbk','........kbbk','.....kkkbbbbkkkk','...kkbbbbbbbbbbbkk','k.kbbbbbbbbbbbbbbbk','kkbbbbbbbbbbbbbbbkbk','kbkbbbbbbbbbbbbbbbbbkkkk','k..kwwwwwwwwwwwwwwwwbbbbk','....kkkkwwwkkkkkkkkkkkk','.........kwk','..........k'] },
  { id:'whaleshark', name:'鯨鯊', r:4, fact:'世界上最大的魚，卻只吃浮游生物。', px: ['........kk........','.......knk........','k....kkknnkkkk....','kk.kknwnnnwnnnnkk.','knkknnnnwnnnnwnknk','knnnnwnnnnwnnnnnnk','kkkkwwwwwwwwwwwwk.','k...kkkkknkkkkkk..','.........k........'] },
];
const CR = Object.fromEntries(CREATURES.map(c => [c.id, c]));
// ===== 成長型態 =====
// 幼體：每種生物各自的幼體造型（參考真實的幼體樣貌）
const MINI = ['...kkk...', '.kkAAAk..', 'kAkAAAAk.', 'kAAAAAkAk', 'kAkAAAAk.', '.kkAAAk..', '...kkk...'];
function mini(body, stripes = {}, dots = []) {
  const rows = MINI.map(r => [...r].map((ch, i) => ch === 'A' ? (stripes[i] || body) : ch));
  for (const [j, i, ch] of dots) rows[j][i] = ch;
  return rows.map(r => r.join(''));
}
const JUV = {
  clown: mini('o', { 4: 'w' }),                                      // 幼魚只有一條白帶
  damsel: mini('b', { 1: 'y', 2: 'y' }),                             // 尾巴黃色
  butterfly: mini('y', {}, [[3, 3, 'k'], [2, 3, 'w'], [4, 3, 'w']]),  // 背上有假眼斑
  star: ['.....k.....','....kok....','....kok....','kkkkoookkkk','kooooyooook','.kkoooookk.','..koooook..','.kook.kook.','.kok...kok.','.kk.....kk.'],   // 五隻腳的小海星
  hermit: ['.......k','......ktk','.....kkkk','....ktttk','.k.kkkkkk','.r.ktttttk','krrrkkkkkk','kwrrrrk','.kkrkrk','...k.k'],   // 背著小小的螺殼
  urchin: ['k..k..k', '.kkPkk.', 'kkPPPkk', '.kkPkk.', 'k..k..k'],
  turtle: ['..kkkk...', '.kGgGgkk.', 'kGgGgGkgk', '.kyyyykkk', '.kgkkgk..'],   // 剛孵化的小海龜，頭大
  octopus: ['..kkk..', '.koook.', 'kowowok', 'koooook', '.koook.', '.o.o.o.', 'o.o.o.o'],   // 小章魚，腳還很短
  nudi: ['..o.o.o..', '.kPPPPPk.', 'kPwPPPwPk', '.kyyyyyk.'],
  lion: ['..r.r.r..', ...mini('r', { 3: 'w', 5: 'w' }), '..r.r....'],
  puffer: ['.k.k.k.', '..kkk..', '.kyyyk.', 'kyyykyk', 'kywwwyk', '.kwwwk.', '..kkk..'],   // 圓滾滾、全身小刺
  cuttle: ['..kkkk..', '.kwsswk.', 'kswskwsk', '.kwsswk.', '..kkkk..', '.s.s.s..'],   // 剛孵化的小烏賊，大眼睛
  seahorse: ['.kk..', 'kyyk.', 'kykyk', '.kyk.', '.kyk.', 'kyk..', '.k...'],
  shark: ['.......kk.......','......kSk.......','k....kSSSkkkk...','kwkkkSSSSSSSSkk.','.kSSSSSSSSSSSkSk','kwkkwwwwwwwwwwk.','k...kkkSkkkSk...'],
  moray: ['.............kkkk...','.kkkkkkkkkkkgwkgk...','kgggygggggygggggwwk.','kggggggyggggggkk....','.kkkkkkkkkkkkkkkwk..'],
  jelly: ['..kkk..', '.kccck.', 'kcwccck', 'kkkkkkk', '.c.c.c.', 'c..c.c.', '.c..c.c'],
  manta: ['.....kk......', '....knnnk....', '...knnnnwk.k.', '..knnnnnnnkk.', 'kkknnnnnnnnk.', '..knnnnnnnkk.', '...knnnnwk.k.', '....knnnk....', '.....kk......'],
  mola: ['....k....', '...ksk...', '.kkssskk.', 'kssssskwk', 'ksssssssk', '.kkssskk.', '...ksk...', '....k....'],   // 小翻車魚：上下兩片鰭、圓圓的身體
  dolphin: ['.....k......','....kbk.....','k..kbbbkkk..','kbkbbbbbbbkkk','k..kwwwwwwbbbk','....kkkkkkkk'],
  whaleshark: ['......k.....', '.....knk....', 'k..kknnnkkk.', 'kkknwnnwnnkk', 'k..kkwwwwwk.'],
};
// 共用調色盤以 Sweetie 16（GrafxKid）為基礎。每種生物的實際顏色（對照真實物種調整，蓋過共用調色盤）
const SPECIES_PAL = {
  clown: { o: '#ff8a1c' },                                   // 眼斑雙鋸魚：鮮橘色
  damsel: { b: '#2f6bff', c: '#2f6bff', y: '#2f6bff' },      // 藍魔鬼雀鯛：電光藍
  butterfly: { y: '#ffd23f' },
  star: { o: '#f07a3a' },
  turtle: { G: '#5e4526', g: '#9b7a45', y: '#e6d6a6' },      // 綠蠵龜的殼其實是橄欖褐色
  octopus: { r: '#b5503a', o: '#cf7556' },                   // 大部分章魚是紅褐色
  lion: { r: '#a8362e' },                                    // 魔鬼蓑鮋：紅褐色條紋
  puffer: { y: '#a8957a' },                                  // 白點叉鼻魨：灰褐色
  cuttle: { s: '#9a8466', w: '#e8dcc4' },                    // 白斑烏賊：褐色斑駁
  moray: { g: '#80868e', y: '#3a3f47' },                     // 灰色帶深灰斑點（原本的橄欖褐看起來偏綠）
  jelly: { c: '#bfe6f5' },                                   // 海月水母：半透明淡藍
  manta: { n: '#555e6e', w: '#f4f4f4' },                     // 鬼蝠魟：深灰黑色背部、白色肩斑（太黑會看不到）
  shark: { S: '#7d7f86' },
  dolphin: { b: '#7d8a99' },                                 // 海豚：灰色
  mola: { S: '#6d7a8a', s: '#9fb0c2', c: '#c9d6e3', w: '#eef3f8' },   // 翻車魚：背部深灰、肚子淡，身上有斑點
  whaleshark: { n: '#4a5d78' },                              // 鯨鯊：灰藍色帶白點
};
// 特殊型態：真實存在、比較少見的色型或近親物種，名字＋要換掉的顏色（可帶專屬的圖 px）
const MORPH = {
  clown: { n: '黑色小丑魚', map: { o: '#34343f' } },                      // 眼斑雙鋸魚的黑色型（達爾文小丑）
  damsel: { n: '黃尾雀鯛', map: { c: '#ffd23f' } },                       // 近親 Chrysiptera parasema：藍身黃尾
  butterfly: { n: '浣熊蝴蝶魚', map: { y: '#ffc61a', K: '#2a2016', r: '#5a3a1a' }, px: ['........kkkkkkk', '......kkKKKKKKKkk', '.....kyyKKKKKKKywk', '....kyyyKKKKKKyywkk', 'kkk.kyyyKKKKKyyywkkk', 'kyykkyyyKKKyyyyywkkyk', 'kyyyyyryyryyryyrykwyykk', 'kyyyyryyryyryyryykkyykk', 'kyykkyyryyryyryyykkyk', 'kkk.kyryyryyryyrykkk', '....kryyryyryyryyyk', '.....kyryyryyryyyk', '......kkyyyyyyykk', '........kkkkkkk'] },                  // 近親 Chaetodon lunula：橘黃色
  star: { n: '藍指海星', map: { o: '#2f6fd6', y: '#2f6fd6' } },           // Linckia laevigata：整隻寶藍色
  hermit: { n: '藍腿寄居蟹', map: { r: '#2f6fd6' } },                     // Clibanarius tricolor
  urchin: { n: '火焰海膽', map: { P: '#ff5a3c', k: '#b0302a' } },         // Asthenosoma varium：紅色身體和刺
  turtle: { n: '玳瑁', map: { G: '#3b2414', g: '#d79a3b', y: '#f0dca0' } },   // 綠蠵龜的近親，琥珀色龜甲，極度瀕危
  octopus: { n: '藍環章魚', map: { y: '#e3c13a', b: '#1f5fd6' }, px: ['....kkkkkkk....', '...kyyybyyyk...', '..kyyybybyyyk..', '..kybyybyybyk..', '..kbybyyybybk..', '..kybyyyyybyk..', '..kywkyyywkyk..', '...kyyyyyyyk...', '..kykykykykyk..', '.kyk.ky.yk.kyk.', 'kyk..ky.yk..kyk', 'yk...k...k...ky', 'k.............k'] },   // Hapalochlaena，身上的藍環
  nudi: { n: '藍龍海蛞蝓', map: { P: '#3d6fd6', o: '#9fd0ff', y: '#dfe9f5' } },   // Glaucus atlanticus
  lion: { n: '黑色獅子魚', map: { r: '#2b2b36' } },                       // 魔鬼蓑鮋的黑色型
  puffer: { n: '黃金河豚', map: { y: '#ffd23f' } },                       // 近親 Arothron meleagris 的金黃色型
  cuttle: { n: '火焰烏賊', map: { s: '#5a2a4a', w: '#f2c94c' } },         // Metasepia pfefferi：深紫底帶黃色
  seahorse: { n: '豆丁海馬', map: { y: '#f19ac0' } },                     // Hippocampus bargibanti
  shark: { n: '白化白鰭鯊', map: { S: '#eceef0' } },                      // 罕見的白化個體
  moray: { n: '黃邊海鰻', map: { g: '#b59a3a' } },                      // Gymnothorax flavimarginatus：黃褐色
  jelly: { n: '紫紋海刺水母', map: { c: '#c9a6e6' } },                    // Chrysaora colorata
  manta: { n: '黑化鬼蝠魟', map: { n: '#33373f', w: '#33373f' } },        // 黑色型：全身更黑、背上沒有白色肩斑
  mola: { n: '長翻車魚', map: { S: '#8fa3b8', s: '#c3d3e6', c: '#dfe8f1' } },                         // 近親 Ranzania laevis，銀色
  dolphin: { n: '中華白海豚', map: { b: '#f2b6c6', w: '#fde6ee' } },      // 台灣西海岸的粉紅色海豚
  whaleshark: { n: '白化鯨鯊', map: { n: '#dfe6ea', w: '#ffffff' } },     // 罕見的白化個體
};
// 黑色獅子魚全身暗色，黑眼睛會被吃掉，改成黃色的眼睛
MORPH.lion.px = CR.lion.px.map((r, j) => j === 4 ? r.slice(0, 10) + 'y' + r.slice(11) : r);
const stageName = (c, s) => s === 1 ? '幼體' : s === 2 ? '成體' : MORPH[c.id].n;


const spriteCache = {};
function spriteURL(rows, sil) {
  const key = rows.join('|') + sil;
  if (spriteCache[key]) return spriteCache[key];
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.' || !PAL[ch]) return;
    x.fillStyle = sil ? '#1b3a60' : PAL[ch]; x.fillRect(i, j, 1, 1);
  }));
  return spriteCache[key] = { src: cv.toDataURL(), w, h };
}
function img(rows, scale, sil = false, cls = '') {
  const s = spriteURL(rows, sil);
  return `<img class="sprite ${cls}" src="${s.src}" width="${s.w * scale}" height="${s.h * scale}" alt="">`;
}


// 生物型態共用繪圖：遊戲與圖鑑審查使用同一個入口。
// 三個完整家族的照片參考像素稿；尺寸/碰撞仍由原邏輯圖格決定。
const CREATURE_ART = {
    "mola:1":  {
                   "rows":  [
                                "....k...................",
                                "...ksk..................",
                                "...ksskk................",
                                "....kbssk...............",
                                "....kbbsk...............",
                                ".....kbbk.kkkkkk........",
                                ".....ksbskhhhhhhkk......",
                                ".....kbbbhhhhhhhhhkk....",
                                "..kkkbbbbhhhhhhhhhhhk...",
                                ".kbbbbbbbbbbbbbbhhhbbk..",
                                ".ksbbbbbbbbbbbbbbbbbbk..",
                                "ksbbbbbbbbbbbbbbbddbbbk.",
                                "ksbbbbbbbbbbbbbbbbbbbbbk",
                                "ksbbbbbbbbbbkkbbbbbbbbdk",
                                "ksbbbbbbbbbbsssbbbbbbbk.",
                                "ksbbbbbbbbbbkskbbbbbbk..",
                                "ksssswwwwwwwwwwwwwwwwk..",
                                ".kswwwwwwwwwwwwwwwwwk...",
                                ".kswwwwwwwwwwwwwwwwk....",
                                "..kssswwwwwwwwwwwkk.....",
                                "..kssssskwwwwwwkkkk.....",
                                "...kksbbskkkkkk.........",
                                ".....kbbk...............",
                                "....kbbsk...............",
                                "....kbbsk...............",
                                "...ksskk................",
                                "...ksk..................",
                                "....k..................."
                            ],
                   "palette":  {
                                   "k":  "#1a1c2c",
                                   "b":  "#a9b8c2",
                                   "s":  "#6f8392",
                                   "h":  "#d6e0e6",
                                   "w":  "#eef3f5",
                                   "d":  "#2a3240"
                               }
               },
    "dolphin:1":  {
                      "rows":  [
                                   "...........kk...................",
                                   "............kkk.................",
                                   ".............ksk................",
                                   ".............ksskk..............",
                                   "k......kkkkkkssssskkkkkkk.......",
                                   "kkk..kksssssssssssssssssk.......",
                                   ".kskkssbbbbbbbbbbbbbbbbbbkkk....",
                                   ".kkssssbbbbbbbbbbbbbbbbbbbbsk...",
                                   "...kssbbbbbbbbbbbbbbbbbbbbdbbkk.",
                                   "..ksssbbbbbbbbbbbbbbbbbbbbbbbbkk",
                                   ".ksskkkwwwwwwwwwwwwwwwwwwwwwwk..",
                                   "kssk...kkkkkwwwwwwwwwwwwwwwkk...",
                                   "kkk.........kkkkkwwwwkkkkkk.....",
                                   ".................kssk...........",
                                   "................kkkk............",
                                   "...............kk..............."
                               ],
                      "palette":  {
                                      "k":  "#1a1c2c",
                                      "b":  "#8c98a8",
                                      "s":  "#5d6878",
                                      "w":  "#eef1f4",
                                      "d":  "#15171f"
                                  }
                  },
    "whaleshark:1":  {
                         "rows":  [
                                      "kk......................kk.......................",
                                      "kssk....................kssk.....................",
                                      ".ksssk..................ksssk....................",
                                      ".kssssk.................kssssk...................",
                                      "..kssssk................ksssssk..................",
                                      "...kssssk..............ksssssssskkkkkkkk.........",
                                      "....kssssk.....kk.kkkkkssssssssssssssskkkk.......",
                                      ".....kssssk...ksskssssbbbbbwbbbbbbbwbbbbbbbkk....",
                                      "......ksssk..kssssbbbbwbbbbbbbbwbbbbbbbwbbbbbkk..",
                                      ".......ksskkkkssssbbbbbbbbwbbbbbbbwbbbbbbbbbbbbk.",
                                      "........kssssssbbbbbwbbbbbbbbwbbbbbbbdbdbdbbdbbk.",
                                      ".......ksssssssbbbbbbbbbwbbbbbbbbwbbbdbdbdbbbbbk.",
                                      "......ksssssssbbbbwbbbbbbbbwbbbbbbbbdbdbdbddddk..",
                                      ".....kssssskkkkkbbbbbbbhhhhhhhhhhhhhhhdhdhdhhhhhk",
                                      ".....ksssk.....bbbbbbhhhhhhhhhhhhhhhhhhhhhhhhhhk.",
                                      "....ksssk......kkkkbbhhhhhhhhhhhhhhhhhhhhhhhhkk..",
                                      "....kssk...........kkkhhhhhhhhhhksssskhhhhkkk....",
                                      "...kssk...............kkkkkkkkkkssssskkkkkk......",
                                      "...kk.........................kssssk.............",
                                      "............................ksssk................",
                                      "...........................kkk..................."
                                  ],
                         "palette":  {
                                         "k":  "#1a1c2c",
                                         "b":  "#3d5a78",
                                         "s":  "#2a3f57",
                                         "h":  "#dfe6ea",
                                         "w":  "#eef4f7",
                                         "d":  "#121a24"
                                     }
                     },
    "whaleshark:2":  {
                         "rows":  [
                                      "kk................................kk.............................",
                                      "kssk..............................kssk...........................",
                                      ".ksssk............................ksssk..........................",
                                      ".kssssk...........................kssssk.........................",
                                      "..kssssk..........................ksssssk........................",
                                      "..ksssssk.........................kssssssk.......................",
                                      "...ksssssk........................ksssssssk......................",
                                      "...kssssssk......................ksssssssskkkkkkkk...............",
                                      "....kssssssk........kk.......kkkkssssssssssssssssssskkkkk........",
                                      ".....kssssssk......kssk.kkkkkssssssssssssssssssssssssssskkk......",
                                      "......kssssssk....ksssssssssbbwbbbbbbbwbbbbbbbwbbbbbbbbssskk.....",
                                      ".......kssssskkkkkssssssbbbwbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbbbkk..",
                                      "........ksssssssssbbbbwbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbbbbbbbbbbk.",
                                      ".........kssssssssbbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbbdbdbdbbbdbbbk.",
                                      "........ksssssssssbbbbwbbbbbbbwbbbbbbbwbbbbbbbwbbbbdbdbdbbbbbbbk.",
                                      ".......kssssssssssbbbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbdbdbdbbbbbbbk.",
                                      "......kssssssskkkkkkbbbbbbbbbbbbbwbbbbbbbwbbbbbbbbbbdbdbdbbdddddk",
                                      ".....kssssssk......bbbbbbbbbbbhhhhhhhhhhhhhhhhhhhhhdhdhdhhhhhhhk.",
                                      ".....ksssssk.......kkkkkbbbbbbhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkk..",
                                      "....ksssssk.............bbbbbhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkk....",
                                      "....kssssk..............kkkkkkhhhhhhhhhhhhhksssssk.kkkkkkkk......",
                                      "...kssssk.....................kkkkkkkkkkkkksssssskk..............",
                                      "...ksssk................................kssssk...................",
                                      "...kssk...............................kssssk.....................",
                                      "...kkk..............................kssssk.......................",
                                      "...................................kssk..........................",
                                      "..................................kkk............................"
                                  ],
                         "palette":  {
                                         "k":  "#1a1c2c",
                                         "b":  "#3d5a78",
                                         "s":  "#2a3f57",
                                         "h":  "#dfe6ea",
                                         "w":  "#eef4f7",
                                         "d":  "#121a24"
                                     }
                     },
    "whaleshark:3":  {
                         "rows":  [
                                      "kk................................kk.............................",
                                      "kssk..............................kssk...........................",
                                      ".ksssk............................ksssk..........................",
                                      ".kssssk...........................kssssk.........................",
                                      "..kssssk..........................ksssssk........................",
                                      "..ksssssk.........................kssssssk.......................",
                                      "...ksssssk........................ksssssssk......................",
                                      "...kssssssk......................ksssssssskkkkkkkk...............",
                                      "....kssssssk........kk.......kkkkssssssssssssssssssskkkkk........",
                                      ".....kssssssk......kssk.kkkkkssssssssssssssssssssssssssskkk......",
                                      "......kssssssk....ksssssssssbbwbbbbbbbwbbbbbbbwbbbbbbbbssskk.....",
                                      ".......kssssskkkkkssssssbbbwbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbbbkk..",
                                      "........ksssssssssbbbbwbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbbbbbbbbbbk.",
                                      ".........kssssssssbbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbbdbdbdbbbdbbbk.",
                                      "........ksssssssssbbbbwbbbbbbbwbbbbbbbwbbbbbbbwbbbbdbdbdbbbbbbbk.",
                                      ".......kssssssssssbbbbbbbbbwbbbbbbbwbbbbbbbwbbbbbbbdbdbdbbbbbbbk.",
                                      "......kssssssskkkkkkbbbbbbbbbbbbbwbbbbbbbwbbbbbbbbbbdbdbdbbdddddk",
                                      ".....kssssssk......bbbbbbbbbbbhhhhhhhhhhhhhhhhhhhhhdhdhdhhhhhhhk.",
                                      ".....ksssssk.......kkkkkbbbbbbhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkk..",
                                      "....ksssssk.............bbbbbhhhhhhhhhhhhhhhhhhhhhhhhhhhhhkkk....",
                                      "....kssssk..............kkkkkkhhhhhhhhhhhhhksssssk.kkkkkkkk......",
                                      "...kssssk.....................kkkkkkkkkkkkksssssskk..............",
                                      "...ksssk................................kssssk...................",
                                      "...kssk...............................kssssk.....................",
                                      "...kkk..............................kssssk.......................",
                                      "...................................kssk..........................",
                                      "..................................kkk............................"
                                  ],
                         "palette":  {
                                         "k":  "#1a1c2c",
                                         "b":  "#c2cbd3",
                                         "s":  "#a3aeb8",
                                         "h":  "#eef1f4",
                                         "w":  "#ffffff",
                                         "d":  "#2a303a"
                                     }
                     },
    "mola:2":  {
                   "rows":  [
                                ".....kk.............................",
                                "....kssk............................",
                                "....ksssk...........................",
                                "....kshssk..........................",
                                ".....kshbssk........................",
                                ".....kshbbssk.......................",
                                "......kshbbssk......................",
                                "......kshbbbsk......................",
                                ".......kshbbskkkkkkkkkkk............",
                                ".......kshbbbkhhhhhhhhhhkk..........",
                                "......ksbbbbbhhhhhhhhhhhhkk.........",
                                "...kkksbbbbbbbhhhhhhhhhhhhhkk.......",
                                "..ksbbbbbbbbbbhhhhhhhhhhhhhbbk......",
                                ".kssbbbbbbbbbbbbbbbbbbbbbhhhhbbbbk..",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbdwbbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbddbbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk",
                                "kssbbbbbbbbbbbbbbbbkkbbbbbbbbbbbbbdk",
                                "kssbbbbbbbbbbbbbbbksssbbbbbbbbbbbbk.",
                                "kssbbbbbbbbbbbbbbbksskbbbbbbbbbbbbk.",
                                "kssbbbbbbbbbbbbbbbbkkbbbbbbbbbbbbk..",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk..",
                                "ksssssswwwwwwwwwwwwwwwwwwwwwwwwk....",
                                ".ksssswwwwwwwwwwwwwwwwwwwwwwwwk.....",
                                ".kssswwwwwwwwwwwwwwwwwwwwwwwwwk.....",
                                "..ksssswwwwwwwwwwwwwwwwwwwwwwk......",
                                "..ksssssswwwwwwwwwwwwwwwwwwkk.......",
                                "...kssssssskkwwwwwwwwwwwwkkk........",
                                "....kkksbbskkkkkkkkkkkkk............",
                                "......ksbbsk........................",
                                "......kshbsk........................",
                                "......ksbbsk........................",
                                ".....ksbbsk.........................",
                                ".....ksbbsk.........................",
                                "....ksbssk..........................",
                                "....ksssk...........................",
                                "....kssk............................",
                                ".....kk............................."
                            ],
                   "palette":  {
                                   "k":  "#1a1c2c",
                                   "b":  "#9fb0bc",
                                   "s":  "#687d8c",
                                   "h":  "#d0dbe2",
                                   "w":  "#eaf0f3",
                                   "d":  "#2a3240"
                               }
               },
    "mola:3":  {
                   "rows":  [
                                "...kk.....................................",
                                "...kssk...................................",
                                "....kssk..................................",
                                "....kshsk.................................",
                                ".....kshsk................................",
                                ".....kshbsk...............................",
                                "......kshbskkkkkkkkkkkkkkkkk..............",
                                "......kshbbkhhhhhhhhhhhhhhhhhhkk..........",
                                "....kkksbbbbhhhhhhhhhhhhhhhhhhhhhhkk......",
                                "..kssbbbbbbbhhhhhhhhhhhhhhhhhhhhhhhhbbk...",
                                ".kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbhhhhbbbk..",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbdwbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbddbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbdk",
                                "kssbbbbbbbbbbbbbbbbbbbbkkbbbbbbbbbbbbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbksssbbbbbbbbbbbbbbk.",
                                "kssbbbbbbbbbbbbbbbbbbbbkkbbbbbbbbbbbbbbk..",
                                "ksssswwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk....",
                                "ksssswwwwwwwwwwwwwwwwwwwdwwwdwwwk.........",
                                ".kssssswwwwwwwwwwwwwwwwwwwwdwwwdwk........",
                                ".ksssssswwwwwwwwwwwwwwwwwwwwwwkk..........",
                                "..ksssssskkwwwwwwwwwwwwkkk................",
                                "...kkksbbskkkkkkkkkkkk....................",
                                ".....ksbbsk...............................",
                                ".....kshbsk...............................",
                                "....ksbbsk................................",
                                "....ksbsk.................................",
                                "...ksssk..................................",
                                "...kssk...................................",
                                "...kk....................................."
                            ],
                   "palette":  {
                                   "k":  "#1a1c2c",
                                   "b":  "#b7c4cc",
                                   "s":  "#7d8c99",
                                   "h":  "#e6eef2",
                                   "w":  "#f5f8fa",
                                   "d":  "#2a3240"
                               }
               },
    "dolphin:2":  {
                      "rows":  [
                                   "......................kk.....................................",
                                   "......................ksk....................................",
                                   ".......................kssk..................................",
                                   "........................ksssk................................",
                                   ".........................kssssk..............................",
                                   "..........................ksssssk............................",
                                   "..........................kssssssk...........................",
                                   "..............kkkkkkkkkkkksssssssssskkkkkkkkkk...............",
                                   "kk..........kkksssssssssssssssssssssssssssssssssskkk.........",
                                   "kssk......kksssssssssssssssssssssssssssssssssssssssskk.......",
                                   "ksssk...kksssssssssssssssssssssssssssssssssssssssssssk.......",
                                   ".kssssskksssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbsk.......",
                                   "..ksssssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbsk.....",
                                   "...ksssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk....",
                                   "....kssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbdbbbbbbbbk....",
                                   "...ksssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkkk..",
                                   "..kssssssbbbbbwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwbbbbbbk",
                                   ".ksssssskkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwdddddddk.",
                                   "ksssssk....kkkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk......",
                                   "kssk..........kkkkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk...........",
                                   "kk..................kkkkkkkkkkbssssskkkkkkkkkkkk.............",
                                   "...............................kbsssk........................",
                                   "..............................kbssk..........................",
                                   "............................kbssk............................",
                                   "...........................ksssk.............................",
                                   "..........................kssk...............................",
                                   "..........................kk................................."
                               ],
                      "palette":  {
                                      "k":  "#1a1c2c",
                                      "b":  "#8c98a8",
                                      "s":  "#5d6878",
                                      "w":  "#eef1f4",
                                      "d":  "#15171f"
                                  }
                  },
    "dolphin:3":  {
                      "rows":  [
                                   "........................kkk..................................",
                                   ".....................kksssskk................................",
                                   "...................kkssssssssskk.............................",
                                   "................kkksssssssssssssskkk.........................",
                                   ".............kkkksssssssssssssssssssskkkkkk..................",
                                   "kk..........kkksssssssssssssssssssssssssssssssssskkk.........",
                                   "kssk......kkssssssssssssssssssshhhhssssssssssssssssskk.......",
                                   "ksssk...kksssssssssssssssssssssssssssssssssssssssssssk.......",
                                   ".kssssskksssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbsk.......",
                                   "..ksssssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbsk.........",
                                   "...ksssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbk.......",
                                   "....kssssbbbbbbbbbbbbbhhhbbbbbbbbbbbbbbbbbbbbdbbbbbbbk.......",
                                   "...ksssssbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkk.....",
                                   "..kssssssbbbbbwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwbbbbbbbk",
                                   ".ksssssskkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwdddddddddk.",
                                   "ksssssk....kkkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.......",
                                   "kssk..........kkkkkwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk...........",
                                   "kk..................kkkkkkkkkkbssssskkkkkkkkkkkk.............",
                                   "...............................kbsssk........................",
                                   "..............................kbssk..........................",
                                   "............................kbssk............................",
                                   "...........................ksssk.............................",
                                   "..........................kssk...............................",
                                   "..........................kk................................."
                               ],
                      "palette":  {
                                      "k":  "#1a1c2c",
                                      "b":  "#e8c4c4",
                                      "s":  "#b99aa3",
                                      "h":  "#9aa0a8",
                                      "w":  "#f7ecec",
                                      "d":  "#15171f"
                                  }
                  }
};
const stageCv = {};
function stageSize(c, s) {
  const rows = s === 1 ? JUV[c.id] : s === 3 && MORPH[c.id].px ? MORPH[c.id].px : c.px;
  return { w: Math.max(...rows.map(r => r.length)), h: rows.length };
}
function stageCanvas(c, s) {
  const key = c.id + s; if (stageCv[key]) return stageCv[key];
  const art = CREATURE_ART[c.id + ':' + s];
  const rows = art ? art.rows : s === 1 ? JUV[c.id] : s === 3 && MORPH[c.id].px ? MORPH[c.id].px : c.px;
  const map = art ? art.palette : { ...PAL, ...(SPECIES_PAL[c.id] || {}), ...(s === 3 ? MORPH[c.id].map : {}) };
  const cv = document.createElement('canvas'); cv.width = Math.max(...rows.map(r => r.length)); cv.height = rows.length;
  const x = cv.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === '.' || !(art ? map[ch] : PAL[ch])) return;
    x.fillStyle = map[ch]; x.fillRect(i, j, 1, 1);
  }));
  return stageCv[key] = cv;
}

// 小尺寸UI使用由同一張稿整理的縮圖，重建一格外框並保留眼嘴深色點，避免瀏覽器直接丟列。
const stageThumbs = {};
function stageThumbnail(c, s, maxW, maxH) {
  const src = stageCanvas(c, s), art = CREATURE_ART[c.id + ':' + s];
  if (!art || (src.width <= maxW && src.height <= maxH)) return src;
  const fit = Math.min(maxW / src.width, maxH / src.height), w = Math.max(1, Math.floor(src.width * fit)), h = Math.max(1, Math.floor(src.height * fit));
  const key = c.id + ':' + s + ':' + w + 'x' + h;
  if (stageThumbs[key]) return stageThumbs[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, w, h);
  const pixels = x.getImageData(0, 0, w, h).data, inside = (i, j) => i >= 0 && j >= 0 && i < w && j < h && pixels[(j * w + i) * 4 + 3] > 0;
  x.fillStyle = art.palette.k;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (inside(i, y) && [[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => !inside(i+dx,y+dy))) x.fillRect(i, y, 1, 1);
  x.fillStyle = art.palette.d;
  art.rows.forEach((r, y) => [...r].forEach((ch, i) => {
    if (ch !== 'd') return;
    const px = Math.min(w - 1, Math.floor((i + .5) * w / src.width)), py = Math.min(h - 1, Math.floor((y + .5) * h / src.height));
    if ([[0,0],[0,1],[0,-1],[1,0],[-1,0]].every(([dx,dy]) => inside(px+dx,py+dy))) x.fillRect(px, py, 1, 1);
  }));
  return stageThumbs[key] = cv;
}
