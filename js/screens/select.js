/* ============ 3.0 舞台選擇 / 4.0 音樂選擇 ============
   兩頁的介面一樣，所以共用同一個 createSelectScreen()：
   左邊是霓虹外框裡的圖片和文字說明框，右邊是上下輪轉的選項，上下鍵選、空白鍵決定。
   換選項的時候：外框亮一下、圖片淡入淡出、說明框先縮起來再張開、選項上下滑動。
   樣子和動畫的速度都在 css/screens.css 的「3.0 / 4.0」那一段 */

const DESC_CLOSE_MS = 260;  // 說明框縮起來要多久（要跟 CSS 的 .select-desc transition 差不多）

/* ---------- 按上下鍵換選項的音效 ---------- */
const SELECT_SOUND = "assets/audio/sfx_select.mp3";   // 想換別的音效就換這個檔案
const SELECT_SOUND_VOLUME = 1;                      // 音量（0 ~ 1）
const selectSound = new Audio(SELECT_SOUND);
selectSound.preload = "auto";

function playSelectSound() {
  // 每次複製一份來播，連續快速按的時候聲音才不會被切掉
  const sound = selectSound.cloneNode();
  sound.volume = SELECT_SOUND_VOLUME;
  sound.play().catch(function () {});
}

/* ---------- 右邊選項框的設定 ----------
   停下來的時候（被選到的大框、沒被選到的小框），畫的是從 AI 檔切出來的原圖，造型跟 AI 檔一模一樣：
     assets/images/select/option-big-lines.png  大框的線條和蓮花
     assets/images/select/option-lines.png      小框的線條和花苞
     （-mask.png 是「條紋可以出現的範圍」，條紋本身是程式畫的，才能一直旋轉）
   只有在兩個狀態「變形的途中」（不到半秒），才改用程式在 canvas 上畫過渡形狀（下面的 drawOption）：
   形狀是照 AI 檔的三個造型（小框 → 過渡造型 → 大框，見 OPTION_SHAPES）補間出來的，
   所以變形途中跟停下來的時候是同一套造型，頭尾再接回原圖。
   位置的單位是 1920×1080 畫布上的 px */
const OPTION = {
  centerX: 1410,        // 被選到的選項（大框）的中心
  centerY: 532,
  sideX: 130,           // 沒被選到的選項往右偏多少
  gapY: 358,            // 選項之間上下的距離
  smallScale: 0.75,     // 沒被選到的選項（小框）縮小成幾倍（1 = AI 檔原本的大小，越小上下越不擠）

  moveMs: 340,          // 上下滑動要多久
  openMs: 480,          // 展開（方框 → 十字、蓮花開花）要多久
  closeMs: 280,         // 收起來要多久
  // 條紋的動畫（照螢幕錄影量出來的）：
  //   平常順時針慢慢轉；每次切換選項，會先猛轉一下，再在 spinBoostMs 內慢慢減速回平常的速度
  spinSpeed: 0.148,     // 平常的轉速（每秒轉幾個弧度，0.148 ≈ 每秒 8.5 度；0 = 不轉，負的 = 反方向）
  spinBoost: 0.87,      // 每次切換時多轉多少（弧度，0.87 ≈ 50 度；0 = 切換時不加速）
  spinBoostMs: 1000,    // 加速之後，花多久減速回平常的速度
  rays: 44,             // 條紋有幾道（AI 檔是 44 道）

  line: "#00ff40",      // 變形途中，霓虹線的顏色（跟 AI 檔一樣）
  lineWidth: 1,         // 變形途中，霓虹線的粗細
  dim: 0.6              // 沒被選到的選項有多暗（1 = 跟被選到的一樣亮）
};

