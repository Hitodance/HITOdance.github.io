/* =========================================================
   hall-stage.js — 3D「台式復古舞廳」（3.0 選「復古舞廳」時的 5.0 對戰、6.0 結算背景）

   跟 Blender 的 build_dancehall.py 同一套尺寸和設計，直接在網頁裡建出來：
     會反光的拼花木地板、三面黑牆（相機後面那面不做）、後牆上的霓虹燈招牌、天花板掛滿彩色小燈泡、
     8 根白色大柱子、3 顆會轉的銀色 disco 球（亮片會閃）、
     disco 球反射出來、跟著球一起轉的紫藍粉光點、紫藍粉色的聚光燈和光束

   float-stage.js 會呼叫 buildHall()，鏡頭、小人、結算頁的暗場和 spotlight 都共用那邊的程式。
   想調整的東西都在最上面的 HALL。座標跟 Blender 一樣：x 左右、y 前後（負的 = 入口）、z 高度。
   ========================================================= */

import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

export const HALL = {
  room: { w: 20, d: 28, h: 4.8 },          // 舞廳寬、深、高（公尺）
  textures: {
    floor: "assets/stage/hall/parquet.png",          // 拼花木地板（一張 = 4 m × 4 m）
  },
  pillars: { r: 0.6, x: 7.2, ys: [-10, -3.5, 3.5, 10], color: "#f4f1ec" },   // 柱子半徑、離中線多遠、前後位置、顏色

  discoBalls: [            // [x, y, 高度, 半徑]
    [0, 0, 3.55, 0.75],
    [0, -8.5, 3.85, 0.45],
    [0, 8.5, 3.85, 0.45],
  ],
  discoSpeed: 0.35,        // disco 球轉多快
  discoSpots: 420,         // disco 球反射出來的光點數量（跟著球一起轉）
  sparkles: 70,            // 大 disco 球上閃閃的亮片數量（小球自動少一點）

  // 顏色（紫、藍、粉）
  tone: {
    purple: "#6b00ff",
    blue: "#0026ff",
    pink: "#ff008c",
    magenta: "#ff00d9",
    cyan: "#008cff",
  },
  glow: 1.0,               // 燈泡、光點、霓虹燈條一起調亮／調暗
  lightPower: 1.0,         // 彩色聚光燈一起調亮／調暗
  floorReflection: 0.15,   // 地板倒影多明顯（0 = 沒有，0.6 = 很像鏡子）

  // 後牆上的霓虹燈招牌（要打去練舞室打）
  sign: {
    on: true,
    image: "assets/stage/hall/sign.png",       // 招牌本體
    glow: "assets/stage/hall/sign_glow.png",   // 招牌後面那一圈光暈
    width: 11,            // 招牌多寬（公尺，後牆寬 20）
    z: 2.3  ,                // 招牌中心的高度
    brightness: 1.9,       // 招牌多亮（超過 1 才會有光暈，2.5 很刺眼）
    halo: 2,             // 牆上那圈光暈多亮（0 = 不要）
    flicker: true,         // 霓虹燈偶爾閃一下
  },

  // 3D 小人站的位置（舞池中間，地板高度 0）
  dancer: { x: 1.6, y: -2.0, height: 1.9, lift: 0.1 },   // lift：整個人往上抬多少（覺得陷進地板就調大）

  // 對戰頁運鏡（跟 float-stage.js 的 camera 一樣寫法）
  camera: {
    fov: 52,               // 視角（Blender 那台 20mm 廣角相機差不多是 52）
    secondsPerShot: 5,
    shake: 0,
    shots: [
      { pos: [0, -12.5, 1.6], look: [0, 4.0, 2.3] },    // 入口看進去（跟 Blender 相機一樣）
      { pos: [0, -7.5, 1.2],  look: [0, 0.0, 1.4] },    // 往舞池推近
      { pos: [0, -10.5, 2.4], look: [0, 2.0, 1.6] },    // 退回入口、高一點
    ],
  },

  // 結算頁攝影機
  resultCamera: {
    fov: 52,
    from: { pos: [0, -5.5, 1.4], look: [0, -1.5, 1.2] },   // 一開始的近景
    pullSeconds: 4,
    closeUp: {
      seconds: 3,
      moveSeconds: 1.2,
      distance: 3.0,
      height: 1.5,
      lookHeight: 1.0,     // 地板是 0，小人頭大約 1.8
      side: 0.4,
    },
    backSeconds: 1.8,
    pos: [0, -12.5, 1.8],  // 最後停在入口看整個舞廳
    look: [0, 3.0, 2.0],
  },

  // 從天花板打下來的光束（跟電子花車同一套；燈頭在天花板）
  beams: {
    on: true,
    lights: [
      { head: [-6.0, -9.0, 4.6], colors: ["#6b00ff", "#ff008c"] },
      { head: [-3.0, -6.0, 4.6], colors: ["#0026ff", "#8a2cff"] },
      { head: [0.0, -8.0, 4.6],  colors: ["#ff008c", "#6b00ff"] },
      { head: [3.0, -6.0, 4.6],  colors: ["#0026ff", "#ff00d9"] },
      { head: [6.0, -9.0, 4.6],  colors: ["#8a2cff", "#008cff"] },
    ],
    radius: 0.8,
    opacity: 0.16,
    speed: 0.35,
    suspenseSpeed: 1.2,
    area: { x: 4.5, yc: -2.0, ya: 4.0, clampX: 8 },   // 光束在地上掃的範圍
  },
  spotHeadZ: 4.5,          // 結算頁 spotlight 的燈頭高度（天花板下面一點）
  spotStrength: 0.45,      // 結算頁 spotlight 的亮度（1 = 跟電子花車一樣亮；越小越暗）
};

