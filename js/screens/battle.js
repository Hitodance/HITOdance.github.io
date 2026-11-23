/* ============ 5.0 對戰 ============ */

/* ============ 基本設定 ============ */

const BATTLE_COUNTDOWN = 3;
const DEFAULT_DURATION = 20;
/* ============ 對戰理論滿分 ============ */

let battleMaxScore = 1;

// 歌曲剩最後幾秒時，把雙方分數藏起來（分數條變彩虹跑滿、分數變 ????），結算頁才揭曉勝負
const HIDE_SCORE_SECONDS = 5;
let battleScoreHidden = false;

// 箭頭從底部移動到判定線的秒數
const NOTE_TRAVEL = 1.8;

// 判定時間（秒）
const JUDGE = {
  perfect: 0.12,
  great: 0.22,
  good: 0.35,
};

// 各判定的分數
const BATTLE_POINTS = {
  perfect: 100,
  great: 70,
  good: 40,
};

// 文字箭頭（現在畫面上顯示的是 assets/arrow/ 的圖片，文字被 CSS 藏起來了；圖片壞掉時可以當備用）
const ARROWS = {
  left: "←",
  down: "↓",
  up: "↑",
  right: "→",
};

/* ============ 玩家按鍵設定 ============ */

const KEY_MAP = {
  KeyW: ["p1", "up"],
  KeyA: ["p1", "left"],
  KeyS: ["p1", "down"],
  KeyD: ["p1", "right"],

  ArrowUp: ["p2", "up"],
  ArrowLeft: ["p2", "left"],
  ArrowDown: ["p2", "down"],
  ArrowRight: ["p2", "right"],
};

/* ============ 取得 HTML 元件 ============ */

const battleCountdownEl = document.getElementById("battle-countdown");

const battleDancers = {
  p1: LowPoly.create(document.getElementById("battle-dancer-p1"), "p1"),

  p2: LowPoly.create(document.getElementById("battle-dancer-p2"), "p2"),
};

/* ============ 遊戲狀態 ============ */

const battlePlayers = ["p1", "p2"];

let battlePlaying = false;
let battleCountTimer;
let battleFrame;
let battleAudio;

let battleStartTime;
let battleDuration;
let battleRun = 0;

let battleNotes = {};
let battleFeedback = {};
let battleFlash = {};

/* ============ 產生歌曲譜面 ============ */

/* ============ BPM 自動產生譜面 ============ */

function makeBattleChart(song, duration) {
  // 歌曲 BPM
  const bpm = Number(song?.bpm) || 120;

  // 每拍的秒數
  const beat = 60 / bpm;

  // 第一拍的位置
  const offset = Number(song?.firstBeat) || 0;

  // 四個方向
  const directions = ["left", "down", "up", "right"];

  /* ============ 節奏組合 ============ */

  const patterns = [
    // 普通：每拍一個
    [0, 1, 2, 3],

    // 普通：每拍一個
    [0, 1, 2, 3],

    // 快速連按
    [0, 0.5, 1, 1.5, 3],

    // 後半段快速連按
    [0, 1, 2, 2.5, 3, 3.5],

    // 跳拍
    [0, 1.5, 2, 3.5],

    // 兩組快速連按
    [0, 0.5, 1, 2, 2.5, 3],

    // 短暫休息
    [0, 2, 3],

    // 雙鍵同時按
    [0, 1, 2, 2, 3],
  ];

  const chart = [];

  let lastDir = null;
  let lastTime = -Infinity;

  /* ============ 每四拍產生一組節奏 ============ */

  for (let bar = 0; offset + bar * beat < duration; bar += 4) {
    // 開頭先使用簡單節奏
    const pattern =
      bar < 8
        ? patterns[0]
        : patterns[Math.floor(Math.random() * patterns.length)];

    for (const position of pattern) {
      // 計算箭頭抵達時間
      const time = offset + (bar + position) * beat;

      // 避免開頭來不及反應
      if (time < NOTE_TRAVEL) continue;

      // 避免歌曲結束時還有箭頭
      if (time >= duration - JUDGE.good) continue;

      // 快速連按時避免相同方向
      const available =
        time - lastTime <= beat * 0.6
          ? directions.filter((dir) => dir !== lastDir)
          : directions;

      // 隨機選擇方向
      const dir = available[Math.floor(Math.random() * available.length)];

      chart.push({
        time: time,
        dir: dir,
      });

      lastDir = dir;
      lastTime = time;
    }
  }

  return chart;
}