// AI 檔切出來的原圖。width / height 是圖在畫布上的大小，cx / cy 是圖裡面「框的正中心」的位置
const OPTION_ART = {
  big:   { file: "option-big", width: 834, height: 470, cx: 418, cy: 233 },
  small: { file: "option",     width: 622, height: 252, cx: 311, cy: 126 }
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

/* ---------- 變形用的三個關鍵造型 ----------
   這三組路徑是直接從 AI 匯出的 SVG 複製過來的（小框 → 過渡造型 → 大框），
   變形途中畫的形狀就是在這三個造型之間「補間」出來的，所以從頭到尾都是同一套造型，不會跑型。
   想改造型的話：在 AI 改好之後重新匯出 SVG，把對應的 d="..." 換掉就好。
     at      展開到多少的時候剛好是這個造型（0 = 小框，0.5 = 過渡造型，1 = 大框）
     center  框的正中心在 SVG 裡的座標
     rings   三圈霓虹線，由外到內
     fan     左邊的扇子（右邊是左右翻過去的），anchor = 扇子的尖端
     lotus   上面的花（下面是上下翻過去的），anchor = 花的底部；
             fill 是顏色，寫成 [y1, y2] 的話是從橘色到桃紅色的漸層（SVG 裡漸層開始和結束的 y）
     arcs    左上角的捲紋（另外三個角是翻過去的），anchor = 外圈線的內凹轉角 */
const OPTION_SHAPES = [
  {
    // 沒被選到的小框（圓角長方形 + 花苞）
    at: 0,
    center: [409.89, 125.54],
    rings: [
      "M186.06,204.43c-30.36,0-55.06-21.58-55.06-48.11v-61.05c0-26.53,24.7-48.11,55.06-48.11h447.66c30.36,0,55.06,21.58,55.06,48.11v61.05c0,26.53-24.7,48.11-55.06,48.11H186.06Z",
      "M633.72,53.24H186.06c-26.57,0-48.11,18.82-48.11,42.03v61.05c0,23.21,21.54,42.03,48.11,42.03h447.66c26.57,0,48.11-18.82,48.11-42.03v-61.05C681.83,72.06,660.29,53.24,633.72,53.24Z",
      "M292.11,188.23h-106.05c-20.14,0-36.52-14.32-36.52-31.91v-61.05c0-17.59,16.38-31.91,36.52-31.91h447.66c20.14,0,36.52,14.32,36.52,31.91v61.05c0,17.59-16.38,31.91-36.52,31.91H292.11Z"
    ],
    fan: {
      anchor: [149.53, 125.54],
      paths: [
        "M149.18,125.54c-.53,0-1.08.05-1.62.12h-.03c-.61.04-1.2.14-1.8.28-.03.02-.06.02-.09.02-.83.09-1.77.21-2.83.35-.01-.03-.03,0-.04,0-11.25,1.5-33.29,5.35-40.49,13.25-1.31-3.98-2.03-8.36-2.03-13,0-.35,0-.69.01-1.02-.01-.32-.01-.67-.01-1.02,0-4.52.69-8.8,1.94-12.72,7.44,7.69,29.05,11.49,40.19,12.95.03.03.06.05.1.03,1.43.18,2.68.34,3.71.46h.12c.51.12,1.01.19,1.51.23.37.03.74.05,1.12.05C149.02,125.54,149.11,125.54,149.18,125.54ZM149.53,125.54L100.2,125.54M101.9,111.47c.09.1.18.21.29.33,7.44,7.69,29.05,11.49,40.19,12.95.03.03.06.05.1.03,1.43.18,2.69.34,3.71.46h.12c1.32.16,2.23.23,2.63.28.08.02.17.02.24.02M149.18,125.54c-.07,0-.16,0-.24-.02-.38,0-.75-.02-1.12-.05-1.84-.11-3.63-.35-5.34-.69-.04.02-.07,0-.1-.03M102.25,139.61s.02-.02.03-.05c7.2-7.9,29.24-11.75,40.49-13.25.01,0,.03-.03.04,0,1.06-.14,2-.26,2.83-.35.03,0,.06,0,.09-.02,1.8-.21,3.07-.33,3.56-.38.08-.02.17-.02.25-.02M149.54,125.54c-.08,0-.17,0-.25.02-.58,0-1.16.05-1.73.1h-.03c-1.62.11-3.19.34-4.72.65-.01-.03-.03,0-.04,0"
      ]
    },
    lotus: {
      anchor: [409.89, 57.31],
      fill: "#000",
      paths: [
        "M409.89.83s-19.13,25.4,0,36.46C429.02,26.23,409.89.83,409.89.83Z",
        "M420.47,13.12s-19.14,25.4,0,36.45C439.6,38.52,420.47,13.12,420.47,13.12Z",
        "M399.94,13.12s-19.13,25.4,0,36.45C419.07,38.52,399.94,13.12,399.94,13.12Z",
        "M409.89,20.86s-28.83,25.4,0,36.45C438.72,46.26,409.89,20.86,409.89,20.86Z"
      ]
    },
    arcs: {
      anchor: [273.8, 46.9],
      paths: []
    }
  },
  {
    // 變形到一半的過渡造型（矮十字 + 小蓮花 + 一圈捲紋）
    at: 0.5,
    center: [411.96, 433.08],
    rings: [
      "M350.58,560.69c-52.26,0-95.27,4.9-99.46-38.05h-103.8c-35.9,0-65.1-24.5-65.1-54.62v-69.3c0-30.12,29.2-54.62,65.1-54.62h103.74c3.87-43.22,47.03-36.8,99.52-36.8h124.13c52.49,0,95.65-6.42,99.51,36.8h102.39c35.89,0,65.1,24.5,65.1,54.62v69.3c0,30.12-29.21,54.62-65.1,54.62h-102.44c-4.2,42.95-47.2,38.05-99.46,38.05H350.58Z",
      "M676.61,351h-110.33v-.57c0-42.43-41-36.23-91.57-36.23h-124.13c-50.58,0-91.58-6.2-91.58,36.23v.57h-111.68c-31.42,0-56.88,21.36-56.88,47.72v69.3c0,26.36,25.46,47.72,56.88,47.72h111.68c0,42.43,41,38.06,91.58,38.06h124.13c50.57,0,91.57,4.37,91.57-38.06h0s110.33,0,110.33,0c31.41,0,56.88-21.36,56.88-47.72v-69.3C733.49,372.36,708.02,351,676.61,351Z",
      "M350.58,542.3c-42.94,0-77.88,9.46-77.88-26.56v-11.49h-125.38c-23.81,0-43.18-16.25-43.18-36.23v-69.3c0-19.98,19.37-36.23,43.18-36.23h125.38v-12.06c0-25.54,34.94-27.58,77.88-27.58h124.13c42.94,0,77.87,0,77.87,27.58v12.06h124.03c23.81,0,43.18,16.25,43.18,36.23v69.3c0,19.98-19.37,36.23-43.18,36.23h-124.03v11.49c0,36.02-34.93,26.56-77.87,26.56H350.58Z"
    ],
    fan: {
      anchor: [104.14, 433.08],
      paths: [
        "M103.5,433.08c-1.15.01-2.3.06-3.44.15-.11.01-.21.01-.31.02-.93.08-1.86.19-2.78.32,0,0-.02,0-.03,0-1.6.12-3.42.26-5.43.43-.05.01-.1.02-.14.02-39.26,5.08-60.33,28.27-60.33,28.27-4.97-3.62-8.98-8.15-11.63-13.29-2.35-4.52-3.65-9.52-3.65-14.77,0-.39,0-.78.03-1.15-.03-.37-.03-.76-.03-1.15,0-5.13,1.24-10.02,3.49-14.46,2.59-5.14,6.53-9.69,11.45-13.34,1.05,1.13,21.83,23.1,60.04,28.01.05.01.09.01.14.02,2.58.22,4.86.39,6.75.53h.04c1.16.15,2.33.25,3.5.32.14.01.28.01.42.02C102.22,433.05,102.86,433.07,103.5,433.08ZM104.14,433.08L15.68,433.08M18.72,417.12c.17.12.35.24.53.35,13.25,8.67,51.38,12.96,71.49,14.67.05.01.09.01.14.02,2.58.22,4.86.39,6.75.53h.04c3.66.27,5.83.39,5.83.39M103.5,433.08c-.64,0-1.28-.03-1.91-.05-.14,0-.28,0-.42-.02-3.56-.14-6.99-.43-10.29-.85-.05,0-.09,0-.14-.02-38.21-4.91-58.99-26.88-60.04-28.01-.03-.03-.04-.05-.04-.05M19.35,449.04s.04-.03.06-.04c12.8-8.87,51.61-13.25,71.96-14.98.04,0,.09,0,.14-.02,2.01-.17,3.83-.31,5.43-.43t.03,0c4.46-.34,7.16-.49,7.16-.49M104.13,433.08c-1.38.03-2.73.08-4.07.15-.11.01-.21.01-.31.02-2.83.16-5.58.42-8.24.75-.05.01-.1.02-.14.02-39.26,5.08-60.33,28.27-60.33,28.27"
      ]
    },
    lotus: {
      anchor: [411.96, 319.36],
      fill: [235.58, 352.62],
      paths: [
        "M420.54,276.73c-5.23-2.32-8.58-10.5-8.58-10.5,0,0-3.34,8.18-8.57,10.5-5.23,2.32-10.99,8.41-8.03,16.23l12.28,12.61,20.93-12.61C431.52,285.14,425.77,279.05,420.54,276.73Z",
        "M394.08,301.94c-10.87-.3-14.7-16.44-14.7-16.44,0,0-11.38,16.7.5,26.47,3.71,3.06,8.68,4.4,13.63,4.17l12.99-.62L394.08,301.94Z",
        "M409.66,317.78l-10.17-4.02c-6.19-2.44-11.61-6.74-14.69-12.43-9.81-18.12,13.45-31.2,13.45-31.2,0,0-3.74,21.01,9.82,27.5L409.66,317.78Z",
        "M429.06,301.94c10.86-.3,14.7-16.44,14.7-16.44,0,0,11.38,16.7-.5,26.47-3.71,3.06-8.69,4.4-13.63,4.17l-12.99-.62L429.06,301.94Z",
        "M413.48,317.78l10.16-4.02c6.2-2.44,11.62-6.74,14.7-12.43,9.81-18.12-13.45-31.2-13.45-31.2,0,0,3.74,21.01-9.82,27.5L413.48,317.78Z",
        "M411.96,277.97s-34.09,28.83,0,41.39C446.05,306.8,411.96,277.97,411.96,277.97Z"
      ]
    },
    arcs: {
      anchor: [251.06, 344.1],
      paths: [
        "M228.88,343.8c-.03-.29-.03-.62-.03-.94,0-9.93,9.59-17.97,21.46-17.97,1.69,0,3.37.16,4.96.5"
      ]
    }
  },
  {
    // 被選到的大框（圓弧十字 + 盛開的蓮花 + 三圈捲紋）
    at: 1,
    center: [416.34, 863.07],
    rings: [
      "M352.02,1044.99c-54.86,0-100.01-37.04-104.42-84h-108.98c-37.69,0-68.35-26.79-68.35-59.72v-75.78c0-32.93,30.66-59.72,68.35-59.72h108.92c4.06-47.26,49.37-84.63,104.48-84.63h130.33c55.11,0,100.42,37.37,104.48,84.63h107.49c37.7,0,68.36,26.79,68.36,59.72v75.78c0,32.93-30.66,59.72-68.36,59.72h-107.54c-4.41,46.96-49.56,84-104.43,84H352.02Z",
      "M694.33,773.31h-115.83v-.63c0-46.39-43.05-84-96.15-84h-130.33c-53.09,0-96.14,37.61-96.14,84v.63h-117.26c-32.98,0-59.72,23.36-59.72,52.18v75.78c0,28.82,26.74,52.18,59.72,52.18h117.26c0,46.39,43.05,84,96.14,84h130.33c53.1,0,96.15-37.61,96.15-84h0s115.83,0,115.83,0c32.98,0,59.72-23.36,59.72-52.18v-75.78C754.05,796.67,727.31,773.31,694.33,773.31Z",
      "M352.02,1024.88c-45.08,0-81.76-32.04-81.76-71.43v-12.57h-131.64c-25,0-45.34-17.77-45.34-39.61v-75.78c0-21.84,20.34-39.61,45.34-39.61h131.64v-13.2c0-39.38,36.68-71.43,81.76-71.43h130.33c45.09,0,81.76,32.05,81.76,71.43v13.2h130.21c25.01,0,45.34,17.77,45.34,39.61v75.78c0,21.84-20.33,39.61-45.34,39.61h-130.21v12.57c0,39.39-36.67,71.43-81.76,71.43H352.02Z"
    ],
    fan: {
      anchor: [93.28, 863.07],
      paths: [
        "M92.62,863.07c-26.18-.23-49.05-21.14-61.8-39.34-17.69,5.73-30.32,20.61-30.32,38.08,0,.43,0,.85.03,1.26-.03.4-.03.83-.03,1.25,0,17.47,12.63,32.35,30.32,38.08C43.57,884.2,66.44,863.29,92.62,863.07H92.62ZM93.28,863.07L.42,863.07M92.62,863.07s-70.59-4.04-89.01-17.46M16.14,831.35s26.66,30.66,76.48,31.72M93.28,863.07s-70.58,4.04-89.01,17.45M16.81,894.78s26.66-30.66,76.47-31.71"
      ]
    },
    lotus: {
      anchor: [416.47, 696.76],
      fill: [598.88, 726.86],
      paths: [
        "M426.65,643.88c-6.21-2.53-10.18-11.48-10.18-11.48,0,0-3.97,8.95-10.17,11.48-6.2,2.54-13.03,9.2-9.52,17.74l14.57,13.8,24.82-13.8C439.67,653.08,432.85,646.42,426.65,643.88Z",
        "M467.14,667.88c6.46-14.43-17-36.31-17-36.31,0,0,.18,6.51-2.07,8.96-3.38,3.65-25.28,14.63-15,34.55l13.81,11.17,22.1-6.55L467.14,667.88Z",
        "M457.04,674.94c11.38-.9,14.6-18.73,14.6-18.73,0,0,12.76,17.65.79,28.95-3.74,3.52-8.89,5.25-14.09,5.25h-13.65L457.04,674.94Z",
        "M422.79,693.16h11.48c7,0,13.94-2.19,19.15-6.74,16.57-14.49-1.1-37.14-1.1-37.14,0,0-4.46,22.87-20.2,24.03L422.79,693.16Z",
        "M365.54,668.7c-6.45-14.43,17.01-36.3,17.01-36.3,0,0-.19,6.51,2.07,8.95,3.37,3.66,25.27,14.63,14.99,34.56l-13.81,11.16-22.09-6.54L365.54,668.7Z",
        "M375.64,675.76c-11.37-.9-14.59-18.73-14.59-18.73,0,0-12.77,17.65-.8,28.95,3.74,3.53,8.89,5.25,14.09,5.25h13.65L375.64,675.76Z",
        "M409.89,693.98h-11.48c-6.99,0-13.94-2.18-19.14-6.74-16.57-14.49,1.1-37.13,1.1-37.13,0,0,4.45,22.87,20.2,24.02L409.89,693.98Z",
        "M416.47,651.51s-35.79,31.53,0,45.25C452.27,683.04,416.47,651.51,416.47,651.51Z"
      ]
    },
    arcs: {
      anchor: [247.54, 765.77],
      paths: [
        "M195.48,765.44c-.02-.35-.02-.67-.02-1.03,0-24.7,23.01-44.79,51.29-44.79,6.16,0,12.08.96,17.58,2.72M209.87,765.44c-.03-.35-.03-.67-.03-1.03,0-17.77,16.54-32.22,36.91-32.22,3.62,0,7.11.45,10.41,1.31M224.25,765.44c-.03-.32-.03-.67-.03-1.03,0-10.85,10.07-19.65,22.53-19.65,1.78,0,3.54.17,5.21.55"
      ]
    }
  }
];
const LOTUS_COLORS = ["#ff6500", "#ff00e3"];   // 蓮花漸層的兩個顏色（外側 → 靠近框的那一側）
const RING_COLS = 720;                         // 每一圈線切成幾段來補間（越多越細緻）

// 把一條 SVG 路徑（d="..." 那串字）切成一串很密的點，座標改成以 center 為原點。
// 看得懂 AI 匯出的 SVG 會用到的指令：M L H V C S Z（大寫是絕對座標，小寫是相對座標）
function samplePath(d, center) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];
  const points = [];
  let i = 0;
  let command = "";
  let x = 0, y = 0;             // 現在畫到哪裡
  let startX = 0, startY = 0;   // 這一段是從哪裡開始的（Z 會接回這裡）
  let ctrlX = 0, ctrlY = 0;     // 上一條曲線的第二個控制點（S 指令會用到）
  function num() { return parseFloat(tokens[i++]); }
  function add(px, py) { points.push([px - center[0], py - center[1]]); }
  function curve(x1, y1, x2, y2, x3, y3) {      // 一條曲線切成 24 小段直線
    for (let s = 1; s <= 24; s++) {
      const t = s / 24;
      const u = 1 - t;
      add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
    ctrlX = x2; ctrlY = y2;
    x = x3; y = y3;
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) { command = tokens[i++]; }
    const relative = command === command.toLowerCase();
    const baseX = relative ? x : 0;
    const baseY = relative ? y : 0;
    const type = command.toUpperCase();
    if (type === "Z") {
      x = startX; y = startY;
      add(x, y);
    } else if (type === "M") {
      x = baseX + num(); y = baseY + num();
      startX = x; startY = y;
      add(x, y);
      command = relative ? "l" : "L";            // M 後面如果還有數字，當成直線
    } else if (type === "L") {
      x = baseX + num(); y = baseY + num();
      add(x, y);
    } else if (type === "H") {
      x = baseX + num();
      add(x, y);
    } else if (type === "V") {
      y = baseY + num();
      add(x, y);
    } else if (type === "C") {
      curve(baseX + num(), baseY + num(), baseX + num(), baseY + num(), baseX + num(), baseY + num());
      continue;
    } else if (type === "S") {                   // 第一個控制點 = 上一個控制點對折過來
      curve(2 * x - ctrlX, 2 * y - ctrlY, baseX + num(), baseY + num(), baseX + num(), baseY + num());
      continue;
    } else {
      break;                                     // 看不懂的指令就停（AI 匯出的不會有）
    }
    ctrlX = x; ctrlY = y;
  }
  return points;
}

