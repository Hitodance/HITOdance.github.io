/* =========================================================
   data.js — 所有「內容」都放這裡
   要改文字、加死語、加舞台、加歌，改這個檔案就好，不用動其他程式
   （下面的內容都是先放著佔位的，可以直接換掉）
   ========================================================= */

// ---------- 0.1 死語詞典 ----------
const DEAD_WORDS = [
  {
    word: "ㄅㄧㄤˋ",
    meaning: "很棒、很厲害",
    example: "這個網站超ㄅㄧㄤˋ的！",
  },
  {
    word: "阿娘喂",
    meaning: "我的媽呀（驚訝的時候喊）",
    example: "阿娘喂～怎麼這麼貴！",
  },
  {
    word: "哇哩勒",
    meaning: "傻眼、無言時的感嘆詞，類似「我的天啊」",
    example: "哇哩勒，作業明天就要交了？！",
  },
  {
    word: "LKK",
    meaning: "老扣扣，形容人年紀大、跟不上流行",
    example: "連這個都不知道，你很 LKK 欸。",
  },
  {
    word: "SPP",
    meaning: "俗斃斃，形容很俗氣",
    example: "這件衣服也太 SPP 了吧。",
  },
  { word: "安安", meaning: "打招呼用語，你好", example: "安安，幾歲住哪？" },
  {
    word: "3Q",
    meaning: "謝謝（Thank you 的諧音）",
    example: "幫我帶便當，3Q～",
  },
  { word: "886", meaning: "拜拜囉", example: "我要下線了，886。" },
  { word: "醬子", meaning: "「這樣子」的連音", example: "原來是醬子喔。" },
  { word: "粉", meaning: "「很」的意思", example: "今天粉開心。" },
  { word: "偶", meaning: "「我」的意思", example: "偶也要去！" },
  {
    word: "Orz",
    meaning: "一個人跪倒在地，表示無奈、佩服",
    example: "網站明天要檢討…Orz",
  },
  {
    word: "KUSO",
    meaning: "搞笑的感覺（來自日文）",
    example: "這個網站也太 KUSO 了吧！",
  },
  {
    word: "ㄘㄟˊ",
    meaning: "不屑、不以為然時發出的聲音",
    example: "ㄘㄟˊ，誰稀罕啊。",
  },
  {
    word: "瞎趴",
    meaning: "很炫、很拉風，有點囂張的感覺",
    example: "他騎那台新機車超瞎趴的！",
  },
  {
    word: "叭噗啦",
    meaning: "類似屁gan，表示胡說八道、瞎扯",
    example: "你叭噗啦",
  },
  {
    word: "閃光get",
    meaning: "交到男女朋友、脫單了",
    example: "我終於閃光 get 啦！",
  },
  {
    word: "告老師",
    meaning: "威脅要去打小報告（小學生把告訴老師簡化為告老師）",
    example: "你插隊！我要告老師喔！",
  },
  {
    word: "BJ4",
    meaning: "不解釋（注音首字的縮寫）",
    example: "懂的就懂，BJ4。",
  },
  {
    word: "傻眼貓咪",
    meaning: "傻眼、不敢相信",
    example: "排了兩小時結果賣完了，傻眼貓咪。",
  },
  {
    word: "櫻櫻美代子",
    meaning: "台語「閒閒沒代誌」的諧音，閒閒沒事做",
    example: "放假在家櫻櫻美代子。",
  },
  {
    word: "無言薯條",
    meaning: "無言(無鹽)薯條",
    example: "他又遲到了，我真的無言薯條。",
  },
  {
    word: "是在哈嘍",
    meaning: "「你是在幹嘛？」傻眼的吐槽",
    example: "現在才說不來，是在哈嘍？",
  },
  {
    word: "哭哭饅頭",
    meaning: "裝可愛地表示難過、想哭",
    example: "便當被吃掉了，哭哭饅頭。",
  },
  {
    word: "e04",
    meaning: "罵髒話的意思（注音鍵盤打 e04 會變成「幹」）",
    example: "電腦當機檔案沒存，e04！",
  },
  {
    word: "香蕉你個芭樂",
    meaning: "不想講髒話時的替代罵法",
    example: "香蕉你個芭樂，又輸了！",
  },
  {
    word: "屁gan",
    meaning: "表示胡說八道或瞎扯",
    example: "屁gan啦，又在騙！",
  },
];

