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

registerScreen("dictionary", {
  onEnter: function () {
    dictPosition = 0;
    scrollDict(0);
  },

  onKey: function (e) {
    if (e.code === "ArrowDown") { scrollDict(1); }
    if (e.code === "ArrowUp")   { scrollDict(-1); }
    if (e.code === "Escape" || e.code === "Space") { goTo("home"); }
  }
});