/* 把一圈線記成「每個 x 位置的上緣和下緣各在哪裡」。
   兩個造型用同樣的方式記下來之後，一格一格對應著補間，
   凸出去的那一塊就會「垂直往上長」，直的邊不會歪掉。
   x 的取法是兩端密、中間疏，圓角才會平滑 */
function ringProfile(d, center) {
  const points = samplePath(d, center);
  let left = Infinity;
  let right = -Infinity;
  points.forEach(function (p) {
    left = Math.min(left, p[0]);
    right = Math.max(right, p[0]);
  });
  const mid = (left + right) / 2;
  const half = (right - left) / 2;
  const top = new Float32Array(RING_COLS + 1).fill(Infinity);
  const bottom = new Float32Array(RING_COLS + 1).fill(-Infinity);
  function colOf(x) {                          // 這個 x 落在第幾格（可以有小數）
    const u = Math.max(-1, Math.min(1, (x - mid) / (half * 0.9995)));
    return Math.acos(-u) / Math.PI * RING_COLS;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ka = colOf(a[0]);
    const kb = colOf(b[0]);
    for (let k = Math.ceil(Math.min(ka, kb)); k <= Math.floor(Math.max(ka, kb)); k++) {
      const x = mid + RING_U[k] * half;
      const t = a[0] === b[0] ? 0.5 : Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      const y = lerp(a[1], b[1], t);
      top[k] = Math.min(top[k], y, a[0] === b[0] ? Math.min(a[1], b[1]) : y);
      bottom[k] = Math.max(bottom[k], y, a[0] === b[0] ? Math.max(a[1], b[1]) : y);
    }
  }
  return { mid: mid, half: half, top: top, bottom: bottom };
}
// 每一格的 x 在 -1 ~ 1 之間的哪裡（兩端密、中間疏）
const RING_U = new Float32Array(RING_COLS + 1);
for (let k = 0; k <= RING_COLS; k++) {
  RING_U[k] = -Math.cos(Math.PI * k / RING_COLS) * 0.9995;
}

