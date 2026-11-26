/* =========================================================
   fireworks.js — 電子花車舞台後面的天空一直在放煙火

   每隔一段隨機時間，從舞台後面射上一顆火箭（拖著小尾巴），
   飛到天上炸開成一大圈彩色火花，火花會受重力往下掉、閃爍、慢慢變暗。
   所有火花用同一組 Points 畫（最多 MAX 顆），很省效能。
   想調整的數字都在下面的 FIREWORKS（座標是 three.js 的：x 左右、y 高度、z 前後，舞台在 z = 0 附近，越負越遠）
   ========================================================= */
import * as THREE from "three";

export const FIREWORKS = {
  everyMin: 0.35,       // 最快隔幾秒放一發
  everyMax: 0.9,        // 最慢隔幾秒放一發
  x: [-32, 32],         // 炸開的位置：左右範圍
  y: [14, 20],          //               高度範圍（舞台拉寬後看板很大，要放高、放遠才看得到）
  z: [-42, -26],        //               前後範圍（越負越遠、在舞台後面）
  sparks: [160, 240],   // 每發幾顆火花
  speed: [8, 12],       // 火花往外噴的速度（越大炸得越開）
  life: [1.4, 2.4],     // 火花多久消失（秒）
  gravity: 3.2,         // 往下掉的重力
  size: 1.4,            // 火花大小
  brightness: 1.4,      // 亮度（太亮會整片糊成一團光）
  tails: 0.35,          // 火花拖尾巴的多寡（0 = 不拖、1 = 很多）
  colors: ["#ff3fd2", "#ffd23f", "#3fd8ff", "#8eff5a", "#ff6a3d", "#ffffff", "#b46bff"],
};

const MAX = 9000;   // 同時最多幾顆火花

