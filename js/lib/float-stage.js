/* =========================================================
   float-stage.js — 5.0 對戰的 3D 電子花車舞台（three.js）

   花車模型是你在 Blender 做好、匯出的 assets/stage/float.glb。
   想改花車造型：在 Blender 改好 → 檔案 → 匯出 → glTF 2.0（.glb）
   → 覆蓋 assets/stage/float.glb 就好，這支程式不用動。

   這支程式負責：
     1. 一打開網頁就先在背景下載模型（檔案比較大，等玩家玩到 5.0 通常已經載好）
     2. 讓 LED 發光、圖稿看板不被光暈糊掉、兩支直立燈管變彩虹（Blender 的彩虹材質匯不出來，這裡補上）
     3. 把兩個 3D 小人（lowpoly.js 畫的）放到舞台上跳舞
     4. 攝影機照 CONFIG.camera.shots 的順序一路飛上舞台再飛回來

   battle.js / result.js 這樣用：
     FloatStage.start({
       host: 畫面的 <section>,           // 3D 舞台要畫在哪一頁（對戰頁、結算頁共用同一個舞台）
       camera: "tour" 或 "fixed",         // tour = 照 shots 運鏡（對戰）；fixed = 固定正面（結算）
       dancers: { p1: canvas, p2: canvas }, viewers: { p1, p2 },
     })  // 回傳 Promise
     FloatStage.stop();

   想調整的東西都在最上面的 CONFIG。
   座標寫法跟 Blender 一樣：x 左右、y 前後（負的 = 靠近觀眾）、z 高度，單位公尺。
   ========================================================= */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ---------- 可以調整的設定 ----------
