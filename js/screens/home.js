/* ============ 0.0 首頁 ============ */

registerScreen("home", {
  onEnter: function () {
    resetGame();   // 回到首頁就全部重來
  },

  onKey: function (e) {
    if (e.code === "Space") {
      goTo("intro");
    }
    if (e.code === "KeyD") {
      WordDrop.play(function () { goTo("dictionary"); }); // 死語掉下來的轉場（桃紅）
    }
    if (e.code === "KeyC") {
      goTo("credits");
    }
  }
});