/* ============ 更新玩家分數 ============ */
/* ============ 更新分數與 COMBO ============ */

function updateBattleScore(player) {
  const result = GameState.result[player];

  // 最後幾秒：分數藏起來，不更新數字和分數條（只更新 COMBO）
  if (!battleScoreHidden) {
    // 更新數字分數
    document.getElementById("battle-score-" + player).textContent = result.score;

    /* ============ 更新分數進度條 ============ */

    const percent = Math.min(
      100,
      Math.max(0, (result.score / battleMaxScore) * 100),
    );

    const scoreFill = document.getElementById("battle-score-fill-" + player);

    if (scoreFill) {
      scoreFill.style.width = percent + "%";
    }
  }

  /* ============ COMBO 顯示 ============ */

  const comboEl = document.getElementById("battle-combo-" + player);

  if (result.combo > 1) {
    // 只有連擊數字改變時才更新及播放動畫
    if (comboEl.dataset.combo !== String(result.combo)) {
      comboEl.innerHTML = `
        <span class="combo-number">${result.combo}</span>
        <span class="combo-label">combo</span>
      `;

      comboEl.dataset.combo = String(result.combo);

      // 重新播放彈跳動畫
      comboEl.classList.remove("pop");
      void comboEl.offsetWidth;
      comboEl.classList.add("pop");
    }
  } else {
    // 連擊中斷時清除 COMBO
    comboEl.textContent = "";
    comboEl.dataset.combo = "";
    comboEl.classList.remove("pop");
  }
}

/* ============ 判定與計分 ============ */

function judgeBattle(player, type, now) {
  const result = GameState.result[player];

  result[type]++;

  if (type === "miss") {
    // MISS 時連擊歸零
    result.combo = 0;
  } else {
    // 增加分數
    result.score += BATTLE_POINTS[type];

    // 增加連擊
    result.combo++;

    // 記錄最高連擊
    result.maxCombo = Math.max(result.maxCombo, result.combo);
  }

  /* ============ 判定文字 ============ */

  const judgeText = {
    perfect: "超ㄅㄧㄤˋ",
    great: "粉讚",
    good: "哇哩勒",
    miss: "阿娘喂",
  };

  const judgeEl = document.getElementById("battle-judge-" + player);

  judgeEl.textContent = judgeText[type];

  judgeEl.classList.remove("perfect", "great", "good", "miss");

  judgeEl.classList.add(type);
  /* ============ 判定文字隨機跳動 ============ */

  // 隨機水平位置：左右 45px
  const randomX = Math.random() * 90 - 45;

  // 隨機垂直位置：上下 30px
  const randomY = Math.random() * 60 - 30;

  // 隨機旋轉角度：左右 10 度
  const randomRotate = Math.random() * 20 - 10;

  // 將隨機數值傳給 CSS
  judgeEl.style.setProperty("--judge-x", randomX + "px");
  judgeEl.style.setProperty("--judge-y", randomY + "px");
  judgeEl.style.setProperty("--judge-rotate", randomRotate + "deg");

  // 每次判定重新播放彈跳動畫
  judgeEl.classList.remove("pop");
  void judgeEl.offsetWidth;
  judgeEl.classList.add("pop");
  // 判定文字顯示 0.65 秒
  battleFeedback[player] = now + 0.65;

  updateBattleScore(player);
}

/* ============ 取得目前音樂時間 ============ */

function battleTime() {
  // 有音樂時，使用音樂播放時間
  if (battleAudio) {
    return battleAudio.currentTime;
  }

  // 沒有音樂時，使用計時器
  return (performance.now() - battleStartTime) / 1000;
}

/* ============ 移除已完成的箭頭 ============ */

function removeBattleNote(note) {
  note.done = true;

  if (note.el) {
    note.el.remove();
    note.el = null;
  }
}

/* ============ 檢查漏掉的箭頭 ============ */

