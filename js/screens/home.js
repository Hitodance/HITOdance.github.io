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
      goTo("dictionary");
    }
  }
});
