/* ============ 6.0 結算 ============
   顯示兩位玩家的小人、分數、判定成績，按空白鍵回首頁
   贏的小人舉手歡呼，輸的垂頭喪氣，平手就一起跳舞 */

const resultDancers = {
  p1: LowPoly.create(document.getElementById("result-dancer-p1"), "p1"),
  p2: LowPoly.create(document.getElementById("result-dancer-p2"), "p2")
};

function showResult(player) {
  const result = GameState.result[player];
  resultDancers[player].setSkin(getSkin(player));
  document.getElementById("result-score-" + player).textContent = result.score;

  const rows = [
    ["PERFECT", result.perfect],
    ["GOOD", result.good],
    ["MISS", result.miss],
    ["MAX COMBO", result.maxCombo]
  ];
  const list = document.getElementById("result-judge-" + player);
  list.textContent = "";
  rows.forEach(function (row) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const value = document.createElement("span");
    label.textContent = row[0];
    value.textContent = row[1];
    li.appendChild(label);
    li.appendChild(value);
    list.appendChild(li);
  });
}

registerScreen("result", {
  onEnter: function () {
    showResult("p1");
    showResult("p2");

    const score1 = GameState.result.p1.score;
    const score2 = GameState.result.p2.score;
    const winnerEl = document.getElementById("result-winner");
    if (score1 > score2) {
      winnerEl.textContent = "P1 WIN!";
      resultDancers.p1.play("win");
      resultDancers.p2.play("lose");
    } else if (score2 > score1) {
      winnerEl.textContent = "P2 WIN!";
      resultDancers.p1.play("lose");
      resultDancers.p2.play("win");
    } else {
      winnerEl.textContent = "平手！";
      resultDancers.p1.play("dance");
      resultDancers.p2.play("dance");
    }
  },

  onLeave: function () {
    resultDancers.p1.stop();
    resultDancers.p2.stop();
  },

  onKey: function (e) {
    if (e.code === "Space") {
      goTo("home");
    }
  }
});
