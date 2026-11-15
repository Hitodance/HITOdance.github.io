/* ============ 3.0 舞台選擇 / 4.0 音樂選擇 ============
   兩頁的介面一樣，所以共用同一個 createSelectScreen()：
   左邊顯示選項的圖片，右邊是上下輪轉的選項，上下鍵選、空白鍵決定 */

const WHEEL_GAP_Y = 178;    // 每個選項上下的間距
const WHEEL_STEP_X = 105;   // 離中間越遠，往右縮多少
const WHEEL_VISIBLE = 2;    // 中間那個的上下各顯示幾個

/* ---------- 試聽設定 ----------
   停在一首歌上就自動播一段，切歌或離開這頁就停。
   每首歌從第幾秒開始試聽，寫在 js/data.js 的 previewStart */
const PREVIEW_DELAY_MS = 400;    // 停在同一首歌超過這麼久才開始播（快速轉的時候才不會一直亂播）
const PREVIEW_SECONDS = 15;      // 試聽幾秒
const PREVIEW_LOOP = true;       // 播完要不要從頭再播一次（false = 播完就安靜）
const PREVIEW_FADE_MS = 800;     // 淡入淡出幾毫秒
const PREVIEW_VOLUME = 0.7;      // 試聽的音量（0 ~ 1）

let previewAudio = null;         // 現在正在試聽的音樂
let previewTimer = null;         // 等待、換段落用的計時器
let previewFade = null;          // 淡入淡出用的計時器

// 停止試聽（切歌、離開畫面都要呼叫）
function stopPreview() {
  clearTimeout(previewTimer);
  clearInterval(previewFade);
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }
}

// 把音量慢慢變到 target
function fadeVolume(audio, target, ms) {
  clearInterval(previewFade);
  const from = audio.volume;
  const startTime = Date.now();
  previewFade = setInterval(function () {
    const k = Math.min(1, (Date.now() - startTime) / ms);
    audio.volume = from + (target - from) * k;
    if (k >= 1) { clearInterval(previewFade); }
  }, 50);
}

// 從第 start 秒開始播一段，播完看要不要重來
function playPreview(audio, start) {
  audio.currentTime = start;
  audio.play().then(function () {
    fadeVolume(audio, PREVIEW_VOLUME, PREVIEW_FADE_MS);
    // 快播完的時候先淡出
    previewTimer = setTimeout(function () {
      fadeVolume(audio, 0, PREVIEW_FADE_MS);
      previewTimer = setTimeout(function () {
        if (previewAudio !== audio) { return; }   // 已經換歌了就不用管
        if (PREVIEW_LOOP) {
          playPreview(audio, start);
        } else {
          stopPreview();
        }
      }, PREVIEW_FADE_MS);
    }, PREVIEW_SECONDS * 1000 - PREVIEW_FADE_MS);
  }).catch(function (error) {
    console.warn("試聽播不出來（通常是瀏覽器還沒允許這個分頁發出聲音）：", error);
  });
}

// 開始試聽某一首歌。沒有音樂檔（例如舞台選擇）就什麼都不做
function startPreview(item) {
  stopPreview();
  if (!item.src) { return; }

  previewTimer = setTimeout(function () {
    const audio = new Audio(item.src);
    audio.volume = 0;
    previewAudio = audio;
    audio.addEventListener("error", function () {
      console.warn("找不到音樂檔或格式不支援：", item.src);
    });
    // 要等音樂載到一點點，才有辦法跳到指定的秒數
    audio.addEventListener("loadedmetadata", function () {
      if (previewAudio !== audio) { return; }   // 載好之前就換歌了
      playPreview(audio, item.previewStart || 0);
    }, { once: true });
  }, PREVIEW_DELAY_MS);
}

/*
  options 要給：
    items      選項陣列（STAGES 或 SONGS）
    wheelId    右邊輪盤的 id
    previewId  左邊圖片的 id
    onConfirm  按空白鍵之後要做的事，會收到被選到的那個選項
*/
function createSelectScreen(options) {
  const items = options.items;
  const wheel = document.getElementById(options.wheelId);
  const preview = document.getElementById(options.previewId);
  let selected = 0;         // 目前選到第幾個
  const elements = [];      // 右邊每個選項的元素

  // 產生右邊的選項
  items.forEach(function (item) {
    const el = document.createElement("div");
    el.className = "select-item";
    el.textContent = item.name;
    if (item.artist) {
      const small = document.createElement("small");
      small.textContent = item.artist;
      el.appendChild(small);
    }
    wheel.appendChild(el);
    elements.push(el);
  });

  // 依照 selected 更新畫面
  function render() {
    elements.forEach(function (el, index) {
      // offset：這個選項離「被選到的」差幾格（0 = 正中間）
      let offset = index - selected;
      // 讓清單頭尾相接，變成輪盤
      if (offset > items.length / 2)  { offset = offset - items.length; }
      if (offset < -items.length / 2) { offset = offset + items.length; }

      const x = Math.abs(offset) * WHEEL_STEP_X;
      const y = offset * WHEEL_GAP_Y;
      el.style.transform = "translate(" + x + "px, " + y + "px)";
      el.style.opacity = Math.abs(offset) > WHEEL_VISIBLE ? 0 : 1;
      el.classList.toggle("selected", offset === 0);
    });

    // 左邊的圖片：有圖就顯示圖，沒圖先顯示名字
    const item = items[selected];
    if (item.image) {
      preview.style.backgroundImage = "url('" + item.image + "')";
      preview.textContent = "";
    } else {
      preview.style.backgroundImage = "none";
      preview.textContent = item.name + "（圖片待補）";
    }

    startPreview(item);   // 換到哪一首就試聽哪一首
  }

  function move(step) {
    selected = (selected + step + items.length) % items.length;
    render();
  }

  return {
    onEnter: function () {
      selected = 0;
      render();
    },
    onLeave: function () {
      stopPreview();
    },
    onKey: function (e) {
      if (e.code === "ArrowDown") { move(1); }
      if (e.code === "ArrowUp")   { move(-1); }
      if (e.code === "Space")     { options.onConfirm(items[selected]); }
    }
  };
}

// 3.0 舞台選擇
registerScreen("stage", createSelectScreen({
  items: STAGES,
  wheelId: "stage-wheel",
  previewId: "stage-preview",
  onConfirm: function (stage) {
    GameState.stage = stage;
    goTo("music");
  }
}));

// 4.0 音樂選擇
registerScreen("music", createSelectScreen({
  items: SONGS,
  wheelId: "music-wheel",
  previewId: "music-preview",
  onConfirm: function (song) {
    GameState.song = song;
    goTo("loading");
  }
}));
