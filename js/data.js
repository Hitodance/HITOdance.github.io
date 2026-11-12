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
    example: "你這個造型超ㄅㄧㄤˋ的！",
  },
  {
    word: "啊娘喂",
    meaning: "我的媽呀（驚訝的時候喊）",
    example: "啊娘喂～怎麼這麼貴！",
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
  { word: "886", meaning: "掰掰囉", example: "我要下線了，886。" },
  { word: "醬子", meaning: "「這樣子」的連音", example: "原來是醬子喔。" },
  { word: "粉", meaning: "「很」的意思", example: "今天粉開心。" },
  { word: "偶", meaning: "「我」的意思", example: "偶也要去！" },
  {
    word: "Orz",
    meaning: "一個人跪倒在地，表示無奈、佩服",
    example: "報告明天要交…Orz",
  },
  {
    word: "啾咪",
    meaning: "裝可愛的語尾（親一下的聲音）",
    example: "明天見囉，啾咪～",
  },
];

// ---------- 1.0 引言 ----------
// 直接在引號裡換行，畫面上就會換行
const INTRO_TEXT = `廣義來說死語是指過時的流行語、網路用語。

哇哩勒！死語已經是很LKK的東西了嗎？！吧噗啦QAQ

不哭不哭眼淚是珍珠，我們研發出一款最HITO的節奏對戰遊戲，

教你各種最ㄅㄧㄤˋ的死語XD

玩完這款遊戲，你就不會再俗斃斃！`;

// ---------- 3.0 舞台 ----------
// image：舞台圖片的路徑，例如 "assets/images/stage-1.jpg"；先留空會顯示灰色方塊
const STAGES = [
  { name: "練舞室", image: "" },
  { name: "舞台二", image: "" },
  { name: "舞台三", image: "" },
  { name: "舞台四", image: "" },
  { name: "舞台五", image: "" },
  { name: "舞台六", image: "" },
];

// ---------- 4.0 音樂 ----------
// src：音樂檔路徑，例如 "assets/audio/song-1.mp3"；留空就不會播音樂
// duration：這首歌要玩幾秒（之後有音樂檔可以改成跟著音樂長度）
// bpm：這首歌的速度（每分鐘幾拍），小人會照這個速度跳舞
const SONGS = [
  {
    name: "歌曲一",
    artist: "歌手",
    image: "",
    src: "",
    duration: 20,
    bpm: 120,
  },
  {
    name: "歌曲二",
    artist: "歌手",
    image: "",
    src: "",
    duration: 20,
    bpm: 120,
  },
  {
    name: "歌曲三",
    artist: "歌手",
    image: "",
    src: "",
    duration: 20,
    bpm: 120,
  },
  {
    name: "歌曲四",
    artist: "歌手",
    image: "",
    src: "",
    duration: 20,
    bpm: 120,
  },
  {
    name: "歌曲五",
    artist: "歌手",
    image: "",
    src: "",
    duration: 20,
    bpm: 120,
  },
  {
    name: "歌曲六",
    artist: "歌手",
    image: "",
    src: "",
    duration: 20,
    bpm: 120,
  },
];
