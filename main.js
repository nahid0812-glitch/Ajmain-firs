const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;
const baseWidth = canvas.width;
const baseHeight = canvas.height;
canvas.width = baseWidth * dpr;
canvas.height = baseHeight * dpr;
canvas.style.width = baseWidth + 'px';
canvas.style.height = baseHeight + 'px';
ctx.scale(dpr, dpr);

const WIDTH = baseWidth;
const HEIGHT = baseHeight;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const timeEl = document.getElementById("time");
const restartBtn = document.getElementById("restart");

const keys = new Set();
let mouseDown = false;

const PLAYER_SPEED = 4.2;
const BULLET_SPEED = 9;
const ENEMY_SPEED = 1.8;
const ENEMY_ACCEL = 0.0025;
const ENEMY_SPAWN = 1200;
const BULLET_COOLDOWN = 180; // ms
const MAX_LIVES = 3;

let lastShot = 0;
let lastSpawn = 0;
let spawnInterval = ENEMY_SPAWN;
let startTime = 0;
let elapsed = 0;

class Player {
  constructor() {
    this.radius = 18;
    this.x = WIDTH / 2;
    this.y = HEIGHT - 80;
  }

  update(delta) {
    let vx = 0;
    let vy = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) vx -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) vx += 1;
    if (keys.has("ArrowUp") || keys.has("w")) vy -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) vy += 1;

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      vx = (vx / len) * PLAYER_SPEED;
      vy = (vy / len) * PLAYER_SPEED;
    }

    this.x = clamp(this.x + vx * delta, this.radius, WIDTH - this.radius);
    this.y = clamp(this.y + vy * delta, this.radius, HEIGHT - this.radius);
  }

  draw() {
    const gradient = ctx.createRadialGradient(
      this.x,
      this.y,
      4,
      this.x,
      this.y,
      this.radius
    );
    gradient.addColorStop(0, "#2ef2ff");
    gradient.addColorStop(1, "#1938ff");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 5;
  }

  update(delta) {
    this.y -= BULLET_SPEED * delta;
    return this.y + this.radius > 0;
  }

  draw() {
    ctx.fillStyle = "#fffd9b";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Enemy {
  constructor() {
    this.radius = 16 + Math.random() * 10;
    this.x = Math.random() * (WIDTH - this.radius * 2) + this.radius;
    this.y = -this.radius;
    this.speed = ENEMY_SPEED + Math.random() * 0.5;
  }

  update(delta) {
    this.speed += ENEMY_ACCEL * delta;
    this.y += this.speed * delta;
    return this.y - this.radius < HEIGHT + 40;
  }

  draw() {
    ctx.fillStyle = "rgba(255, 64, 129, 0.85)";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.life = 1;
    this.radius = 2 + Math.random() * 2;
  }

  update(delta) {
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    this.life -= 0.02 * delta;
    return this.life > 0;
  }

  draw() {
    ctx.fillStyle = `rgba(255, 255, 255, ${this.life})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

const bullets = [];
const enemies = [];
const particles = [];
let player = new Player();
let score = 0;
let lives = MAX_LIVES;
let gameOver = false;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function spawnEnemy(timestamp) {
  if (timestamp - lastSpawn > spawnInterval) {
    enemies.push(new Enemy());
    lastSpawn = timestamp;
    spawnInterval = Math.max(350, spawnInterval * 0.985);
  }
}

function shoot(timestamp) {
  if (timestamp - lastShot < BULLET_COOLDOWN) return;
  bullets.push(new Bullet(player.x, player.y - player.radius));
  lastShot = timestamp;
}

function updateUI() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  timeEl.textContent = (elapsed / 1000).toFixed(1);
  restartBtn.classList.toggle("hidden", !gameOver);
}

function resetGame() {
  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  player = new Player();
  score = 0;
  lives = MAX_LIVES;
  gameOver = false;
  startTime = performance.now();
  lastSpawn = startTime;
  lastShot = 0;
  spawnInterval = ENEMY_SPAWN;
}

function checkCollisions() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    // Player hit
    const distToPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distToPlayer < enemy.radius + player.radius) {
      createExplosion(enemy.x, enemy.y, 20);
      enemies.splice(i, 1);
      lives -= 1;
      if (lives <= 0) {
        gameOver = true;
        endGame();
      }
      continue;
    }

    // Bullet collisions
    for (let j = bullets.length - 1; j >= 0; j--) {
      const bullet = bullets[j];
      const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
      if (dist < enemy.radius + bullet.radius) {
        createExplosion(enemy.x, enemy.y, 30);
        bullets.splice(j, 1);
        enemies.splice(i, 1);
        score += 25;
        break;
      }
    }
  }
}

function createExplosion(x, y, count) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y));
  }
}

function endGame() {
  gameOver = true;
  elapsed = performance.now() - startTime;
  updateUI();
}

let previous = 0;
function loop(timestamp) {
  if (!startTime) {
    startTime = timestamp;
    lastSpawn = timestamp;
  }

  const delta = Math.min(1, (timestamp - previous) / (1000 / 60)) || 1;
  previous = timestamp;

  if (!gameOver) {
    elapsed = timestamp - startTime;
    player.update(delta);
    spawnEnemy(timestamp);

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].update(delta)) {
        bullets.splice(i, 1);
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].update(delta)) {
        enemies.splice(i, 1);
        lives -= 1;
        if (lives <= 0) {
          gameOver = true;
          endGame();
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      if (!particles[i].update(delta)) {
        particles.splice(i, 1);
      }
    }

    checkCollisions();
  }

  draw();
  updateUI();
  requestAnimationFrame(loop);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(10, 7, 26, 0.2)");
  gradient.addColorStop(1, "rgba(12, 5, 18, 0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(46, 242, 255, 0.05)";
  for (let i = 0; i < HEIGHT / 20; i++) {
    ctx.fillRect(0, i * 20, WIDTH, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();

  particles.forEach((p) => p.draw());
  bullets.forEach((b) => b.draw());
  enemies.forEach((e) => e.draw());
  player.draw();

  if (gameOver) {
    ctx.fillStyle = "rgba(5, 1, 10, 0.75)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#f6f8ff";
    ctx.font = "bold 36px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 40);
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillText(`Time: ${(elapsed / 1000).toFixed(1)}s`, WIDTH / 2, HEIGHT / 2 + 30);
    ctx.fillText("Press Restart or Space to try again", WIDTH / 2, HEIGHT / 2 + 70);
  }
}

// Input handlers
document.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.key === " " && !gameOver) {
    shoot(performance.now());
  }
  if (event.key === " " && gameOver) {
    resetGame();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

canvas.addEventListener("mousedown", () => {
  mouseDown = true;
  if (!gameOver) {
    shoot(performance.now());
  }
});

canvas.addEventListener("mouseup", () => {
  mouseDown = false;
});

canvas.addEventListener("mouseleave", () => {
  mouseDown = false;
});

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  mouseDown = true;
  if (!gameOver) {
    shoot(performance.now());
  }
});

canvas.addEventListener("touchend", (event) => {
  event.preventDefault();
  mouseDown = false;
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

function autoFire(timestamp) {
  if (mouseDown && !gameOver) {
    shoot(timestamp);
  }
  requestAnimationFrame(autoFire);
}

resetGame();
requestAnimationFrame(loop);
requestAnimationFrame(autoFire);
