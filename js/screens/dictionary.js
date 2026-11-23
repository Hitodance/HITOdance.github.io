/* ============ 0.1 死語詞典 ============
   詞條內容在 js/data.js 的 DEAD_WORDS
   上下鍵一次滑動一個詞條 */

const ITEM_HEIGHT = 150;     // 一個詞條的高度（要跟 screens.css 的 .dict-item 一樣）
const VISIBLE_ITEMS = 4;     // 畫面上一次看得到幾個
let dictPosition = 0;        // 目前滑到第幾個

const dictList = document.getElementById("dict-list");

// 把資料變成畫面上的詞條
DEAD_WORDS.forEach(function (item) {
  const row = document.createElement("div");
  row.className = "dict-item";

  const word = document.createElement("span");
  word.className = "dict-word";
  word.textContent = item.word;
  // 字太多（超過 5 個字）就縮小，才不會換行
  if (item.word.length > 5) { word.classList.add("long"); }

  const meaning = document.createElement("p");
  meaning.className = "dict-meaning";
  meaning.textContent = item.meaning;

  const example = document.createElement("p");
  example.className = "dict-example";
  example.textContent = "「" + item.example + "」";

  row.appendChild(word);
  row.appendChild(meaning);
  row.appendChild(example);
  dictList.appendChild(row);
});

function scrollDict(step) {
  const max = Math.max(0, DEAD_WORDS.length - VISIBLE_ITEMS);
  dictPosition = dictPosition + step;
  if (dictPosition < 0) { dictPosition = 0; }
  if (dictPosition > max) { dictPosition = max; }
  dictList.style.transform = "translateY(" + (-dictPosition * ITEM_HEIGHT) + "px)";
}

// ---- 長按上下鍵：自動一直滑 ----
const HOLD_DELAY = 350;   // 按住多久（毫秒）才開始自動滑
const HOLD_SPEED = 110;   // 自動滑的時候，每隔幾毫秒滑一個詞條（越小越快）
let holdStart = null;     // 等待開始自動滑的計時器
let holdRepeat = null;    // 自動滑的計時器

function stopHold() {
  clearTimeout(holdStart);
  clearInterval(holdRepeat);
  holdStart = null;
  holdRepeat = null;
  dictList.classList.remove("holding");
}

function startHold(step) {
  stopHold();
  scrollDict(step);                    // 按下去先滑一格
  holdStart = setTimeout(function () { // 按住超過 HOLD_DELAY 就開始一直滑
    dictList.classList.add("holding");
    holdRepeat = setInterval(function () { scrollDict(step); }, HOLD_SPEED);
  }, HOLD_DELAY);
}

// 放開上下鍵就停（router.js 只管按下，放開要自己聽）
document.addEventListener("keyup", function (e) {
  if (e.code === "ArrowDown" || e.code === "ArrowUp") { stopHold(); }
});

registerScreen("dictionary", {
  onEnter: function () {
    dictPosition = 0;
    scrollDict(0);
  },

  onLeave: function () {
    stopHold();
  },

  onKey: function (e) {
    if (e.code === "ArrowDown") { startHold(1); }
    if (e.code === "ArrowUp")   { startHold(-1); }
    if (e.code === "Escape" || e.code === "Space") {
      stopHold();
      WordDrop.play(function () { goTo("home"); }, "green"); // 死語掉下來的轉場（螢光綠）
    }
  }
});
