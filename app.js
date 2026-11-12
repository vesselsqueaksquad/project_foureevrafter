const bubbleField = document.querySelector('#bubbleField');
const statusText = document.querySelector('#statusText');
const presenceTitle = document.querySelector('#presenceTitle');
const presenceDetail = document.querySelector('#presenceDetail');
const gameOver = document.querySelector('#gameOver');
const gameOverTimer = document.querySelector('#gameOverTimer');
const hazardGameOver = document.querySelector('#hazardGameOver');
const hazardGameOverTimer = document.querySelector('#hazardGameOverTimer');
const hpGameOver = document.querySelector('#hpGameOver');
const hpGameOverTimer = document.querySelector('#hpGameOverTimer');
const winScreen = document.querySelector('#winScreen');
const goEndless = document.querySelector('#goEndless');
const cackleAudio = new Audio('/cackle.mp3');
cackleAudio.preload = 'auto';
const scoreValue = document.querySelector('#scoreValue');
const comboValue = document.querySelector('#comboValue');
const comboPoints = document.querySelector('#comboPoints');
const comboMeter = document.querySelector('.combo-meter');
const comboMeterFill = document.querySelector('#comboMeterFill');
const frenzyStatus = document.querySelector('#frenzyStatus');
const frenzySeconds = document.querySelector('#frenzySeconds');
const frenzyMeter = document.querySelector('.frenzy-meter');
const frenzyMeterFill = document.querySelector('#frenzyMeterFill');
const hpValue = document.querySelector('#hpValue');
const hpMeter = document.querySelector('.hp-meter');
const hpMeterFill = document.querySelector('#hpMeterFill');
const tutorialWindow = document.querySelector('.tutorial-window');
const tutorialToggle = document.querySelector('#tutorialToggle');
let socket;
let gameOverUntil = 0;
let gameOverInterval;
let hazardGameOverInterval;
let hpGameOverInterval;
let comboInterval;
let frenzyInterval;
let score = 0;
let combo = 0;
let comboExpiresAt = 0;
let frenzyExpiresAt = 0;
let hp = 100;
let endlessMode = false;
const popAudio = new Audio('/pop.mp3');
popAudio.preload = 'auto';
const comboWindow = 7000;
const frenzyWindow = 10000;
const gobliDamageMin = 5;
const gobliDamageMax = 15;

tutorialToggle.addEventListener('click', () => {
  const minimized = tutorialWindow.classList.toggle('is-minimized');
  tutorialToggle.textContent = minimized ? '+' : '−';
  tutorialToggle.setAttribute('aria-expanded', String(!minimized));
  tutorialToggle.setAttribute('aria-label', minimized ? 'Expand bubble guide' : 'Minimize bubble guide');
});

goEndless.addEventListener('click', () => {
  endlessMode = true;
  winScreen.hidden = true;
  if (gameOver.hidden && hazardGameOver.hidden && hpGameOver.hidden) {
    document.body.classList.remove('game-is-over');
  }
});

function renderHp() {
  hpValue.textContent = `${hp} / 100`;
  hpMeterFill.style.transform = `scaleX(${hp / 100})`;
  hpMeter.setAttribute('aria-valuenow', String(hp));
  hpMeter.classList.toggle('is-low', hp <= 25);
}

function takeGobliDamage() {
  if (!gameOver.hidden || !hazardGameOver.hidden || !hpGameOver.hidden || !winScreen.hidden) return;
  const damage = Math.floor(Math.random() * (gobliDamageMax - gobliDamageMin + 1)) + gobliDamageMin;
  hp = Math.max(0, hp - damage);
  renderHp();
  if (hp === 0 && hpGameOver.hidden) showHpGameOver();
}

function healFromGobli() {
  hp = Math.min(100, hp + 1);
  renderHp();
}

function resetFrenzy() {
  frenzyExpiresAt = 0;
  clearInterval(frenzyInterval);
  updateDangerVisuals();
  renderFrenzy();
}

function resetRun() {
  score = 0;
  resetCombo();
  resetFrenzy();
  hp = 100;
  renderHp();
  document.body.classList.remove('has-started');
  endlessMode = false;
  winScreen.hidden = true;
}

function playPopSound() {
  popAudio.currentTime = 0;
  popAudio.play().catch(() => {});
}

function playCackleSound() {
  cackleAudio.currentTime = 0;
  cackleAudio.play().catch(() => {});
}

function isFrenzyActive() {
  return frenzyExpiresAt > Date.now();
}

function updateDangerVisuals() {
  bubbleField.querySelectorAll('[data-dangerous="true"]').forEach((bubble) => {
    if (!bubble.classList.contains('claimed')) {
      bubble.classList.toggle('dangerous', !isFrenzyActive());
    }
  });
}

function renderFrenzy() {
  const seconds = Math.max(0, Math.ceil((frenzyExpiresAt - Date.now()) / 1000));
  const active = seconds > 0;
  frenzyStatus.hidden = !active;
  frenzySeconds.textContent = `${seconds}s`;
  frenzyMeterFill.style.transform = `scaleX(${seconds / 10})`;
  frenzyMeter.setAttribute('aria-valuenow', String(seconds));
  document.body.classList.toggle('frenzy-active', active);
}

