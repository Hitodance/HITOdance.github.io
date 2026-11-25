/* ============ 1.0 引言 ============
   文字在 js/data.js 的 INTRO_TEXT，一般的字是打字機效果，一個字一個字出現；
   打到死語（INTRO_KTV_WORDS）的時候，整個詞先出現成白色，
   再像 KTV 字幕一樣，螢光粉色從左到右「唱過去」填滿，填完才繼續打後面的字。
   還在打字時按空白鍵 → 直接顯示全部；打完再按空白鍵 → 下一頁 */

// 引言裡要做成 KTV 效果的死語（照順序寫在這裡；同一個詞出現好幾次都會有效果）
const INTRO_KTV_WORDS = ["哇哩勒", "LKK", "叭噗啦", "QAQ", "不哭不哭眼淚是珍珠", "HITO", "ㄅㄧㄤˋ", "XD", "俗斃斃"];
const INTRO_TYPE_MS = 45;    // 一般的字：每隔幾毫秒打一個字（越小越快）
const INTRO_KTV_MS = 240;    // KTV 死語：每個字填色要幾毫秒（越小填得越快）
const INTRO_KTV_PAUSE = 200; // 死語填完之後，停幾毫秒再繼續打字

const introTextEl = document.getElementById("intro-text");
const introJoyEl = document.getElementById("intro-joy");
let introTimer = null;
let introDone = false;
let introSteps = [];   // 一步一步要顯示的東西：一般的字，或是一整個死語

// 把 INTRO_TEXT 拆成「一般的字」和「死語」，做成畫面上的 span（先全部藏起來）
function buildIntro() {
  introTextEl.textContent = "";
  introSteps = [];
  const words = INTRO_KTV_WORDS.slice().sort((a, b) => b.length - a.length); // 長的先比對
  let i = 0;
  while (i < INTRO_TEXT.length) {
    const word = words.find((w) => INTRO_TEXT.startsWith(w, i));
    if (word) {
      const span = document.createElement("span");
      span.className = "ktv";
      span.dataset.text = word;   // 粉色那一層的字（css 的 ::after 會用到）
      span.textContent = word;
      span.style.setProperty("--ktv-time", word.length * INTRO_KTV_MS + "ms");
      introTextEl.appendChild(span);
      introSteps.push({ el: span, ktv: true, len: word.length });
      i += word.length;
    } else {
      const ch = INTRO_TEXT[i];
      if (ch === "\n") {
        introTextEl.appendChild(document.createTextNode("\n"));
      } else {
        const span = document.createElement("span");
        span.className = "ch";
        span.textContent = ch;
        introTextEl.appendChild(span);
        introSteps.push({ el: span, ktv: false });
      }
      i += 1;
    }
  }
}

// 顯示第 index 步，然後排下一步
function playIntroStep(index) {
  if (index >= introSteps.length) {
    finishIntro();
    return;
  }
  const step = introSteps[index];
  step.el.classList.add("shown");
  if (step.ktv) {
    step.el.classList.add("sing");   // 開始填粉色
    introTimer = setTimeout(function () {
      playIntroStep(index + 1);
    }, step.len * INTRO_KTV_MS + INTRO_KTV_PAUSE);
  } else {
    introTimer = setTimeout(function () {
      playIntroStep(index + 1);
    }, INTRO_TYPE_MS);
  }
}

function finishIntro() {
  clearTimeout(introTimer);
  introSteps.forEach(function (step) {
    step.el.classList.add("shown");
    if (step.ktv) { step.el.classList.add("sung"); }   // 直接全部填滿粉色
  });
  introJoyEl.classList.add("show");   // 字跑完，歡樂一百點出場
  introDone = true;
}

registerScreen("intro", {
  onEnter: function () {
    introDone = false;
    introJoyEl.classList.remove("show");   // 先藏起來，動畫下次才會重播
    buildIntro();
    playIntroStep(0);
  },

  onLeave: function () {
    clearTimeout(introTimer);
  },

  onKey: function (e) {
    if (e.code !== "Space") { return; }
    if (introDone) {
      goTo("photo");
    } else {
      finishIntro();
    }
  }
});
