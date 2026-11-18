/* ============ 0.2 版權資訊 ============
   首頁按 C 進來，內容直接寫在 index.html 的 #screen-credits
   （要新增或修改項目，複製一組 <div class="credits-item"> 改文字就好） */

registerScreen("credits", {
  onKey: function (e) {
    if (e.code === "Escape" || e.code === "Space") { goTo("home"); }
  }
});
