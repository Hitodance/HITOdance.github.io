/* =========================================================
   marquee.js — 首頁、拍照頁、著裝完成頁最上面的跑馬燈

   用法：在 index.html 寫 <div class="marquee-bar">要跑的文字</div>
   這個檔案會把裡面的文字重複很多次，變成一直往左跑的跑馬燈。
   樣子（顏色、字級、上下的線）跟舞台／音樂選擇頁的跑馬燈共用，
   在 css/screens.css 搜尋 select-title 就找得到。
   ========================================================= */

// 跑馬燈的速度（每秒往左跑幾 px）。所有頁面的跑馬燈（包含選擇頁）都用這個速度，
// 這樣不管字長字短，看起來都一樣快。數字越大跑越快
const MARQUEE_SPEED = 123;

document.querySelectorAll(".marquee-bar").forEach(function (bar) {
  const text = bar.textContent.trim();
  const marquee = document.createElement("div");
  marquee.className = "select-marquee";

  // 前 20 個和後 20 個一模一樣，跑完一半剛好接回開頭，看不出斷點
  for (let i = 0; i < 40; i++) {
    const span = document.createElement("span");
    span.textContent = text;
    marquee.appendChild(span);
  }

  bar.textContent = "";
  bar.appendChild(marquee);
});

// 依照字的長度算出要跑幾秒，速度才會一樣。
// 畫面還沒顯示的頁面量不到寬度，所以複製一份放到畫面外面量
function setMarqueeSpeed() {
  document.querySelectorAll(".select-title, .marquee-bar").forEach(function (bar) {
    const track = bar.querySelector(".select-marquee");
    if (!track) { return; }
    const copy = bar.cloneNode(true);
    copy.style.position = "absolute";
    copy.style.left = "-99999px";
    copy.style.top = "0";
    copy.style.visibility = "hidden";
    document.body.appendChild(copy);
    const half = copy.querySelector(".select-marquee").offsetWidth / 2;   // 跑一輪 = 一半的長度
    copy.remove();
    if (half > 0) {
      track.style.animationDuration = (half / MARQUEE_SPEED).toFixed(2) + "s";
    }
  });
}
// 字體載好之後字的寬度才準，所以等字體載好再量一次
setTimeout(setMarqueeSpeed, 0);
if (document.fonts) {
  document.fonts.ready.then(setMarqueeSpeed);
}
