/* =========================================================
   main.js — 啟動：畫布縮放 + 決定一開始顯示哪個畫面
   ========================================================= */

// 畫布（1920×1080）要怎麼放進視窗：
//   "stretch" = 左右、上下各自縮放，剛好塞滿整個視窗，不會有黑邊
//               （螢幕不是 16:9 的話整個畫面會稍微被拉長或壓扁）
//   "fit"     = 等比例縮放，畫面不變形，但螢幕不是 16:9 的話旁邊會有黑邊
const STAGE_FIT = "stretch";

function resizeStage() {
  let scaleX = window.innerWidth / 1920;
  let scaleY = window.innerHeight / 1080;
  if (STAGE_FIT === "fit") {
    scaleX = Math.min(scaleX, scaleY);
    scaleY = scaleX;
  }
  document.getElementById("stage").style.transform =
    "translate(-50%, -50%) scale(" + scaleX + ", " + scaleY + ")";
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
