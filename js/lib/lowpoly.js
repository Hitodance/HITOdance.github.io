/* =========================================================
   lowpoly.js — 低面數 3D 小人（自己用 WebGL 畫，沒有用外部函式庫）

   這個檔案是「引擎」，裡面是 3D 數學，平常不用改。
   其他檔案只要這樣用：

     const viewer = LowPoly.create(canvas, "p1");   // 在某個 <canvas> 上建立小人
     viewer.setSkin(getSkin("p1"));                 // 貼上玩家的照片貼圖
     viewer.play("dance");                          // 開始動
     viewer.stop();                                 // 停止（離開畫面時記得呼叫）

   play() 可以用的動作：
     "spin"   從很小一路旋轉放大（建模頁）
     "dance"  跳舞（對戰頁），舞步在下面的 DANCE_MOVES
     "win"    舉手歡呼（結算頁贏家）
     "lose"   垂頭喪氣（結算頁輸家）
     "idle"   站著輕輕晃
   viewer.kick()：小人抖一下（對戰時按到按鍵用）

   想調整的東西都集中在最上面：
     LOOK         解析度、抖動、節奏
     BODY         身體比例
     DANCE_MOVES  舞步（可以自己改、自己加）
   （臉的位置、眼睛放大幾倍是在 cutout.js 的 FACE）
   ========================================================= */

