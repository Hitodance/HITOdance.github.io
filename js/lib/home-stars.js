/* =========================================================
   home-stars.js — 首頁的霓虹星星：留在原位，全部往同一個方向慢慢轉

   旋轉的動畫在 css/screens.css 的 @keyframes home-star-spin。
   想調整的數字都在下面的 STARS。
   ========================================================= */

const HomeStars = (function () {
  const STARS = {
    seconds: 6,        // 轉一圈要幾秒（越小轉越快）
    clockwise: true,   // true = 順時針、false = 逆時針
  };

  // 全部同時開始、同速度同方向轉：疊在一起的星星（star-3 和裡面的 star-4、star-5 和裡面的 star-6）角度才會一直對齊，不會互相碰到。
  // 星星之間的距離已經算好，整圈轉下來都不會碰到彼此；如果改了星星大小或位置，要注意別讓它們靠太近
  document.querySelectorAll(".home-star").forEach(function (star) {
    star.style.transform = "";
    star.style.transition = "";
    star.style.animation =
      "home-star-spin " + STARS.seconds + "s linear infinite" + (STARS.clockwise ? "" : " reverse");
  });

  return { STARS: STARS };
})();
