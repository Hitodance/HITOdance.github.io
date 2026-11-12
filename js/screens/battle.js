/* ============ 5.0 對戰 ============
   流程：倒數 3 2 1 → 開始播音樂 → 兩人同時按鍵 → 時間到自動跳結算
   P1 用 W A S D，P2 用方向鍵

   目前還沒有譜面，所以先做成「每按一下就 +100 分」的暫時版，
   方便測試整個流程。之後要做的事（TODO）：
     1. 編譜面：哪個時間點掉哪個箭頭
     2. 讓箭頭在軌道（.lane）裡移動
     3. 在 pressKey() 裡依照按的時間準不準，判定 PERFECT / GOOD / MISS */

const BATTLE_COUNTDOWN = 3;       // 開場倒數幾秒
const DEFAULT_DURATION = 20;      // 沒選歌時玩幾秒

// 鍵盤的哪個鍵 → 哪位玩家的哪個方向
const KEY_MAP = {
  KeyW: { player: "p1", dir: "up" },
  KeyA: { player: "p1", dir: "left" },
  KeyS: { player: "p1", dir: "down" },
  KeyD: { player: "p1", dir: "right" },
  ArrowUp:    { player: "p2", dir: "up" },
  ArrowLeft:  { player: "p2", dir: "left" },
  ArrowDown:  { player: "p2", dir: "down" },
  ArrowRight: { player: "p2", dir: "right" }
};

const battleCountdownEl = document.getElementById("battle-countdown");
const battleTimeFillEl = document.getElementById("battle-time-fill");

// 左右兩邊跳舞的 3D 小人
const battleDancers = {
  p1: LowPoly.create(document.getElementById("battle-dancer-p1"), "p1"),
  p2: LowPoly.create(document.getElementById("battle-dancer-p2"), "p2")
};

let battlePlaying = false;        // 倒數結束、正在玩才是 true
let battleCountTimer = null;      // 開場倒數的計時器
let battleLoopTimer = null;       // 遊戲進行中每 0.1 秒跑一次的計時器
let battleAudio = null;           // 正在播的音樂
let battleStartTime = 0;
let battleDuration = DEFAULT_DURATION;

// 把分數、combo 更新到畫面上
function updateBattleScore(player) {
  const result = GameState.result[player];
  document.getElementById("battle-score-" + player).textContent = result.score;
  const comboEl = document.getElementById("battle-combo-" + player);
  comboEl.textContent = result.combo > 1 ? result.combo + " combo" : "";
}

// 玩家按下方向鍵時
function pressKey(player, dir) {
  // 判定區的箭頭亮一下
  const receptor = document.querySelector("#lane-" + player + ' .receptor[data-dir="' + dir + '"]');
  receptor.classList.add("hit");
  setTimeout(function () { receptor.classList.remove("hit"); }, 100);
  battleDancers[player].kick();   // 小人跟著抖一下

  // TODO：之後改成依照譜面判定。現在先每按一下都算 PERFECT
  const result = GameState.result[player];
  result.score = result.score + 100;
  result.perfect = result.perfect + 1;
  result.combo = result.combo + 1;
  if (result.combo > result.maxCombo) {
    result.maxCombo = result.combo;
  }
  updateBattleScore(player);
}

function startBattle() {
  battlePlaying = true;
  battleStartTime = Date.now();
  battleDancers.p1.play("dance");
  battleDancers.p2.play("dance");

  // 播音樂（data.js 裡這首歌有填 src 才會播）
  const song = GameState.song;
  if (song && song.src) {
    battleAudio = new Audio(song.src);
    battleAudio.play().catch(function (error) {
      console.warn("音樂播不出來：", error);
    });
  }

  // 每 0.1 秒更新一次進度條，時間到就結束
  battleLoopTimer = setInterval(function () {
    const elapsed = (Date.now() - battleStartTime) / 1000;
    battleTimeFillEl.style.width = Math.min(100, elapsed / battleDuration * 100) + "%";
    if (elapsed >= battleDuration) {
      goTo("result");
    }
  }, 100);
}

registerScreen("battle", {
  onEnter: function () {
    resetResult();
    battlePlaying = false;
    updateBattleScore("p1");
    updateBattleScore("p2");
    battleTimeFillEl.style.width = "0%";

    const song = GameState.song;
    battleDuration = song ? song.duration : DEFAULT_DURATION;
    LowPoly.LOOK.danceBpm = song && song.bpm ? song.bpm : 120;   // 小人照這首歌的速度跳
    document.getElementById("battle-song-name").textContent = song ? song.name : "";
    // 倒數的時候小人先站著，音樂開始才跳舞
    ["p1", "p2"].forEach(function (player) {
      battleDancers[player].setSkin(getSkin(player));
      battleDancers[player].play("idle");
    });

    // 開場倒數
    let count = BATTLE_COUNTDOWN;
    battleCountdownEl.textContent = count;
    battleCountTimer = setInterval(function () {
      count = count - 1;
      if (count > 0) {
        battleCountdownEl.textContent = count;
      } else if (count === 0) {
        battleCountdownEl.textContent = "START!";
        startBattle();
      } else {
        battleCountdownEl.textContent = "";
        clearInterval(battleCountTimer);
      }
    }, 1000);
  },

  onLeave: function () {
    battlePlaying = false;
    clearInterval(battleCountTimer);
    clearInterval(battleLoopTimer);
    battleCountdownEl.textContent = "";
    battleDancers.p1.stop();
    battleDancers.p2.stop();
    if (battleAudio) {
      battleAudio.pause();
      battleAudio = null;
    }
  },

  onKey: function (e) {
    if (!battlePlaying) { return; }
    const key = KEY_MAP[e.code];
    if (key) {
      pressKey(key.player, key.dir);
    }
  }
});