function V(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// disco 光點：圓形、中間亮、邊緣淡出（每個光點的顏色放在 instanceColor）
function spotMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uMaster: { value: 1 }, uGain: { value: 2.2 * HALL.glow } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uMaster;
      uniform float uGain;
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.15, 1.0, d);
        gl_FragColor = vec4(vCol * uGain * uMaster, a);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// disco 球的亮片：永遠面向鏡頭的小星芒，一閃一閃
function sparkleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMaster: { value: 1 } },
    vertexShader: `
      attribute float aPhase;
      uniform float uTime;
      varying vec2 vUv;
      varying float vA;
      void main() {
        vUv = uv;
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float tw = pow(max(0.0, sin(uTime * (2.0 + aPhase * 2.0) + aPhase * 6.2831)), 6.0);
        vA = tw;
        c.xy += position.xy * (0.06 + 0.22 * tw);
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: `
      uniform float uMaster;
      varying vec2 vUv;
      varying float vA;
      void main() {
        vec2 q = abs(vUv - 0.5) * 2.0;
        float core = pow(max(0.0, 1.0 - length(q)), 3.0) * 1.6;
        float cross = max(0.0, 1.0 - q.x * 10.0) * (1.0 - q.y) + max(0.0, 1.0 - q.y * 10.0) * (1.0 - q.x);
        float a = (core + cross * 0.9) * vA;
        gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * 3.0 * max(uMaster, 0.35), a);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/* =========================================================
   建立舞廳。ctx = { renderer, renderScale }
   回傳 world：float-stage.js 用它切換舞台、調暗場、每一格更新
   ========================================================= */
