/* ============ 1.0 引言 ============
   文字在 js/data.js 的 INTRO_TEXT，目前的小動畫是打字機效果
   還在打字時按空白鍵 → 直接顯示全部；打完再按空白鍵 → 下一頁 */

const introTextEl = document.getElementById("intro-text");
const introJoyEl = document.getElementById("intro-joy");
let introTimer = null;
let introDone = false;

function finishIntro() {
  clearInterval(introTimer);
  introTextEl.textContent = INTRO_TEXT;
  introJoyEl.classList.add("show");   // 字跑完，歡樂一百點出場
  introDone = true;
}

registerScreen("intro", {
  onEnter: function () {
    introDone = false;
    introTextEl.textContent = "";
    introJoyEl.classList.remove("show");   // 先藏起來，動畫下次才會重播
    let count = 0;
    introTimer = setInterval(function () {
      count = count + 1;
      introTextEl.textContent = INTRO_TEXT.slice(0, count);
      if (count >= INTRO_TEXT.length) {
        finishIntro();
      }
    }, 45);   // 數字越小打字越快
  },

  onLeave: function () {
    clearInterval(introTimer);
  },

  onKey: function (e) {
    if (e.code !== "Space") { return; }
    if (introDone) {
      goTo("photo");
    } else {
      finishIntro();
    }
  }
});
