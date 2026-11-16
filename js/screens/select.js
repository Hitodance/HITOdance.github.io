/* ============ 3.0 舞台選擇 / 4.0 音樂選擇 ============
   兩頁的介面一樣，所以共用同一個 createSelectScreen()：
   左邊是霓虹外框裡的圖片和文字說明框，右邊是上下輪轉的選項，上下鍵選、空白鍵決定。
   換選項的時候：外框亮一下、圖片淡入淡出、說明框先縮起來再張開、選項上下滑動。
   樣子和動畫的速度都在 css/screens.css 的「3.0 / 4.0」那一段 */

const DESC_CLOSE_MS = 260;  // 說明框縮起來要多久（要跟 CSS 的 .select-desc transition 差不多）

/* ---------- 右邊選項框的設定 ----------
   停下來的時候（被選到的大框、沒被選到的小框），畫的是從 AI 檔切出來的原圖，造型跟 AI 檔一模一樣：
     assets/images/select/option-big-lines.png  大框的線條和蓮花
     assets/images/select/option-lines.png      小框的線條和花苞
     （-mask.png 是「條紋可以出現的範圍」，條紋本身是程式畫的，才能一直旋轉）
   只有在兩個狀態「變形的途中」（不到半秒），才改用程式在 canvas 上畫過渡形狀（下面的 drawOption），
   做出「方框展開成圓弧十字」「蓮花開花」的連續變化，頭尾再淡接回原圖。
   位置的單位是 1920×1080 畫布上的 px */
const OPTION = {
  centerX: 1410,        // 被選到的選項（大框）的中心
  centerY: 532,
  sideX: 130,           // 沒被選到的選項往右偏多少
  gapY: 358,            // 選項之間上下的距離

  moveMs: 340,          // 上下滑動要多久
  openMs: 480,          // 展開（方框 → 十字、蓮花開花）要多久
  closeMs: 280,         // 收起來要多久
  // 條紋的動畫（照螢幕錄影量出來的）：
  //   平常順時針慢慢轉；每次切換選項，會先猛轉一下，再在 spinBoostMs 內慢慢減速回平常的速度
  spinSpeed: 0.148,     // 平常的轉速（每秒轉幾個弧度，0.148 ≈ 每秒 8.5 度；0 = 不轉，負的 = 反方向）
  spinBoost: 0.87,      // 每次切換時多轉多少（弧度，0.87 ≈ 50 度；0 = 切換時不加速）
  spinBoostMs: 1000,    // 加速之後，花多久減速回平常的速度
  rays: 44,             // 條紋有幾道（AI 檔是 44 道）

  line: "#16e05c",      // 變形途中，霓虹線的顏色
  dim: 0.6              // 沒被選到的選項有多暗（1 = 跟被選到的一樣亮）
};

// AI 檔切出來的原圖。width / height 是圖在畫布上的大小，cx / cy 是圖裡面「框的正中心」的位置
const OPTION_ART = {
  big:   { file: "option-big", width: 834, height: 470, cx: 418, cy: 233, barW: 324 },
  small: { file: "option",     width: 622, height: 252, cx: 311, cy: 126, barW: 262 }
};
Object.keys(OPTION_ART).forEach(function (key) {
  const art = OPTION_ART[key];
  art.lines = new Image();
  art.lines.src = "assets/images/select/" + art.file + "-lines.png";
  art.mask = new Image();
  art.mask.src = "assets/images/select/" + art.file + "-mask.png";
});

// 兩張圖都載好了嗎？（還沒載好的那一下子，會先用程式畫的形狀頂著）
function artReady(art) {
  return art.lines.complete && art.lines.naturalWidth > 0 && art.mask.complete && art.mask.naturalWidth > 0;
}

// 畫旋轉的條紋（以原點為中心的一整圈）。顏色和漸層是照 AI 檔量的：中心淡、越往外越綠
// strength = 亮度（1 = 正常，沒被選到的選項會小於 1）
function drawRays(ctx, angle, strength) {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 330);
  gradient.addColorStop(0, "rgba(0, 255, 255, " + 0.10 * strength + ")");
  gradient.addColorStop(1, "rgba(0, 255, 64, " + 0.41 * strength + ")");
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  const step = Math.PI * 2 / OPTION.rays;
  for (let i = 0; i < OPTION.rays; i++) {
    const a = i * step;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 440, Math.sin(a) * 440);
    ctx.lineTo(Math.cos(a + step * 0.51) * 440, Math.sin(a + step * 0.51) * 440);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// 把兩個顏色照比例混在一起，顏色寫成 [r, g, b]
