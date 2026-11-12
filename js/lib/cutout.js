/* =========================================================
   cutout.js — 自動去背、偵測五官，把照片做成 3D 小人的「貼圖」

   其他檔案這樣用：
     Cutout.preload();                               // 先在背景把模型載好（拍照頁一進來就呼叫）
     const skin = await Cutout.photoToSkin(照片canvas);   // 去背 + 找五官 + 做貼圖，一次完成
     viewer.setSkin(skin);                           // 交給 lowpoly.js 的小人

   用的是 Google 的 MediaPipe（要連網路才能載入）：
     - Image Segmenter：去背
     - Face Landmarker：找出臉的位置和眼睛，用來對準臉、把眼睛放大
   沒網路、載入失敗、或照片裡找不到臉時，會改用備用方案（固定的人形輪廓、不放大眼睛），
   流程一樣走得完，只是沒那麼準。

   想調整的數字都集中在下面的 FACE。
   ========================================================= */

const Cutout = (function () {

  // ---------- 臉的設定 ----------
  const FACE = {
    eyeScale: 2.5,         // 眼睛放大幾倍（1 = 不放大）
    eyeArea: 0.7,         // 以眼睛寬度為準，往外多取多少範圍一起放大（含眼皮、睫毛）
    eyeSpread: 0.08,       // 放大後兩眼各往外移一點，才不會擠在一起（以臉寬為單位）
    hairAbove: 0.4,        // 額頭上方多留多少給頭髮（以臉高為單位）
    sideMargin: 0.25,      // 臉的左右各多留多少給頭髮、耳朵（以臉寬為單位）
    chinBelow: 0.06        // 下巴下面多留多少
  };

  const MEDIAPIPE_VERSION = "0.10.14";
  const MEDIAPIPE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MEDIAPIPE_VERSION;
  const SEGMENTER_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
  const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const LOAD_TIMEOUT_MS = 30000;      // 等模型最多等多久，超過就用備用方案（第一次下載大約要 10 秒）

  let toolsPromise = null;            // 載好之後會是 { segmenter, landmarker }
  let loadFailed = false;             // 模型載不起來時設成 true，之後直接用備用方案

  // 載入兩個模型（只會載一次）
  function preload() {
    if (!toolsPromise) {
      toolsPromise = (async function () {
        const vision = await import(MEDIAPIPE_URL);
        const files = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_URL + "/wasm");
        const tools = { segmenter: null, landmarker: null };
        // 兩個模型分開載，其中一個失敗不影響另一個
        try {
          tools.segmenter = await vision.ImageSegmenter.createFromOptions(files, {
            baseOptions: { modelAssetPath: SEGMENTER_MODEL, delegate: "CPU" },
            runningMode: "IMAGE",
            outputCategoryMask: false,
            outputConfidenceMasks: true
          });
        } catch (error) {
          console.warn("去背模型載入失敗：", error);
        }
        try {
          tools.landmarker = await vision.FaceLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
            runningMode: "IMAGE",
            numFaces: 1
          });
        } catch (error) {
          console.warn("五官偵測模型載入失敗：", error);
        }
        return tools;
      })();
      toolsPromise.then(function () {
        loadFailed = false;
      }, function (error) {
        loadFailed = true;
        console.warn("MediaPipe 載入失敗，會改用備用方案：", error);
      });
    }
    return toolsPromise;
  }

  // 等模型載好。載不起來或等太久就回傳空的工具組
  async function getTools() {
    const none = { segmenter: null, landmarker: null };
    if (loadFailed) {
      return none;
    }
    const waitTooLong = new Promise(function (resolve, reject) {
      setTimeout(function () { reject(new Error("等太久")); }, LOAD_TIMEOUT_MS);
    });
    try {
      return await Promise.race([preload(), waitTooLong]);
    } catch (error) {
      loadFailed = true;
      console.warn("模型還沒準備好，改用備用方案：", error);
      return none;
    }
  }

  function newCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // =======================================================
  //  去背
  // =======================================================

  // 備用方案：用固定的「頭 + 肩膀」輪廓去切
  function fallbackCutout(photo) {
    const w = photo.width, h = photo.height;
    const canvas = newCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.36, w * 0.25, h * 0.25, 0, 0, Math.PI * 2);      // 頭
    ctx.rect(w * 0.42, h * 0.55, w * 0.16, h * 0.12);                            // 脖子
    ctx.ellipse(w * 0.5, h * 1.08, w * 0.47, h * 0.44, 0, 0, Math.PI * 2);      // 肩膀
    ctx.fill();
    ctx.globalCompositeOperation = "source-in";     // 只留下輪廓裡面的照片
    ctx.drawImage(photo, 0, 0);
    return canvas;
  }

  // 用 MediaPipe 去背
  function aiCutout(segmenter, photo) {
    const w = photo.width, h = photo.height;
    const result = segmenter.segment(photo);
    const masks = result.confidenceMasks;
    if (!masks || masks.length === 0) {
      throw new Error("沒有拿到遮罩");
    }
    // 只有一張遮罩時它就是「人」；有兩張時第 0 張是背景、第 1 張是人
    const mask = masks.length > 1 ? masks[1] : masks[0];
    const values = mask.getAsFloat32Array();
    const mw = mask.width, mh = mask.height;

    // 保險：正常情況下人在中間、背景在上面兩個角落。如果反過來，代表遮罩是「背景」，要反轉
    function sample(fx, fy) {
      return values[Math.floor(fy * (mh - 1)) * mw + Math.floor(fx * (mw - 1))];
    }
    const corners = (sample(0.03, 0.03) + sample(0.97, 0.03)) / 2;
    const middle = (sample(0.5, 0.45) + sample(0.5, 0.6)) / 2;
    const inverted = corners > middle;

    const canvas = newCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(photo, 0, 0);
    const image = ctx.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const my = Math.min(mh - 1, Math.floor(y * mh / h));
      for (let x = 0; x < w; x++) {
        const mx = Math.min(mw - 1, Math.floor(x * mw / w));
        let person = values[my * mw + mx];
        if (inverted) { person = 1 - person; }
        // 0.35 以下當背景、0.65 以上當人，中間漸層，邊緣比較柔
        const alpha = Math.min(1, Math.max(0, (person - 0.35) / 0.3));
        image.data[(y * w + x) * 4 + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    masks.forEach(function (m) { if (m.close) { m.close(); } });
    return canvas;
  }

  // 去背。不管成功失敗一定會回傳一張 canvas
  function removeBackground(tools, photo) {
    if (tools.segmenter) {
      try {
        const canvas = aiCutout(tools.segmenter, photo);
        if (findPerson(canvas) !== null) {
          return canvas;
        }
        console.warn("去背後找不到人，改用備用輪廓");
      } catch (error) {
        console.warn("去背失敗，改用備用輪廓：", error);
      }
    }
    return fallbackCutout(photo);
  }

  // =======================================================
  //  偵測五官
  //  回傳 { left, right, top, chin, eyes: [{x, y, w}, {x, y, w}] }（單位是照片的像素）
  //  找不到臉回傳 null
  // =======================================================
  function findFace(tools, photo) {
    if (!tools.landmarker) {
      return null;
    }
    try {
      const result = tools.landmarker.detect(photo);
      const points = result.faceLandmarks && result.faceLandmarks[0];
      if (!points) {
        return null;
      }
      // MediaPipe 臉部網格的固定編號：
      // 10 額頭頂、152 下巴、234 / 454 臉的左右邊、33 / 133 一隻眼睛的兩個眼角、362 / 263 另一隻
      function at(index) {
        return { x: points[index].x * photo.width, y: points[index].y * photo.height };
      }
      function eye(cornerA, cornerB) {
        const a = at(cornerA), b = at(cornerB);
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: Math.hypot(a.x - b.x, a.y - b.y) };
      }
      return {
        left: Math.min(at(234).x, at(454).x),
        right: Math.max(at(234).x, at(454).x),
        top: at(10).y,
        chin: at(152).y,
        eyes: [eye(33, 133), eye(362, 263)]
      };
    } catch (error) {
      console.warn("五官偵測失敗：", error);
      return null;
    }
  }

  // =======================================================
  //  分析去背後的圖：人在哪、脖子在哪（找不到臉時才會用到脖子）
  //  回傳 { rows: 每一列最左和最右的位置, top, bottom, neck }；找不到人回傳 null
  // =======================================================
  function findPerson(cutout) {
    const w = cutout.width, h = cutout.height;
    const data = cutout.getContext("2d").getImageData(0, 0, w, h).data;
    const rows = [];
    let top = -1, bottom = -1, total = 0;
    for (let y = 0; y < h; y++) {
      let left = -1, right = -1, count = 0;
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 128) {
          if (left < 0) { left = x; }
          right = x;
          count++;
        }
      }
      rows.push({ left: left, right: right, count: count });
      if (count > w * 0.03) {
        if (top < 0) { top = y; }
        bottom = y;
        total += count;
      }
    }
    if (top < 0 || bottom - top < h * 0.2 || total < w * h * 0.04) {
      return null;
    }

    // 找脖子：從頭頂往下，寬度先變寬（頭），再變窄（脖子），之後又變寬（肩膀）
    function widthAt(y) {       // 取上下幾列平均，比較不會被雜訊騙
      let sum = 0, n = 0;
      for (let k = -3; k <= 3; k++) {
        if (rows[y + k]) { sum += rows[y + k].count; n++; }
      }
      return sum / n;
    }
    const personHeight = bottom - top;
    let widest = 0;
    let neck = -1;
    for (let y = top + Math.floor(personHeight * 0.12); y < bottom - 5; y++) {
      const width = widthAt(y);
      if (width > widest) { widest = width; }
      if (width < widest * 0.8) {
        // 開始變窄了，繼續往下走到最窄的地方
        let best = y;
        for (let k = y; k < bottom && widthAt(k) <= widest; k++) {
          if (widthAt(k) < widthAt(best)) { best = k; }
        }
        neck = best;
        break;
      }
    }
    // 找不到明顯的脖子（例如長頭髮蓋住）：就當頭佔人的上半部
    if (neck < 0 || neck - top < personHeight * 0.2 || neck - top > personHeight * 0.8) {
      neck = top + Math.floor(personHeight * 0.52);
    }
    return { rows: rows, top: top, bottom: bottom, neck: neck };
  }

  // 某一段高度裡，人的最左和最右
  function sideRange(rows, yStart, yEnd, width) {
    let left = width, right = 0;
    for (let y = Math.floor(yStart); y <= yEnd; y++) {
      if (rows[y] && rows[y].count > 0) {
        left = Math.min(left, rows[y].left);
        right = Math.max(right, rows[y].right);
      }
    }
    if (right <= left) { left = 0; right = width - 1; }
    return { left: left, right: right };
  }

  // 一塊區域裡「有人的像素」的平均顏色，回傳 [r, g, b]（0~1）
  function averageColor(cutout, x, y, w, h) {
    x = Math.max(0, Math.min(cutout.width - 1, Math.floor(x)));
    y = Math.max(0, Math.min(cutout.height - 1, Math.floor(y)));
    w = Math.max(1, Math.min(cutout.width - x, Math.floor(w)));
    h = Math.max(1, Math.min(cutout.height - y, Math.floor(h)));
    const data = cutout.getContext("2d").getImageData(x, y, w, h).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 128) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    if (n === 0) { return [0.6, 0.6, 0.6]; }
    return [r / n / 255, g / n / 255, b / n / 255];
  }

  function cssColor(rgb) {
    return "rgb(" + Math.round(rgb[0] * 255) + "," + Math.round(rgb[1] * 255) + "," + Math.round(rgb[2] * 255) + ")";
  }

  // =======================================================
  //  把眼睛放大：從照片上把眼睛那一塊取出來，放大後蓋回貼圖上原本的位置
  // =======================================================
  function drawBigEye(ctx, cutout, eye, headBox, shiftX) {
    const toSkin = 256 / headBox.w;                        // 照片像素 → 貼圖像素的比例（橫向）
    const toSkinY = 256 / headBox.h;
    const sourceRadius = eye.w * FACE.eyeArea;             // 在照片上取多大一塊
    const size = 96;                                       // 先畫到一張小畫布上
    const patch = newCanvas(size, size);
    const pctx = patch.getContext("2d");
    pctx.drawImage(cutout,
      eye.x - sourceRadius, eye.y - sourceRadius, sourceRadius * 2, sourceRadius * 2,
      0, 0, size, size);
    // 邊緣做成漸層透明，蓋回去時才不會有一圈明顯的邊
    const fade = pctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size / 2);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    pctx.globalCompositeOperation = "destination-in";
    pctx.fillStyle = fade;
    pctx.fillRect(0, 0, size, size);

    const centerX = (eye.x - headBox.x) * toSkin + shiftX;
    const centerY = (eye.y - headBox.y) * toSkinY;
    const radiusX = sourceRadius * FACE.eyeScale * toSkin;
    const radiusY = sourceRadius * FACE.eyeScale * toSkinY;
    ctx.drawImage(patch, centerX - radiusX, centerY - radiusY, radiusX * 2, radiusY * 2);
  }

  // =======================================================
  //  做貼圖
  //  貼圖是一張 256×512 的圖：上半部放頭、下半部放身體
  //  cutout：去背後的照片　face：findFace 的結果（沒有就給 null）
  //  回傳 { canvas: 貼圖, cloth: 衣服色, skin: 膚色 }
  // =======================================================
  function makeSkin(cutout, face) {
    const w = cutout.width, h = cutout.height;
    let person = findPerson(cutout);
    if (person === null) {
      // 完全找不到人：整張圖上半當頭、下半當身體
      person = { rows: [], top: 0, bottom: h - 1, neck: Math.floor(h * 0.55) };
    }

    let headBox, torsoTop, skinColor, hairColor;
    if (face) {
      // 有偵測到臉：以臉為準框出頭，臉一定會在正中間
      const faceW = face.right - face.left;
      const faceH = face.chin - face.top;
      headBox = {
        x: face.left - faceW * FACE.sideMargin,
        y: face.top - faceH * FACE.hairAbove,
        w: faceW * (1 + FACE.sideMargin * 2),
        h: faceH * (1 + FACE.hairAbove + FACE.chinBelow)
      };
      torsoTop = face.chin + faceH * FACE.chinBelow;
      // 膚色取臉頰（眼睛下面那一帶）
      skinColor = averageColor(cutout, face.left + faceW * 0.25, face.top + faceH * 0.5, faceW * 0.5, faceH * 0.2);
      // 髮色取額頭正上方那一小塊
      hairColor = averageColor(cutout, face.left + faceW * 0.25, face.top - faceH * 0.3, faceW * 0.5, faceH * 0.2);
    } else {
      // 沒偵測到臉：用輪廓猜脖子的位置
      const head = sideRange(person.rows, person.top, person.neck, w);
      headBox = { x: head.left, y: person.top, w: head.right - head.left + 1, h: person.neck - person.top };
      torsoTop = person.neck;
      skinColor = averageColor(cutout, headBox.x + headBox.w * 0.3, headBox.y + headBox.h * 0.4, headBox.w * 0.4, headBox.h * 0.35);
      hairColor = averageColor(cutout, headBox.x, headBox.y, headBox.w, headBox.h * 0.22);
    }

    // 身體：從下巴（脖子）往下取一段。只拍到肩膀也沒關係，有多少用多少
    let torsoBottom = Math.min(person.bottom, torsoTop + headBox.h * 0.9);
    if (torsoBottom - torsoTop < 8) {              // 下巴已經在照片最底下了：就用最底下那一小條
      torsoTop = Math.max(0, h - 12);
      torsoBottom = h - 1;
    }
    const torso = sideRange(person.rows, torsoTop, torsoBottom, w);
    const torsoBox = { x: torso.left, y: torsoTop, w: torso.right - torso.left + 1, h: torsoBottom - torsoTop };

    const clothColor = averageColor(cutout, torsoBox.x + torsoBox.w * 0.2, torsoBox.y + torsoBox.h * 0.5, torsoBox.w * 0.6, torsoBox.h * 0.5);

    const canvas = newCanvas(256, 512);
    const ctx = canvas.getContext("2d");
    // 去背後透明的地方先塗上顏色，不然貼到模型上會破洞：頭的周圍塗髮色，身體塗衣服色
    ctx.fillStyle = cssColor(hairColor);
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = cssColor(clothColor);
    ctx.fillRect(0, 256, 256, 256);

    // 畫頭（上半部）。用 clip 限制範圍，等一下放大的眼睛才不會畫到身體那一半
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 256, 256);
    ctx.clip();
    ctx.drawImage(cutout, headBox.x, headBox.y, headBox.w, headBox.h, 0, 0, 256, 256);
    if (face && FACE.eyeScale > 1) {
      // 照片上比較左邊的眼睛往左移、右邊的往右移
      const eyes = face.eyes.slice().sort(function (a, b) { return a.x - b.x; });
      const spread = (face.right - face.left) * FACE.eyeSpread * (256 / headBox.w);
      drawBigEye(ctx, cutout, eyes[0], headBox, -spread);
      drawBigEye(ctx, cutout, eyes[1], headBox, spread);
    }
    ctx.restore();

    // 畫身體（下半部）
    ctx.drawImage(cutout, torsoBox.x, torsoBox.y, torsoBox.w, torsoBox.h, 0, 256, 256, 256);

    return { canvas: canvas, cloth: clothColor, skin: skinColor };
  }

  // 一次做完：去背 → 找五官 → 做貼圖
  async function photoToSkin(photo) {
    const tools = await getTools();
    const cutout = removeBackground(tools, photo);
    const face = findFace(tools, photo);
    return makeSkin(cutout, face);
  }

  return {
    FACE: FACE,
    preload: preload,
    photoToSkin: photoToSkin,
    fallbackCutout: fallbackCutout,
    makeSkin: makeSkin
  };
})();
