/* ============ 2.0 拍照 ============
   流程：按空白鍵 → P1 開鏡頭、白框閃、倒數 5 秒拍照
         → 自動換 P2 倒數 5 秒拍照 → 自動去背、偵測五官、做成 3D 小人的貼圖
         → 自動跳到 2.1 建模動畫
   注意：鏡頭要用 Live Server（http://localhost）開網頁才能用，
         直接點兩下開 index.html 有些瀏覽器會擋。
   沒有鏡頭或被拒絕時會用替代圖，流程還是可以走完。 */

const PHOTO_SECONDS = 5;          // 每個人倒數幾秒

const photoCountdownEl = document.getElementById("photo-countdown");
const photoHintEl = document.getElementById("photo-hint");

let cameraStream = null;          // 鏡頭畫面
let photoTimer = null;            // 倒數計時器
let photoNextTimer = null;        // 拍完後等一下再換頁的計時器
let photoStarted = false;         // 是否已經按過 空白鍵

// 開鏡頭。成功回傳 true，失敗回傳 false
async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 1280, height: 720 },
      audio: false
    });
    return true;
  } catch (error) {
    console.warn("開不了鏡頭，改用替代圖：", error);
    cameraStream = null;
    return false;
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) { track.stop(); });
    cameraStream = null;
  }
}

// 把鏡頭現在的畫面存成一張直式照片（3:4），回傳 canvas
function takePhoto(video, player) {
  if (!cameraStream || !video.videoWidth) {
    return makePlaceholderPhoto(player);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  // 從影片正中間裁出 3:4 的範圍
  const cropHeight = video.videoHeight;
  const cropWidth = cropHeight * 3 / 4;
  const cropX = (video.videoWidth - cropWidth) / 2;

  // 左右翻轉，照片才會跟預覽時看到的一樣
  ctx.translate(600, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, 0, cropWidth, cropHeight, 0, 0, 600, 800);
  return canvas;
}

// 兩個人都拍完之後：去背、找五官 → 做成貼圖 → 換到建模頁
async function buildModels() {
  photoCountdownEl.classList.add("small");
  photoCountdownEl.textContent = "建模中…";

  // 一個一個做：去背 → 找五官 → 做成貼圖（都在 js/lib/cutout.js）
  GameState.skins.p1 = await Cutout.photoToSkin(GameState.photos.p1);
  GameState.skins.p2 = await Cutout.photoToSkin(GameState.photos.p2);

  // 去背要等一下，如果這段時間已經離開這頁就不要換頁
  if (currentScreen === "photo") {
    photoNextTimer = setTimeout(function () { goTo("model"); }, 600);
  }
}

// 幫一位玩家拍照，拍完後呼叫 whenDone
function shootPlayer(player, whenDone) {
  const frame = document.getElementById("photo-frame-" + player);
  const video = document.getElementById("photo-video-" + player);
  const img = document.getElementById("photo-img-" + player);

  frame.classList.add("active");          // 白框開始閃、顯示鏡頭
  if (cameraStream) {
    video.srcObject = cameraStream;
  }

  let secondsLeft = PHOTO_SECONDS;
  photoCountdownEl.textContent = secondsLeft;

  photoTimer = setInterval(function () {
    secondsLeft = secondsLeft - 1;
    if (secondsLeft > 0) {
      photoCountdownEl.textContent = secondsLeft;
      return;
    }

    // 倒數結束：拍照
    clearInterval(photoTimer);
    const photo = takePhoto(video, player);
    GameState.photos[player] = photo;
    img.src = photo.toDataURL("image/jpeg", 0.9);
    video.srcObject = null;
    frame.classList.remove("active");
    frame.classList.add("done");
    whenDone();
  }, 1000);
}

async function startPhotoFlow() {
  photoStarted = true;
  photoHintEl.classList.add("hidden");
  await openCamera();

  // 開鏡頭要等使用者按「允許」，如果這段時間已經離開這頁就不要繼續
  if (currentScreen !== "photo") {
    closeCamera();
    return;
  }

  shootPlayer("p1", function () {
    shootPlayer("p2", function () {
      closeCamera();
      buildModels();
    });
  });
}

registerScreen("photo", {
  onEnter: function () {
    // 每次進來都恢復成還沒拍的樣子
    photoStarted = false;
    photoCountdownEl.textContent = "";
    photoCountdownEl.classList.remove("small");
    Cutout.preload();   // 趁玩家在倒數的時候，先把去背模型載好
    photoHintEl.classList.remove("hidden");
    ["p1", "p2"].forEach(function (player) {
      document.getElementById("photo-frame-" + player).classList.remove("active", "done");
    });
  },

  onLeave: function () {
    clearInterval(photoTimer);
    clearTimeout(photoNextTimer);
    closeCamera();
  },

  onKey: function (e) {
    if (e.code === "Space" && !photoStarted) {
      startPhotoFlow();
    }
  }
});
