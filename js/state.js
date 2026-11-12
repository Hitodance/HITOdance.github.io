/* =========================================================
   state.js — 整場遊戲共用的資料（跨畫面要記住的東西）
   例如：拍照頁拍的照片，對戰頁和結算頁都要用到
   ========================================================= */

const GameState = {
  photos: { p1: null, p2: null },   // 兩位玩家拍到的照片（canvas）
  skins: { p1: null, p2: null },    // 去背後做成的 3D 小人貼圖（Cutout.makeSkin 的結果）
  stage: null,                  // 選到的舞台（STAGES 裡的其中一個）
  song: null,                   // 選到的歌（SONGS 裡的其中一個）
  result: {                     // 對戰成績
    p1: { score: 0, perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 },
    p2: { score: 0, perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 }
  }
};

// 把成績歸零（每次進對戰前呼叫）
function resetResult() {
  ["p1", "p2"].forEach(function (player) {
    GameState.result[player] = { score: 0, perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 };
  });
}

// 全部重來（回到首頁時呼叫）
function resetGame() {
  GameState.photos = { p1: null, p2: null };
  GameState.skins = { p1: null, p2: null };
  GameState.stage = null;
  GameState.song = null;
  resetResult();
}

// 拿某位玩家的 3D 小人貼圖。
// 還沒拍照（例如用 #battle 直接跳到後面的頁面測試）時，會用替代圖做一個
function getSkin(player) {
  if (!GameState.skins[player]) {
    if (GameState.photos[player]) {
      // 有照片但還沒處理（正常流程不會走到這裡）：用備用輪廓、不找五官
      GameState.skins[player] = Cutout.makeSkin(Cutout.fallbackCutout(GameState.photos[player]), null);
    } else {
      // 沒照片：用替代圖。替代圖的臉在哪是固定的，直接告訴它，這樣測試時也看得到大眼睛
      const fakeFace = {
        left: 180, right: 420, top: 150, chin: 470,
        eyes: [{ x: 245, y: 260, w: 55 }, { x: 355, y: 260, w: 55 }]
      };
      GameState.skins[player] = Cutout.makeSkin(Cutout.fallbackCutout(makePlaceholderPhoto(player)), fakeFace);
    }
  }
  return GameState.skins[player];
}

// 沒有鏡頭時用的替代圖：玩家代表色的底 + 一張簡單的臉，回傳 canvas
function makePlaceholderPhoto(player) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 800);
  if (player === "p1") {
    gradient.addColorStop(0, "#00FF40");
    gradient.addColorStop(1, "#00FFFF");
  } else {
    gradient.addColorStop(0, "#FF00FF");
    gradient.addColorStop(1, "#FF6500");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 800);

  // 眼睛、嘴巴
  ctx.fillStyle = "#000";
  ctx.fillRect(225, 230, 40, 60);
  ctx.fillRect(335, 230, 40, 60);
  ctx.fillRect(240, 360, 120, 24);
  // 身上寫 P1 / P2
  ctx.font = "700 130px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.toUpperCase(), 300, 690);
  return canvas;
}