// 第一次要畫的時候，把上面三個造型整理成好補間的資料（只會做一次）
let shapesReady = false;
function prepareShapes() {
  if (shapesReady) { return; }
  shapesReady = true;
  OPTION_SHAPES.forEach(function (shape) {
    shape.profiles = shape.rings.map(function (d) { return ringProfile(d, shape.center); });
    ["fan", "lotus", "arcs"].forEach(function (kind) {
      const piece = shape[kind];
      // 量出這個零件的寬和高，補間的時候才知道要放大縮小多少
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      piece.paths.forEach(function (d) {
        samplePath(d, [0, 0]).forEach(function (p) {
          minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
          minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
        });
      });
      piece.width = maxX - minX;
      piece.height = maxY - minY;
      piece.x = piece.anchor[0] - shape.center[0];     // anchor 離框中心多遠
      piece.y = piece.anchor[1] - shape.center[1];
      piece.drawn = piece.paths.map(function (d) { return new Path2D(d); });
    });
  });
  // 小框沒有捲紋：當成是從很小的捲紋長出來的
  OPTION_SHAPES.forEach(function (shape, index) {
    const next = OPTION_SHAPES[index + 1];
    if (shape.arcs.paths.length === 0 && next) {
      shape.arcs.width = next.arcs.width * 0.3;
      shape.arcs.height = next.arcs.height * 0.3;
    }
  });
}

