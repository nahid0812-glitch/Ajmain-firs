const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const overlayEl = document.getElementById("overlay");
const messageEl = document.getElementById("modal-message");
const restartBtn = document.getElementById("restart");

const PLAYER = {
  width: 36,
  height: 36,
  speed: 320,
  reloadTime: 200,
  color: "#38bdf8",
};

const BULLET = {
  width: 6,
  height: 16,
  speed: 540,
  color: "#facc15",
};

const ENEMY = {
  width: 34,
  height: 34,
  minSpeed: 80,
  maxSpeed: 180,
  color: "#f87171",
};

const STAR_COUNT = 90;
const STARS = [];

const keys = new Map();
let shootHeld = false;

const state = {
  player: null,
  bullets: [],
  enemies: [],
  lastShot: 0,
  spawnTimer: 0,
  spawnInterval: 1500,
  time: 0,
  score: 0,
  lives: 3,
  wave: 1,
  running: true,
};

function initPlayer() {
  state.player = {
    x: canvas.width / 2 - PLAYER.width / 2,
    y: canvas.height - PLAYER.height - 30,
    vx: 0,
    vy: 0,
  };
}

function initStars() {
  STARS.length = 0;
  for (let i = 0; i < STAR_COUNT; i += 1) {
    STARS.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 20 + Math.random() * 60,
      size: Math.random() * 1.8 + 0.2,
    });
  }
}

function resetGame() {
  state.bullets = [];
  state.enemies = [];
  state.lastShot = 0;
  state.spawnTimer = 0;
  state.spawnInterval = 1500;
  state.time = 0;
  state.score = 0;
  state.lives = 3;
  state.wave = 1;
  state.running = true;
  shootHeld = false;
  initPlayer();
  initStars();
  overlayEl.hidden = true;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  waveEl.textContent = state.wave;
}

function handleKeydown(event) {
  keys.set(event.code, true);
  if (event.code === "Space" || event.code === "Enter") {
    shootHeld = true;
  }
}

function handleKeyup(event) {
  keys.set(event.code, false);
  if (event.code === "Space" || event.code === "Enter") {
    shootHeld = false;
  }
}

document.addEventListener("keydown", handleKeydown);
document.addEventListener("keyup", handleKeyup);
restartBtn.addEventListener("click", resetGame);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spawnEnemy() {
  const speed = ENEMY.minSpeed + Math.random() * (ENEMY.maxSpeed + state.wave * 12 - ENEMY.minSpeed);
  const padding = 20;
  const x = padding + Math.random() * (canvas.width - ENEMY.width - padding * 2);
  const enemy = {
    x,
    y: -ENEMY.height,
    speed,
  };
  state.enemies.push(enemy);
}

function maybeIncreaseWave() {
  const nextWaveScore = state.wave * 500;
  if (state.score >= nextWaveScore) {
    state.wave += 1;
    state.spawnInterval = Math.max(450, state.spawnInterval * 0.9);
    ENEMY.minSpeed += 5;
    ENEMY.maxSpeed += 6;
    updateHud();
  }
}

function shoot(time) {
  if (time - state.lastShot < PLAYER.reloadTime) {
    return;
  }

  state.lastShot = time;
  const bulletX = state.player.x + PLAYER.width / 2 - BULLET.width / 2;
  const bulletY = state.player.y - BULLET.height;
  state.bullets.push({ x: bulletX, y: bulletY });
}

function updatePlayer(delta) {
  if (!state.player) return;

  let dirX = 0;
  let dirY = 0;
  if (keys.get("ArrowLeft") || keys.get("KeyA")) dirX -= 1;
  if (keys.get("ArrowRight") || keys.get("KeyD")) dirX += 1;
  if (keys.get("ArrowUp") || keys.get("KeyW")) dirY -= 1;
  if (keys.get("ArrowDown") || keys.get("KeyS")) dirY += 1;

  const length = Math.hypot(dirX, dirY) || 1;
  state.player.x += (dirX / length) * PLAYER.speed * delta;
  state.player.y += (dirY / length) * PLAYER.speed * delta;

  state.player.x = clamp(state.player.x, 12, canvas.width - PLAYER.width - 12);
  state.player.y = clamp(state.player.y, canvas.height * 0.4, canvas.height - PLAYER.height - 16);

  if (shootHeld) {
    shoot(state.time);
  }
}