function mixColor(a, b, t) {
  return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + ")";
}

// 圓角方塊的路徑（中心 cx, cy，半寬 hw，半高 hh，圓角 r）
function addRoundRect(ctx, cx, cy, hw, hh, r) {
  r = Math.min(r, hw, hh);
  ctx.moveTo(cx - hw + r, cy - hh);
  ctx.arcTo(cx + hw, cy - hh, cx + hw, cy + hh, r);
  ctx.arcTo(cx + hw, cy + hh, cx - hw, cy + hh, r);
  ctx.arcTo(cx - hw, cy + hh, cx - hw, cy - hh, r);
  ctx.arcTo(cx - hw, cy - hh, cx + hw, cy - hh, r);
  ctx.closePath();
}

// 一片花瓣（從原點往上長，長 length、寬 width）
function addPetal(ctx, length, width) {
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-width * 0.78, -length * 0.28, -width * 0.55, -length * 0.74, 0, -length);
  ctx.bezierCurveTo(width * 0.55, -length * 0.74, width * 0.78, -length * 0.28, 0, 0);
  ctx.closePath();
}

/* 畫「變形途中」的選項框（停下來的時候用的是 AI 原圖，見 createSelectScreen 裡的 paintOption）。
   x, y   中心位置
   open   0 = 收起來的小框（圓角方塊 + 花苞），1 = 完全展開的大框（圓弧十字 + 盛開的蓮花）
   angle  條紋現在轉到幾度
   alpha  整個框的透明度 */