function activateFrenzy() {
  frenzyExpiresAt = Date.now() + frenzyWindow;
  updateDangerVisuals();
  clearInterval(frenzyInterval);
  frenzyInterval = setInterval(() => {
    if (!isFrenzyActive()) {
      clearInterval(frenzyInterval);
      frenzyExpiresAt = 0;
      updateDangerVisuals();
    }
    renderFrenzy();
  }, 100);
  renderFrenzy();
}

function makeGobliFall(bubble) {
  const bounds = bubble.getBoundingClientRect();
  const gobli = document.createElement('img');
  gobli.className = 'falling-gobli';
  gobli.src = 'gobli.png';
  gobli.alt = '';
  gobli.setAttribute('aria-hidden', 'true');
  gobli.style.left = `${bounds.left + bounds.width / 2}px`;
  gobli.style.top = `${bounds.top + bounds.height / 2}px`;
  gobli.style.width = `${Math.max(28, bounds.width * 0.56)}px`;
  gobli.style.setProperty('--fall-distance', `${window.innerHeight - bounds.top + 100}px`);
  bubbleField.appendChild(gobli);
  window.setTimeout(() => gobli.remove(), 1200);
}

function renderScore() {
  scoreValue.textContent = String(score).padStart(6, '0');
  comboValue.textContent = `Combo x${combo}`;
  comboPoints.textContent = combo > 0 ? `+${10 * combo}` : '+0';
  const remaining = Math.max(0, comboExpiresAt - Date.now());
  const progress = combo > 0 ? remaining / comboWindow : 0;
  comboMeterFill.style.transform = `scaleX(${progress})`;
  comboMeter.setAttribute('aria-valuenow', String(Math.ceil(remaining / 1000)));
  comboMeter.classList.toggle('is-hot', combo > 0);
}

function resetCombo() {
  combo = 0;
  comboExpiresAt = 0;
  clearInterval(comboInterval);
  renderScore();
  if (!endlessMode && score >= 30000 && winScreen.hidden) {
    winScreen.hidden = false;
    document.body.classList.add('game-is-over');
  }
}

function registerPop() {
  if (comboExpiresAt && Date.now() >= comboExpiresAt) combo = 0;
  combo += 1;
  score += 10 * combo;
  comboExpiresAt = Date.now() + comboWindow;
  clearInterval(comboInterval);
  comboInterval = setInterval(() => {
    if (Date.now() >= comboExpiresAt) resetCombo();
    else renderScore();
  }, 100);
  renderScore();
}

function bubbleLifetimeForScore() {
  if (score < 12000) {
    const steps = Math.floor(score / 3000);
    return 3.2 - (steps * 0.3);
  }
  if (score < 24000) {
    const steps = Math.floor((score - 12000) / 2000);
    return 2 - (steps / 6);
  }
  const steps = Math.floor((score - 24000) / 1000);
  return Math.max(0.35, 1 - (steps * 0.02));
}

function showBubble(data) {
  if (bubbleField.querySelector(`[data-id="${data.id}"]`)) return;
  const bubble = document.createElement('button');
  bubble.className = 'floating-bubble';
  if (data.dangerous && !isFrenzyActive()) bubble.classList.add('dangerous');
  if (data.golden) bubble.classList.add('golden');
  bubble.type = 'button';
  bubble.dataset.id = data.id;
  bubble.dataset.dangerous = data.dangerous ? 'true' : 'false';
  const hasGobli = !data.dangerous && !data.golden && Math.random() < (1 / 3);
  bubble.dataset.hasGobli = hasGobli ? 'true' : 'false';
  bubble.setAttribute('aria-label', data.dangerous ? 'Danger bubble' : data.golden ? 'Golden frenzy bubble' : 'Pop bubble');
  bubble.style.setProperty('--size', `${data.size}px`);
  bubble.style.left = `${data.x}%`;
  bubble.style.top = `${data.y}%`;
  bubble.style.setProperty('--drift-x', `${data.driftX}px`);
  bubble.style.setProperty('--drift-y', `${data.driftY}px`);
  if (hasGobli) {
    const gobli = document.createElement('img');
    gobli.className = 'bubble-gobli';
    gobli.src = 'gobli.png';
    gobli.alt = '';
    gobli.setAttribute('aria-hidden', 'true');
    gobli.draggable = false;
    bubble.appendChild(gobli);
  }
  bubble.addEventListener('click', () => popBubble(bubble));
  bubble.addEventListener('mouseenter', () => {
    if (isFrenzyActive()) popBubble(bubble);
  });
  bubbleField.appendChild(bubble);
  const serverLifetime = data.expiresAt ? Math.max(0, data.expiresAt - Date.now()) / 1000 : 3.2;
  const localLifetime = bubbleLifetimeForScore();
  window.setTimeout(() => removeBubble(bubble), Math.min(serverLifetime, localLifetime) * 1000);
}