function updateBullets(delta) {
  state.bullets.forEach((bullet) => {
    bullet.y -= BULLET.speed * delta;
  });
  state.bullets = state.bullets.filter((bullet) => bullet.y + BULLET.height > 0);
}

function updateEnemies(delta) {
  state.enemies.forEach((enemy) => {
    enemy.y += enemy.speed * delta;
  });

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.y > canvas.height) {
      state.lives -= 1;
      updateHud();
      if (state.lives <= 0) {
        endGame("The galaxy fell to the invaders.");
      }
      return false;
    }
    return true;
  });
}

function updateStars(delta) {
  STARS.forEach((star) => {
    star.y += star.speed * delta;
    if (star.y > canvas.height) {
      star.y = -5;
      star.x = Math.random() * canvas.width;
    }
  });
}

function checkCollisions() {
  const enemies = state.enemies;
  const bullets = state.bullets;
  const player = state.player;

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];

    // Player collision
    if (
      player &&
      player.x < enemy.x + ENEMY.width &&
      player.x + PLAYER.width > enemy.x &&
      player.y < enemy.y + ENEMY.height &&
      player.y + PLAYER.height > enemy.y
    ) {
      enemies.splice(i, 1);
      state.lives -= 1;
      updateHud();
      if (state.lives <= 0) {
        endGame("Your ship was destroyed in the crossfire.");
      }
      continue;
    }

    // Bullet collision
    for (let j = bullets.length - 1; j >= 0; j -= 1) {
      const bullet = bullets[j];
      if (
        bullet.x < enemy.x + ENEMY.width &&
        bullet.x + BULLET.width > enemy.x &&
        bullet.y < enemy.y + ENEMY.height &&
        bullet.y + BULLET.height > enemy.y
      ) {
        bullets.splice(j, 1);
        enemies.splice(i, 1);
        state.score += 50;
        updateHud();
        maybeIncreaseWave();
        break;
      }
    }
  }
}

function endGame(message) {
  state.running = false;
  overlayEl.hidden = false;
  messageEl.textContent = `${message} Final score: ${state.score}.`;
}

function clearCanvas() {
  ctx.fillStyle = "rgba(3, 7, 18, 0.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStars() {
  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  STARS.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  if (!state.player) return;
  const { x, y } = state.player;
  ctx.fillStyle = PLAYER.color;
  ctx.beginPath();
  ctx.moveTo(x + PLAYER.width / 2, y);
  ctx.lineTo(x, y + PLAYER.height);
  ctx.lineTo(x + PLAYER.width, y + PLAYER.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(14, 165, 233, 0.4)";
  ctx.fillRect(x + PLAYER.width / 2 - 4, y + PLAYER.height - 4, 8, 12);
}

function drawBullets() {
  ctx.fillStyle = BULLET.color;
  state.bullets.forEach((bullet) => {
    ctx.fillRect(bullet.x, bullet.y, BULLET.width, BULLET.height);
  });
}

function drawEnemies() {
  ctx.fillStyle = ENEMY.color;
  state.enemies.forEach((enemy) => {
    ctx.beginPath();
    ctx.rect(enemy.x, enemy.y, ENEMY.width, ENEMY.height);
    ctx.fill();

    ctx.fillStyle = "rgba(248, 113, 113, 0.35)";
    ctx.fillRect(enemy.x + ENEMY.width / 2 - 5, enemy.y + ENEMY.height, 10, 12);
    ctx.fillStyle = ENEMY.color;
  });
}

function gameLoop(timestamp) {
  if (!state.running) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const delta = (timestamp - state.time) / 1000;
  state.time = timestamp;

  clearCanvas();
  updateStars(delta);
  drawStars();

  updatePlayer(delta);
  updateBullets(delta);
  updateEnemies(delta);
  checkCollisions();

  drawBullets();
  drawEnemies();
  drawPlayer();

  state.spawnTimer += delta * 1000;
  if (state.spawnTimer > state.spawnInterval) {
    spawnEnemy();
    state.spawnTimer = 0;
  }

  requestAnimationFrame(gameLoop);
}

// Setup
resetGame();
requestAnimationFrame(gameLoop);
