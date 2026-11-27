/* =========================================================
   taunt.js — 結算頁：兩個小人用死語互嗆

   公布獲勝者之後（js/screens/result.js 呼叫 Taunt.start）：
     1. 鏡頭帶到贏家 → 贏家開口嗆輸家
     2. 鏡頭帶到輸家 → 輸家回嘴
     3. 鏡頭拉遠 → 兩個人輪流互嗆兩三句（一次只有講話的那個人有對話框）
   平手的話：先 P1 再 P2，兩個人都用平手的台詞。
   台詞在 js/data.js 的 TAUNTS，想加新的直接加在那裡。

   對話框是「一整個」造型：圓角框和尾巴是同一條線畫出來的（SVG），尾巴的尖端每一格都會對準講話的人。
   鏡頭特寫（1、2）的時候：框在小人腳下，尾巴往上指；拉遠（3）之後：框在小人頭上，尾巴往下指。
   時間跟著 3D 舞台的鏡頭（float-stage.js 的 resultCamera.closeUp）；沒有 3D 舞台就用下面的 FALLBACK。
   ========================================================= */

const Taunt = (function () {
  const TAUNT = {
    lineSeconds: 1.8, // 拉遠之後，每句話停留幾秒
    rounds: [2, 3], // 拉遠之後，每個人嗆幾句（在這兩個數字之間隨機）
    tail: 70, // 尾巴多長（px）：對話框離頭多遠
    tailWidth: 40, // 尾巴根部多寬（px）
    radius: 26, // 對話框圓角
    topLimit: 265, // 對話框最高只能到這裡（上面是跑馬燈和「煞氣ㄟ舞王」標題）
    topLimit2D: 240, // 沒有 3D 舞台時（標題比較上面）
    bottomLimit: 900, // 對話框最低到這裡（下面是提示字）
    avoidLeft: 620, // 3D 舞台時，對話框不要超過這條線往左（左邊是 P1 的分數框）
    avoidRight: 1300, // 3D 舞台時，對話框不要超過這條線往右（右邊是 P2 的分數框）
    // 沒有 3D 舞台時的時間（沒有鏡頭要飛）
    FALLBACK: { seconds: 2.6, moveSeconds: 0.3, backSeconds: 0.6 },
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  const bubbles = {};
  ["p1", "p2"].forEach(function (player) {
    const root = document.getElementById("taunt-" + player);
    root.textContent = "";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 1920 1080");
    const path = document.createElementNS(SVG_NS, "path");
    svg.appendChild(path);
    const text = document.createElement("div");
    text.className = "taunt-text";
    const words = document.createElement("span");
    text.appendChild(words);
    root.appendChild(svg);
    root.appendChild(text);
    bubbles[player] = { root: root, path: path, text: text, words: words };
  });

  let timers = [];
  let frameId = 0;
  let under = false; // true = 框放在小人腳下（鏡頭特寫的時候）

  // 從一堆台詞裡隨機挑，挑過的先不要重複
  function makePicker(list) {
    let bag = [];
    return function () {
      if (bag.length === 0) {
        bag = list.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop();
    };
  }

  function later(seconds, fn) {
    timers.push(setTimeout(fn, seconds * 1000));
  }

  function onStage() {
    return document.getElementById("screen-result").classList.contains("has-float");
  }

  function say(player, line) {
    hide(player === "p1" ? "p2" : "p1"); // 一次只有一個人講話
    const b = bubbles[player];
    b.words.textContent = line;
    b.root.classList.remove("pop");
    b.root.classList.add("show");
    place(player);
    void b.root.offsetWidth; // 讓彈出動畫重播
    b.root.classList.add("pop");
  }

  function hide(player) {
    bubbles[player].root.classList.remove("show", "pop");
  }

  // 小人頭頂在畫面上的位置（1920×1080 座標）：有 3D 舞台就問舞台，沒有就看 2D 小人的 canvas
  // feet = true：改問腳底的位置
  function headOf(player, feet) {
    if (onStage() && window.FloatStage && FloatStage.headPoint) {
      const p = FloatStage.headPoint(player, feet ? -0.05 : undefined);
      if (p) return p;
    }
    const canvas = document.getElementById("result-dancer-" + player);
    const stage = document.getElementById("stage").getBoundingClientRect();
    const r = canvas.getBoundingClientRect();
    if (!r.width) return null;
    const sx = stage.width / 1920;
    const sy = stage.height / 1080;
    return { x: (r.left + r.width / 2 - stage.left) / sx, y: (r.top + r.height * (feet ? 0.86 : 0.2) - stage.top) / sy };
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // 算對話框放哪裡，並畫出「框＋尾巴」一整個造型
  function place(player) {
    const b = bubbles[player];
    const head = headOf(player, under); // under 的時候這個其實是「腳底」
    if (!head) return;
    const w = b.text.offsetWidth;
    const h = b.text.offsetHeight;
    const minX = onStage() ? TAUNT.avoidLeft : 30;
    const maxX = onStage() ? TAUNT.avoidRight : 1890;

    // 鏡頭特寫：放在腳下，尾巴往上指著小人
    if (under) {
      const ux = clamp(head.x - w / 2, minX, maxX - w);
      const uy = clamp(head.y + TAUNT.tail, TAUNT.topLimit, TAUNT.bottomLimit - h);
      b.text.style.left = ux + "px";
      b.text.style.top = uy + "px";
      // 尾巴一定往上：尖端在框的正上方、對著小人（特寫時腳常常在畫面外，不能直接指腳）
      const tipX = clamp(head.x, ux + TAUNT.radius + 30, ux + w - TAUNT.radius - 30);
      const tipY = uy - TAUNT.tail * 0.75;
      b.root.style.transformOrigin = tipX + "px " + tipY + "px";
      b.path.setAttribute("d", bubblePath(ux, uy, w, h, tipX, tipY - 12));
      return;
    }

    // 先放在頭的正上方
    let x = clamp(head.x - w / 2, minX, maxX - w);
    let y = head.y - TAUNT.tail - h;
    // 太高會蓋到標題：往下移到標題下面
    const top = onStage() ? TAUNT.topLimit : TAUNT.topLimit2D;
    if (y < top) y = top;
    y = Math.min(y, TAUNT.bottomLimit - h);
    // 移下來之後如果蓋到頭：改放在頭的旁邊（往畫面中間那一邊）
    const covers = head.x > x - 20 && head.x < x + w + 20 && head.y > y - 20 && head.y < y + h + 20;
    if (covers) {
      x = head.x < 960 ? head.x + TAUNT.tail : head.x - TAUNT.tail - w;
      x = clamp(x, minX, maxX - w);
      y = clamp(head.y - h / 2, top, TAUNT.bottomLimit - h);
    }

    b.text.style.left = x + "px";
    b.text.style.top = y + "px";
    b.root.style.transformOrigin = head.x + "px " + head.y + "px"; // 從講話的人頭上彈出來
    b.path.setAttribute("d", bubblePath(x, y, w, h, head.x, head.y));
  }

  // 圓角框＋尾巴，用同一條線一筆畫完。尾巴長在離頭最近的那一邊，尖端指向頭
  function bubblePath(x, y, w, h, hx, hy) {
    const r = TAUNT.radius;
    const tw = TAUNT.tailWidth / 2;
    const gap = 12; // 尾巴尖端離頭留一點空隙
    let edge;
    if (hy > y + h + 10) edge = "bottom";
    else if (hy < y - 10) edge = "top";
    else edge = hx < x ? "left" : "right";

    // 尾巴尖端：從框往頭的方向，停在頭前面一點點
    const cx = clamp(hx, x + r + tw, x + w - r - tw);
    const cy = clamp(hy, y + r + tw, y + h - r - tw);
    let tipX = hx;
    let tipY = hy;
    const baseX = edge === "left" ? x : edge === "right" ? x + w : cx;
    const baseY = edge === "top" ? y : edge === "bottom" ? y + h : cy;
    const dx = tipX - baseX;
    const dy = tipY - baseY;
    const len = Math.hypot(dx, dy) || 1;
    tipX -= (dx / len) * gap;
    tipY -= (dy / len) * gap;
    const tip = " L " + tipX + " " + tipY + " L ";

    let d = "M " + (x + r) + " " + y;
    // 上邊
    if (edge === "top") d += " H " + (cx - tw) + tip + (cx + tw) + " " + y;
    d += " H " + (x + w - r) + " Q " + (x + w) + " " + y + " " + (x + w) + " " + (y + r);
    // 右邊
    if (edge === "right") d += " V " + (cy - tw) + tip + (x + w) + " " + (cy + tw);
    d += " V " + (y + h - r) + " Q " + (x + w) + " " + (y + h) + " " + (x + w - r) + " " + (y + h);
    // 下邊
    if (edge === "bottom") d += " H " + (cx + tw) + tip + (cx - tw) + " " + (y + h);
    d += " H " + (x + r) + " Q " + x + " " + (y + h) + " " + x + " " + (y + h - r);
    // 左邊
    if (edge === "left") d += " V " + (cy + tw) + tip + x + " " + (cy - tw);
    d += " V " + (y + r) + " Q " + x + " " + y + " " + (x + r) + " " + y + " Z";
    return d;
  }

  // 鏡頭一直在動：每一格都重新對準頭
  function follow() {
    ["p1", "p2"].forEach(function (player) {
      if (bubbles[player].root.classList.contains("show")) place(player);
    });
    frameId = requestAnimationFrame(follow);
  }

  // order：先拍誰、再拍誰，例如 ["p2", "p1"]；kind："win"（有輸贏）或 "tie"（平手）
  function start(order, kind) {
    stop();
    const T = window.FloatStage && FloatStage.focusTiming && onStage() ? FloatStage.focusTiming() : TAUNT.FALLBACK;
    const first = order[0];
    const second = order[1];
    const pick = {};
    pick[first] = makePicker(kind === "tie" ? TAUNTS.tie : TAUNTS.win);
    pick[second] = makePicker(kind === "tie" ? TAUNTS.tie : TAUNTS.lose);

    // 1. 鏡頭飛到第一個人 → 他開口（特寫的時候框在腳下）
    under = true;
    later(T.moveSeconds * 0.8, () => say(first, pick[first]()));
    later(T.seconds - 0.15, () => hide(first));
    // 2. 鏡頭飛到第二個人 → 他回嘴
    later(T.seconds + T.moveSeconds * 0.8, () => say(second, pick[second]()));
    later(T.seconds * 2 - 0.15, () => hide(second));
    // 3. 拉遠之後：兩個人輪流互嗆兩三句
    const rounds = TAUNT.rounds[0] + Math.floor(Math.random() * (TAUNT.rounds[1] - TAUNT.rounds[0] + 1));
    let t = T.seconds * 2 + T.backSeconds * 0.7;
    later(T.seconds * 2 - 0.1, () => (under = false)); // 拉遠之後，框回到頭上
    for (let i = 0; i < rounds; i++) {
      [first, second].forEach(function (p) {
        later(t, () => say(p, pick[p]()));
        t += TAUNT.lineSeconds;
      });
    }
    // 最後一句講完，對話框收起來
    later(t, () => {
      hide("p1");
      hide("p2");
    });

    frameId = requestAnimationFrame(follow);
  }

  function stop() {
    under = false;
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(frameId);
    hide("p1");
    hide("p2");
  }

  return { start: start, stop: stop, TAUNT: TAUNT };
})();
