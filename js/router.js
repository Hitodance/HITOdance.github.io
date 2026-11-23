/* =========================================================
   router.js — 換頁系統 + 鍵盤分配
   每個畫面在自己的檔案裡用 registerScreen() 登記三件事：
     onEnter()  進到這個畫面時要做什麼
     onLeave()  離開這個畫面時要做什麼（停計時器、關鏡頭…）
     onKey(e)   在這個畫面按鍵盤時要做什麼
   換頁一律用 goTo("畫面名稱")
   ========================================================= */

/* ---------- 按空白鍵進到下一頁的進場音效 ---------- */
const ENTER_SOUND = "assets/audio/sfx_enter.mp3";   // 想換別的音效就換這個檔案
const ENTER_SOUND_VOLUME = 0.2;                     // 音量（0 ~ 1）
const enterSound = new Audio(ENTER_SOUND);
enterSound.preload = "auto";

function playEnterSound() {
  const sound = enterSound.cloneNode();
  sound.volume = ENTER_SOUND_VOLUME;
  sound.play().catch(function () {});
}

const Screens = {};          // 所有登記過的畫面
let currentScreen = "";      // 目前在哪個畫面

function registerScreen(name, screen) {
  Screens[name] = screen;
}

function goTo(name) {
  // 1. 離開舊畫面
  if (currentScreen) {
    const old = Screens[currentScreen];
    if (old && old.onLeave) {
      old.onLeave();
    }
    document.getElementById("screen-" + currentScreen).classList.remove("active");
  }

  // 2. 進入新畫面
  currentScreen = name;
  document.getElementById("screen-" + name).classList.add("active");
  const next = Screens[name];
  if (next && next.onEnter) {
    next.onEnter();
  }
}

// 整個網站只有這一個鍵盤監聽，再把按鍵交給目前的畫面處理
document.addEventListener("keydown", function (e) {
  // 這些鍵瀏覽器本來會捲動頁面或移動焦點，先擋掉
  const blocked = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "Tab"];
  if (blocked.includes(e.code)) {
    e.preventDefault();
  }

  // 按住不放會一直重複觸發，這裡只算第一下
  if (e.repeat) {
    return;
  }

  // 死語掉下來的轉場還在播（js/lib/word-drop.js），先不接受按鍵
  if (typeof WordDrop !== "undefined" && WordDrop.isPlaying()) {
    return;
  }

  const screen = Screens[currentScreen];
  const before = currentScreen;
  const dropping = typeof WordDrop !== "undefined" && WordDrop.isPlaying();
  if (screen && screen.onKey) {
    screen.onKey(e);
  }

  // 按空白鍵之後換了頁（或開始播死語掉下來的轉場）→ 播進場音效
  // ESC 回上一頁、時間到自動換頁都不會響
  if (e.code === "Space") {
    const startedDrop = !dropping && typeof WordDrop !== "undefined" && WordDrop.isPlaying();
    if (currentScreen !== before || startedDrop) {
      playEnterSound();
    }
  }
});
