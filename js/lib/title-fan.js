/* =========================================================
   title-fan.js — 首頁標題上面那把「扇子」的跑燈動畫

   扇子有兩張圖疊在一起：
     assets/images/title_fan_off.png  沒亮（白色細框）
     assets/images/title_fan_on.png   亮（橘到桃紅的色塊）
   程式用遮罩決定「亮的那張」哪幾根扇骨要露出來，一根一根亮、一根一根暗。

   動畫順序（跑完一輪會從頭再來）：
     1. 從最左邊到最右邊一根一根亮
     2. 從最左邊到最右邊一根一根暗
     3. 從兩側往中間亮
     4. 整把一閃一閃（BLINK.times 次）
     5. 從最右邊到最左邊一根一根亮
     6. 從最右邊到最左邊一根一根暗
   想調整速度都在下面的 FAN。
   ========================================================= */

const TitleFan = (function () {
  const FAN = {
    rays: 17,          // 扇骨有幾根（含最下面左右兩條橫的）
    stepMs: 70,        // 每亮／暗一根要多久（越小越快）
    holdMs: 350,       // 每一段跑完之後停多久
    blinkOnMs: 220,    // 閃的時候亮多久
    blinkOffMs: 180,   // 閃的時候暗多久
    blinkTimes: 3,     // 閃幾次
    loopRestMs: 600,   // 一輪跑完、全暗之後休息多久再重來
  };

  // 亮的扇子有兩張（清楚的色塊＋模糊的霓虹光暈），兩張用同一個遮罩
  const onImgs = document.querySelectorAll(".title-fan-on");
  if (onImgs.length === 0) {
    return { FAN: FAN };
  }

  // 第 i 根扇骨（0 = 最左邊）在遮罩裡的角度範圍。
  // 遮罩是 conic-gradient，圓心在扇子底部正中間，從正左邊（from 270deg）開始順時針轉：
  // 0deg = 最左邊、90deg = 正上方、180deg = 最右邊（角度不能超過 360deg，所以要從左邊起算）
  const SPAN = 180 / (FAN.rays - 1);

  // lit：長度 = rays 的陣列，true = 這根亮
  function show(lit) {
    const stops = [];
    for (let i = 0; i < FAN.rays; i++) {
      const from = Math.max(0, (i - 0.5) * SPAN);
      const to = (i + 0.5) * SPAN;
      const color = lit[i] ? "#000" : "transparent";
      stops.push(color + " " + from.toFixed(2) + "deg " + to.toFixed(2) + "deg");
    }
    const mask = "conic-gradient(from 270deg at 50% 100%, " + stops.join(", ") +
      ", transparent " + (180 + SPAN / 2).toFixed(2) + "deg 360deg)";
    onImgs.forEach(function (img) {
      img.style.webkitMaskImage = mask;
      img.style.maskImage = mask;
    });
  }

  function all(value) {
    return new Array(FAN.rays).fill(value);
  }

  // 每一格畫面的狀態，照順序排好（ms = 這一格停多久）
  function buildTimeline() {
    const frames = [];
    const n = FAN.rays;
    function push(lit, ms) {
      frames.push({ lit: lit.slice(), ms: ms });
    }
    let lit = all(false);

    // 1. 左 → 右 亮
    for (let i = 0; i < n; i++) { lit[i] = true; push(lit, FAN.stepMs); }
    frames[frames.length - 1].ms = FAN.holdMs;
    // 2. 左 → 右 暗
    for (let i = 0; i < n; i++) { lit[i] = false; push(lit, FAN.stepMs); }
    frames[frames.length - 1].ms = FAN.holdMs;
    // 3. 兩側 → 中間 亮
    for (let i = 0; i <= Math.floor((n - 1) / 2); i++) {
      lit[i] = true;
      lit[n - 1 - i] = true;
      push(lit, FAN.stepMs * 1.4);
    }
    frames[frames.length - 1].ms = FAN.holdMs;
    // 4. 一閃一閃
    for (let k = 0; k < FAN.blinkTimes; k++) {
      push(all(false), FAN.blinkOffMs);
      push(all(true), FAN.blinkOnMs);
    }
    push(all(false), FAN.holdMs);
    lit = all(false);
    // 5. 右 → 左 亮
    for (let i = n - 1; i >= 0; i--) { lit[i] = true; push(lit, FAN.stepMs); }
    frames[frames.length - 1].ms = FAN.holdMs;
    // 6. 右 → 左 暗
    for (let i = n - 1; i >= 0; i--) { lit[i] = false; push(lit, FAN.stepMs); }
    frames[frames.length - 1].ms = FAN.loopRestMs;
    return frames;
  }

  const timeline = buildTimeline();
  let index = 0;

  function tick() {
    const frame = timeline[index];
    show(frame.lit);
    index = (index + 1) % timeline.length;
    setTimeout(tick, frame.ms);
  }

  show(all(false));
  setTimeout(tick, 400);

  return { FAN: FAN };
})();
