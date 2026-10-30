// 生物：像素圖、圖鑑資料、三種成長型態（幼體 JUV／成體／特殊型態 MORPH）與每種生物的實際顏色。
/* ========= 像素圖 ========= */
const PAL = { k:'#1a1c2c', w:'#f4f4f4', o:'#ef7d57', y:'#ffcd75', b:'#41a6f6', n:'#3b5dc9', c:'#73eff7',
  g:'#38b764', G:'#257179', P:'#b267e6', r:'#e43b44', s:'#94b0c2', S:'#566c86', t:'#a0703c' };
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

const CREATURES = [
  { id:'clown', name:'小丑魚', r:0, fact:'住在海葵裡，出生時全是雄性。', px: fish('o', {4:'w', 8:'w'}) },
  { id:'damsel', name:'藍魔鬼雀鯛', r:0, fact:'珊瑚礁上最常見的亮藍色小魚。', px: fish('b', {1:'c', 2:'c'}) },
  { id:'butterfly', name:'蝴蝶魚', r:0, fact:'多半成對生活，在礁石間一起覓食。', px: fish('y', {9:'k', 1:'w'}) },
  { id:'star', name:'海星', r:0, fact:'沒有腦，斷掉的腕還能再長回來。', px: ['.....k.....','....kok....','....kok....','kkkkoookkkk','kooooyooook','.kkoooookk.','...kooook..','..kok.kok..','.kok...kok.','.kk.....kk.'] },
  { id:'hermit', name:'寄居蟹', r:0, fact:'長大就要換更大的殼——跟習慣一樣。', px: ['....kkkkk...','...ktttttk..','..kttkkkttk.','..ktkttktk..','..kttkkttk..','.kkkttttk...','krrrkkkk....','krkrrk......','.k.k.k......'] },
  { id:'urchin', name:'海膽', r:0, fact:'下水時最該注意別踩到的傢伙。', px: ['k....k....k','.k...k...k.','..k.kPk.k..','...kPPPk...','kkkPPPPPkkk','...kPPPk...','..k.kPk.k..','.k...k...k.','k....k....k'] },
  { id:'turtle', name:'綠蠵龜', r:1, fact:'休息時可以閉氣好幾個小時。', px: ['.....kkkkk....','...kkGgGgGkk..','..kGgGgGgGgkkk','.kGgGgGgGgGkgk','.kyyyyyyyyykgk','..kkgkkkkgkkk.','..kgk....kgk..','...k......k...'] },
  { id:'octopus', name:'章魚', r:1, fact:'三顆心臟、藍色的血。', px: ['...kkkkk...','..krrrrrk..','.krrrrrrrk.','.krwkrwkrk.','.krrrrrrrk.','..krrrrrk..','.krkrkrkrk.','kr.kr.kr.rk','k..k..k...k'] },
  { id:'nudi', name:'海蛞蝓', r:1, fact:'微距攝影的最愛，配色一隻比一隻浮誇。', px: ['..o.o...o.o.o','.kPPPkkkkPPPk','kPPwPPPPPPPPk','kPPPPPwPPPPPk','.kyyyyyyyyyk.','..kkkkkkkkk..'] },
  { id:'lion', name:'獅子魚', r:1, fact:'很美，但背鰭有毒，看就好。', px: fish('r', {3:'w', 5:'w', 7:'w', 9:'w'}, '...r.r.r.r...') },
  { id:'puffer', name:'河豚', r:1, fact:'受到威脅時會吸水膨脹成一顆球。', px: ['..k..k..k..','...kkkkk...','..kyyyyyk..','.kyyyyykyk.','kkyyyyyyyyk','kyywwwwwyyk','.kwwwwwwwk.','..kkkkkkk..'] },
  { id:'cuttle', name:'烏賊', r:1, fact:'能在一瞬間改變膚色與紋路。', px: ['....kkkkkkkk..','...kwswswswsk.','kkkswkswswswsk','sskswswswswswk','kkksssssssssk.','...kkkkkkkkk..'] },
  { id:'seahorse', name:'海馬', r:2, fact:'由爸爸懷孕、生下寶寶。', px: ['..kkk...','.kyyyk..','.kykyyyk','..kyykk.','..kyyk..','.kyyyk..','kyyyyk..','kyyyk...','.kyyk...','..kyk...','.kyk....','.kk.....'] },
  { id:'shark', name:'白鰭鯊', r:2, fact:'白天常趴在礁洞底下休息。', px: ['.......kk.......','......kwk.......','k...kkSSkkkk....','kwkkSSSSSSSSkkk.','.kSSSSSSSSSSSkSk','kwkkwwwwwwwwwwk.','k...kkwkkkkkkk..','......kwk.......'] },
  { id:'moray', name:'裸胸鯙', r:2, fact:'嘴巴一開一合是在呼吸，不是要咬你。', px: ['..........kkkk..','...kkkkkkkgggkk.','..kgygggygggkgwk','.kgggygggyggggkk','kgkkkkkkkkkkkwwk','k...............'] },
  { id:'jelly', name:'水母', r:2, fact:'沒有腦也沒有心臟，已在海裡活了五億年。', px: ['...kkkkk...','..kcccccck.','.kcwcccccck','kccccccccck','kkkkkkkkkkk','.c.c.c.c.c.','.c..c.c..c.','..c.c..c.c.','..c..c.c...','.c...c..c..'] },
  { id:'manta', name:'鬼蝠魟', r:3, fact:'Nusa Penida Manta Point 的明星，翼展可達 7 公尺。', px: ['.........kk..........', '........knnk.........', '........knnnk........', '.......knnnnnkk......', '......knnnnnnnnk.....', '......knnnnnnwnnk.kk.', '.....knnnnnnnnnnnkk..', 'kkkkknnnnnnnnnnnnnnk.', '.....knnnnnnnnnnnkk..', '......knnnnnnwnnk.kk.', '......knnnnnnnnk.....', '.......knnnnnkk......', '........knnnk........', '........knnk.........', '.........kk..........'] },
  { id:'mola', name:'翻車魚', r:3, fact:'Crystal Bay 的夢幻魚種，世界最重的硬骨魚。', px: ['....k.......','...ksk......','.kkssskkk...','kssssssssk..','kssssssskwk.','ksswssssssk.','kssssssssssk','kswsssssssk.','.kkssssskk..','...ksssk....','....ksk.....','.....k......'] },
  { id:'dolphin', name:'海豚', r:3, fact:'睡覺時只讓半邊大腦休息。', px: ['........k.......','.......kbk......','k...kkkbbbkkk...','kbkkbbbbbbbbbkk.','.kbbbbbbbbbbkbkk','kbkkwwwwwwwwwkbk','k...kkkbkkkkkkk.','.......k........'] },
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
  star: ['....k....', '...kok...', '...kok...', 'kkkoookkk', '.kooyook.', '..koook..', '.kok.kok.', 'kok...kok', 'kk.....kk'],   // 五隻腳的小海星
  hermit: ['...kk...', '..kttk..', '.kttttk.', 'ktktkttk', 'kkkkkkkk', '.krkrk..', '.k.k.k..'],   // 背著小小的螺殼
  urchin: ['k..k..k', '.kkPkk.', 'kkPPPkk', '.kkPkk.', 'k..k..k'],
  turtle: ['..kkkk...', '.kGgGgkk.', 'kGgGgGkgk', '.kyyyykkk', '.kgkkgk..'],   // 剛孵化的小海龜，頭大
  octopus: ['..kkk..', '.koook.', 'kowowok', 'koooook', '.koook.', '.o.o.o.', 'o.o.o.o'],   // 小章魚，腳還很短
  nudi: ['..o.o.o..', '.kPPPPPk.', 'kPwPPPwPk', '.kyyyyyk.'],
  lion: ['..r.r.r..', ...mini('r', { 3: 'w', 5: 'w' }), '..r.r....'],
  puffer: ['.k.k.k.', '..kkk..', '.kyyyk.', 'kyyykyk', 'kywwwyk', '.kwwwk.', '..kkk..'],   // 圓滾滾、全身小刺
  cuttle: ['..kkkk..', '.kwsswk.', 'kswskwsk', '.kwsswk.', '..kkkk..', '.s.s.s..'],   // 剛孵化的小烏賊，大眼睛
  seahorse: ['.kk..', 'kyyk.', 'kykyk', '.kyk.', '.kyk.', 'kyk..', '.k...'],
  shark: ['....kk.....', '...kSk.....', 'k.kSSSSkk..', 'kkSSSSSSkSk', 'k.kwwwwwkk.', '....kwk....'],
  moray: ['......kkk.', '.kkkkkgggk', 'kgygygggwk', '.kkkkkkkk.'],
  jelly: ['.c.c.c.', 'ccccccc', '.ccwcc.', 'ccccccc', '.c.c.c.'],      // 碟狀幼體
  manta: ['.....kk......', '....knnnk....', '...knnnnwk.k.', '..knnnnnnnkk.', 'kkknnnnnnnnk.', '..knnnnnnnkk.', '...knnnnwk.k.', '....knnnk....', '.....kk......'],
  mola: ['....k....', '...ksk...', '.kkssskk.', 'kssssskwk', 'ksssssssk', '.kkssskk.', '...ksk...', '....k....'],   // 小翻車魚：上下兩片鰭、圓圓的身體
  dolphin: ['.....k....', '....kbk...', 'k..kbbbkk.', 'kbkbbbbkbk', 'k..kwwwkk.'],
  whaleshark: ['......k.....', '.....knk....', 'k..kknnnkkk.', 'kkknwnnwnnkk', 'k..kkwwwwwk.'],
};
// 每種生物的實際顏色（對照真實物種調整，蓋過共用調色盤）
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
  moray: { g: '#7a6a3a', y: '#2f2616' },                     // 爪哇裸胸鯙：褐色帶深色斑點
  jelly: { c: '#bfe6f5' },                                   // 海月水母：半透明淡藍
  manta: { n: '#555e6e', w: '#f4f4f4' },                     // 鬼蝠魟：深灰黑色背部、白色肩斑（太黑會看不到）
  shark: { S: '#7d7f86' },
  dolphin: { b: '#7d8a99' },                                 // 海豚：灰色
  whaleshark: { n: '#4a5d78' },                              // 鯨鯊：灰藍色帶白點
};
// 特殊型態：真實存在、比較少見的色型或近親物種，名字＋要換掉的顏色（可帶專屬的圖 px）
const MORPH = {
  clown: { n: '黑色小丑魚', map: { o: '#34343f' } },                      // 眼斑雙鋸魚的黑色型（達爾文小丑）
  damsel: { n: '黃尾雀鯛', map: { c: '#ffd23f' } },                       // 近親 Chrysiptera parasema：藍身黃尾
  butterfly: { n: '浣熊蝴蝶魚', map: { y: '#f6a623' } },                  // 近親 Chaetodon lunula：橘黃色
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
  moray: { n: '黃邊裸胸鯙', map: { g: '#b59a3a' } },                      // Gymnothorax flavimarginatus：黃褐色
  jelly: { n: '紫紋海刺水母', map: { c: '#c9a6e6' } },                    // Chrysaora colorata
  manta: { n: '黑化鬼蝠魟', map: { n: '#33373f', w: '#33373f' } },        // 黑色型：全身更黑、背上沒有白色肩斑
  mola: { n: '長翻車魚', map: { s: '#c3d3e6' } },                         // 近親 Ranzania laevis，銀色
  dolphin: { n: '中華白海豚', map: { b: '#f2b6c6', w: '#fde6ee' } },      // 台灣西海岸的粉紅色海豚
  whaleshark: { n: '白化鯨鯊', map: { n: '#dfe6ea', w: '#ffffff' } },     // 罕見的白化個體
};
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