function popBubble(bubble) {
  if (Date.now() < gameOverUntil || bubble.classList.contains('claimed') || bubble.classList.contains('bursting') || bubble.classList.contains('fading')) return;
  document.body.classList.add('has-started');
  playPopSound();
  bubble.classList.add('claimed');
  if (bubble.dataset.hasGobli === 'true') {
    makeGobliFall(bubble);
    healFromGobli();
  }
  bubble.setAttribute('aria-label', bubble.classList.contains('dangerous') ? 'Danger bubble popped' : 'Bubble already popped by another player');
  if (bubble.classList.contains('dangerous')) {
    showHazardGameOver();
  } else if (bubble.classList.contains('golden')) {
    activateFrenzy();
  } else {
    registerPop();
  }
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'pop', id: Number(bubble.dataset.id) }));
  bubble.remove();
}

function burstBubble(bubble) {
  if (!bubble.isConnected || bubble.classList.contains('bursting')) return;
  bubble.classList.add('bursting');
  window.setTimeout(() => bubble.remove(), 180);
}

function removeBubble(bubble) {
  if (bubble.dataset.hasGobli === 'true' && !bubble.classList.contains('claimed') && bubble.dataset.damageApplied !== 'true') {
    bubble.dataset.damageApplied = 'true';
    takeGobliDamage();
  }
  if (bubble.isConnected && !bubble.classList.contains('bursting')) bubble.classList.add('fading');
  window.setTimeout(() => bubble.remove(), 260);
}

function connect() {
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  socket.addEventListener('open', () => {
    document.body.classList.add('is-connected');
    statusText.textContent = 'Shared';
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.type === 'state') {
      message.bubbles?.forEach(showBubble);
      updatePresence(message.count);
      if (message.gameOverRemaining > 0) showGameOver(message.gameOverRemaining);
    }
    if (message.type === 'bubble') showBubble(message);
    if (message.type === 'game-over') showGameOver(message.remaining);
    if (message.type === 'presence') updatePresence(message.count);
  });
  socket.addEventListener('close', () => {
    document.body.classList.remove('is-connected');
    statusText.textContent = 'Reconnecting';
    updatePresence(0);
    setTimeout(connect, 1200);
  });
  socket.addEventListener('error', () => { statusText.textContent = 'Reconnecting'; });
}

function showGameOver(duration = 5000) {
  playCackleSound();
  resetRun();
  gameOverUntil = Date.now() + duration;
  gameOver.hidden = false;
  document.body.classList.add('game-is-over');
  clearInterval(gameOverInterval);
  const updateTimer = () => {
    const seconds = Math.max(0, Math.ceil((gameOverUntil - Date.now()) / 1000));
    gameOverTimer.textContent = `Back in ${seconds}`;
    if (seconds <= 0) {
      clearInterval(gameOverInterval);
      gameOver.hidden = true;
      if (hazardGameOver.hidden) document.body.classList.remove('game-is-over');
    }
  };
  updateTimer();
  gameOverInterval = setInterval(updateTimer, 250);
}

function showHazardGameOver(duration = 5000) {
  playCackleSound();
  resetRun();
  const hazardGameOverUntil = Date.now() + duration;
  hazardGameOver.hidden = false;
  document.body.classList.add('game-is-over');
  clearInterval(hazardGameOverInterval);
  const updateTimer = () => {
    const seconds = Math.max(0, Math.ceil((hazardGameOverUntil - Date.now()) / 1000));
    hazardGameOverTimer.textContent = `Back in ${seconds}`;
    if (seconds <= 0) {
      clearInterval(hazardGameOverInterval);
      hazardGameOver.hidden = true;
      if (gameOver.hidden) document.body.classList.remove('game-is-over');
    }
  };
  updateTimer();
  hazardGameOverInterval = setInterval(updateTimer, 250);
}

function showHpGameOver(duration = 5000) {
  playCackleSound();
  resetRun();
  hpGameOver.hidden = false;
  document.body.classList.add('game-is-over');
  clearInterval(hpGameOverInterval);
  const hpGameOverUntil = Date.now() + duration;
  const updateTimer = () => {
    const seconds = Math.max(0, Math.ceil((hpGameOverUntil - Date.now()) / 1000));
    hpGameOverTimer.textContent = `Back in ${seconds}`;
    if (seconds <= 0) {
      clearInterval(hpGameOverInterval);
      hpGameOver.hidden = true;
      if (gameOver.hidden && hazardGameOver.hidden) document.body.classList.remove('game-is-over');
    }
  };
  updateTimer();
  hpGameOverInterval = setInterval(updateTimer, 250);
}

function updatePresence(count) {
  if (count > 0) {
    presenceTitle.textContent = `${count} ${count === 1 ? 'person is' : 'people are'} fighting`;
    presenceDetail.textContent = `${count} open tab${count === 1 ? '' : 's'} fighting evil larry spawns`;
  } else {
    presenceTitle.textContent = 'Opening the battlefield…';
    presenceDetail.textContent = 'EVIL LARRY SPAWNS APPEAR';
  }
}

connect();