function drawOption(ctx, x, y, open, angle, alpha) {
  const line = OPTION.line;

  // ---- 形狀：一條橫的圓角方塊 + 一塊直的圓角方塊，疊在一起就是十字 ----
  // 收起來的時候，直的那塊縮到比橫的還矮，藏在裡面，所以只看得到圓角方塊
  const barW = lerp(262, 324, open);
  const barH = lerp(64, 77.5, open);
  const barR = lerp(40, 28, open);
  const bulgeW = lerp(110, 145, open);
  const bulgeH = lerp(barH - 3, 162, open);
  const bulgeR = lerp(30, 96, open);
  const rings = [lerp(15, 20, open), lerp(6, 12, open), 0];   // 三圈線，由外到內各往外擴多少

  function shape(grow) {
    ctx.beginPath();
    addRoundRect(ctx, 0, 0, barW + grow, barH + grow, barR + grow);
    addRoundRect(ctx, 0, 0, bulgeW + grow, bulgeH + grow, bulgeR + grow);
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";

  // ---- 四個內凹轉角的捲紋（展開才出現） ----
  if (open > 0.02) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = alpha * open;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (side) {
      const cx = side[0] * (bulgeW + rings[0]);
      const cy = side[1] * (barH + rings[0]);
      const start = Math.atan2(side[1], 0);            // 朝上或朝下
      const end = Math.atan2(0, side[0]);              // 朝左或朝右
      [20, 34, 48].forEach(function (radius) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * open, start, end, side[0] * side[1] > 0);
        ctx.stroke();
      });
    });
    ctx.globalAlpha = alpha;
  }

  // ---- 左右兩邊的扇形：收起來是小小的尖角，展開變成大扇子 ----
  const fanR = lerp(30, 82, open);
  const fanHalf = lerp(0.42, 0.66, open);            // 扇子張開的角度（弧度）
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  [-1, 1].forEach(function (side) {
    ctx.save();
    ctx.translate(side * (barW + rings[0]), 0);
    ctx.scale(side, 1);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = lerp(-fanHalf, fanHalf, i / 6);
      // 中間幾根扇骨展開才看得到
      if (i % 3 !== 0 && open < 0.25) { continue; }
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * fanR, Math.sin(a) * fanR);
    }
    ctx.moveTo(Math.cos(-fanHalf) * fanR, Math.sin(-fanHalf) * fanR);
    ctx.arc(0, 0, fanR, -fanHalf, fanHalf);
    ctx.stroke();
    if (open > 0.02) {                                // 扇面上的兩道弧線
      ctx.globalAlpha = alpha * open;
      ctx.beginPath();
      ctx.arc(0, 0, fanR * 0.55, -fanHalf, fanHalf);
      ctx.moveTo(Math.cos(-fanHalf) * fanR * 0.78, Math.sin(-fanHalf) * fanR * 0.78);
      ctx.arc(0, 0, fanR * 0.78, -fanHalf, fanHalf);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    ctx.restore();
  });

  // ---- 三圈霓虹線 ----
  // 每一圈：先畫粗線、再把形狀裡面塗黑，剩下露在外面的那半圈線就是外框
  //（這樣橫的和直的兩塊交疊的地方不會有多餘的線）
  rings.forEach(function (grow) {
    shape(grow);
    ctx.strokeStyle = line;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.6;                              // 露在外面的是一半，約 1.3px，跟 AI 檔的線差不多細
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.fill();
  });

  // ---- 裡面旋轉的條紋 ----
  ctx.save();
  shape(-1);
  ctx.clip();
  drawRays(ctx, angle, 1);
  ctx.restore();

  // ---- 上下的蓮花：收起來是綠色的花苞，展開時花瓣一片片張開、變成桃紅色 ----
  const bloom = open * open * (3 - 2 * open);         // 讓開花的速度前後慢、中間快
  const top = Math.max(barH, bulgeH) + lerp(rings[1], rings[0] - 8, open);
  const petalLength = lerp(54, 66, open);
  const petalWidth = lerp(24, 42, open);
  const closedColor = [5, 40, 20];
  const petals = [                                    // [張開後的角度, 長度比例, 張開後的顏色]，由外到內畫
    [1.3, 0.78, [255, 96, 64]],
    [-1.3, 0.78, [255, 96, 64]],
    [0.88, 0.9, [255, 78, 96]],
    [-0.88, 0.9, [255, 78, 96]],
    [0.45, 0.97, [255, 52, 140]],
    [-0.45, 0.97, [255, 52, 140]],
    [0, 1, [255, 40, 170]]
  ];
  [-1, 1].forEach(function (side) {
    ctx.save();
    ctx.translate(0, side * top);
    ctx.scale(1, -side);                              // 下面那朵上下顛倒
    petals.forEach(function (petal) {
      ctx.save();
      ctx.rotate(petal[0] * lerp(0.16, 1, bloom));    // 花苞的時候花瓣只張開一點點
      ctx.beginPath();
      addPetal(ctx, petalLength * lerp(1, petal[1], bloom), petalWidth);
      ctx.fillStyle = mixColor(closedColor, petal[2], bloom);
      ctx.fill();
      ctx.strokeStyle = mixColor([22, 224, 92], [255, 150, 190], bloom);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  });

  ctx.restore();
}

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
    frameId    圖片外框的 id
    descId     文字說明框的 id
    onConfirm  按空白鍵之後要做的事，會收到被選到的那個選項

  每個選項會用到的文字（都在 js/data.js）：
    name    名字
    sub     名字下面的小字（選填；歌曲沒填的話會顯示 artist）
    desc    左下說明框的文字（選填；沒填的話會顯示名字）
*/
function createSelectScreen(options) {
  const items = options.items;
  const wheel = document.getElementById(options.wheelId);
  const preview = document.getElementById(options.previewId);
  const frame = document.getElementById(options.frameId);
  const desc = document.getElementById(options.descId);
  const descText = desc.querySelector("span");
  let selected = 0;         // 目前選到第幾個
  const elements = [];      // 右邊每個選項的文字元素
  let descTimer = null;     // 說明框動畫用的計時器

  // ---- 最上面的標題改成跑馬燈：把原本的標題文字重複很多次，一直往左跑 ----
  const title = wheel.closest(".screen").querySelector(".select-title");
  const titleText = title.textContent.trim();
  const marquee = document.createElement("div");
  marquee.className = "select-marquee";
  for (let i = 0; i < 40; i++) {      // 前 20 個和後 20 個一模一樣，跑完一半剛好接回開頭
    const span = document.createElement("span");
    span.textContent = titleText;
    marquee.appendChild(span);
  }
  title.textContent = "";
  title.appendChild(marquee);

  // ---- 圖片有兩層，換選項時輪流用，才能做淡入淡出 ----
  const photos = [document.createElement("div"), document.createElement("div")];
  photos.forEach(function (photo) {
    photo.className = "select-photo";
    preview.appendChild(photo);
  });
  let frontPhoto = 0;       // 現在顯示的是哪一層

  // ---- 右邊的選項：框畫在 canvas 上，文字是疊在上面的一般文字 ----
  // canvas 蓋住畫面右半邊（x 從 900 到 1920）；內部解析度放大 1.5 倍，線條才不會糊
  const canvas = document.createElement("canvas");
  const CANVAS_LEFT = 900;
  const CANVAS_SCALE = 1.5;
  canvas.className = "select-canvas";
  canvas.width = (1920 - CANVAS_LEFT) * CANVAS_SCALE;
  canvas.height = 1080 * CANVAS_SCALE;
  wheel.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // 每個框先畫在這張看不到的小畫布上，再整張貼到上面的 canvas。
  // 這樣要讓整個框變暗、變透明的時候，裡面的線才不會互相透出來
  const STAMP_W = 940;
  const STAMP_H = 580;
  const stamp = document.createElement("canvas");
  stamp.width = STAMP_W * CANVAS_SCALE;
  stamp.height = STAMP_H * CANVAS_SCALE;
  const stampCtx = stamp.getContext("2d");
  stampCtx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
  // 另外兩張同樣大小的小畫布：一張畫變形途中的形狀，一張畫條紋
  function newLayer() {
    const layer = document.createElement("canvas");
    layer.width = stamp.width;
    layer.height = stamp.height;
    const layerCtx = layer.getContext("2d");
    layerCtx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
    return { canvas: layer, ctx: layerCtx };
  }
  const morphLayer = newLayer();
  const raysLayer = newLayer();
  const CX = STAMP_W / 2;       // 框的中心在小畫布上的位置
  const CY = STAMP_H / 2;

  // ---- 為了跑得順，先把會重複用到的東西各畫好一份存起來 ----
  // 條紋圓盤：整圈條紋先畫成一張圖，之後每一格只要把這張圖轉個角度貼上去就好
  const RAYS_RADIUS = 345;
  const raysDiscs = {};
  function raysDisc(dimmed) {
    const key = dimmed ? "dim" : "normal";
    if (!raysDiscs[key]) {
      const disc = document.createElement("canvas");
      disc.width = disc.height = RAYS_RADIUS * 2 * CANVAS_SCALE;
      const discCtx = disc.getContext("2d");
      discCtx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, RAYS_RADIUS * CANVAS_SCALE, RAYS_RADIUS * CANVAS_SCALE);
      drawRays(discCtx, 0, dimmed ? OPTION.dim : 1);
      raysDiscs[key] = disc;
    }
    return raysDiscs[key];
  }
  // 原圖縮成畫布實際用的大小（還有變暗的版本），之後貼的時候就不用每次重新縮放
  function prepared(art, kind) {
    if (!art.prepared) { art.prepared = {}; }
    if (!art.prepared[kind]) {
      const copy = document.createElement("canvas");
      copy.width = Math.round(art.width * CANVAS_SCALE);
      copy.height = Math.round(art.height * CANVAS_SCALE);
      const copyCtx = copy.getContext("2d");
      copyCtx.drawImage(kind === "mask" ? art.mask : art.lines, 0, 0, copy.width, copy.height);
      if (kind === "dim") {
        copyCtx.globalCompositeOperation = "source-atop";     // 只蓋在有畫東西的地方
        copyCtx.fillStyle = "rgba(0, 0, 0, " + (1 - OPTION.dim) + ")";
        copyCtx.fillRect(0, 0, copy.width, copy.height);
      }
      art.prepared[kind] = copy;
    }
    return art.prepared[kind];
  }

  // 把 AI 原圖（大框或小框）畫出來：線條 + 裡面旋轉的條紋
  // target = 要畫到哪張畫布，x / y = 框的中心，size = 放大縮小的倍率，
  // amount = 透明度（0 ~ 1），dimmed = true 表示用變暗的版本（沒被選到的選項）
  function paintArt(target, art, x, y, size, angle, amount, dimmed) {
    const width = art.width * size;
    const height = art.height * size;

    // 條紋：在小畫布上把條紋圓盤轉個角度貼上去，再用遮罩圖把框外面的部分擦掉
    const left = CX - art.cx * size;
    const top = CY - art.cy * size;
    raysLayer.ctx.clearRect(left - 2, top - 2, width + 4, height + 4);
    raysLayer.ctx.save();
    raysLayer.ctx.beginPath();
    raysLayer.ctx.rect(left, top, width, height);
    raysLayer.ctx.clip();
    raysLayer.ctx.translate(CX, CY);
    raysLayer.ctx.rotate(angle);
    raysLayer.ctx.drawImage(raysDisc(dimmed), -RAYS_RADIUS, -RAYS_RADIUS, RAYS_RADIUS * 2, RAYS_RADIUS * 2);
    raysLayer.ctx.restore();
    raysLayer.ctx.globalCompositeOperation = "destination-in";
    raysLayer.ctx.drawImage(prepared(art, "mask"), left, top, width, height);
    raysLayer.ctx.globalCompositeOperation = "source-over";

    const before = target.globalAlpha;
    target.globalAlpha = before * amount;
    target.drawImage(prepared(art, dimmed ? "dim" : "lines"), x - art.cx * size, y - art.cy * size, width, height);
    target.drawImage(raysLayer.canvas,
      left * CANVAS_SCALE, top * CANVAS_SCALE, width * CANVAS_SCALE, height * CANVAS_SCALE,
      x - art.cx * size, y - art.cy * size, width, height);
    target.globalAlpha = before;
  }

  // 把一個選項（展開程度 open）畫到 stamp 上
  function paintOption(open, angle) {
    stampCtx.clearRect(0, 0, STAMP_W, STAMP_H);
    const big = OPTION_ART.big;
    const small = OPTION_ART.small;
    const ready = artReady(big) && artReady(small);

    // 接近完全展開時淡接成大框原圖，接近完全收起時淡接成小框原圖
    function smooth(t) {
      t = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);
    }
    const bigAmount = ready ? smooth((open - 0.7) / 0.3) : 0;
    const smallAmount = ready ? smooth((0.3 - open) / 0.3) : 0;
    const artAmount = Math.max(bigAmount, smallAmount);

    // 變形途中的形狀：原圖淡入到一半之後才開始淡出，中間才不會透出後面的背景
    const morphAmount = 1 - smooth((artAmount - 0.5) / 0.5);
    if (morphAmount > 0.01) {
      morphLayer.ctx.clearRect(0, 0, STAMP_W, STAMP_H);
      drawOption(morphLayer.ctx, CX, CY, open, angle, 1);
      stampCtx.globalAlpha = morphAmount;
      stampCtx.drawImage(morphLayer.canvas, 0, 0, STAMP_W, STAMP_H);
      stampCtx.globalAlpha = 1;
    }
    // 原圖的大小跟著變形途中的形狀一起縮放，接起來才順
    const widthNow = lerp(small.barW, big.barW, open);
    if (bigAmount > 0) {
      paintArt(stampCtx, big, CX, CY, widthNow / big.barW, angle, bigAmount, false);
    }
    if (smallAmount > 0) {
      paintArt(stampCtx, small, CX, CY, widthNow / small.barW, angle, smallAmount, false);
    }
  }

  // 每個選項的動畫狀態：pos = 現在在第幾格（0 = 正中間，可以有小數），open = 展開了多少（0 ~ 1）
  const states = [];
  items.forEach(function (item) {
    const el = document.createElement("div");
    el.className = "select-item";
    // 停著不動時顯示的 AI 原圖（大框、小框各一份，樣子在 css/screens.css 的 .opt-art）：
    // 底圖是線條，裡面一層是被遮罩切成框的形狀、會旋轉的條紋
    ["big", "small"].forEach(function (kind) {
      const art = document.createElement("div");
      art.className = "opt-art " + kind;
      const rays = document.createElement("div");
      rays.className = "opt-rays";
      const disc = document.createElement("div");
      disc.className = "opt-disc";
      rays.appendChild(disc);
      art.appendChild(rays);
      el.appendChild(art);
    });
    const name = document.createElement("span");
    name.className = "select-item-name";
    name.textContent = item.name;
    const sub = document.createElement("small");
    sub.className = "select-item-sub";
    sub.textContent = item.sub || item.artist || "";
    el.appendChild(name);
    el.appendChild(sub);
    wheel.appendChild(el);
    elements.push(el);
    states.push({ pos: 0, posFrom: 0, posTo: 0, posStart: 0, open: 0, openFrom: 0, openTo: 0, openStart: 0 });
  });

  // 這個選項離「被選到的」差幾格（清單頭尾相接，變成輪盤）
  function offsetOf(index) {
    let offset = index - selected;
    if (offset > items.length / 2)  { offset = offset - items.length; }
    if (offset < -items.length / 2) { offset = offset + items.length; }
    return offset;
  }

  // 告訴每個選項它的新位置，動畫由下面的 tick 每一格慢慢補上。instant = true 就直接跳過去
  function aimWheel(instant) {
    const now = performance.now();
    states.forEach(function (state, index) {
      const target = offsetOf(index);
      // 從畫面外繞到另一頭的選項不用動畫，直接換過去
      if (instant || (Math.abs(state.pos) > 1.6 && Math.abs(target) > 1.6)) {
        state.pos = target;
      }
      state.posFrom = state.pos;
      state.posTo = target;
      state.posStart = now;
      state.openFrom = state.open;
      state.openTo = target === 0 ? 1 : 0;
      state.openStart = now;
    });
  }

  // 條紋圓盤的圖交給 CSS 當背景用；沒被選到的要多暗也交給 CSS
  wheel.style.setProperty("--rays", "url(" + raysDisc(false).toDataURL() + ")");
  wheel.style.setProperty("--dim", OPTION.dim);

  // ---- 條紋現在轉到幾度 ----
  // 平常的慢轉 + 每次切換時多轉的那一段（一開始最快，越來越慢，最後接回平常的速度）
  let boostDone = 0;            // 之前幾次切換已經轉完的角度
  let boostStart = -Infinity;   // 最近一次切換的時間
  function boostNow(now) {
    const p = Math.min(1, Math.max(0, (now - boostStart) / OPTION.spinBoostMs));
    return OPTION.spinBoost * (1 - Math.pow(1 - p, 3));
  }
  function stripeAngle(now) {
    return now / 1000 * OPTION.spinSpeed + boostDone + boostNow(now);
  }
  // 切換選項時呼叫：上一次還沒轉完的部分先記下來，再重新開始加速（連按也會一直順順地接下去）
  function spinBoost() {
    const now = performance.now();
    boostDone += boostNow(now);
    boostStart = now;
  }

  let frameId = 0;
  let canvasDirty = false;      // canvas 上一格有沒有畫東西（有的話這一格要先擦掉）
  function tick(now) {
    const angle = stripeAngle(now);
    wheel.style.setProperty("--angle", angle.toFixed(4) + "rad");   // 條紋現在轉到幾度
    const ready = artReady(OPTION_ART.big) && artReady(OPTION_ART.small);

    if (canvasDirty) {
      ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, -CANVAS_LEFT * CANVAS_SCALE, 0);
      ctx.clearRect(CANVAS_LEFT, 0, 1920 - CANVAS_LEFT, 1080);
      canvasDirty = false;
    }

    states.forEach(function (state, index) {
      // 位置：一開始快、最後慢慢停
      const moveT = Math.min(1, (now - state.posStart) / OPTION.moveMs);
      state.pos = lerp(state.posFrom, state.posTo, 1 - Math.pow(1 - moveT, 3));
      // 展開：比位置慢一點，所以滑到定位之後還會繼續開花
      const openMs = state.openTo > state.openFrom ? OPTION.openMs : OPTION.closeMs;
      const openT = Math.min(1, (now - state.openStart) / openMs);
      state.open = lerp(state.openFrom, state.openTo, openT * openT * (3 - 2 * openT));

      const away = Math.abs(state.pos);
      const x = OPTION.centerX + OPTION.sideX * Math.min(1, away);
      const y = OPTION.centerY + OPTION.gapY * state.pos;
      // 超過上下各一格的慢慢淡掉
      const fade = Math.max(0, Math.min(1, (1.7 - away) / 0.5));

      // 這個選項現在要怎麼顯示：
      //   big / small = 停著不動，直接顯示 AI 原圖（一般的網頁元素，最省力）
      //   morph       = 變形途中，用 canvas 一格一格畫
      const el = elements[index];
      let mode = "morph";
      if (ready && state.open === 1) { mode = "big"; }
      if (ready && state.open === 0) { mode = "small"; }
      if (fade <= 0) { mode = "off"; }                 // 在畫面外的選項什麼都不用顯示
      if (el.dataset.mode !== mode) { el.dataset.mode = mode; }

      if (mode === "morph" && fade > 0) {
        // 先在小畫布上把過渡形狀和原圖疊好，再整張貼到 canvas
        paintOption(state.open, angle);
        // 沒被選到的蓋上一層半透明的黑，看起來比較暗（只蓋在有畫東西的地方）
        stampCtx.globalCompositeOperation = "source-atop";
        stampCtx.fillStyle = "rgba(0, 0, 0, " + (1 - lerp(OPTION.dim, 1, state.open)) + ")";
        stampCtx.fillRect(0, 0, STAMP_W, STAMP_H);
        stampCtx.globalCompositeOperation = "source-over";
        ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, -CANVAS_LEFT * CANVAS_SCALE, 0);
        ctx.globalAlpha = fade;
        ctx.drawImage(stamp, x - STAMP_W / 2, y - STAMP_H / 2, STAMP_W, STAMP_H);
        ctx.globalAlpha = 1;
        canvasDirty = true;
      }

      // 框的原圖和文字跟著一起動（文字的大小、明暗在 CSS 裡用 --open 算）
      el.style.transform = "translate(" + x + "px, " + y + "px)";
      el.style.opacity = fade;
      el.style.setProperty("--open", state.open.toFixed(3));
    });

    frameId = requestAnimationFrame(tick);
  }

  // 換圖片：新的那層淡入，舊的淡出
  function showPhoto(item) {
    const next = photos[1 - frontPhoto];
    if (item.image) {
      next.style.backgroundImage = "url('" + item.image + "')";
      next.textContent = "";
      next.classList.remove("empty");
    } else {
      // 沒圖先顯示名字
      next.style.backgroundImage = "none";
      next.textContent = item.name + "（圖片待補）";
      next.classList.add("empty");
    }
    next.classList.add("show");
    photos[frontPhoto].classList.remove("show");
    frontPhoto = 1 - frontPhoto;

    // 外框亮一下（先拿掉再加回去，動畫才會重播）
    frame.classList.remove("flash");
    void frame.offsetWidth;
    frame.classList.add("flash");
  }

  // 換說明文字：框先縮起來，換好字再張開
  function showDesc(item) {
    let text = item.desc;
    if (!text) {
      text = item.artist ? item.name + "／" + item.artist : item.name;
    }
    clearTimeout(descTimer);
    desc.classList.add("closed");
    descTimer = setTimeout(function () {
      descText.textContent = text;
      desc.classList.remove("closed");
    }, DESC_CLOSE_MS);
  }

  // 依照 selected 更新畫面。instant = true 表示剛進這一頁，選項直接就定位（不用滑）
  function render(instant) {
    aimWheel(instant);

    const item = items[selected];
    showPhoto(item);
    showDesc(item);
    startPreview(item);   // 換到哪一首就試聽哪一首
  }

  function move(step) {
    selected = (selected + step + items.length) % items.length;
    spinBoost();          // 條紋猛轉一下
    render();
  }

  return {
    onEnter: function () {
      selected = 0;
      states.forEach(function (state) { state.open = 0; });   // 一進來，中間那個從花苞開始開花
      render(true);
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(tick);
    },
    onLeave: function () {
      cancelAnimationFrame(frameId);
      clearTimeout(descTimer);
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
  frameId: "stage-frame",
  descId: "stage-desc",
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
  frameId: "music-frame",
  descId: "music-desc",
  onConfirm: function (song) {
    GameState.song = song;
    goTo("loading");
  }
}));