// 展開到 open 的時候，是在哪兩個造型之間、補到多少（t = 0 ~ 1）
function shapesAt(open) {
  let index = 0;
  while (index < OPTION_SHAPES.length - 2 && open > OPTION_SHAPES[index + 1].at) { index++; }
  const from = OPTION_SHAPES[index];
  const to = OPTION_SHAPES[index + 1];
  const t = Math.max(0, Math.min(1, (open - from.at) / (to.at - from.at)));
  return { from: from, to: to, t: t };
}

// 展開到 open 的時候，最裡面那圈線的半寬（原圖要跟著縮放的時候會用到）
function optionHalfWidth(open) {
  prepareShapes();
  const s = shapesAt(open);
  return lerp(s.from.profiles[2].half, s.to.profiles[2].half, s.t);
}

// 把補間出來的一圈線變成路徑（a、b 是兩個造型的同一圈線，t 是補到多少）
function traceRing(ctx, a, b, t) {
  const mid = lerp(a.mid, b.mid, t);
  const half = lerp(a.half, b.half, t);
  ctx.beginPath();
  for (let k = 0; k <= RING_COLS; k++) {
    ctx.lineTo(mid + RING_U[k] * half, lerp(a.top[k], b.top[k], t));
  }
  for (let k = RING_COLS; k >= 0; k--) {
    ctx.lineTo(mid + RING_U[k] * half, lerp(a.bottom[k], b.bottom[k], t));
  }
  ctx.closePath();
}

