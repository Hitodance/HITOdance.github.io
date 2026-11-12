/* =========================================================
   main.js — 啟動：畫布縮放 + 決定一開始顯示哪個畫面
   ========================================================= */

// 讓 1920×1080 的畫布等比例縮放到塞滿視窗
function resizeStage() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.getElementById("stage").style.setProperty("--stage-scale", scale);
}
window.addEventListener("resize", resizeStage);
resizeStage();

// 網頁一打開就先在背景下載去背和五官偵測的模型（大約要 10 秒），等玩家拍完照就能馬上用
Cutout.preload();

// 開發用小技巧：網址後面加 #畫面名稱 可以直接跳到那一頁
// 例如 index.html#battle 直接看對戰頁，不用每次從首頁按過去
// 可以用的名稱：home dictionary intro photo model stage music loading battle result
const startScreen = location.hash.replace("#", "");
if (Screens[startScreen]) {
  goTo(startScreen);
} else {
  goTo("home");
}