const LowPoly = (function () {

  // ---------- 外觀設定 ----------
  const LOOK = {
    pixelWidth: 240,       // 畫面內部解析度（越小越有復古馬賽克感）
    pixelHeight: 320,
    wobble: 90,            // 頂點抖動程度（越小抖越兇，像 PS1；0 = 不抖）
    spinSeconds: 3,        // "spin" 轉出來要幾秒
    spinTurns: 4,          // "spin" 總共轉幾圈
    danceBpm: 120,         // 跳舞的節奏（對戰頁會換成那首歌的 bpm）
    snap: 0.45,            // 動作多俐落：一拍裡面用多少比例的時間「甩」到定位，剩下的時間定格（越小越有力）
    groove: 0.16           // 每一拍膝蓋往下彈多少（律動感）
  };

  // ---------- 身體比例（大頭娃娃） ----------
  const BODY = {
    headSize: 0.95,        // 頭的大小
    headStretchX: 1.0,     // 頭的寬度倍率
    headForward: 0,        // 頭往前探多少
    noseLength: 0,         // 鼻子多長（0 = 不要鼻子）
    noseDroop: 0.3,        // 鼻尖往下垂多少
    hunch: 0,              // 駝背程度（0 = 站直）
    shoulder: 0.56,        // 肩膀半寬
    waist: 0.40,           // 腰半寬
    torsoHeight: 1.0,      // 身體多長
    armLength: 0.95,       // 手臂多長（上臂 + 前臂）
    armThick: 0.1,         // 手臂多粗
    handSize: 0.13,        // 手多大
    legLength: 0.9,        // 腿多長（大腿 + 小腿）
    legThick: 0.115,       // 腿多粗
    shoeLength: 0.22       // 鞋子多長
  };
  // 想換成「長鼻子、駝背、細長手腳」的誇張漫畫版，把上面的數字改成：
  //   headSize 1.05, headForward 0.4, noseLength 1.1, hunch 0.4, shoulder 0.34, waist 0.24,
  //   torsoHeight 0.65, armLength 1.25, armThick 0.06, handSize 0.15, legLength 1.5, legThick 0.07, shoeLength 0.4

  /* ---------- 舞步 ----------
     每一組舞步有幾個「定格姿勢」，每一拍換下一個姿勢，跳完 beats 拍之後換下一組，全部跳完再從頭循環。
     mirror: true 的姿勢 = 把前面寫的那個姿勢左右相反。

     姿勢裡可以寫的項目（沒寫的就是站直的預設值；角度的單位是「弧度」，1.57 ≈ 90 度）：
       turn       整個人轉向（正的往他的左邊轉）
       hipX       整個人左右移
       y          跳起來的高度
       lean       身體左右傾
       hunch      身體往前彎（負的 = 往後仰）
       twist      上半身扭轉
       headNod    點頭（正的往下）   headTilt 歪頭   headTurn 轉頭
       armLRaise  左手往旁邊舉起（0 垂下、1.57 平舉、3 舉高）
       armLFwd    左手往前擺（負的往後）
       armLElbow  左手肘彎曲（0 伸直、1.57 彎 90 度）
       armLIn     左前臂往身體內側收（手放胸前、叉腰用）
       legLSpread 左腳往旁邊張開
       legLBend   左膝蓋彎曲（兩腳一起彎就是蹲）
       legLLift   左腳抬起來（抬膝、踢腿）
       右邊就是把 L 換成 R。
  */
  const STANCE = { legLSpread: 0.35, legRSpread: 0.35, legLBend: 0.35, legRBend: 0.35 };   // 街舞基本站姿：腳開、膝蓋微彎

  const DANCE_MOVES = [
    {
      name: "胸前律動",
      beats: 8,
      poses: [
        { stance: true, lean: 0.22, twist: 0.6, headTilt: 0.2, legLBend: 0.2, legRBend: 0.5,
          armLRaise: 0.5, armLFwd: 1.4, armLElbow: 1.7,
          armRRaise: 0.5, armRFwd: -0.7, armRElbow: 1.5 },
        { mirror: true }
      ]
    },
    {
      name: "單手甩出去",
      beats: 8,
      poses: [
        { legLSpread: 0.3, legRSpread: 0.55, legLBend: 0.4, legRBend: 0.15, lean: -0.28, twist: -0.3, headTurn: -0.45,
          armRRaise: 2.2, armRElbow: 0.1,
          armLRaise: 0.55, armLElbow: 1.8, armLIn: 1.2 },
        { stance: true, legLBend: 0.55, legRBend: 0.55, hunch: 0.28, headNod: 0.2,
          armLRaise: 0.6, armLFwd: 0.8, armLElbow: 2.1,
          armRRaise: 0.6, armRFwd: 0.8, armRElbow: 2.1 },
        { mirror: true, of: 0 },
        { mirror: true, of: 1 }
      ]
    },
    {
      name: "蹲低再彈起",
      beats: 8,
      poses: [
        { legLSpread: 0.6, legRSpread: 0.6, legLBend: 1.0, legRBend: 1.0, hunch: 0.45, headNod: -0.2, lean: 0.15,
          armLRaise: 0.35, armLFwd: 0.7, armLElbow: 0.4,
          armRRaise: 0.35, armRFwd: 0.7, armRElbow: 0.4 },
        { legLSpread: 0.6, legRSpread: 0.6, legLBend: 1.1, legRBend: 1.1, hunch: 0.5, headNod: -0.2, lean: -0.15,
          armLRaise: 0.5, armLFwd: 0.4, armLElbow: 0.9,
          armRRaise: 0.5, armRFwd: 0.4, armRElbow: 0.9 },
        { legLSpread: 0.3, legRSpread: 0.3, legLBend: 0.05, legRBend: 0.05, hunch: -0.15, headNod: -0.3, y: 0.3,
          armLRaise: 2.7, armLElbow: 0.3,
          armRRaise: 2.7, armRElbow: 0.3 },
        { stance: true, legLBend: 0.55, legRBend: 0.55,
          armLRaise: 1.3, armLElbow: 1.6, armLIn: 0.4,
          armRRaise: 1.3, armRElbow: 1.6, armRIn: 0.4 }
      ]
    },
    {
      name: "側身抬腿",
      beats: 8,
      poses: [
        { turn: 0.9, lean: 0.15, hunch: -0.1, legLBend: 0.25, legRLift: 1.1, legRBend: 0.2,
          armLRaise: 1.5, armLElbow: 0.2,
          armRRaise: 0.35, armRFwd: -0.8, armRElbow: 0.5 },
        { turn: 0.9, stance: true, legLBend: 0.5, legRBend: 0.5, hunch: 0.3,
          armLRaise: 0.6, armLFwd: 0.9, armLElbow: 1.6, armLIn: 0.8,
          armRRaise: 0.6, armRFwd: 0.9, armRElbow: 1.6, armRIn: 0.8 },
        { mirror: true, of: 0 },
        { mirror: true, of: 1 }
      ]
    },
    {
      name: "左右搖擺",
      beats: 8,
      poses: [
        { hipX: 0.3, lean: 0.35, turn: 0.35, hunch: 0.25, headTilt: 0.3,
          legLSpread: 0.45, legRSpread: 0.4, legLBend: 0.15, legRBend: 0.7,
          armLRaise: 1.7, armLElbow: 1.2,
          armRRaise: 0.2, armRFwd: 0.7, armRElbow: 1.1, armRIn: 0.6 },
        { mirror: true }
      ]
    },
    {
      name: "指天指地",
      beats: 8,
      poses: [
        { lean: -0.2, twist: -0.25, headTurn: -0.5,
          legLSpread: 0.3, legRSpread: 0.5, legLBend: 0.4, legRBend: 0.1,
          armRRaise: 2.5, armRElbow: 0,
          armLRaise: 0.7, armLFwd: -0.2, armLElbow: 0 },
        { stance: true, legLBend: 0.55, legRBend: 0.55, hunch: 0.2, twist: 0.3,
          armRRaise: 0.25, armRFwd: 1.0, armRIn: 0.9, armRElbow: 0.5,
          armLRaise: 0.45, armLElbow: 0.9, armLIn: 0.9 },
        { ref: 0 }, { ref: 1 },
        { mirror: true, of: 0 }, { mirror: true, of: 1 }, { mirror: true, of: 0 }, { mirror: true, of: 1 }
      ]
    }
  ];

  const ACCENT = {               // 鞋子顏色 = 玩家代表色
    p1: [0, 1, 1],
    p2: [1, 0, 1]
  };

  // =======================================================
  //  姿勢：所有可以動的項目和預設值（站直）
  // =======================================================
  const DEFAULT_POSE = {
    scale: 1, y: 0, turn: 0, hipX: 0,
    lean: 0, hunch: 0, twist: 0,
    headNod: 0, headTilt: 0, headTurn: 0,
    armLRaise: 0.12, armLFwd: 0, armLElbow: 0.15, armLIn: 0,
    armRRaise: 0.12, armRFwd: 0, armRElbow: 0.15, armRIn: 0,
    legLSpread: 0.05, legLBend: 0, legLLift: 0,
    legRSpread: 0.05, legRBend: 0, legRLift: 0
  };
  const POSE_KEYS = Object.keys(DEFAULT_POSE);
  const FLIP_SIGN = ["turn", "hipX", "lean", "twist", "headTilt", "headTurn"];   // 左右相反時要變號的項目

  function makePose(overrides) {
    const pose = Object.assign({}, DEFAULT_POSE);
    if (overrides && overrides.stance) {
      Object.assign(pose, STANCE);
    }
    POSE_KEYS.forEach(function (key) {
      if (overrides && typeof overrides[key] === "number") {
        pose[key] = overrides[key];
      }
    });
    return pose;
  }

  function mirrorPose(pose) {
    const out = {};
    POSE_KEYS.forEach(function (key) {
      let from = key;
      if (key.indexOf("armL") === 0 || key.indexOf("legL") === 0) { from = key.replace("L", "R"); }
      else if (key.indexOf("armR") === 0 || key.indexOf("legR") === 0) { from = key.replace("R", "L"); }
      out[key] = FLIP_SIGN.indexOf(key) >= 0 ? -pose[from] : pose[from];
    });
    return out;
  }

  function mixPose(a, b, amount) {
    const out = {};
    POSE_KEYS.forEach(function (key) {
      out[key] = a[key] + (b[key] - a[key]) * amount;
    });
    return out;
  }

  // 把 DANCE_MOVES 展開成「每一拍一個姿勢」的長清單
  function buildDanceTimeline() {
    const timeline = [];
    DANCE_MOVES.forEach(function (move) {
      const poses = [];
      move.poses.forEach(function (raw, index) {
        if (raw.mirror) {
          const source = typeof raw.of === "number" ? raw.of : index - 1;
          poses.push(mirrorPose(poses[source]));
        } else if (typeof raw.ref === "number") {
          poses.push(poses[raw.ref]);
        } else {
          poses.push(makePose(raw));
        }
      });
      for (let beat = 0; beat < move.beats; beat++) {
        timeline.push(poses[beat % poses.length]);
      }
    });
    return timeline;
  }
  const DANCE_TIMELINE = buildDanceTimeline();

  // =======================================================
  //  矩陣小工具（4×4，欄優先）
  // =======================================================
  function matIdentity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  function matMultiply(a, b) {
    const out = new Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        out[col * 4 + row] = sum;
      }
    }
    return out;
  }
  function matTranslate(m, x, y, z) {
    return matMultiply(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }
  function matScale(m, s) {
    return matMultiply(m, [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  }
  function matRotateX(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return matMultiply(m, [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function matRotateY(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return matMultiply(m, [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  function matRotateZ(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return matMultiply(m, [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  function matPerspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ];
  }

  // =======================================================
  //  模型：用三角形拼出頭、身體、手、腳
  //  每個頂點 9 個數字：位置 xyz、法線 xyz、貼圖座標 uv、種類 kind
  //  kind：0 = 貼照片　1 = 衣服色　2 = 膚色　3 = 褲子色　4 = 鞋子色
  // =======================================================
  const STRIDE = 9;

  function createBuilder() {
    const data = [];
    const builder = {
      data: data,
      // 加一個三角形。center 是這個零件的中心，用來確定法線朝外
      tri: function (a, b, c, center, kind, uvOf) {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= length; ny /= length; nz /= length;
        const mx = (a[0] + b[0] + c[0]) / 3 - center[0];
        const my = (a[1] + b[1] + c[1]) / 3 - center[1];
        const mz = (a[2] + b[2] + c[2]) / 3 - center[2];
        if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        [a, b, c].forEach(function (p) {
          const uv = uvOf ? uvOf(p) : [0, 0];
          data.push(p[0], p[1], p[2], nx, ny, nz, uv[0], uv[1], kind);
        });
      },
      quad: function (a, b, c, d, center, kind, uvOf) {
        builder.tri(a, b, c, center, kind, uvOf);
        builder.tri(a, c, d, center, kind, uvOf);
      },
      // 上下可以不同寬的方塊（中心在 x=offsetX, z=offsetZ，從 yBottom 到 yTop）
      box: function (yBottom, yTop, halfBottom, halfTop, depthBottom, depthTop, kind, uvOf, offsetX, offsetZ) {
        const ox = offsetX || 0;
        const oz = offsetZ || 0;
        const b = [
          [ox - halfBottom, yBottom, oz + depthBottom], [ox + halfBottom, yBottom, oz + depthBottom],
          [ox + halfBottom, yBottom, oz - depthBottom], [ox - halfBottom, yBottom, oz - depthBottom]
        ];
        const t = [
          [ox - halfTop, yTop, oz + depthTop], [ox + halfTop, yTop, oz + depthTop],
          [ox + halfTop, yTop, oz - depthTop], [ox - halfTop, yTop, oz - depthTop]
        ];
        const center = [ox, (yBottom + yTop) / 2, oz];
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4;
          builder.quad(b[i], b[j], t[j], t[i], center, kind, uvOf);   // 四個側面
        }
        builder.quad(t[0], t[1], t[2], t[3], center, kind, uvOf);     // 上蓋
        builder.quad(b[0], b[1], b[2], b[3], center, kind, uvOf);     // 下蓋
      }
    };
    return builder;
  }

  // 固定的「亂數」，讓頭的稜角每次都長一樣
  function fakeRandom(i) {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // 頭：像切割過的寶石。照片從正面「投影」上去，所以側面會被拉長，這就是好笑的來源
  function buildHead(builder) {
    const size = BODY.headSize;
    const rings = [            // [高度, 半徑]，由上到下
      [0.78, 0.50],
      [0.28, 0.80],
      [-0.30, 0.76],
      [-0.78, 0.46]
    ];
    const segments = 6;
    const points = [];
    rings.forEach(function (ring, r) {
      const row = [];
      for (let s = 0; s < segments; s++) {
        const angle = (s + 0.5) / segments * Math.PI * 2;
        const jitter = 1 + (fakeRandom(r * 10 + s) - 0.5) * 0.14;
        row.push([
          Math.sin(angle) * ring[1] * jitter * size * BODY.headStretchX,
          ring[0] * size,
          Math.cos(angle) * ring[1] * jitter * size * 0.85
        ]);
      }
      points.push(row);
    });
    const top = [0, 1.0 * size, 0];
    const bottom = [0, -1.0 * size, 0.1 * size];
    const center = [0, 0, 0];

    // 貼圖座標：只看 x、y（從正面投影），對應到貼圖的上半部（頭的照片）
    const halfWidth = 0.86 * size * BODY.headStretchX;
    function uvOf(p) {
      const u = 0.5 + p[0] / (2 * halfWidth);
      const v = (size - p[1]) / (2 * size);
      return [Math.min(0.98, Math.max(0.02, u)), Math.min(0.98, Math.max(0.02, v)) * 0.5];
    }

    for (let s = 0; s < segments; s++) {
      const n = (s + 1) % segments;
      builder.tri(top, points[0][s], points[0][n], center, 0, uvOf);
      for (let r = 0; r < rings.length - 1; r++) {
        builder.quad(points[r][s], points[r][n], points[r + 1][n], points[r + 1][s], center, 0, uvOf);
      }
      builder.tri(bottom, points[rings.length - 1][s], points[rings.length - 1][n], center, 0, uvOf);
    }

    // 鼻子：從臉的中間往前伸出去的尖錐。顏色取照片上鼻子那一帶，所以會被拉得很長
    if (BODY.noseLength > 0) {
      const noseY = -0.14 * size;        // 鼻子在頭的哪個高度（照片裡鼻子大約在頭的中間偏下）
      const faceZ = 0.5 * size;          // 臉的表面大概在這個深度
      const base = [
        [0, noseY + 0.26 * size, faceZ],
        [0.2 * size, noseY, faceZ],
        [0, noseY - 0.16 * size, faceZ],
        [-0.2 * size, noseY, faceZ]
      ];
      const tip = [0, noseY - BODY.noseDroop * size, faceZ + BODY.noseLength * size];
      const noseCenter = [0, noseY, faceZ + BODY.noseLength * size * 0.3];
      const tipUV = uvOf([0, noseY - 0.05 * size, 0]);
      function noseUV(p) {
        return p === tip ? tipUV : uvOf(p);
      }
      for (let i = 0; i < 4; i++) {
        builder.tri(base[i], base[(i + 1) % 4], tip, noseCenter, 0, noseUV);
      }
    }
  }

  // 身體各段的長度
  const SIZE = {
    upperArm: BODY.armLength * 0.5,
    foreArm: BODY.armLength * 0.5,
    thigh: BODY.legLength * 0.5,
    shin: BODY.legLength * 0.5
  };

  // 把所有零件做出來。每個零件記住自己用到第幾個到第幾個頂點
  // 零件的原點都在「關節」上（肩膀、手肘、屁股、膝蓋），往下長
  function buildModel() {
    const builder = createBuilder();
    const parts = {};
    function part(name, build) {
      const first = builder.data.length / STRIDE;
      build();
      parts[name] = { first: first, count: builder.data.length / STRIDE - first };
    }

    // 身體：貼圖的下半部（身體的照片），一樣從正面投影
    part("torso", function () {
      function uvOf(p) {
        const u = 0.5 + p[0] / (2 * BODY.shoulder);
        const v = 1 - p[1] / BODY.torsoHeight;
        return [Math.min(0.98, Math.max(0.02, u)), 0.5 + Math.min(0.98, Math.max(0.02, v)) * 0.5];
      }
      builder.box(0, BODY.torsoHeight, BODY.waist, BODY.shoulder, 0.2, 0.24, 0, uvOf);
    });

    part("head", function () {
      buildHead(builder);
    });

    const arm = BODY.armThick, hand = BODY.handSize;
    part("upperArm", function () {
      builder.box(-SIZE.upperArm, 0, arm * 1.1, arm * 1.3, arm * 1.1, arm * 1.3, 1);
    });
    part("foreArm", function () {
      builder.box(-SIZE.foreArm, 0, arm, arm * 1.1, arm, arm * 1.1, 1);
      builder.box(-SIZE.foreArm - hand * 2, -SIZE.foreArm, hand * 0.8, hand, hand * 0.5, hand * 0.6, 2);   // 手
    });

    const leg = BODY.legThick;
    part("thigh", function () {
      builder.box(-SIZE.thigh, 0, leg * 1.2, leg * 1.4, leg * 1.2, leg * 1.4, 3);
    });
    part("shin", function () {
      builder.box(-SIZE.shin + 0.14, 0, leg, leg * 1.2, leg, leg * 1.2, 3);
      builder.box(-SIZE.shin, -SIZE.shin + 0.17, 0.17, 0.14, BODY.shoeLength, BODY.shoeLength * 0.75, 4, null, 0, BODY.shoeLength * 0.55);   // 鞋子
    });

    return {
      vertices: new Float32Array(builder.data),
      parts: parts,
      height: BODY.legLength + BODY.torsoHeight + BODY.headSize * 1.75
    };
  }

  const MODEL = buildModel();

  // =======================================================
  //  著色器
  // =======================================================
  const VERTEX_SHADER = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUV;
    attribute float aKind;
    uniform mat4 uProjection;
    uniform mat4 uModel;
    uniform float uWobble;
    varying vec2 vUV;
    varying float vKind;
    varying float vLight;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vec3 normal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
      float diffuse = max(dot(normal, normalize(vec3(0.35, 0.6, 0.75))), 0.0);
      vLight = 0.5 + 0.6 * diffuse;
      vUV = aUV;
      vKind = aKind;
      vec4 position = uProjection * world;
      if (uWobble > 0.0) {
        // 把頂點吸附到格子上，動起來會一抖一抖的
        position.xy = floor(position.xy / position.w * uWobble + 0.5) / uWobble * position.w;
      }
      gl_Position = position;
    }
  `;
  const FRAGMENT_SHADER = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec3 uCloth;
    uniform vec3 uSkin;
    uniform vec3 uAccent;
    varying vec2 vUV;
    varying float vKind;
    varying float vLight;
    void main() {
      vec3 color;
      if (vKind < 0.5) { color = texture2D(uTexture, vUV).rgb; }
      else if (vKind < 1.5) { color = uCloth; }
      else if (vKind < 2.5) { color = uSkin; }
      else if (vKind < 3.5) { color = uCloth * 0.4 + 0.05; }
      else { color = uAccent; }
      gl_FragColor = vec4(color * vLight, 1.0);
    }
  `;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  // WebGL 開不起來時回傳的空殼，讓其他程式照樣能呼叫、不會壞掉
  function dummyViewer() {
    return { setSkin: function () {}, play: function () {}, stop: function () {}, kick: function () {} };
  }

  // =======================================================
  //  建立一個小人
  // =======================================================
  function create(canvas, player) {
    canvas.width = LOOK.pixelWidth;
    canvas.height = LOOK.pixelHeight;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) {
      console.warn("這個瀏覽器開不了 WebGL，3D 小人不會顯示");
      return dummyViewer();
    }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
    } catch (error) {
      console.warn("3D 小人初始化失敗：", error);
      return dummyViewer();
    }
    gl.useProgram(program);

    // 頂點資料
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, MODEL.vertices, gl.STATIC_DRAW);
    const bytes = STRIDE * 4;
    [["aPosition", 3, 0], ["aNormal", 3, 12], ["aUV", 2, 24], ["aKind", 1, 32]].forEach(function (a) {
      const location = gl.getAttribLocation(program, a[0]);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, a[1], gl.FLOAT, false, bytes, a[2]);
    });

    const uniform = {};
    ["uProjection", "uModel", "uWobble", "uTexture", "uCloth", "uSkin", "uAccent"].forEach(function (name) {
      uniform[name] = gl.getUniformLocation(program, name);
    });

    // 貼圖（先放一格灰色，等 setSkin）
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([160, 160, 160, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniformMatrix4fv(uniform.uProjection, false,
      new Float32Array(matPerspective(0.6, canvas.width / canvas.height, 0.1, 50)));
    gl.uniform1f(uniform.uWobble, LOOK.wobble);
    gl.uniform1i(uniform.uTexture, 0);
    gl.uniform3fv(uniform.uCloth, [0.5, 0.5, 0.5]);
    gl.uniform3fv(uniform.uSkin, [0.9, 0.75, 0.65]);
    gl.uniform3fv(uniform.uAccent, ACCENT[player] || ACCENT.p1);

    let mode = "idle";
    let startTime = 0;
    let frameId = 0;
    let kickTime = -10;
    // 兩個人從不同的舞步開始跳，才不會動作一模一樣
    const danceOffset = player === "p2" ? Math.floor(DANCE_TIMELINE.length / 2) : 0;

    // ---------- 跳舞：依照時間算出現在的姿勢 ----------
    function dancePose(t) {
      const beatTime = Math.max(0, t) * LOOK.danceBpm / 60;   // 現在是第幾拍（含小數）
      const beat = Math.floor(beatTime);
      const inside = beatTime - beat;                      // 這一拍走到哪了（0 ~ 1）
      const length = DANCE_TIMELINE.length;
      const from = DANCE_TIMELINE[(beat + danceOffset + length - 1) % length];
      const to = DANCE_TIMELINE[(beat + danceOffset) % length];

      // 前段很快甩到定位，後段定格：這就是「俐落」的感覺
      const progress = Math.min(1, inside / LOOK.snap);
      const ease = 1 - Math.pow(1 - progress, 3);
      const pose = mixPose(from, to, ease);

      // 律動：每一拍的拍點膝蓋往下沉一下、頭點一下
      const pulse = Math.cos(inside * Math.PI * 2) * 0.5 + 0.5;
      pose.legLBend += LOOK.groove * pulse;
      pose.legRBend += LOOK.groove * pulse;
      pose.headNod += 0.1 * pulse;
      return pose;
    }

    // ---------- 依照目前的動作和時間，算出姿勢 ----------
    function currentPose(t) {
      let p;
      const beat = t * LOOK.danceBpm / 60 * Math.PI;       // 每一拍 = π

      if (mode === "dance") {
        p = dancePose(t);
      } else if (mode === "spin") {
        p = makePose({ armLRaise: 0.5, armRRaise: 0.5 });
        const progress = Math.min(1, t / LOOK.spinSeconds);
        const ease = 1 - Math.pow(1 - progress, 3);
        p.scale = 0.05 + 0.95 * ease;
        p.turn = (1 - ease) * Math.PI * 2 * LOOK.spinTurns;
        if (progress >= 1) {                               // 轉完之後慢慢自轉展示
          p.turn = (t - LOOK.spinSeconds) * 0.9;
          p.y = Math.abs(Math.sin((t - LOOK.spinSeconds) * 3)) * 0.06;
        }
      } else if (mode === "win") {
        p = makePose({ hunch: -0.1, headNod: -0.25, legLBend: 0.15, legRBend: 0.15 });
        p.y = Math.abs(Math.sin(beat)) * 0.45;
        p.turn = Math.sin(beat / 2) * 0.5;
        p.armLRaise = 2.6 + Math.sin(beat * 2) * 0.3;
        p.armRRaise = 2.6 - Math.sin(beat * 2) * 0.3;
        p.armLElbow = 0.3; p.armRElbow = 0.3;
      } else if (mode === "lose") {
        p = makePose({ hunch: 0.4, headNod: 0.6, legLBend: 0.15, legRBend: 0.15, armLFwd: 0.1, armRFwd: 0.1 });
        p.turn = Math.sin(t * 0.8) * 0.3;
        p.headTilt = Math.sin(t * 1.3) * 0.08;
      } else {
        p = makePose({});
        p.turn = Math.sin(t * 0.9) * 0.45;
        p.legLBend = p.legRBend = 0.05 + Math.sin(t * 2.2) * 0.04;
        p.headTilt = Math.sin(t * 1.1) * 0.08;
      }

      // 被 kick() 之後抖一下
      const sinceKick = t - kickTime;
      if (sinceKick >= 0 && sinceKick < 0.25) {
        p.scale *= 1 + (1 - sinceKick / 0.25) * 0.12;
      }
      return p;
    }

    function drawPart(name, matrix) {
      const part = MODEL.parts[name];
      gl.uniformMatrix4fv(uniform.uModel, false, new Float32Array(matrix));
      gl.drawArrays(gl.TRIANGLES, part.first, part.count);
    }

    function draw(now) {
      const t = (now - startTime) / 1000;
      const p = currentPose(t);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 腳要踩在地上：膝蓋彎、腳張開時腿「垂直方向」會變短，身體就要跟著降下來。
      // 兩隻腳裡比較直的那隻決定身體高度，另一隻就是抬起來的腳
      function legReach(spread, bend, lift) {
        const thighAngle = bend + lift;
        const shinAngle = thighAngle - (bend * 2 + lift * 1.2);
        return (SIZE.thigh * Math.cos(thighAngle) + SIZE.shin * Math.cos(shinAngle)) * Math.cos(spread);
      }
      const reach = Math.max(
        legReach(p.legLSpread, p.legLBend, p.legLLift),
        legReach(p.legRSpread, p.legRBend, p.legRLift)
      );
      const drop = BODY.legLength - reach;

      // ---- 整個人 ----
      let root = matIdentity();
      // 鏡頭距離跟著身高和鼻子長度自動調整，改比例之後不會跑出畫面
      root = matTranslate(root, 0, -MODEL.height * 0.5, -(MODEL.height * 2.35 + BODY.noseLength * 0.8));
      root = matTranslate(root, 0, MODEL.height * 0.45, 0);     // 以身體中心縮放、旋轉
      root = matScale(root, p.scale);
      root = matRotateY(root, p.turn);
      // 最後一個數字：頭往前探、鼻子很長的時候把人往後挪一點，轉圈時才不會轉出畫面
      root = matTranslate(root, p.hipX, -MODEL.height * 0.45 + p.y - drop, -(BODY.headForward + BODY.noseLength) * 0.5);

      const hunch = BODY.hunch + p.hunch;

      // ---- 身體 → 頭、手 ----
      let torso = matTranslate(root, 0, BODY.legLength, 0);
      torso = matRotateZ(torso, p.lean);
      torso = matRotateY(torso, p.twist);
      torso = matRotateX(torso, hunch);
      drawPart("torso", torso);

      let head = matTranslate(torso, 0, BODY.torsoHeight + BODY.headSize * 0.8, BODY.headForward);
      head = matRotateY(head, p.headTurn);
      head = matRotateZ(head, p.headTilt);
      head = matRotateX(head, p.headNod - hunch * 0.75);       // 身體往前彎時頭往回抬一點，才看得到臉
      drawPart("head", head);

      [["L", -1], ["R", 1]].forEach(function (side) {
        const name = side[0], sign = side[1];
        let upper = matTranslate(torso, sign * (BODY.shoulder + 0.05), BODY.torsoHeight - 0.06, 0);
        upper = matRotateZ(upper, sign * p["arm" + name + "Raise"]);
        upper = matRotateX(upper, -p["arm" + name + "Fwd"] - hunch);
        drawPart("upperArm", upper);
        let fore = matTranslate(upper, 0, -SIZE.upperArm, 0);
        fore = matRotateZ(fore, -sign * p["arm" + name + "In"]);
        fore = matRotateX(fore, -p["arm" + name + "Elbow"]);
        drawPart("foreArm", fore);
      });

      // ---- 腿 ----
      [["L", -1], ["R", 1]].forEach(function (side) {
        const name = side[0], sign = side[1];
        const bend = p["leg" + name + "Bend"], lift = p["leg" + name + "Lift"];
        let thigh = matTranslate(root, sign * 0.2, BODY.legLength, 0);
        thigh = matRotateZ(thigh, sign * p["leg" + name + "Spread"]);
        thigh = matRotateX(thigh, -(bend + lift));
        drawPart("thigh", thigh);
        let shin = matTranslate(thigh, 0, -SIZE.thigh, 0);
        shin = matRotateX(shin, bend * 2 + lift * 1.2);
        drawPart("shin", shin);
      });

      frameId = requestAnimationFrame(draw);
    }

    return {
      // skin 由 Cutout.makeSkin() 產生：{ canvas, cloth, skin }
      setSkin: function (skin) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skin.canvas);
        gl.uniform3fv(uniform.uCloth, skin.cloth);
        gl.uniform3fv(uniform.uSkin, skin.skin);
      },
      play: function (newMode) {
        mode = newMode;
        cancelAnimationFrame(frameId);
        startTime = performance.now();
        kickTime = -10;
        frameId = requestAnimationFrame(draw);
      },
      stop: function () {
        cancelAnimationFrame(frameId);
      },
      kick: function () {
        kickTime = (performance.now() - startTime) / 1000;
      }
    };
  }

  return { create: create, LOOK: LOOK, BODY: BODY, DANCE_MOVES: DANCE_MOVES };
})();
