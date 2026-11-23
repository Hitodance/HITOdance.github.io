/* =========================================================
   bgm.js — 網站的背景音樂

   除了 QUIET_SCREENS 裡的畫面（選音樂有試聽、對戰有歌、Loading 夾在兩者中間），
   其他畫面都會循環播放背景音樂。換到安靜的畫面會淡出，換回來會從頭淡入。
   SCREEN_MUSIC 裡的畫面（例如結算頁）改播自己的音樂，一樣循環播放。

   注意：瀏覽器規定使用者要先按過鍵盤或點過滑鼠，網頁才能發出聲音。
   所以一打開網站時，在畫面上點一下滑鼠（或按任何鍵），首頁的音樂就會開始；
   這個限制只卡第一次，之後玩完回到首頁都會一直有音樂。
   想要連點都不用：展示的電腦用 Safari，在「設定 → 網站 → 自動播放」把這個網站設成「允許全部自動播放」。
   ========================================================= */

const BGM_SRC = "assets/audio/bgm.mp3";            // 背景音樂檔
const BGM_VOLUME = 0.5;                            // 音量（0 ~ 1）
const BGM_FADE_MS = 600;                           // 淡入淡出幾毫秒
const QUIET_SCREENS = ["music", "loading", "battle"];   // 這些畫面不放背景音樂

// 有自己專屬音樂的畫面：到這些畫面會改播這裡的音樂（一樣循環播放），不放原本的背景音樂
const SCREEN_MUSIC = {
  result: "assets/audio/result_award.mp3",         // 結算頁：頒獎典禮音樂
};

// 每一首音樂一個播放器：main = 原本的背景音樂，其他的用畫面名稱當名字
const bgmTracks = { main: makeTrack(BGM_SRC) };
Object.keys(SCREEN_MUSIC).forEach(function (screen) {
  bgmTracks[screen] = makeTrack(SCREEN_MUSIC[screen]);
});
let bgmWantedTrack = null;   // 現在這個畫面應該播哪一首（null = 安靜）

function makeTrack(src) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0;
  return { audio: audio, fadeTimer: null };
}

// 把某一首的音量慢慢變到 target，變完之後執行 done
function fadeBgm(track, target, done) {
  clearInterval(track.fadeTimer);
  const from = track.audio.volume;
  const start = Date.now();
  track.fadeTimer = setInterval(function () {
    const k = Math.min(1, (Date.now() - start) / BGM_FADE_MS);
    track.audio.volume = from + (target - from) * k;
    if (k >= 1) {
      clearInterval(track.fadeTimer);
      if (done) { done(); }
    }
  }, 30);
}

// 依照現在的畫面決定要播哪一首：該播的淡入，其他的淡出停掉
function updateBgm(screen) {
  if (SCREEN_MUSIC[screen]) {
    bgmWantedTrack = screen;
  } else if (QUIET_SCREENS.includes(screen)) {
    bgmWantedTrack = null;
  } else {
    bgmWantedTrack = "main";
  }

  Object.keys(bgmTracks).forEach(function (name) {
    const track = bgmTracks[name];
    if (name === bgmWantedTrack) {
      if (track.audio.paused) {
        track.audio.currentTime = 0;     // 從別的畫面回來，從頭開始播
        track.audio.play().then(function () {
          fadeBgm(track, BGM_VOLUME);
        }).catch(function () {
          // 使用者還沒按過任何鍵，瀏覽器不讓播。等下面的 keydown 再試一次
        });
      } else {
        fadeBgm(track, BGM_VOLUME);
      }
    } else if (!track.audio.paused) {
      fadeBgm(track, 0, function () {
        if (bgmWantedTrack !== name) { track.audio.pause(); }
      });
    }
  });
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
  const track = bgmTracks[bgmWantedTrack];
  if (track && track.audio.paused) {
    updateBgm(currentScreen);
  }
}
["keydown", "pointerdown", "touchstart"].forEach(function (type) {
  document.addEventListener(type, unlockBgm);
});
