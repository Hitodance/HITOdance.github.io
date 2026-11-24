/* =========================================================
   word-drop.js — 著裝完成 → 舞台選擇 中間的轉場

   死語（js/data.js 的 DEAD_WORDS）變成霓虹燈管大字，從畫面上面一個一個掉下來，
   歪歪的堆在畫面最下面，越堆越高；快堆滿的時候，整堆字一起往下掉出畫面，
   掉下去之後露出來的就是舞台選擇頁。

   用法：WordDrop.play(換頁要做的事, 顏色)
     例如 WordDrop.play(function () { goTo("stage"); });           ← 桃紅色的字
          WordDrop.play(function () { goTo("home"); }, "green");    ← 螢光綠的字
   用到的地方：著裝完成 → 舞台選擇、結算 → 死語詞典、首頁 → 死語詞典（桃紅）、死語詞典 → 首頁（綠）
     換頁會在「整堆往下掉」的那一刻執行，所以字掉下去就看到新的一頁。

   想調整的數字都在下面的 DROP。
   ========================================================= */

const WordDrop = (function () {
  const DROP = {
    sizeMin: 130, // 字最小幾 px
    sizeMax: 220, // 字最大幾 px
    maxWidth: 640, // 一個詞最寬幾 px（字太多的詞會自動縮小）
    tilt: 22, // 落地時最多歪幾度（左右隨機）
    gravity: 7200, // 往下掉的重力，越大掉越快
    spawnStart: 0.14, // 一開始每隔幾秒掉一個字
    spawnEnd: 0.016, // 最後每隔幾秒掉一個字（越來越密）
    spawnRamp: 2, // 幾秒內從 spawnStart 變到 spawnEnd
    overlap: 0.5, // 字跟字疊在一起的程度（0 = 不疊、越大疊越多）
    sink: 0.35, // 字可以陷進字堆縫裡的程度（0 = 碰到最高點就停、越大越密）
    fullAt: 20, // 堆到離畫面頂端剩幾 px 就算「滿了」（0 = 堆到最頂端）
    maxSeconds: 10, // 最多堆幾秒，時間到也直接整堆掉下去
    wordBack: 0, // 每個字後面墊的一小塊黑影有多黑（0 = 沒有、1 = 全黑）
  };

  // 字的顏色：core = 燈管中間的亮芯、edge = 燈管邊緣、glow = 外面的光暈
  const COLORS = {
    pink: { core: "#ffe4fb", edge: "#ff2df1", glow: "#ff00ff" },
    green: { core: "#eaffef", edge: "#00ff40", glow: "#00ff40" },
  };
  let color = COLORS.pink; // 這次轉場用的顏色（play 的時候決定）

  const W = 1920;
  const H = 1080;
  const COL = 8; // 地面高度一格多寬（px）
  const cols = Math.ceil(W / COL);

  const canvas = document.getElementById("word-drop");
  const ctx = canvas.getContext("2d");
  const spriteCache = {};

  let words = []; // 畫面上所有的字
  let ground = []; // 每一格目前堆到哪裡（y 越小 = 堆越高）
  let stopSpawn = false; // 堆滿了，不再掉新的字
  let planned = []; // 算上「還在空中、等一下會落在這裡」的字之後，每一格會堆到哪裡（選位置用，字才會平均鋪開）
  let state = "idle"; // idle → pile（堆）→ fall（整堆掉）→ idle
  let elapsed = 0;
  let nextSpawn = 0;
  let onSwitch = null;
  let lastTime = 0;

  // ---- 把一個詞畫成霓虹燈管字的小圖（跟死語詞典的大字一樣：亮芯 + 桃紅邊 + 光暈），畫一次就存起來 ----
  function makeSprite(text, size) {
    const key = text + "@" + size + "@" + color.edge;
    if (spriteCache[key]) return spriteCache[key];
    const font = "700 " + size + 'px "Courier", "MoeLi", sans-serif';
    ctx.font = font;
    const textW = Math.ceil(ctx.measureText(text).width);
    const pad = Math.ceil(size * 0.35);
    const c = document.createElement("canvas");
    c.width = textW + pad * 2;
    c.height = Math.ceil(size * 1.3) + pad * 2;
    const g = c.getContext("2d");
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const cx = c.width / 2;
    const cy = c.height / 2;
    const stroke = Math.max(4, size * 0.07);
    // 字後面墊一小塊邊緣模糊的黑影：字疊在一起時，後面的字和畫面才會被擋住
    if (DROP.wordBack > 0) {
      g.fillStyle = "rgba(0, 0, 0, " + DROP.wordBack + ")";
      g.shadowColor = "rgba(0, 0, 0, " + DROP.wordBack + ")";
      g.shadowBlur = size * 0.25;
      const bw = textW + size * 0.2;
      const bh = size * 0.95;
      g.beginPath();
      g.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, size * 0.25);
      g.fill();
    }
    // 外圍的光暈
    g.shadowColor = color.glow;
    g.shadowBlur = size * 0.22;
    g.strokeStyle = color.edge;
    g.lineWidth = stroke;
    g.strokeText(text, cx, cy);
    g.shadowBlur = size * 0.06;
    g.strokeText(text, cx, cy);
    // 中間的亮芯
    g.shadowBlur = 0;
    g.fillStyle = color.core;
    g.fillText(text, cx, cy);
    const sprite = { img: c, w: textW, h: size * 1.05 };
    spriteCache[key] = sprite;
    return sprite;
  }

  // 一個詞歪 angle 度之後，外框有多寬多高
  function boxOf(w, h, angle) {
    const r = (angle * Math.PI) / 180;
    const c = Math.abs(Math.cos(r));
    const s = Math.abs(Math.sin(r));
    return { w: w * c + h * s, h: w * s + h * c };
  }

  // 歪的字是一條斜斜的長條：算出它每一格的底邊會碰到哪裡，找出「剛好碰到字堆」時的中心高度
  function slopeOf(w) {
    const r = (w.target * Math.PI) / 180;
    return {
      tan: Math.tan(r),
      half: w.sprite.h / 2 / Math.cos(r), // 字的半個厚度（歪了之後在垂直方向變厚一點）
      reach: (w.sprite.w / 2) * Math.cos(r), // 左右各延伸多遠
    };
  }

  function landingY(w, map) {
    map = map || ground;
    const k = slopeOf(w);
    const a = Math.max(0, Math.floor((w.x - k.reach) / COL));
    const b = Math.min(cols - 1, Math.floor((w.x + k.reach) / COL));
    const ys = [];
    for (let i = a; i <= b; i++) {
      const dx = i * COL + COL / 2 - w.x;
      // 這一格的底邊 = 中心 + dx×斜率 + 半個厚度，要剛好壓到 ground（再往下陷一點 = 疊在一起）
      ys.push(map[i] - dx * k.tan - k.half + w.sprite.h * DROP.overlap * 0.5);
    }
    if (ys.length === 0) return H - k.half;
    // 不用最高的那一點，而是讓字可以稍微陷進凸起來的地方（sink 越大越會往縫裡塞，字堆越密）
    ys.sort((p, q) => p - q);
    return ys[Math.floor((ys.length - 1) * DROP.sink)];
  }

  function raiseGround(w, map, y) {
    map = map || ground;
    y = y === undefined ? w.y : y;
    const k = slopeOf(w);
    const a = Math.max(0, Math.floor((w.x - k.reach) / COL));
    const b = Math.min(cols - 1, Math.floor((w.x + k.reach) / COL));
    for (let i = a; i <= b; i++) {
      const dx = i * COL + COL / 2 - w.x;
      const top = y + dx * k.tan - k.half + w.sprite.h * DROP.overlap;
      map[i] = Math.min(map[i], top);
    }
  }

  function spawn() {
    const list = DEAD_WORDS.map((d) => d.word);
    const text = list[Math.floor(Math.random() * list.length)];
    let size = Math.round(
      DROP.sizeMin + Math.random() * (DROP.sizeMax - DROP.sizeMin),
    );
    let sprite = makeSprite(text, size);
    if (sprite.w > DROP.maxWidth) {
      size = Math.max(60, Math.floor((size * DROP.maxWidth) / sprite.w));
      sprite = makeSprite(text, size);
    }
    const angle = (Math.random() * 2 - 1) * DROP.tilt;
    const box = boxOf(sprite.w, sprite.h, angle);

    // 隨便挑幾個位置，選堆得最低的那個，字才會平均鋪滿
    let bestX = 0;
    let bestY = -Infinity;
    for (let k = 0; k < 10; k++) {
      const x = box.w / 2 - 80 + Math.random() * (W - box.w + 160);
      const y = landingY({ x: x, target: angle, sprite: sprite }, planned);
      if (y > bestY) {
        bestY = y;
        bestX = x;
      }
    }
    // 先把這個字預定的位置記到 planned，下一個字就會挑別的地方
    raiseGround({ x: bestX, target: angle, sprite: sprite }, planned, bestY);

    words.push({
      sprite: sprite,
      x: bestX,
      y: -box.h,
      vy: 0,
      angle: angle + (Math.random() * 2 - 1) * 60, // 掉的時候先亂轉，落地前轉到 angle
      target: angle,
      spin: 0,
      box: box,
      landed: false,
      squash: 0,
    });
  }

  function update(dt) {
    elapsed += dt;

    if (state === "pile" && !stopSpawn) {
      nextSpawn -= dt;
      while (nextSpawn <= 0) {
        spawn();
        const k = Math.min(1, elapsed / DROP.spawnRamp);
        nextSpawn += DROP.spawnStart + (DROP.spawnEnd - DROP.spawnStart) * k;
      }
    }

    words.forEach(function (w) {
      if (state === "fall") {
        // 整堆一起往下掉
        w.vy += DROP.gravity * dt;
        w.y += w.vy * dt;
        w.angle += w.spin * dt;
        return;
      }
      if (w.landed) {
        w.squash = Math.max(0, w.squash - dt * 5);
        return;
      }
      w.vy += DROP.gravity * dt;
      w.y += w.vy * dt;
      w.angle += (w.target - w.angle) * Math.min(1, dt * 8);
      // 用落地時的角度算：這個字的底邊碰到字堆的時候，中心應該在哪
      const restY = landingY(w);
      if (w.y >= restY) {
        // 落地：停在字堆上面，壓扁一下，然後把字堆的高度墊高
        w.y = restY;
        w.angle = w.target;
        w.landed = true;
        w.squash = 1;
        raiseGround(w);
      }
    });

    if (state === "pile") {
      // 快滿了（大部分的地方都堆到很上面）或時間到 → 整堆掉下去
      const sorted = planned.slice().sort((p, q) => p - q);
      const high = sorted[Math.floor(cols * 0.98)]; // 98% 的地方都堆到這個高度以上
      // 預定的位置都堆滿了（或時間到）→ 不再掉新字，等空中的字都落地，再整堆掉下去
      if (high < DROP.fullAt || elapsed > DROP.maxSeconds) stopSpawn = true;
      if (stopSpawn && words.every((w) => w.landed)) startFall();
    } else if (state === "fall") {
      const allGone = words.every((w) => w.y - w.box.h > H);
      if (allGone) finish();
    }
  }

  function startFall() {
    state = "fall";
    words.forEach(function (w) {
      w.vy = -Math.random() * 400; // 有的先往上彈一下
      w.spin = (Math.random() * 2 - 1) * 90;
    });
    if (onSwitch) onSwitch(); // 換到下一頁（被字堆擋著，字掉下去才看得到）
  }

  function finish() {
    state = "idle";
    words = [];
    canvas.classList.remove("show");
    ctx.clearRect(0, 0, W, H);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    words.forEach(function (w) {
      const s = w.sprite;
      ctx.save();
      ctx.translate(w.x, w.y + w.box.h * 0.5);
      // 落地的時候壓扁一下再彈回來
      const sq = w.squash;
      ctx.scale(1 + sq * 0.12, 1 - sq * 0.18);
      ctx.translate(0, -w.box.h * 0.5);
      ctx.rotate((w.angle * Math.PI) / 180);
      ctx.drawImage(s.img, -s.img.width / 2, -s.img.height / 2);
      ctx.restore();
    });
  }

  const DROP_SPEED = 1.75; // 轉場動畫整體速度

  function loop(now) {
    if (state === "idle") return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt * DROP_SPEED);
    if (state !== "idle") draw();
    requestAnimationFrame(loop);
  }

  // colorName："pink"（預設，桃紅色）或 "green"（螢光綠）
  function play(switchScreen, colorName) {
    if (state !== "idle") return;
    onSwitch = switchScreen;
    color = COLORS[colorName] || COLORS.pink;
    words = [];
    ground = new Array(cols).fill(H);
    planned = new Array(cols).fill(H);
    stopSpawn = false;
    elapsed = 0;
    nextSpawn = 0;
    state = "pile";
    canvas.classList.add("show");
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  return {
    play: play,
    isPlaying: function () {
      return state !== "idle";
    },
    DROP: DROP,
  };
})();
