/* ============ 3.0 舞台選擇 / 4.0 音樂選擇 ============
   兩頁的介面一樣，所以共用同一個 createSelectScreen()：
   左邊顯示選項的圖片，右邊是上下輪轉的選項，上下鍵選、空白鍵決定 */

const WHEEL_GAP_Y = 178;    // 每個選項上下的間距
const WHEEL_STEP_X = 105;   // 離中間越遠，往右縮多少
const WHEEL_VISIBLE = 2;    // 中間那個的上下各顯示幾個

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