const CONFIG = {
  model: "assets/stage/float.glb",   // Blender 匯出的花車

  renderScale: 0.75,        // 算圖解析度（1 = 1920×1080；電腦跑不動就調小，例如 0.5）
  bloom: { strength: 0.5, radius: 0.8, threshold: 1.0 },   // LED 光暈（不會閃，固定亮）
  ledGlow: 0.2,            // Blender 的 LED 亮度（Emission Strength）換算到網頁的比例：越大越亮
  artBrightness: 0.8,      // 圖稿看板的亮度（不要超過 1，不然圖會被光暈糊掉）
  rainbowTubes: true,       // 兩支「直立燈管」做成彩虹燈

  // LED 一閃一閃（燈泡、霓虹燈條、樓梯燈條、彩虹燈管都會）
  blink: {
    on: true,               // false = 不閃，一直亮著
    style: "twinkle",       // "twinkle" = 每顆燈泡各自亂閃（像星星）；"chase" = 跑馬燈，一波一波往旁邊跑
    speed: 3.0,             // 閃的速度（越大越快）
    dim: 0.15,              // 暗下來的時候剩多少亮度（0 = 全暗，1 = 不會變暗）
  },

  // 舞台燈光：從上面打下來的彩色光束，會左右掃（對戰頁、結算頁都有）
  beams: {
    on: true,
    // 每一盞燈：燈頭在哪（Blender 座標，z 是高度）、兩個顏色（光束左右兩邊的漸層）
    lights: [
      { head: [-4.6, -2.2, 11.0], colors: ["#3fd8c8", "#8ee05a"] },
      { head: [-2.4, -1.2, 11.8], colors: ["#ff3fd2", "#ff8a3d"] },
      { head: [0.0, -1.8, 12.2],  colors: ["#ff3fd2", "#ff8a3d"] },
      { head: [2.4, -1.2, 11.8],  colors: ["#3fd8c8", "#8ee05a"] },
      { head: [4.6, -2.2, 11.0],  colors: ["#ff3fd2", "#ff8a3d"] },
    ],
    radius: 1.1,            // 光束打到地上有多寬
    opacity: 0.22,          // 光束多亮（0.1 很淡，0.4 很濃）
    softness: 0.8,          // 光束邊緣多模糊（0 = 邊界很清楚，1 = 很朦朧）
    speed: 0.35,            // 平常掃動的速度
    suspenseSpeed: 1.2,     // 結算頁公布前（懸疑感）掃動的速度
  },

  // 結算頁：公布前舞台是暗的，公布後依序打 spotlight 給贏家、輸家，最後全部亮起來
  mood: {
    dark: 0.1,              // 暗下來的時候 LED、看板、舞台剩多少亮度（0 = 全黑）
    fadeSeconds: 1.2,       // 變亮／變暗要幾秒
    spotColor: "#fff4dc",   // spotlight 的顏色
    spotOpacity: 0.3,       // spotlight 光束多亮
  },

  // 3D 小人站的位置
  dancer: {
    x: 2.2,                 // 離舞台中線多遠（P1 在左、P2 在右）
    y: -1.2,                // 前後（負的 = 往舞台前緣；背板在 1.0、舞台前緣在 -3.7）
    height: 1.9,            // 小人多高（公尺）
  },

  // 攝影機運鏡：照順序一個一個鏡頭飛過去，最後一個會接回第一個（一直循環）
  // pos = 攝影機在哪、look = 看向哪（Blender 座標）
  // 參考：舞台面高 1.3、舞台前緣 y = -3.7、下層背板在 y = 1.0、大看板中心大約 z = 5.9
  camera: {
    fov: 36,                // 視角（越小越像長鏡頭）
    secondsPerShot: 5,      // 每個鏡頭之間飛幾秒
    shake: 0,               // 手持晃動（0 = 很穩）
    shots: [
      { pos: [0, -13.0, 3.8],   look: [0, 0.0, 4.0] },   // 正面全景
      { pos: [0, -7.5, 2.4],    look: [0, 0.5, 2.7] },   // 往前推近
      { pos: [0, -13.0, 3.8],   look: [0, 0.0, 4.0] },   // 正面全景
    ],
  },

  // 6.0 結算頁的攝影機：固定不動，正面看得到整台花車
  resultCamera: {
    fov: 36,
    // 一進結算頁先從這個近景開始，再慢慢拉遠到下面的 pos / look
    from: { pos: [0, -5.5, 2.5], look: [0, 0.0, 2.8] },
    pullSeconds: 4,         // 拉遠要幾秒
    // 公布獲勝者之後：鏡頭先到贏家、再到輸家、最後回到下面的 pos / look
    closeUp: {
      seconds: 3,           // 每個人拍幾秒（包含飛過去的時間）
      moveSeconds: 1.2,     // 飛過去要幾秒
      distance: 4.2,        // 攝影機離小人多遠（越小越近）
      height: 2.4,          // 攝影機高度
      lookHeight: 2.2,      // 看小人的哪個高度（舞台面 1.3，小人頭大約 3.1）
      side: 0.5,            // 攝影機往舞台中間偏多少（0 = 正對小人，1 = 在舞台正中間斜斜拍過去）
    },
    backSeconds: 1.8,       // 最後回到全景要飛幾秒
    pos: [0, -16.5, 4.4],   // 最後停在這裡（-14 比較近、-19 比較遠）
    look: [0, 0.0, 4.3],
  },
};

// Blender 座標 (x, y, z) → three.js 座標 (x, z, -y)（跟 glb 匯出的換算一樣）
function V(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

// ============================================================
//  一打開網頁就先下載模型
// ============================================================
const modelPromise = new GLTFLoader().loadAsync(CONFIG.model);
modelPromise.catch(function (error) {
  console.warn("電子花車模型載入失敗：" + CONFIG.model, error);
});

// ============================================================
//  整理模型的材質
// ============================================================
// 彩虹燈：沿著燈管高度，從下到上 紅橙黃綠藍靛紫
const RAINBOW = [[1, 0, 0], [1, 0.35, 0], [1, 0.9, 0], [0, 1, 0.1], [0, 0.6, 1], [0.15, 0.1, 1], [0.7, 0, 1]];
function rainbowAt(t) {
  t = Math.min(0.9999, Math.max(0, t)) * (RAINBOW.length - 1);
  const i = Math.floor(t), f = t - i;
  const a = RAINBOW[i], b = RAINBOW[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function makeRainbow(mesh, glow) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = rainbowAt((pos.getY(i) - box.min.y) / (box.max.y - box.min.y || 1));
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  mesh.material = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(glow, glow, glow) });
}