function expireBattleNotes(player, now) {
  for (const note of battleNotes[player]) {
    if (!note.done && now - note.time > JUDGE.good) {
      removeBattleNote(note);

      judgeBattle(player, "miss", now);
    }
  }
}

/* ============ 打中箭頭的特效 ============ */

// 在定位箭頭的位置放一個會放大淡出的彩色箭頭 + 光環（樣子在 css/screens.css 的 .hit-burst）
function showHitEffect(player, dir, perfect) {
  const burst = document.createElement("span");

  burst.className = perfect ? "hit-burst perfect" : "hit-burst";
  burst.dataset.dir = dir;

  document.querySelector(`#lane-${player} .receptors`).appendChild(burst);

  // 動畫播完就拿掉
  setTimeout(() => burst.remove(), 500);
}

/* ============ 玩家按下按鍵 ============ */

function pressKey(player, dir) {
  const now = battleTime();

  // 找到對應的固定箭頭
  const receptor = document.querySelector(
    `#lane-${player} .receptor[data-dir="${dir}"]`,
  );

  // 固定箭頭發光
  receptor.classList.add("hit");

  battleFlash[player][dir] = now + 0.12;

  // 先處理已經錯過的箭頭
  expireBattleNotes(player, now);

  let best = null;
  let distance = Infinity;

  // 找出同方向、最接近判定線的箭頭
  for (const note of battleNotes[player]) {
    const delta = Math.abs(note.time - now);

    if (
      !note.done &&
      note.dir === dir &&
      delta <= JUDGE.good &&
      delta < distance
    ) {
      best = note;
      distance = delta;
    }
  }

  // 空按不加分
  if (!best) return;

  // 移除成功按到的箭頭
  removeBattleNote(best);

  // 判斷準確度
  if (distance <= JUDGE.perfect) {
    judgeBattle(player, "perfect", now);
  } else if (distance <= JUDGE.great) {
    judgeBattle(player, "great", now);
  } else {
    judgeBattle(player, "good", now);
  }

  // 打中的特效
  showHitEffect(player, dir, distance <= JUDGE.perfect);

  // 讓人物做出動作
  battleDancers[player].kick();
}

/* ============ 產生與移動箭頭 ============ */

function renderBattle(now) {
  for (const player of battlePlayers) {
    const container = document.getElementById("battle-notes-" + player);

    const lane = container.parentElement;

    // 讀取 CSS 設定的判定線位置
    const hitY = parseFloat(getComputedStyle(lane).getPropertyValue("--hit-y"));

    // 箭頭從容器底部出現
    const arrowSize = parseFloat(
      getComputedStyle(lane).getPropertyValue("--arrow-size"),
    );

    const startY = container.clientHeight + arrowSize / 2;

    // 處理 MISS
    expireBattleNotes(player, now);

    for (const note of battleNotes[player]) {
      // 已經完成或還沒到出現時間
      if (note.done || note.time - now > NOTE_TRAVEL) {
        continue;
      }

      // 建立新的箭頭
      if (!note.el) {
        note.el = document.createElement("span");

        note.el.className = "battle-note";

        // 設定箭頭方向
        note.el.dataset.dir = note.dir;

        // 暫時顯示文字箭頭
        note.el.textContent = ARROWS[note.dir];

        container.appendChild(note.el);
      }

      // 距離判定時間還剩幾秒
      const remaining = note.time - now;

      // 計算箭頭垂直位置
      const y = hitY + (remaining / NOTE_TRAVEL) * (startY - hitY);

      // 只修改 Y 座標，不修改 X 座標
      note.el.style.top = y + "px";
    }

    // 清除過期的判定文字
    if (now > battleFeedback[player]) {
      document.getElementById("battle-judge-" + player).textContent = "";
    }

    // 清除固定箭頭的發光效果
    for (const dir of Object.keys(ARROWS)) {
      if (now > (battleFlash[player][dir] ?? -1)) {
        lane
          .querySelector(`.receptor[data-dir="${dir}"]`)
          .classList.remove("hit");
      }
    }
  }
}

/* ============ 對戰結束 ============ */