export function createFireworks() {
  const F = FIREWORKS;
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const alpha = new Float32Array(MAX);
  const size = new Float32Array(MAX);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);      // 剩下的壽命（秒）；<= 0 = 沒在用
  const maxLife = new Float32Array(MAX);
  const kind = new Uint8Array(MAX);        // 0 = 火花、1 = 火箭、2 = 尾巴
  const target = new Float32Array(MAX);    // 火箭：飛到這個高度就炸開
  const twinkle = new Float32Array(MAX);
  const burstColor = new Float32Array(MAX * 3);   // 火箭炸開要用的顏色
  let next = 0;    // 下一個可以用的位置（輪著用）

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 }, uMaster: { value: 1 } },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uScale;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uMaster;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(1.0, 0.0, d);
        float glow = core * core * core;
        gl_FragColor = vec4(vColor * glow * vAlpha * uMaster, 1.0);
      }`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -1;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickColor() {
    return new THREE.Color(F.colors[Math.floor(Math.random() * F.colors.length)]);
  }

  function take() {
    for (let n = 0; n < MAX; n++) {
      const i = (next + n) % MAX;
      if (life[i] <= 0) { next = (i + 1) % MAX; return i; }
    }
    return -1;   // 滿了就不放
  }

  function launch() {
    const i = take();
    if (i < 0) return;
    const x = rand(F.x[0], F.x[1]), z = rand(F.z[0], F.z[1]);
    pos[i * 3] = x; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = z;
    target[i] = rand(F.y[0], F.y[1]);
    vel[i * 3] = rand(-0.6, 0.6); vel[i * 3 + 1] = rand(14, 18); vel[i * 3 + 2] = 0;
    life[i] = maxLife[i] = 3;
    kind[i] = 1;
    const c = pickColor();
    burstColor[i * 3] = c.r; burstColor[i * 3 + 1] = c.g; burstColor[i * 3 + 2] = c.b;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1;
    size[i] = F.size * 0.9;
  }

  function burst(x, y, z, c) {
    const n = Math.floor(rand(F.sparks[0], F.sparks[1]));
    const second = Math.random() < 0.4 ? pickColor() : null;   // 有時候混兩種顏色
    const speed = rand(F.speed[0], F.speed[1]);
    for (let k = 0; k < n; k++) {
      const i = take();
      if (i < 0) return;
      // 均勻散在球面上
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const v = speed * rand(0.85, 1.05);
      vel[i * 3] = s * Math.cos(t) * v; vel[i * 3 + 1] = u * v; vel[i * 3 + 2] = s * Math.sin(t) * v;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const cc = second && k % 2 ? second : c;
      col[i * 3] = cc.r * F.brightness; col[i * 3 + 1] = cc.g * F.brightness; col[i * 3 + 2] = cc.b * F.brightness;
      life[i] = maxLife[i] = rand(F.life[0], F.life[1]);
      kind[i] = 0;
      twinkle[i] = Math.random() < 0.5 ? rand(10, 25) : 0;
      size[i] = F.size * rand(0.8, 1.2);
    }
  }

  function trail(x, y, z) {
    const i = take();
    if (i < 0) return;
    pos[i * 3] = x + rand(-0.05, 0.05); pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = rand(-0.3, 0.3); vel[i * 3 + 1] = rand(-1.5, -0.5); vel[i * 3 + 2] = 0;
    col[i * 3] = 1.0; col[i * 3 + 1] = 0.75; col[i * 3 + 2] = 0.45;
    life[i] = maxLife[i] = rand(0.3, 0.6);
    kind[i] = 2;
    twinkle[i] = 0;
    size[i] = F.size * 0.5;
  }

  let timer = 0.3;
  let clock = 0;

  function update(dt, master) {
    clock += dt;
    timer -= dt;
    if (timer <= 0) {
      launch();
      timer = rand(F.everyMin, F.everyMax);
    }
    mat.uniforms.uMaster.value = master === undefined ? 1 : Math.max(0.35, master);
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = kind[i];
      if (k === 1) {
        // 火箭：往上飛、留尾巴，到了高度就炸開
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        vel[i * 3 + 1] -= 4 * dt;
        alpha[i] = 1;
        if (Math.random() < 0.8) trail(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        if (pos[i * 3 + 1] >= target[i] || vel[i * 3 + 1] < 2) {
          life[i] = 0;
          alpha[i] = 0;
          burst(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2],
            new THREE.Color(burstColor[i * 3], burstColor[i * 3 + 1], burstColor[i * 3 + 2]));
        }
        continue;
      }
      // 火花、尾巴：慢慢減速、往下掉、變暗
      const drag = Math.pow(k === 0 ? 0.35 : 0.5, dt);
      vel[i * 3] *= drag; vel[i * 3 + 1] *= drag; vel[i * 3 + 2] *= drag;
      vel[i * 3 + 1] -= F.gravity * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = life[i] / maxLife[i];       // 1 → 0
      // 火花後面拖一點同色的小尾巴，看起來像一條條光線
      if (k === 0 && t > 0.25 && Math.random() < F.tails) {
        const j = take();
        if (j >= 0) {
          pos[j * 3] = pos[i * 3]; pos[j * 3 + 1] = pos[i * 3 + 1]; pos[j * 3 + 2] = pos[i * 3 + 2];
          vel[j * 3] = vel[i * 3] * 0.1; vel[j * 3 + 1] = vel[i * 3 + 1] * 0.1; vel[j * 3 + 2] = vel[i * 3 + 2] * 0.1;
          col[j * 3] = col[i * 3] * 0.6; col[j * 3 + 1] = col[i * 3 + 1] * 0.6; col[j * 3 + 2] = col[i * 3 + 2] * 0.6;
          life[j] = maxLife[j] = rand(0.25, 0.45);
          kind[j] = 2;
          twinkle[j] = 0;
          size[j] = size[i] * 0.55;
        }
      }
      let a = Math.min(1, t * 1.6);
      if (twinkle[i] > 0 && t < 0.6) a *= 0.5 + 0.5 * Math.sin(clock * twinkle[i] + i);
      alpha[i] = Math.max(0, a);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  return { object: points, update: update };
}
