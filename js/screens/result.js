/* ============ 6.0 結算 ============
   顯示兩位玩家的小人、分數、判定成績，按空白鍵回首頁

   揭曉的順序（時間都在下面的 REVEAL 改）：
     1. 小人先站著，總分從 0 一路往上加
     2. 同時 PERFECT / GREAT / GOOD / MISS / MAX COMBO 一行一行跳出來
     3. 都加完之後停一下，公布獲勝者
     4. 這時候小人才開始跳舞（贏）或跪下（輸）
   揭曉途中按空白鍵 = 直接跳到最後結果；揭曉完再按空白鍵才回首頁

   3.0 選「電子花車」的話：
     背景是 3D 電子花車（攝影機固定在正面，看得到整台），小人站在舞台上，
     贏的繼續跳舞、輸的跪下，平手就一起跳舞，畫面上方一直掉彩帶下來。
   選其他舞台：跟原本一樣，贏的舉手歡呼，輸的垂頭喪氣。 */

const resultDancers = {
  p1: LowPoly.create(document.getElementById("result-dancer-p1"), "p1"),
  p2: LowPoly.create(document.getElementById("result-dancer-p2"), "p2"),
};

let resultRun = 0; // 每次進結算頁換一個號碼，離開後就不會再做事

const REVEAL = {
  startDelay: 1.2, // 進結算頁後等幾秒才開始加分數（等畫面亮起來）
  rowGap: 0.55, // 細節每一行隔幾秒跳出來
  rowCount: 0.4, // 每一行的數字要花幾秒加上去
  scoreExtra: 0.6, // 總分比最後一行再多加幾秒才停
  winnerDelay: 0.8, // 分數加完之後停幾秒才公布獲勝者
};