/* 畫一個零件（扇子、花、捲紋）。位置和大小在兩個造型之間補間；
   樣子則是兩個造型的零件縮放成一樣大之後疊在一起，前半段新的淡入、後半段舊的淡出。
   flipX / flipY = -1 表示左右 / 上下翻過去畫（右邊的扇子、下面的花、另外三個角的捲紋） */
function drawPiece(ctx, kind, shapes, alpha, flipX, flipY) {
  const a = shapes.from[kind];
  const b = shapes.to[kind];
  const t = shapes.t;
  const x = lerp(a.x, b.x, t);
  const y = lerp(a.y, b.y, t);
  const width = lerp(a.width, b.width, t);
  const height = lerp(a.height, b.height, t);
  [[a, Math.min(1, 2 - 2 * t)], [b, Math.min(1, 2 * t)]].forEach(function (pair) {
    const piece = pair[0];
    const amount = pair[1];
    if (amount <= 0 || piece.drawn.length === 0) { return; }
    const scaleX = width / piece.width;
    const scaleY = height / piece.height;
    ctx.save();
    ctx.translate(flipX * x, flipY * y);
    ctx.scale(flipX * scaleX, flipY * scaleY);
    ctx.translate(-piece.anchor[0], -piece.anchor[1]);
    ctx.globalAlpha = alpha * amount;
    ctx.strokeStyle = OPTION.line;
    ctx.lineWidth = OPTION.lineWidth / ((scaleX + scaleY) / 2);   // 縮放之後線還是一樣粗
    let fill = piece.fill;
    if (Array.isArray(fill)) {
      fill = ctx.createLinearGradient(0, piece.fill[0], 0, piece.fill[1]);
      fill.addColorStop(0, LOTUS_COLORS[0]);
      fill.addColorStop(1, LOTUS_COLORS[1]);
    }
    piece.drawn.forEach(function (path) {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill(path);
      }
      ctx.stroke(path);
    });
    ctx.restore();
  });
}

