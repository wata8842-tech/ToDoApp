(() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const stageEl = document.getElementById("stage");

  const W = canvas.width;
  const H = canvas.height;

  const COLS = 8;
  const BRICK_GAP = 6;
  const BRICK_TOP = 70;
  const BRICK_H = 20;
  const BRICK_W = (W - BRICK_GAP * (COLS + 1)) / COLS;
  const ROW_COLORS = ["#ef476f", "#f78c6b", "#ffd166", "#06d6a0", "#118ab2", "#8e7dbe"];

  const paddle = { w: 90, h: 12, x: (W - 90) / 2, y: H - 40, speed: 7 };
  const ball = { r: 7, x: 0, y: 0, dx: 0, dy: 0 };

  let bricks = [];
  let score = 0;
  let lives = 3;
  let stage = 1;
  // ready: 発射待ち / playing: プレイ中 / paused: 一時停止 / over: ゲームオーバー
  let state = "ready";
  const keys = { left: false, right: false };

  function buildBricks() {
    const rows = Math.min(3 + stage, ROW_COLORS.length);
    bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: BRICK_GAP + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          color: ROW_COLORS[r],
          points: (rows - r) * 10,
          alive: true,
        });
      }
    }
  }

  function resetBall() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
    ball.dx = 0;
    ball.dy = 0;
    state = "ready";
  }

  function launch() {
    const speed = 4 + stage * 0.5;
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
    ball.dx = speed * Math.sin(angle);
    ball.dy = -speed * Math.cos(angle);
    state = "playing";
  }

  function newGame() {
    score = 0;
    lives = 3;
    stage = 1;
    buildBricks();
    resetBall();
    updateStatus();
  }

  function updateStatus() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    stageEl.textContent = stage;
  }

  function handleAction() {
    if (state === "ready") launch();
    else if (state === "playing") state = "paused";
    else if (state === "paused") state = "playing";
    else if (state === "over") newGame();
  }

  function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
  }

  function update() {
    if (keys.left) paddle.x = Math.max(0, paddle.x - paddle.speed);
    if (keys.right) paddle.x = Math.min(W - paddle.w, paddle.x + paddle.speed);

    if (state === "ready") {
      ball.x = paddle.x + paddle.w / 2;
      return;
    }
    if (state !== "playing") return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    // 壁
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.dx = Math.abs(ball.dx); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.dx = -Math.abs(ball.dx); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.dy = Math.abs(ball.dy); }

    // パドル（当たった位置で反射角を変える）
    if (
      ball.dy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y - ball.r <= paddle.y + paddle.h &&
      ball.x >= paddle.x - ball.r &&
      ball.x <= paddle.x + paddle.w + ball.r
    ) {
      const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const angle = Math.max(-1, Math.min(1, hit)) * (60 * Math.PI / 180);
      const speed = Math.hypot(ball.dx, ball.dy);
      ball.dx = speed * Math.sin(angle);
      ball.dy = -speed * Math.cos(angle);
      ball.y = paddle.y - ball.r;
    }

    // ブロック
    for (const b of bricks) {
      if (!b.alive) continue;
      const nearX = Math.max(b.x, Math.min(ball.x, b.x + BRICK_W));
      const nearY = Math.max(b.y, Math.min(ball.y, b.y + BRICK_H));
      const distX = ball.x - nearX;
      const distY = ball.y - nearY;
      if (distX * distX + distY * distY > ball.r * ball.r) continue;

      b.alive = false;
      score += b.points;
      if (Math.abs(distX) > Math.abs(distY)) ball.dx = -ball.dx;
      else ball.dy = -ball.dy;
      updateStatus();
      break;
    }

    if (bricks.every((b) => !b.alive)) {
      stage++;
      buildBricks();
      resetBall();
      updateStatus();
      return;
    }

    // 落下
    if (ball.y - ball.r > H) {
      lives--;
      updateStatus();
      if (lives <= 0) state = "over";
      else resetBall();
    }
  }

  function drawMessage(title, sub) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, H / 2 - 60, W, 120);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText(title, W / 2, H / 2 - 5);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 4);
      ctx.fill();
    }

    ctx.fillStyle = "#e8e8f0";
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    if (state === "ready") drawMessage(`ステージ ${stage}`, "スペース / クリックで発射");
    if (state === "paused") drawMessage("一時停止", "スペース / クリックで再開");
    if (state === "over") drawMessage("ゲームオーバー", `スコア ${score}　クリックでもう一度`);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key === " ") {
      e.preventDefault();
      handleAction();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });
  canvas.addEventListener("mousemove", (e) => movePaddleTo(e.clientX));
  canvas.addEventListener("click", handleAction);
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    movePaddleTo(e.touches[0].clientX);
  }, { passive: false });

  newGame();
  loop();
})();