// ---------- LED 一閃一閃 ----------
// 所有會發光的材質共用這組數值，每一格更新 uTime
const blinkUniforms = {
  uTime: { value: 0 },
  uSpeed: { value: CONFIG.blink.speed },
  uDim: { value: CONFIG.blink.on ? CONFIG.blink.dim : 1 },
  uChase: { value: CONFIG.blink.style === "chase" ? 1 : 0 },
  uMaster: { value: 1 },   // 整體亮度（結算頁暗場用）
};

// 讓材質會閃：亮度 = 在 dim 和 1 之間來回
function addBlink(material) {
  material.onBeforeCompile = function (shader) {
    Object.assign(shader.uniforms, blinkUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPhase;\nattribute float aChase;\nvarying float vPhase;\nvarying float vChase;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPhase = aPhase;\nvChase = aChase;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uSpeed;\nuniform float uDim;\nuniform float uChase;\nuniform float uMaster;\nvarying float vPhase;\nvarying float vChase;")
      .replace("#include <color_fragment>", [
        "#include <color_fragment>",
        "float ph = mix(vPhase, vChase, uChase);",
        // twinkle：每顆的速度也稍微不同，才不會整齊劃一
        "float rate = uSpeed * mix(0.7 + 0.6 * fract(vPhase * 7.13), 1.0, uChase);",
        "float wave = 0.5 + 0.5 * sin(uTime * rate - ph * 6.2831853);",
        "diffuseColor.rgb *= mix(uDim, 1.0, smoothstep(0.3, 0.7, wave)) * uMaster;",
      ].join("\n"));
  };
  material.needsUpdate = true;
}

// 幫每個三角形記住「它屬於哪一顆燈泡」：同一顆燈泡的三角形拿到同樣的節奏，整顆一起亮暗
// （Blender 匯出時燈泡的頂點是打散的，所以用幾何算回每顆燈泡的中心：
//   燈泡是正二十面體，三角形中心往內退 0.7947 × 半徑 就是燈泡中心，半徑 = 邊長 ÷ 1.0515）
function addBlinkAttributes(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const idx = g.index;
  const count = pos.count;
  const phase = new Float32Array(count);
  const chase = new Float32Array(count);
  const isDots = mesh.name.indexOf("LED點燈") === 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const center = new THREE.Vector3(), n = new THREE.Vector3(), tmp = new THREE.Vector3();
  const tris = (idx ? idx.count : count) / 3;
  // 找「同一顆燈泡」：算出來的中心距離不到 4 公釐就當同一顆（用 1 公分的格子加速找鄰居）
  const grid = new Map();
  function bulbPhase(p) {
    const gx = Math.floor(p.x * 100), gy = Math.floor(p.y * 100), gz = Math.floor(p.z * 100);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get((gx + dx) + "," + (gy + dy) + "," + (gz + dz));
          if (!list) continue;
          for (const bulb of list) {
            if (bulb.p.distanceToSquared(p) < 0.004 * 0.004) return bulb.phase;
          }
        }
      }
    }
    const bulb = { p: p.clone(), phase: Math.random() };
    const key = gx + "," + gy + "," + gz;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(bulb);
    return bulb.phase;
  }
  for (let t = 0; t < tris; t++) {
    const ia = idx ? idx.getX(t * 3) : t * 3;
    const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    center.copy(a).add(b).add(c).divideScalar(3);
    if (isDots) {
      if (nor) {
        n.fromBufferAttribute(nor, ia).add(tmp.fromBufferAttribute(nor, ib)).add(tmp.fromBufferAttribute(nor, ic)).normalize();
      } else {
        n.subVectors(b, a).cross(tmp.subVectors(c, a)).normalize();
      }
      const r = a.distanceTo(b) / 1.0515;
      center.addScaledVector(n, -0.7947 * r);
    }
    // 燈泡：每顆一個亂數節奏；燈條、燈管：照位置，一段一段流動
    const ch = (center.x * 1.6 + center.y * 1.1);
    const ph = isDots ? bulbPhase(center) : ch - Math.floor(ch);
    for (const i of [ia, ib, ic]) {
      phase[i] = ph;
      chase[i] = ch;
    }
  }
  g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  g.setAttribute("aChase", new THREE.BufferAttribute(chase, 1));
}

