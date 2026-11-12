/* ============ 2.1 建模動畫 ============
   拍照頁已經把照片去背、做成貼圖（GameState.skins）。
   這頁把貼圖貼到兩個低面數 3D 小人身上，從很小一路旋轉放大轉出來。
   小人怎麼畫的在 js/lib/lowpoly.js，轉幾秒、轉幾圈可以改那邊的 LOOK */

const modelHintEl = document.getElementById("model-hint");
const modelViewers = {
  p1: LowPoly.create(document.getElementById("model-canvas-p1"), "p1"),
  p2: LowPoly.create(document.getElementById("model-canvas-p2"), "p2")
};
let modelTimer = null;
let modelReady = false;

registerScreen("model", {
  onEnter: function () {
    modelReady = false;
    modelHintEl.classList.add("hidden");

    ["p1", "p2"].forEach(function (player) {
      modelViewers[player].setSkin(getSkin(player));
      modelViewers[player].play("spin");
    });

    // 等小人轉到變大之後，才顯示「按空白鍵進入下一步」
    modelTimer = setTimeout(function () {
      modelReady = true;
      modelHintEl.classList.remove("hidden");
    }, LowPoly.LOOK.spinSeconds * 1000 + 300);
  },

  onLeave: function () {
    clearTimeout(modelTimer);
    modelViewers.p1.stop();
    modelViewers.p2.stop();
  },

  onKey: function (e) {
    if (e.code === "Space" && modelReady) {
      goTo("stage");
    }
  }
});
