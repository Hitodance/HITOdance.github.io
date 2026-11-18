/* =========================================================
   bgm.js — 網站的背景音樂

   除了 QUIET_SCREENS 裡的畫面（選音樂有試聽、對戰有歌、Loading 夾在兩者中間），
   其他畫面都會循環播放背景音樂。換到安靜的畫面會淡出，換回來會從頭淡入。

   注意：瀏覽器規定使用者要先按過鍵盤或點過滑鼠，網頁才能發出聲音。
   所以一打開網站時，在畫面上點一下滑鼠（或按任何鍵），首頁的音樂就會開始；
   這個限制只卡第一次，之後玩完回到首頁都會一直有音樂。
   想要連點都不用：展示的電腦用 Safari，在「設定 → 網站 → 自動播放」把這個網站設成「允許全部自動播放」。
   ========================================================= */

const BGM_SRC = "assets/audio/bgm.mp3";            // 背景音樂檔
const BGM_VOLUME = 0.5;                            // 音量（0 ~ 1）
const BGM_FADE_MS = 600;                           // 淡入淡出幾毫秒
const QUIET_SCREENS = ["music", "loading", "battle"];   // 這些畫面不放背景音樂

const bgmAudio = new Audio(BGM_SRC);
bgmAudio.loop = true;
bgmAudio.volume = 0;
let bgmFadeTimer = null;
let bgmWanted = false;       // 現在這個畫面應不應該有背景音樂

// 把音量慢慢變到 target，變完之後執行 done
function fadeBgm(target, done) {
  clearInterval(bgmFadeTimer);
  const from = bgmAudio.volume;
  const start = Date.now();
  bgmFadeTimer = setInterval(function () {
    const k = Math.min(1, (Date.now() - start) / BGM_FADE_MS);
    bgmAudio.volume = from + (target - from) * k;
    if (k >= 1) {
      clearInterval(bgmFadeTimer);
      if (done) { done(); }
    }
  }, 30);
}

// 依照現在的畫面決定要播還是停
function updateBgm(screen) {
  bgmWanted = !QUIET_SCREENS.includes(screen);
  if (bgmWanted) {
    if (bgmAudio.paused) {
      bgmAudio.currentTime = 0;          // 從安靜的畫面回來，從頭開始播
      bgmAudio.play().then(function () {
        fadeBgm(BGM_VOLUME);
      }).catch(function () {
        // 使用者還沒按過任何鍵，瀏覽器不讓播。等下面的 keydown 再試一次
      });
    } else {
      fadeBgm(BGM_VOLUME);
    }
  } else if (!bgmAudio.paused) {
    fadeBgm(0, function () {
      if (!bgmWanted) { bgmAudio.pause(); }
    });
  }
}

// 每次換頁都檢查一次：把 router.js 的 goTo 包一層，換完頁之後順便更新背景音樂
const goToWithoutBgm = goTo;
goTo = function (name) {
  goToWithoutBgm(name);
  updateBgm(name);
};

// 一打開網頁就先試著播放（瀏覽器有開放自動播放的話，首頁一打開就有音樂）
// 不行的話，等使用者第一次按鍵或點滑鼠，瀏覽器允許發出聲音的那一刻補播
function unlockBgm() {
  if (bgmWanted && bgmAudio.paused) {
    updateBgm(currentScreen);
  }
}
["keydown", "pointerdown", "touchstart"].forEach(function (type) {
  document.addEventListener(type, unlockBgm);
});