const artMaterials = [];   // 圖稿看板的材質（暗場時一起變暗）

function prepareModel(root) {
  const converted = new Map();   // 同一個材質只換一次
  root.traverse(function (obj) {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = mats.map(function (m) {
      if (converted.has(m)) return converted.get(m);
      let out = m;
      const name = m.name || "";
      if (name.indexOf("Art_") === 0) {
        // 圖稿看板：只顯示圖，不受燈光影響，也不要太亮
        out = new THREE.MeshBasicMaterial({
          map: m.map || m.emissiveMap,
          color: new THREE.Color(CONFIG.artBrightness, CONFIG.artBrightness, CONFIG.artBrightness),
        });
        artMaterials.push(out);
      } else if (m.emissive && m.emissiveIntensity > 0 && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) {
        // 會發光的東西（LED、燈條、探照燈）：直接用發光的顏色畫，亮度照 Blender 裡設定的比例
        const glow = 1 + CONFIG.ledGlow * m.emissiveIntensity;
        out = new THREE.MeshBasicMaterial({ color: m.emissive.clone().multiplyScalar(glow) });
        out.userData.glow = glow;
        addBlink(out);
      }
      out.name = name;
      converted.set(m, out);
      return out;
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];

    if (CONFIG.rainbowTubes && obj.name.indexOf("直立燈管") === 0) {
      makeRainbow(obj, 1 + CONFIG.ledGlow * 20);
      addBlink(obj.material);
    }

    // 會發光的東西都記住每個三角形的閃爍節奏
    const glowing = (Array.isArray(obj.material) ? obj.material : [obj.material])
      .some((m) => m.userData && m.userData.glow) || obj.name.indexOf("直立燈管") === 0;
    if (glowing) addBlinkAttributes(obj);
  });
}

// ============================================================
//  主程式
// ============================================================
let renderer, composer, scene, camera;
let deckTop = 1.3;
let running = false;
let frameId = 0;
let startTime = 0;
let readyPromise = null;
let session = 0;      // 每次 start / stop 換一個號碼，避免離開對戰頁後模型才載好又自己開始跑
const dancers = {};   // p1 / p2：{ mesh, texture, viewer }

function init(gltf) {
  const canvas = document.getElementById("battle-float");
  const w = Math.round(1920 * CONFIG.renderScale);
  const h = Math.round(1080 * CONFIG.renderScale);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060b22);
  scene.fog = new THREE.Fog(0x060b22, 24, 60);
  camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, w / h, 0.1, 200);

  // 燈光：只照亮鋼架、地板、音箱（LED 和圖稿自己會亮）
  const hemi = new THREE.HemisphereLight(0x8090ff, 0x200820, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0, 8, 14);
  scene.add(key);
  const pink = new THREE.PointLight(0xff80e6, 40, 14);
  pink.position.copy(V(0, -1.5, 3.8));
  scene.add(pink);
  stageLights = [hemi, key, pink].map((l) => ({ light: l, base: l.intensity }));

  // 花車
  const model = gltf.scene;
  prepareModel(model);
  scene.add(model);

  // 舞台面高度：從模型裡的「舞台地板」量出來，你在 Blender 改高度這裡也會跟著變
  const floor = model.getObjectByName("舞台地板");
  if (floor) {
    deckTop = new THREE.Box3().setFromObject(floor).max.y;
  }

  buildBeams();
  buildSpotlights();

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h),
    CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold));
  composer.addPass(new OutputPass());
}

// ============================================================
//  舞台燈光：彩色光束、spotlight、暗場
// ============================================================
let stageLights = [];        // 照亮鋼架地板的燈（暗場時一起變暗）
const beamList = [];         // 彩色光束
const spots = {};            // p1 / p2 的 spotlight
let master = 1, masterTarget = 1;          // 整體亮度（1 = 正常，mood.dark = 暗場）
let beamSpeed = 0, beamSpeedTarget = 0;    // 光束掃動速度（會慢慢變，不會突然跳）
let beamClock = 0;
let lastFrame = 0;
let timedEvents = [];        // [{ t, fn }]：結算頁排好的「幾秒後做什麼」