function finishBattle() {
  for (const player of battlePlayers) {
    for (const note of battleNotes[player]) {
      if (!note.done) {
        removeBattleNote(note);

        judgeBattle(player, "miss", battleDuration);
      }
    }
  }

  // 不再接受按鍵
  battlePlaying = false;

  // 畫面漸漸變暗 → 進入結算畫面 → 再慢慢亮起來
  fadeToResult();
}

/* ============ 對戰結束：漸暗轉場 ============ */

const FADE_OUT_SECONDS = 1.5; // 變暗要幾秒
const BLACK_HOLD_SECONDS = 1; // 全黑之後停幾秒才進結算頁
const FADE_IN_SECONDS = 1.0; // 結算頁亮起來要幾秒

function fadeToResult() {
  const curtain = document.getElementById("fade-curtain");
  const run = battleRun;

  curtain.style.transition = `opacity ${FADE_OUT_SECONDS}s ease-in`;
  curtain.classList.add("show");

  setTimeout(
    () => {
      // 變暗的途中已經離開對戰頁了（例如回首頁）：把黑幕拿掉就好
      if (run !== battleRun) {
        curtain.classList.remove("show");
        return;
      }
      goTo("result");
      // 下一格再開始亮起來，結算頁才來得及準備好
      requestAnimationFrame(() => {
        curtain.style.transition = `opacity ${FADE_IN_SECONDS}s ease-out`;
        curtain.classList.remove("show");
      });
    },
    (FADE_OUT_SECONDS + BLACK_HOLD_SECONDS) * 1000,
  );
}

/* ============ 最後幾秒藏分數 ============ */

// 分數條變彩虹、跑滿，分數變 ????（樣式在 css/screens.css 的 .score-hidden）
function setBattleScoreHidden(hidden) {
  battleScoreHidden = hidden;
  document.getElementById("screen-battle").classList.toggle("score-hidden", hidden);
  if (hidden) {
    for (const player of battlePlayers) {
      document.getElementById("battle-score-" + player).textContent = "????";
    }
  }
}

/* ============ 遊戲更新迴圈 ============ */

function battleTick() {
  if (!battlePlaying) return;

  const now = battleTime();

  // 更新箭頭位置
  renderBattle(now);

  // 剩最後 HIDE_SCORE_SECONDS 秒：藏起分數
  if (!battleScoreHidden && now >= battleDuration - HIDE_SCORE_SECONDS) {
    setBattleScoreHidden(true);
  }

  // 歌曲結束
  if (now >= battleDuration || battleAudio?.ended) {
    finishBattle();
    return;
  }

  // 下一個畫面
  battleFrame = requestAnimationFrame(battleTick);
}

/* ============ 正式開始遊戲 ============ */

async function startBattle(run) {
  // 播放音樂
  if (battleAudio) {
    try {
      await battleAudio.play();
    } catch (error) {
      if (run !== battleRun) return;

      console.warn("音樂播放失敗，改用無聲測試模式", error);

      battleAudio = null;
    }
  }

  // 防止離開畫面後仍然開始遊戲
  if (run !== battleRun) return;

  // 避免設定時間超過音檔長度
  if (battleAudio && Number.isFinite(battleAudio.duration)) {
    battleDuration = Math.min(battleDuration, battleAudio.duration);
  }

  // 建立歌曲譜面
  const chart = makeBattleChart(GameState.song, battleDuration);
  // 每個音符 PERFECT = 100 分
  battleMaxScore = Math.max(1, chart.length * 100);

  // P1、P2 使用相同的譜面
  for (const player of battlePlayers) {
    battleNotes[player] = chart.map((note) => ({
      ...note,
      done: false,
      el: null,
    }));
  }

  battleStartTime = performance.now();

  battlePlaying = true;

  // 人物開始跳舞
  battleDancers.p1.play("dance");
  battleDancers.p2.play("dance");

  // 清除倒數文字
  battleCountdownEl.textContent = "";

  // 開始更新遊戲
  battleTick();
}

/* ============ 3D 電子花車舞台 ============ */

// 3D 舞台用哪一個：data.js 的 STAGES 裡寫的 scene
//   "float" = 電子花車、"hall" = 台式復古舞廳；沒寫 scene 的舞台就用原本的 2D 畫面
// 開發小技巧：直接用 #battle 跳進來測試（還沒選舞台）時用電子花車
function floatSceneKey() {
  if (!GameState.stage) return "float";
  return GameState.stage.scene || null;
}
function wantsFloatStage() {
  return !!floatSceneKey();
}