/* 畫「變形途中」的選項框（停下來的時候用的是 AI 原圖，見 createSelectScreen 裡的 paintOption）。
   x, y   中心位置
   open   0 = 小框，0.5 = 過渡造型，1 = 大框；中間的值就是補間出來的形狀
   angle  條紋現在轉到幾度
   alpha  整個框的透明度 */
function drawOption(ctx, x, y, open, angle, alpha) {
  prepareShapes();
  const shapes = shapesAt(open);

  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // ---- 四個內凹轉角的捲紋（先畫，才會被框蓋在下面） ----
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (flip) {
    drawPiece(ctx, "arcs", shapes, alpha, flip[0], flip[1]);
  });

  // ---- 三圈霓虹線：由外到內，每一圈都是「裡面塗黑 + 描線」 ----
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = OPTION.line;
  ctx.lineWidth = OPTION.lineWidth;
  ctx.fillStyle = "#000";
  for (let i = 0; i < 3; i++) {
    traceRing(ctx, shapes.from.profiles[i], shapes.to.profiles[i], shapes.t);
    ctx.fill();
    ctx.stroke();
  }

  // ---- 裡面旋轉的條紋（只出現在最裡面那一圈裡） ----
  ctx.save();
  traceRing(ctx, shapes.from.profiles[2], shapes.to.profiles[2], shapes.t);
  ctx.clip();
  drawRays(ctx, angle, 1);
  ctx.restore();

  // ---- 左右的扇子、上下的花 ----
  drawPiece(ctx, "fan", shapes, alpha, 1, 1);
  drawPiece(ctx, "fan", shapes, alpha, -1, 1);
  drawPiece(ctx, "lotus", shapes, alpha, 1, 1);
  drawPiece(ctx, "lotus", shapes, alpha, 1, -1);

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
  const choices = options.items;
  // 選項太少（例如只有兩個）的時候，把清單重複排幾次，
  // 輪盤的上面和下面才都看得到「另一個選項」，可以一直輪流轉下去
  const items = choices.slice();
  while (items.length < 6) {
    choices.forEach(function (choice) { items.push(choice); });
  }
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

    // 快要完全展開時淡接成大框原圖，快要完全收起時淡接成小框原圖
    // （變形途中的形狀到頭尾已經跟原圖幾乎一樣，所以只在最後一小段接過去就好）
    function smooth(t) {
      t = Math.max(0, Math.min(1, t));
      return t * t * (3 - 2 * t);
    }
    const bigAmount = ready ? smooth((open - 0.9) / 0.1) : 0;
    const smallAmount = ready ? smooth((0.1 - open) / 0.1) : 0;
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
    const widthNow = optionHalfWidth(open);
    if (bigAmount > 0) {
      paintArt(stampCtx, big, CX, CY, widthNow / optionHalfWidth(1), angle, bigAmount, false);
    }
    if (smallAmount > 0) {
      paintArt(stampCtx, small, CX, CY, widthNow / optionHalfWidth(0), angle, smallAmount, false);
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
      // 框的大小：沒被選到的時候縮小，展開的時候慢慢放大回原本的大小
      const size = lerp(OPTION.smallScale, 1, state.open);
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
        ctx.drawImage(stamp, x - STAMP_W / 2 * size, y - STAMP_H / 2 * size, STAMP_W * size, STAMP_H * size);
        ctx.globalAlpha = 1;
        canvasDirty = true;
      }

      // 框的原圖和文字跟著一起動（文字的大小、明暗在 CSS 裡用 --open 算）
      el.style.transform = "translate(" + x + "px, " + y + "px)";
      el.style.opacity = fade;
      el.style.setProperty("--open", state.open.toFixed(3));
      el.style.setProperty("--size", size.toFixed(4));
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
      descText.classList.toggle("long", text.length > 26); // 一行放不下就縮小字、換成兩行
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
    playSelectSound();    // 喀答一聲
    spinBoost();          // 條紋猛轉一下
    render();
  }

  return {
    onEnter: function () {
      // 一進來停在哪一個：之前選過的話停在那個（例如從音樂選擇按 ESC 回來），沒選過就停在第一個
      const chosen = options.current ? items.indexOf(options.current()) : -1;
      selected = chosen >= 0 ? chosen : 0;
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
      if (e.code === "Escape" && options.onBack) { options.onBack(); }   // 上一頁
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
  current: function () { return GameState.stage; },   // 回到這頁時停在之前選的舞台
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
  current: function () { return GameState.song; },
  onConfirm: function (song) {
    GameState.song = song;
    goTo("loading");
  },
  onBack: function () {
    goTo("stage");   // 按 ESC 回到舞台選擇，重新選舞台
  }
}));
