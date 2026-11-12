/* =========================================================
   router.js — 換頁系統 + 鍵盤分配
   每個畫面在自己的檔案裡用 registerScreen() 登記三件事：
     onEnter()  進到這個畫面時要做什麼
     onLeave()  離開這個畫面時要做什麼（停計時器、關鏡頭…）
     onKey(e)   在這個畫面按鍵盤時要做什麼
   換頁一律用 goTo("畫面名稱")
   ========================================================= */

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

  const screen = Screens[currentScreen];
  if (screen && screen.onKey) {
    screen.onKey(e);
  }
});
