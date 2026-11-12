/* =========================================================
   floor.js — 每一頁共用的地板動畫

   背景圖（bg.jpg）現在只有上面的光暈，地板改成用程式畫在 <canvas id="floor"> 上，
   這樣地磚的色塊才能一格一格隨機亮起來、再暗下去。

   畫法：把地板想成一大片方格，每一格離我們越遠就畫得越小、越靠近地平線（透視）。
   每一格都有自己的節奏：隔一段時間（每格不一樣長）輪到它一次，
   輪到時擲一次骰子決定這一輪要不要亮、亮什麼顏色，要亮的話就慢慢亮起來再慢慢暗掉。
   因為每一格的節奏都錯開，看起來就是色塊在地板上隨機閃爍。

   想調整的數字都集中在下面的 FLOOR。
   ========================================================= */

(function () {

  const FLOOR = {
    blink: true,            // 色塊要不要隨機閃爍（false = 色塊固定不變）
    blinkMin: 1.2,          // 一格亮一次最短幾秒
    blinkMax: 3.5,          // 一格亮一次最長幾秒（每一格會在這兩個數字之間各自不同）
    blinkSharp: 2,          // 閃的俐落程度：1 = 慢慢亮慢慢暗，數字越大亮的時間越短、越像「閃一下」

    mode: "still",          // 整片地板的移動："still" = 不動　"swing" = 往前再往後來回　"forward" = 一直往前跑
    swingTiles: 3,          // swing：來回各移動幾格
    swingSeconds: 6,        // swing：來回一趟幾秒
    forwardSpeed: 1.2,      // forward：每秒往前幾格

    tileSize: 170,          // 最靠近我們的那一排，一格有多寬（px）
    rowHeight: 38,          // 最靠近我們的那一排，一格看起來有多高（px），越小代表視角越貼近地面
    fadeStart: 0.1,         // 離地平線多近開始看得到（0 ~ 1，越小看得越遠）
    fadeEnd: 0.55,          // 到這裡完全不透明

    colorChance: 0.3,       // 每一格每一輪有多少機率會亮
    colors: ["#0b2e12", "#2a3b12", "#3a0042", "#4d0057", "#103d1c"],   // 地磚的顏色（取自 AI 檔）
    lineColor: "rgba(0, 150, 110, 0.45)",                              // 格線的顏色
    lineWidth: 1.5
  };

  const canvas = document.getElementById("floor");
  if (!canvas) { return; }
  const ctx = canvas.getContext("2d");
  const W = canvas.width;           // 1920
  const H = canvas.height;          // 地平線（canvas 最上面）到畫面最下面的高度
  const centerX = W / 2;            // 所有往遠方的線都朝這一點集中

  // 鏡頭離畫面的「距離」，由上面兩個數字決定：讓最近那排剛好是 tileSize 寬、rowHeight 高
  const DEPTH = H * FLOOR.tileSize / FLOOR.rowHeight - FLOOR.tileSize;

  // 離我們 z 遠的東西要縮小成幾倍（z = 0 是畫面最下面那條邊，倍率 1）
  function scaleAt(z) {
    return DEPTH / (DEPTH + z);
  }
  // 地板上的一個點 (x, z) → 畫面上的位置
  function screenX(x, z) { return centerX + x * scaleAt(z); }
  function screenY(z) { return H * scaleAt(z); }

  // 用「第幾列、第幾排、第幾輪」算出一個固定的 0~1 數字（看起來像亂數，但同樣的輸入永遠得到同樣的結果）
  function tileNumber(column, row, round) {
    const n = Math.sin(column * 127.1 + row * 311.7 + round * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // 最遠要畫到哪：縮到 fadeStart 倍以下就看不到了
  const farZ = DEPTH * (1 / FLOOR.fadeStart - 1);

  // 最上面漸漸消失的漸層
  const fade = ctx.createLinearGradient(0, H * FLOOR.fadeStart, 0, H * FLOOR.fadeEnd);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");

  function draw(now) {
    const t = now / 1000;
    const T = FLOOR.tileSize;

    // 地板現在往前移動了多少（單位 px）
    let offset = 0;
    if (FLOOR.mode === "swing") {
      offset = Math.sin(t / FLOOR.swingSeconds * Math.PI * 2) * FLOOR.swingTiles * T;
    } else if (FLOOR.mode === "forward") {
      offset = t * FLOOR.forwardSpeed * T;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    // 第一排是第幾排、它的下緣在哪（會是負的或 0，代表有一部分已經超出畫面下方）
    const firstRow = Math.floor(offset / T);
    const startZ = firstRow * T - offset;

    // ---- 上色的地磚 ----
    for (let z = startZ, row = firstRow; z < farZ; z += T, row++) {
      const near = Math.max(0, z);
      const far = z + T;
      const reach = Math.ceil(centerX / scaleAt(far) / T) + 1;     // 這一排左右各要畫幾格才會蓋滿畫面
      for (let column = -reach; column < reach; column++) {
        let round = 0;          // 這一格現在是第幾輪
        let brightness = 1;     // 這一格現在多亮（0 ~ 1）
        if (FLOOR.blink) {
          // 這一格自己的節奏：多久一輪、從哪裡開始算（每一格都不一樣，而且固定）
          const period = FLOOR.blinkMin + tileNumber(column, row, -1) * (FLOOR.blinkMax - FLOOR.blinkMin);
          const position = t / period + tileNumber(column, row, -2);
          round = Math.floor(position);
          // 一輪裡面：從暗 → 最亮 → 暗
          brightness = Math.pow(Math.sin((position - round) * Math.PI), FLOOR.blinkSharp);
        }
        const number = tileNumber(column, row, round);
        if (number > FLOOR.colorChance) { continue; }
        ctx.globalAlpha = brightness;
        ctx.fillStyle = FLOOR.colors[Math.floor(number / FLOOR.colorChance * FLOOR.colors.length)];
        const x0 = column * T, x1 = x0 + T;
        ctx.beginPath();
        ctx.moveTo(screenX(x0, near), screenY(near));
        ctx.lineTo(screenX(x1, near), screenY(near));
        ctx.lineTo(screenX(x1, far), screenY(far));
        ctx.lineTo(screenX(x0, far), screenY(far));
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // ---- 格線 ----
    ctx.strokeStyle = FLOOR.lineColor;
    ctx.lineWidth = FLOOR.lineWidth;
    ctx.beginPath();
    // 橫線：每一排一條
    for (let z = startZ; z < farZ; z += T) {
      if (z < 0) { continue; }
      const y = screenY(z);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    // 直線：從最遠處一路拉到畫面最下面
    const reachFar = Math.ceil(centerX / scaleAt(farZ) / T) + 1;
    for (let column = -reachFar; column <= reachFar; column++) {
      const x = column * T;
      ctx.moveTo(screenX(x, farZ), screenY(farZ));
      ctx.lineTo(screenX(x, 0), screenY(0));
    }
    ctx.stroke();

    // ---- 靠近地平線的地方漸漸消失 ----
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    if (FLOOR.blink || FLOOR.mode !== "still") {
      requestAnimationFrame(draw);
    }
  }

  requestAnimationFrame(draw);
})();