// 光束的樣子：越往下越亮、左右兩邊是兩個顏色的漸層、邊緣淡出
function beamMaterial(colorA, colorB, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Color(colorA) },
      uB: { value: new THREE.Color(colorB) },
      uOpacity: { value: opacity },
      uSoft: { value: CONFIG.beams.softness },
    },
    vertexShader: `
      varying vec2 vUv;
      varying float vEdge;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vEdge = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uA;
      uniform vec3 uB;
      uniform float uOpacity;
      uniform float uSoft;
      varying vec2 vUv;
      varying float vEdge;
      void main() {
        float side = abs(fract(vUv.x) - 0.5) * 2.0;
        vec3 col = mix(uA, uB, side);
        float along = 1.0 - vUv.y;                       // 0 = 燈頭，1 = 打到地上
        // 邊緣淡出：softness 越大，從中間到邊緣越慢慢變淡，邊界就越模糊
        float edge = pow(smoothstep(0.0, 1.0, vEdge), mix(0.8, 3.0, uSoft));
        // 燈頭附近也慢慢淡入，不會有一個尖尖的硬點
        float head = smoothstep(0.0, mix(0.05, 0.35, uSoft), along);
        float a = uOpacity * (1.0 + uSoft * 0.8) * (0.15 + 0.85 * along) * edge * head;
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// 地上的光圈
function poolMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform vec3 uC;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float soft = 1.0 - smoothstep(0.0, 1.0, d);
        gl_FragColor = vec4(uC, uOpacity * soft * soft);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// 一道光束：燈頭固定，光束和地上的光圈跟著「打到哪」移動
function makeBeam(head, colorA, colorB, radius, opacity) {
  const length = 20;
  const geo = new THREE.ConeGeometry(radius, length, 40, 1, true);
  geo.translate(0, -length / 2, 0);            // 尖端（燈頭）放在原點
  const cone = new THREE.Mesh(geo, beamMaterial(colorA, colorB, opacity));
  cone.position.copy(head);
  cone.frustumCulled = false;
  scene.add(cone);

  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 40), poolMaterial(colorB, opacity * 1.6));
  pool.rotation.x = -Math.PI / 2;
  scene.add(pool);
  return { cone: cone, pool: pool, head: head, length: length, radius: radius, opacity: opacity };
}

const DOWN = new THREE.Vector3(0, -1, 0);
function aimBeam(b, target, strength) {
  const dir = target.clone().sub(b.head);
  const dist = dir.length();
  b.cone.quaternion.setFromUnitVectors(DOWN, dir.normalize());
  b.cone.material.uniforms.uOpacity.value = b.opacity * strength;
  b.cone.visible = strength > 0.001;
  // 光圈：光束在地上的大小（離燈頭越遠越大）
  const r = b.radius * dist / b.length * 1.4;
  b.pool.position.copy(target);
  b.pool.position.y += 0.02;
  b.pool.scale.set(r, r, r);
  b.pool.material.uniforms.uOpacity.value = b.opacity * 1.6 * strength;
  b.pool.visible = b.cone.visible;
}

function buildBeams() {
  const c = CONFIG.beams;
  if (!c.on) return;
  c.lights.forEach(function (l, i) {
    const b = makeBeam(V(l.head[0], l.head[1], l.head[2]), l.colors[0], l.colors[1], c.radius, c.opacity);
    b.index = i;
    b.baseX = l.head[0];
    beamList.push(b);
  });
}

// 每盞燈打在舞台上的位置：幾個不同速度的 sin 疊起來，看起來像亂掃
function beamTarget(b, clock) {
  const i = b.index + 1;
  const x = b.baseX * 0.6 + 3.2 * Math.sin(clock * (0.9 + 0.23 * i) + i * 1.7) + 0.8 * Math.sin(clock * 2.3 + i);
  const y = -1.3 + 1.8 * Math.sin(clock * (0.7 + 0.17 * i) + i * 2.9);
  return V(Math.max(-5, Math.min(5, x)), y, 0).setY(deckTop);
}

// spotlight：白色光束 + 真的聚光燈（照亮地板），從小人頭上正前方打下來
function buildSpotlights() {
  const m = CONFIG.mood;
  ["p1", "p2"].forEach(function (p) {
    const sx = p === "p1" ? -1 : 1;
    const target = V(sx * CONFIG.dancer.x, CONFIG.dancer.y, 0).setY(deckTop);
    const head = V(sx * CONFIG.dancer.x * 0.8, CONFIG.dancer.y - 2.5, 11);
    const b = makeBeam(head, m.spotColor, m.spotColor, 0.95, m.spotOpacity);
    const light = new THREE.SpotLight(m.spotColor, 0, 25, 0.16, 0.6, 1);
    light.position.copy(head);
    light.target.position.copy(target);
    scene.add(light);
    scene.add(light.target);
    spots[p] = { beam: b, light: light, target: target, level: 0, levelTarget: 0 };
  });
}

// mood："normal" = 正常；"suspense" = 舞台暗下來、光束亂掃（結算頁公布前）
function setMood(mood, instant) {
  const suspense = mood === "suspense";
  masterTarget = suspense ? CONFIG.mood.dark : 1;
  beamSpeedTarget = suspense ? CONFIG.beams.suspenseSpeed : CONFIG.beams.speed;
  if (instant) {
    master = masterTarget;
    beamSpeed = beamSpeedTarget;
  }
}

function setSpot(player, on, instant) {
  const sp = spots[player];
  if (!sp) return;
  sp.levelTarget = on ? 1 : 0;
  if (instant) sp.level = sp.levelTarget;
}

function updateLighting(t, dt) {
  // 排好的事件（spotlight、全部亮起來）時間到了就做
  timedEvents = timedEvents.filter(function (ev) {
    if (t >= ev.t) { ev.fn(); return false; }
    return true;
  });

  // 慢慢變亮／變暗
  const rate = Math.min(1, dt / Math.max(0.05, CONFIG.mood.fadeSeconds) * 3);
  master += (masterTarget - master) * rate;
  beamSpeed += (beamSpeedTarget - beamSpeed) * Math.min(1, dt * 1.5);
  beamClock += dt * beamSpeed;

  blinkUniforms.uMaster.value = master;
  artMaterials.forEach((m) => m.color.setScalar(CONFIG.artBrightness * master));
  stageLights.forEach((s) => { s.light.intensity = s.base * Math.max(0.15, master); });

  beamList.forEach((b) => aimBeam(b, beamTarget(b, beamClock), 1));

  ["p1", "p2"].forEach(function (p) {
    const sp = spots[p];
    if (!sp) return;
    sp.level += (sp.levelTarget - sp.level) * Math.min(1, dt * 4);
    aimBeam(sp.beam, sp.target, sp.level);
    sp.light.intensity = 80 * sp.level;
    // 小人：暗場時也跟著暗，被 spotlight 打到就亮起來
    const d = dancers[p];
    if (d) d.mesh.material.color.setScalar(Math.max(master, sp.level));
  });
}

// 把 lowpoly.js 畫小人的 canvas 變成舞台上的「立牌」，永遠轉向鏡頭
function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;      // 保留一格一格的顆粒感
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function attachDancer(player, canvas, viewer) {
  let d = dancers[player];
  if (!d) {
    const texture = canvasTexture(canvas);

    // 小人在 canvas 裡大約佔 1/1.45 的高度，腳底在離下緣 15.6% 的地方（lowpoly.js 的鏡頭決定的）
    const planeH = CONFIG.dancer.height * 1.454;
    const planeW = planeH * canvas.width / canvas.height;
    const geo = new THREE.PlaneGeometry(planeW, planeH);
    geo.translate(0, planeH * (0.5 - 0.156), 0);   // 原點移到腳底
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: texture, alphaTest: 0.5, side: THREE.DoubleSide,
    }));
    const sx = player === "p1" ? -1 : 1;
    mesh.position.copy(V(sx * CONFIG.dancer.x, CONFIG.dancer.y, 0));
    mesh.position.y = deckTop;
    scene.add(mesh);

    // 腳下的影子
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.55, 1);
    shadow.position.copy(mesh.position);
    shadow.position.y = deckTop + 0.01;
    scene.add(shadow);

    d = dancers[player] = { mesh: mesh, texture: texture, canvas: canvas };
  }
  // 對戰頁和結算頁的小人是不同的 canvas：換頁時換成這一頁的小人
  if (d.canvas !== canvas) {
    d.texture.dispose();
    d.texture = canvasTexture(canvas);
    d.mesh.material.map = d.texture;
    d.mesh.material.needsUpdate = true;
    d.canvas = canvas;
  }
  d.viewer = viewer;
}

// ---------- 攝影機 ----------
function smooth(t) {
  return t * t * (3 - 2 * t);
}

let camPath = null, lookPath = null;
let cameraMode = "tour";

// ---------- 結算頁的攝影機 ----------
// 從近景慢慢拉遠：一開始快、最後慢慢停下來
function pullPose(t) {
  const r = CONFIG.resultCamera;
  const end = { pos: V(r.pos[0], r.pos[1], r.pos[2]), look: V(r.look[0], r.look[1], r.look[2]) };
  if (!r.from) return end;
  const k = Math.min(1, t / (r.pullSeconds || 1));
  const e = 1 - Math.pow(1 - k, 3);
  return {
    pos: V(r.from.pos[0], r.from.pos[1], r.from.pos[2]).lerp(end.pos, e),
    look: V(r.from.look[0], r.from.look[1], r.from.look[2]).lerp(end.look, e),
  };
}

// 對著某個小人的特寫位置
function closeUpPose(player) {
  const c = CONFIG.resultCamera.closeUp;
  const dx = (player === "p1" ? -1 : 1) * CONFIG.dancer.x;
  const dy = CONFIG.dancer.y;
  return {
    pos: V(dx * (1 - c.side), dy - c.distance, c.height),
    look: V(dx, dy, c.lookHeight),
  };
}

// 特寫的時間軸：[{ t: 第幾秒, pose }]，兩個點之間平滑飛過去，最後停在最後一個點
let closeUpTimeline = null;
function timelinePose(t) {
  const keys = closeUpTimeline;
  if (t <= keys[0].t) return keys[0].pose;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b.t) {
      const k = (t - a.t) / (b.t - a.t);
      const e = k * k * (3 - 2 * k);   // 慢慢出發、慢慢停
      return { pos: a.pose.pos.clone().lerp(b.pose.pos, e), look: a.pose.look.clone().lerp(b.pose.look, e) };
    }
  }
  return keys[keys.length - 1].pose;
}

// players：依序要拍誰，例如 ["p2", "p1"] = 先拍 P2（贏家）再拍 P1（輸家）
function focusPlayers(players) {
  const r = CONFIG.resultCamera;
  const c = r.closeUp;
  const now = (performance.now() - startTime) / 1000;
  const keys = [{ t: now, pose: closeUpTimeline ? timelinePose(now) : pullPose(now) }];
  let t = now;
  players.forEach(function (p) {
    const pose = closeUpPose(p);
    keys.push({ t: t + c.moveSeconds, pose: pose });              // 飛過去
    keys.push({ t: t + c.seconds, pose: pose });                  // 停著拍
    t += c.seconds;
  });
  keys.push({ t: t + r.backSeconds, pose: pullPose(Infinity) });  // 回到全景
  closeUpTimeline = keys;

  // 燈光：鏡頭飛到誰，誰就打 spotlight；最後拉遠時，舞台燈光全部亮起來
  beamSpeedTarget = CONFIG.beams.speed;     // 光束不再亂掃
  players.forEach(function (p, i) {
    timedEvents.push({ t: now + i * c.seconds, fn: () => setSpot(p, true) });
  });
  timedEvents.push({ t: now + players.length * c.seconds, fn: () => setMood("normal") });
}
function updateCamera(t) {
  if (cameraMode === "fixed") {
    const r = CONFIG.resultCamera;
    const pose = closeUpTimeline ? timelinePose(t) : pullPose(t);
    camera.position.copy(pose.pos);
    camera.lookAt(pose.look);
    if (camera.fov !== r.fov) {
      camera.fov = r.fov;
      camera.updateProjectionMatrix();
    }
    return;
  }
  const c = CONFIG.camera;
  if (!camPath) {
    camPath = new THREE.CatmullRomCurve3(c.shots.map((s) => V(s.pos[0], s.pos[1], s.pos[2])), true, "centripetal");
    lookPath = new THREE.CatmullRomCurve3(c.shots.map((s) => V(s.look[0], s.look[1], s.look[2])), true, "centripetal");
  }
  const n = c.shots.length;
  const shotTime = t / c.secondsPerShot;
  const i = Math.floor(shotTime) % n;
  // 每到一個鏡頭會慢下來、再慢慢出發，比較像真的攝影機
  const u = (i + smooth(shotTime - Math.floor(shotTime))) / n;

  const pos = camPath.getPoint(u);
  const target = lookPath.getPoint(u);
  if (c.shake > 0) {
    pos.x += c.shake * (Math.sin(t * 1.7) + 0.5 * Math.sin(t * 3.9));
    pos.y += c.shake * (Math.sin(t * 2.3 + 1) + 0.5 * Math.sin(t * 4.7));
  }
  camera.position.copy(pos);
  camera.lookAt(target);
  if (camera.fov !== c.fov) {
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
  }
}

// ---------- 每一格 ----------
function frame(now) {
  if (!running) return;
  const t = (now - startTime) / 1000;
  const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  updateCamera(t);
  updateLighting(t, dt);
  blinkUniforms.uTime.value = now / 1000;

  ["p1", "p2"].forEach(function (player) {
    const d = dancers[player];
    if (!d) return;
    // 立牌永遠轉向鏡頭，小人本身反方向轉同樣的角度 → 看起來就像真的站在 3D 舞台上
    const yaw = Math.atan2(camera.position.x - d.mesh.position.x, camera.position.z - d.mesh.position.z);
    d.mesh.rotation.y = yaw;
    if (d.viewer && d.viewer.setView) d.viewer.setView(-yaw);
    d.texture.needsUpdate = true;
  });

  composer.render();
  frameId = requestAnimationFrame(frame);
}

// ============================================================
//  給 battle.js 用的介面
// ============================================================
window.FloatStage = {
  // 模型載好、畫面準備好之後才 resolve；載入失敗會 reject（對戰頁就維持原本的樣子）
  start: function (options) {
    options = options || {};
    const mySession = ++session;
    if (!readyPromise) {
      readyPromise = modelPromise.then(init);
    }
    return readyPromise.then(function () {
      if (mySession !== session) return;   // 已經離開這一頁了
      // 把 3D 舞台的畫布搬到這一頁（放在最底層，其他文字都蓋在上面）
      const canvas = renderer.domElement;
      if (options.host && canvas.parentNode !== options.host) {
        options.host.insertBefore(canvas, options.host.firstChild);
      }
      cameraMode = options.camera === "fixed" ? "fixed" : "tour";
      closeUpTimeline = null;
      timedEvents = [];
      lastFrame = 0;
      setMood(options.mood || "normal", true);   // 結算頁一開始是 "suspense"（暗的）
      setSpot("p1", false, true);
      setSpot("p2", false, true);
      const d = options.dancers || {};
      const v = options.viewers || {};
      ["p1", "p2"].forEach(function (p) {
        if (d[p]) attachDancer(p, d[p], v[p]);
      });
      cancelAnimationFrame(frameId);
      startTime = performance.now();
      running = true;
      frameId = requestAnimationFrame(frame);
    });
  },
  stop: function () {
    session++;
    running = false;
    cancelAnimationFrame(frameId);
    ["p1", "p2"].forEach(function (p) {
      if (dancers[p] && dancers[p].viewer && dancers[p].viewer.setView) dancers[p].viewer.setView(0);
    });
  },
  // 結算頁公布獲勝者後呼叫：鏡頭依序拍這些小人，最後回到全景
  focusPlayers: function (players) {
    if (running && cameraMode === "fixed") focusPlayers(players);
  },
  CONFIG: CONFIG,
};

// three.js 是從網路載入的，比其他程式晚到。通知 battle.js「舞台程式準備好了」
window.dispatchEvent(new Event("floatstage-ready"));