export function buildHall(ctx) {
  const H = HALL;
  const W = H.room.w, D = H.room.d, RH = H.room.h;
  const HW = W / 2, HD = D / 2;
  const tone = {};
  Object.keys(H.tone).forEach((k) => { tone[k] = new THREE.Color(H.tone[k]); });

  const temp = new THREE.Scene();          // 先在這裡建好，拍一張環境貼圖給 disco 球、地板反射用，再交給主場景
  const group = new THREE.Group();
  temp.add(group);
  const loader = new THREE.TextureLoader();
  const glowMats = [];                     // 會發光的材質：[{ mat, base }]，暗場時一起變暗
  const lights = [];                       // [{ light, base }]
  const envMats = [];                      // 要反射環境的材質

  function addGlow(mat) {
    glowMats.push({ mat: mat, base: mat.color.clone() });
    return mat;
  }
  function box(size, loc, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[2], size[1]), mat);
    m.position.copy(V(loc[0], loc[1], loc[2]));
    group.add(m);
    return m;
  }

  // ---------- 1. 地板：拼花木地板 + 倒影 ----------
  const floorTex = loader.load(H.textures.floor);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(W / 4, D / 4);
  floorTex.anisotropy = 8;
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex, roughness: 0.25, metalness: 0.0,
    transparent: H.floorReflection > 0, opacity: 1 - H.floorReflection,
  });
  envMats.push(floorMat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -1;
  group.add(floor);

  let reflector = null;
  if (H.floorReflection > 0) {
    const s = ctx.renderScale * 0.6;
    reflector = new Reflector(new THREE.PlaneGeometry(W, D), {
      textureWidth: Math.round(1920 * s), textureHeight: Math.round(1080 * s), color: 0x9a90a8,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.003;
    group.add(reflector);
  }

  // ---------- 2. 天花板 + 管線 + 彩色小燈泡 ----------
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ color: 0x050308, roughness: 0.85 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = RH;
  group.add(ceil);

  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.5, metalness: 0.7 });
  const pipeZ = RH - 0.35;
  const bulbPos = [];
  for (let y = -HD + 1.5; y < HD - 1.0; y += 1.5) {
    box([W - 2, 0.06, 0.06], [0, y, pipeZ], pipeMat);
    for (let x = -HW + 1.5; x < HW - 1.0; x += 0.75) bulbPos.push([x, y, pipeZ - 0.08]);
  }
  [-HW + 1, 0, HW - 1].forEach((x) => box([0.08, D - 2, 0.08], [x, 0, pipeZ + 0.05], pipeMat));

  const bulbCols = ["#ff0500", "#00ff1a", "#0020ff", "#ffa600", "#ff008c", "#6b00ff"].map((c) => new THREE.Color(c));
  const bulbMat = addGlow(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 1), bulbMat, bulbPos.length);
  const m4 = new THREE.Matrix4();
  bulbPos.forEach((p, i) => {
    m4.makeTranslation(V(p[0], p[1], p[2]));
    bulbs.setMatrixAt(i, m4);
    bulbs.setColorAt(i, bulbCols[i % bulbCols.length].clone().multiplyScalar(2.6 * H.glow)
      .lerp(bulbCols[Math.floor(Math.random() * bulbCols.length)].clone().multiplyScalar(2.6 * H.glow), 0.85));
  });
  group.add(bulbs);

  // ---------- 3. 三面黑牆（左、右、後）、踢腳板、霓虹燈條 ----------
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 0.5 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x030205, roughness: 0.6 });   // 黑牆
  const neonPink = addGlow(new THREE.MeshBasicMaterial({ color: tone.pink.clone().multiplyScalar(2.4 * H.glow) }));
  const neonBlue = addGlow(new THREE.MeshBasicMaterial({ color: tone.blue.clone().multiplyScalar(2.4 * H.glow) }));
  const BASE_H = 0.35, WALL_TOP = RH - 0.5, wallH = WALL_TOP - BASE_H;   // 踢腳板高度、黑牆上緣（粉色霓虹燈條在這裡）

  const walls = [   // 中心、寬度、沿牆方向、往舞池的方向（Blender 座標）
    { c: [0, HD], w: W, along: [1, 0], inward: [0, -1] },
    { c: [-HW, 0], w: D, along: [0, 1], inward: [1, 0] },
    { c: [HW, 0], w: D, along: [0, 1], inward: [-1, 0] },
  ];
  walls.forEach((wl) => {
    const normal = V(wl.inward[0], wl.inward[1], 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const plane = (h, z, mat) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wl.w, h), mat);
      m.position.copy(V(wl.c[0], wl.c[1], z));
      m.quaternion.copy(quat);
      group.add(m);
    };
    plane(wallH, BASE_H + wallH / 2, wallMat);                        // 黑牆
    plane(RH - WALL_TOP, WALL_TOP + (RH - WALL_TOP) / 2, darkMat);
    plane(BASE_H, BASE_H / 2, darkMat);
    const ix = wl.inward[0], iy = wl.inward[1];
    const longX = wl.along[0] ? wl.w : 0.05, longY = wl.along[1] ? wl.w : 0.05;
    box([longX, longY, 0.04], [wl.c[0] + ix * 0.06, wl.c[1] + iy * 0.06, WALL_TOP + 0.12], neonPink);
    box([longX, longY, 0.03], [wl.c[0] + ix * 0.06, wl.c[1] + iy * 0.06, BASE_H + 0.03], neonBlue);
  });

  // ---------- 3b. 後牆上的霓虹燈招牌 ----------
  let signMat = null, haloMat = null;
  if (H.sign.on) {
    const S = H.sign;
    const signTex = loader.load(S.image, (t) => {
      // 圖載好之後才知道比例：照圖的長寬比設定高度
      const h = S.width * t.image.height / t.image.width;
      signMesh.scale.set(S.width, h, 1);
      haloMesh.scale.set(S.width * 1.16, h * 1.16 + S.width * 0.16, 1);
    });
    signTex.colorSpace = THREE.SRGBColorSpace;
    signTex.anisotropy = 8;
    signMat = new THREE.MeshBasicMaterial({
      map: signTex, transparent: true, alphaTest: 0.02, depthWrite: false,
      color: new THREE.Color(S.brightness, S.brightness, S.brightness),
    });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), signMat);
    signMesh.position.copy(V(0, HD - 0.05, S.z));
    signMesh.rotation.y = 0;             // 面向舞池（後牆在最裡面，招牌朝向入口）
    signMesh.scale.set(S.width, S.width * 0.26, 1);
    signMesh.renderOrder = 1;
    group.add(signMesh);

    const glowTex = loader.load(S.glow);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    haloMat = new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      color: new THREE.Color(S.halo, S.halo, S.halo),
    });
    const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
    haloMesh.position.copy(V(0, HD - 0.06, S.z));
    haloMesh.scale.set(S.width * 1.16, S.width * 0.4, 1);
    haloMesh.renderOrder = 0;
    group.add(haloMesh);

    // 招牌也照亮一點點地板和柱子（粉紅色）
    const signLight = new THREE.PointLight(0xff3fb0, 18 * S.brightness, 14, 1.5);
    signLight.position.copy(V(0, HD - 1.2, S.z));
    group.add(signLight);
    lights.push({ light: signLight, base: signLight.intensity });
  }

  // ---------- 4. 大柱子：純白 ----------
  const P = H.pillars;
  const whiteMat = new THREE.MeshStandardMaterial({ color: P.color, roughness: 0.3, envMapIntensity: 0.6 });
  envMats.push(whiteMat);
  [-1, 1].forEach((sx) => {
    P.ys.forEach((py) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r, RH, 48), whiteMat);
      m.position.copy(V(sx * P.x, py, RH / 2));
      group.add(m);
    });
  });

  // ---------- 5. disco 球（銀色鏡片 + 會閃的亮片，會轉） ----------
  const discoMat = new THREE.MeshStandardMaterial({
    color: 0xc8ccd8, metalness: 1.0, roughness: 0.14, flatShading: true,
    emissive: 0x8088a0, emissiveIntensity: 0.45, envMapIntensity: 1.6,
  });
  envMats.push(discoMat);
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1, roughness: 0.5 });
  const sparkleMat = sparkleMaterial();
  const balls = [];
  H.discoBalls.forEach((b, bi) => {
    const [bx, by, bz, br] = b;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(br, 64, 32), discoMat);
    ball.position.copy(V(bx, by, bz));
    group.add(ball);
    const wireLen = RH - (bz + br);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, wireLen, 6), wireMat);
    wire.position.copy(V(bx, by, bz + br + wireLen / 2));
    group.add(wire);

    // 亮片：黏在球面上，跟著球一起轉
    const count = Math.round(H.sparkles * (br / H.discoBalls[0][3]) ** 2);
    const geo = new THREE.PlaneGeometry(1, 1);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) phase[i] = Math.random();
    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    const sp = new THREE.InstancedMesh(geo, sparkleMat, count);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      m4.makeTranslation(dir.multiplyScalar(br + 0.012));
      sp.setMatrixAt(i, m4);
    }
    sp.renderOrder = 3;
    ball.add(sp);
    balls.push(ball);
  });

  // ---------- 6. disco 球反射出來的光點（跟著大球一起轉，打在地板、牆、天花板上） ----------
  const spotPalette = [tone.purple, tone.purple, tone.blue, tone.blue, tone.pink, tone.pink, tone.magenta, tone.cyan];
  const spotMat = spotMaterial();
  const spotCount = H.discoSpots;
  const spotMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), spotMat, spotCount);
  const spotDirs = [], spotSizes = [];
  for (let i = 0; i < spotCount; i++) {
    // 大部分往下、往旁邊（打在地板和牆上），少部分往上（天花板）
    const d = new THREE.Vector3(rand(-1, 1), rand(-1, 0.45), rand(-1, 1)).normalize();
    spotDirs.push(d);
    spotSizes.push(rand(0.07, 0.15));
    spotMesh.setColorAt(i, spotPalette[i % spotPalette.length]);
  }
  spotMesh.renderOrder = 1;
  spotMesh.frustumCulled = false;
  group.add(spotMesh);
  const mainBall = V(H.discoBalls[0][0], H.discoBalls[0][1], H.discoBalls[0][2]);

  const tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpD = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
  const NORMALS = {
    floor: new THREE.Vector3(0, 1, 0), ceil: new THREE.Vector3(0, -1, 0),
    left: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(-1, 0, 0), back: new THREE.Vector3(0, 0, 1),
  };
  function updateSpots(angle) {
    for (let i = 0; i < spotCount; i++) {
      tmpD.copy(spotDirs[i]).applyAxisAngle(UP, angle);
      // 從大球中心往這個方向射出去，看先打到哪一面
      let best = Infinity, normal = null;
      const test = (t, n) => { if (t > 0.05 && t < best) { best = t; normal = n; } };
      if (tmpD.y < 0) test((0 - mainBall.y) / tmpD.y, NORMALS.floor);
      if (tmpD.y > 0) test((RH - 0.01 - mainBall.y) / tmpD.y, NORMALS.ceil);
      if (tmpD.x < 0) test((-HW + 0.06 - mainBall.x) / tmpD.x, NORMALS.left);
      if (tmpD.x > 0) test((HW - 0.06 - mainBall.x) / tmpD.x, NORMALS.right);
      if (tmpD.z < 0) test((-HD + 0.06 - mainBall.z) / tmpD.z, NORMALS.back);
      if (tmpD.z > 0) test((HD - mainBall.z) / tmpD.z, null);       // 前面沒有牆（相機那邊）
      if (!normal) {
        m4.makeScale(0, 0, 0);
      } else {
        tmpP.copy(mainBall).addScaledVector(tmpD, best).addScaledVector(normal, 0.012);
        tmpQ.setFromUnitVectors(Z, normal);
        const s = spotSizes[i] * (0.6 + best / 9);                   // 越遠的光點越大
        tmpS.set(s, s, s);
        m4.compose(tmpP, tmpQ, tmpS);
      }
      spotMesh.setMatrixAt(i, m4);
    }
    spotMesh.instanceMatrix.needsUpdate = true;
  }
  updateSpots(0);

  // ---------- 7. 燈光：紫藍粉 ----------
  const hemi = new THREE.HemisphereLight(0x5a2cff, 0x14001e, 0.7);
  group.add(hemi);
  lights.push({ light: hemi, base: hemi.intensity });
  const spotCols = [tone.purple, tone.blue, tone.pink, tone.magenta, tone.cyan, tone.purple];
  let k = 0;
  [-11, -4, 4].forEach((sy) => {
    [-1, 1].forEach((sx) => {
      const L = new THREE.SpotLight(spotCols[k++ % spotCols.length], 160 * H.lightPower, 0, 0.55, 0.8, 1.6);
      L.position.copy(V(sx * (HW - 2.5), sy, RH - 0.4));
      L.target.position.copy(V(sx * (HW - 2.5) * 0.15, sy * 0.4, 0));
      group.add(L); group.add(L.target);
      lights.push({ light: L, base: L.intensity });
    });
  });
  const ballLight = new THREE.PointLight(0xffffff, 6, 6, 1.5);     // 讓 disco 球有亮光可以反射
  ballLight.position.copy(V(0.8, -1.8, 3.9));
  group.add(ballLight);
  lights.push({ light: ballLight, base: ballLight.intensity });
  const front = new THREE.PointLight(tone.pink, 25 * H.lightPower, 18, 1.5);
  front.position.copy(V(0, -HD + 2, RH - 0.4));
  group.add(front);
  lights.push({ light: front, base: front.intensity });

  // ---------- 8. 環境貼圖：讓 disco 球、地板、柱子反射出舞廳裡的燈 ----------
  try {
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(0.1, 60, cubeRT);
    cubeCam.position.copy(V(0, -2, 1.8));
    temp.add(cubeCam);
    if (reflector) reflector.visible = false;
    temp.background = new THREE.Color(0x07020f);
    cubeCam.update(ctx.renderer, temp);
    if (reflector) reflector.visible = true;
    const pmrem = new THREE.PMREMGenerator(ctx.renderer);
    const env = pmrem.fromCubemap(cubeRT.texture).texture;
    envMats.forEach((m) => { m.envMap = env; m.needsUpdate = true; });
    temp.remove(cubeCam);
  } catch (e) {
    console.warn("舞廳環境貼圖略過", e);
  }

  let angle = 0;
  let signMaster = 1;
  return {
    group: group,
    deckTop: 0,
    background: new THREE.Color(0x07020f),
    fog: new THREE.Fog(0x0a0318, 20, 48),
    lights: lights,
    beamCfg: H.beams,
    clipBeams: true,           // 光束在地板截斷（舞廳裡光束比較短）
    spotHeadZ: H.spotHeadZ,
    spotStrength: H.spotStrength,
    dancerLift: H.dancer.lift || 0,
    // 暗場：發光的東西、燈光一起變暗
    applyMaster: function (m) {
      glowMats.forEach((g) => g.mat.color.copy(g.base).multiplyScalar(m));
      spotMat.uniforms.uMaster.value = m;
      sparkleMat.uniforms.uMaster.value = m;
      discoMat.emissiveIntensity = 0.45 * Math.max(m, 0.3);
      signMaster = m;
    },
    // 每一格：disco 球轉、光點跟著跑、亮片閃
    update: function (dt, now) {
      angle += dt * H.discoSpeed;
      balls.forEach((b) => { b.rotation.y = angle; });
      updateSpots(angle);
      sparkleMat.uniforms.uTime.value = now;
      if (signMat) {
        // 霓虹燈：大部分時間穩定，偶爾很快地暗一下再亮回來
        let f = 1;
        if (H.sign.flicker) {
          const k = Math.sin(now * 0.7) * Math.sin(now * 2.3 + 1.3) * Math.sin(now * 0.31 + 4.1);
          if (k > 0.82) f = 0.35 + 0.65 * Math.abs(Math.sin(now * 40));
        }
        const b = H.sign.brightness * Math.max(0.25, signMaster) * f;
        signMat.color.setScalar(b);
        haloMat.color.setScalar(H.sign.halo * signMaster * f);
      }
    },
  };
}