// ---------- 1.0 引言 ----------
// 直接在引號裡換行，畫面上就會換行
const INTRO_TEXT = `廣義來說死語是指過時的流行語、網路用語。

哇哩勒！死語已經是很LKK的東西了嗎？！叭噗啦QAQ

不哭不哭眼淚是珍珠，我們研發出一款最HITO的節奏對戰遊戲，

教你各種最ㄅㄧㄤˋ的死語XD

玩完這款遊戲，你就不會再俗斃斃！`;

// ---------- 3.0 舞台 ----------
// image：舞台圖片的路徑，例如 "assets/images/stage-1.jpg"；先留空會顯示灰色方塊
// desc：左下說明框的文字（選填）。字多的時候會自動變小、換成兩行（在 css/screens.css 的 .select-desc p span.long 調字的大小）
const STAGES = [
  {
    name: "電子花車",
    image: "assets/images/stage_float.jpg",
    scene: "float",
    desc: "電子花車是臺灣獨特的民俗文化，以滿布車身的LED燈泡、煙火與彩虹燈管打造流動舞台，常見於廟會慶典與婚喪喜慶，展現熱鬧奔放的臺式美學與庶民活力。",
  }, // scene: "float" → 5.0 對戰頁用 3D 電子花車（js/lib/float-stage.js + assets/stage/float.glb）
  {
    name: "復古舞廳",
    image: "assets/images/stage_hall.jpg",
    scene: "hall",
    desc: "復古舞廳是臺灣七、八〇年代盛行的娛樂場所，以紫藍粉色燈光與旋轉迪斯可球營造華麗氛圍，伴隨著熱門舞曲，承載著一代人的青春回憶與臺式復古浪漫。",
  }, // scene: "hall" → 3D 台式復古舞廳（js/lib/hall-stage.js）
];

// ---------- 4.0 音樂 ----------
// image：封面圖路徑，要從 assets 開始寫，例如 "assets/images/song_sister.jpg"；留空會顯示灰色方塊
// src：音樂檔路徑，例如 "assets/audio/song-1.mp3"；留空就不會播音樂
// duration：這首歌要玩幾秒（之後有音樂檔可以改成跟著音樂長度）
// bpm：這首歌的速度（每分鐘幾拍），小人會照這個速度跳舞
// previewStart：在音樂選擇頁試聽時，從第幾秒開始播（想讓人聽到副歌就填副歌的秒數）
const SONGS = [
  {
    name: "姐姐",
    artist: "謝金燕",
    desc: "《姐姐》是2013年7月，台灣歌手謝金燕推出的熱舞歌曲。在MV曝光後，迅速於網上掀起「姐姐炫風」。",
    image: "assets/images/song_sister.jpg",
    src: "assets/audio/song_sister_pre.mp3",
    duration: 17.38,
    bpm: 133,
    firstBeat: 0.07,
    previewStart: 0,
  },
  {
    name: "我有我的young",
    artist: "飛輪海",
    desc: "《我有我的young》是2009年6月，台灣男子團體飛輪海推出的歌曲。這首歌的旋律輕快，歌詞充滿正能量，鼓勵年輕人勇敢追求夢想。",
    image: "assets/images/song_young.JPG",
    src: "assets/audio/song_young_pre.mp3",
    duration: 20,
    bpm: 127,
    firstBeat: 0.14,
    previewStart: 0,
  },
  {
    name: "愛你",
    artist: "王心凌",
    desc: "《愛你》發行於2004年，少女感的學院服造型，加上甜美輕快的節奏，讓王心凌憑著這首歌橫掃華語樂壇。",
    image: "assets/images/song_love.jpg",
    src: "assets/audio/song_love_pre.mp3",
    duration: 20,
    bpm: 100,
    firstBeat: 0.39,
    previewStart: 0,
  },
];