function startFloatStage(run) {
  const screen = document.getElementById("screen-battle");
  screen.classList.remove("has-float");
  if (!wantsFloatStage()) return;

  const begin = () => {
    if (run !== battleRun) return; // 已經離開對戰頁了
    FloatStage.start({
      stage: floatSceneKey(), // 電子花車 or 台式復古舞廳
      host: screen, // 畫在對戰頁
      camera: "tour", // 照 float-stage.js 的 shots 運鏡
      bpm: GameState.song?.bpm || 120,
      dancers: {
        p1: document.getElementById("battle-dancer-p1"),
        p2: document.getElementById("battle-dancer-p2"),
      },
      viewers: battleDancers,
    })
      .then(() => {
        if (run === battleRun) screen.classList.add("has-float");
      })
      .catch((error) => {
        console.warn("3D 舞台開不起來，改用原本的畫面", error);
      });
  };

  // three.js 和模型是從網路／檔案載入的，可能還沒到：等它好了再開始
  if (window.FloatStage) {
    begin();
  } else {
    window.addEventListener("floatstage-ready", begin, { once: true });
  }
}

function stopFloatStage() {
  if (window.FloatStage) FloatStage.stop();
  document.getElementById("screen-battle").classList.remove("has-float");
}

/* ============ 對戰畫面流程 ============ */

registerScreen("battle", {
  onEnter() {
    const run = ++battleRun;

    resetResult();

    // 新的一局：分數重新顯示
    setBattleScoreHidden(false);

    battlePlaying = false;

    const song = GameState.song;

    // 設定歌曲長度
    battleDuration = song?.duration > 0 ? song.duration : DEFAULT_DURATION;

    // 建立音樂
    battleAudio = song?.src ? new Audio(song.src) : null;

    if (battleAudio) {
      battleAudio.preload = "auto";
    }

    // 設定人物跳舞速度
    LowPoly.LOOK.danceBpm = song?.bpm || 120;

    // 顯示歌曲名稱
    document.getElementById("battle-song-name").textContent =
      song?.name || "TEST MODE";

    // 初始化兩位玩家
    for (const player of battlePlayers) {
      battleNotes[player] = [];
      battleFeedback[player] = -1;
      battleFlash[player] = {};

      // 清除舊箭頭
      document.getElementById("battle-notes-" + player).replaceChildren();

      // 清除舊判定
      document.getElementById("battle-judge-" + player).textContent = "";

      // 清除固定箭頭效果
      document.querySelectorAll(`#lane-${player} .receptor`).forEach((el) => {
        el.classList.remove("hit");
      });

      updateBattleScore(player);

      // 載入人物
      battleDancers[player].setSkin(getSkin(player));

      battleDancers[player].play("idle");
    }

    // 3D 電子花車舞台（3.0 選到「電子花車」才會出現）
    startFloatStage(run);

    // 開始倒數
    let count = BATTLE_COUNTDOWN;

    battleCountdownEl.textContent = count;

    battleCountTimer = setInterval(() => {
      count--;

      battleCountdownEl.textContent = count > 0 ? count : "START!";

      if (count === 0) {
        clearInterval(battleCountTimer);

        startBattle(run);
      }
    }, 1000);
  },

  /* 離開對戰畫面 */

  onLeave() {
    battleRun++;

    battlePlaying = false;

    clearInterval(battleCountTimer);

    cancelAnimationFrame(battleFrame);

    battleCountdownEl.textContent = "";

    stopFloatStage();

    for (const player of battlePlayers) {
      battleDancers[player].stop();
    }

    // 停止音樂
    if (battleAudio) {
      battleAudio.pause();

      battleAudio = null;
    }
  },

  /* 監聽玩家按鍵 */

  onKey(e) {
    // 遊戲還沒開始時不能按
    // 長按也不會一直加分
    if (!battlePlaying || e.repeat) return;

    const key = KEY_MAP[e.code];

    if (key) {
      pressKey(...key);
    }
  },
});
