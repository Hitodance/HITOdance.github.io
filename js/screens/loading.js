/* ============ Loading ============
   進度條跑完自動進對戰。目前是固定跑 LOADING_MS 毫秒的假進度條，
   之後可以改成真的等音樂、圖片載入完成 */

const LOADING_MS = 5000;    // 進度條跑多久（也是玩家看玩法說明的時間）

const loadingFillEl = document.getElementById("loading-fill");
const loadingPercentEl = document.getElementById("loading-percent");
let loadingTimer = null;

registerScreen("loading", {
  onEnter: function () {
    const startTime = Date.now();
    loadingTimer = setInterval(function () {
      const percent = Math.min(100, (Date.now() - startTime) / LOADING_MS * 100);
      loadingFillEl.style.width = percent + "%";
      loadingPercentEl.textContent = Math.floor(percent);
      if (percent >= 100) {
        clearInterval(loadingTimer);
        goTo("battle");
      }
    }, 50);
  },

  onLeave: function () {
    clearInterval(loadingTimer);
  }
});