// 把畫面上的數字從 0 加到 to（一開始快、最後慢慢停）
function countUp(el, to, seconds, run) {
  const start = performance.now();
  function step(now) {
    if (run !== resultRun || revealDone) return; // 已經離開，或已經按空白鍵跳到結果
    const k = Math.min(1, (now - start) / (seconds * 1000));
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function showResult(player) {
  const result = GameState.result[player];
  resultDancers[player].setSkin(getSkin(player));
  document.getElementById("result-score-" + player).textContent = "0";

  const rows = [
    ["超ㄅㄧㄤˋ", result.perfect],
    ["粉讚", result.great],
    ["哇哩勒", result.good],
    ["阿娘喂", result.miss],
    ["MAX COMBO", result.maxCombo],
  ];
  const list = document.getElementById("result-judge-" + player);
  list.textContent = "";
  rows.forEach(function (row) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const value = document.createElement("span");
    label.textContent = row[0];
    value.textContent = "0";
    value.dataset.final = row[1]; // 最後要加到多少
    li.className = "reveal-hide"; // 先藏起來，等一下一行一行跳出來
    li.appendChild(label);
    li.appendChild(value);
    list.appendChild(li);
  });
}

/* ============ 揭曉 ============ */

let revealDone = true;
let revealTimers = [];
let revealEnding = null; // 公布獲勝者要做的事（onEnter 準備好）

function later(seconds, fn) {
  revealTimers.push(setTimeout(fn, seconds * 1000));
}

function startReveal(run) {
  revealDone = false;
  const hint = document.querySelector("#screen-result .hint");
  hint.classList.add("hidden"); // 揭曉完才顯示「按空白鍵回到主畫面」

  const rowCount = document.querySelectorAll("#result-judge-p1 li").length;
  const scoreSeconds = rowCount * REVEAL.rowGap + REVEAL.scoreExtra;

  later(REVEAL.startDelay, () => {
    ["p1", "p2"].forEach((player) => {
      countUp(
        document.getElementById("result-score-" + player),
        GameState.result[player].score,
        scoreSeconds,
        run,
      );
    });
  });

  for (let i = 0; i < rowCount; i++) {
    later(REVEAL.startDelay + i * REVEAL.rowGap, () => {
      ["p1", "p2"].forEach((player) => {
        const li = document.querySelectorAll("#result-judge-" + player + " li")[
          i
        ];
        li.classList.remove("reveal-hide");
        li.classList.add("pop-in");
        const value = li.lastChild;
        countUp(value, Number(value.dataset.final), REVEAL.rowCount, run);
      });
    });
  }

  later(REVEAL.startDelay + scoreSeconds + REVEAL.winnerDelay, finishReveal);
}

// 直接跳到最後結果：數字都填好、公布獲勝者、小人開始動
function finishReveal() {
  if (revealDone) return;
  revealDone = true;
  revealTimers.forEach(clearTimeout);
  revealTimers = [];

  ["p1", "p2"].forEach((player) => {
    document.getElementById("result-score-" + player).textContent =
      GameState.result[player].score;
    document
      .querySelectorAll("#result-judge-" + player + " li")
      .forEach((li) => {
        li.classList.remove("reveal-hide");
        li.lastChild.textContent = li.lastChild.dataset.final;
      });
  });

  if (revealEnding) revealEnding();
  document.querySelector("#screen-result .hint").classList.remove("hidden");
}

function stopReveal() {
  revealDone = true;
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
}

/* ============ 3D 電子花車 ============ */

function startResultStage(run) {
  const screen = document.getElementById("screen-result");
  screen.classList.remove("has-float");
  // wantsFloatStage() 寫在 battle.js：3.0 選到「電子花車」才會用 3D 舞台
  if (typeof wantsFloatStage !== "function" || !wantsFloatStage()) return;

  const begin = () => {
    if (run !== resultRun) return;
    FloatStage.start({
      host: screen, // 畫在結算頁
      camera: "fixed", // 攝影機固定在正面（位置在 float-stage.js 的 resultCamera）
      mood: "suspense", // 公布前舞台是暗的，只有光束在亂掃；公布後 focusPlayers 會打 spotlight、最後全部亮起來
      dancers: {
        p1: document.getElementById("result-dancer-p1"),
        p2: document.getElementById("result-dancer-p2"),
      },
      viewers: resultDancers,
    })
      .then(() => {
        if (run !== resultRun) return;
        screen.classList.add("has-float");
      })
      .catch((error) => {
        console.warn("3D 舞台開不起來，結算頁改用原本的畫面", error);
      });
  };

  if (window.FloatStage) {
    begin();
  } else {
    window.addEventListener("floatstage-ready", begin, { once: true });
  }
}

function stopResultStage() {
  if (window.FloatStage) FloatStage.stop();
  if (typeof Confetti !== "undefined") Confetti.stop();
  document.getElementById("screen-result").classList.remove("has-float");
}

/* ============ 結算畫面流程 ============ */

registerScreen("result", {
  onEnter: function () {
    const run = ++resultRun;
    showResult("p1");
    showResult("p2");

    // 3D 電子花車：輸的跪下；其他舞台：輸的垂頭喪氣、贏的舉手歡呼
    const onFloat = typeof wantsFloatStage === "function" && wantsFloatStage();
    const winMove = onFloat ? "dance" : "win";
    const loseMove = onFloat ? "kneel" : "lose";

    const score1 = GameState.result.p1.score;
    const score2 = GameState.result.p2.score;
    const winnerEl = document.getElementById("result-winner");
    winnerEl.textContent = "";
    winnerEl.classList.remove("winner-pop");

    // 揭曉前：兩個人先站著輕輕晃
    resultDancers.p1.play("idle");
    resultDancers.p2.play("idle");

    // 揭曉的最後一步：公布獲勝者 → 小人開始跳舞／跪下
    revealEnding = () => {
      if (score1 > score2) {
        winnerEl.textContent = "煞氣ㄟ舞王乂P1乂";
        resultDancers.p1.play(winMove);
        resultDancers.p2.play(loseMove);
      } else if (score2 > score1) {
        winnerEl.textContent = "煞氣ㄟ舞王乂P2乂";
        resultDancers.p1.play(loseMove);
        resultDancers.p2.play(winMove);
      } else {
        winnerEl.textContent = "平手！";
        resultDancers.p1.play("dance");
        resultDancers.p2.play("dance");
      }
      winnerEl.classList.add("winner-pop");

      // 3D 舞台：鏡頭先拍贏家 3 秒、再拍輸家 3 秒，最後回到全景（平手就 P1 → P2）
      if (onFloat && window.FloatStage && FloatStage.focusPlayers) {
        FloatStage.focusPlayers(score2 > score1 ? ["p2", "p1"] : ["p1", "p2"]);
      }
      // 有彩帶的話，公布的時候才開始灑
      if (onFloat && typeof Confetti !== "undefined") Confetti.start();
    };

    startReveal(run);
    startResultStage(run);
  },

  onLeave: function () {
    resultRun++;
    stopReveal();
    stopResultStage();
    resultDancers.p1.stop();
    resultDancers.p2.stop();
  },

  onKey: function (e) {
    if (e.code !== "Space") return;
    // 還在揭曉：先跳到最後結果；已經揭曉完：回首頁
    if (!revealDone) {
      finishReveal();
    } else {
      goTo("home");
    }
  },
});
