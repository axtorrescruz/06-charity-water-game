/* Hamon: Ripple Effect
   Updated: drops use inline SVG teardrop shapes (larger semicircle base at bottom,
   rounded point at top). Polluted drops ripple & disappear when clicked but still
   spawn a red X penalty.

   Modifications:
   - clouds lowered slightly via CSS
   - spawn & fall speed double each time score reaches a multiple of 10 (10,20,...)
   - added footer placeholders in HTML/CSS
   - added halfway message shown when score reaches half of MAX_SCORE
*/

(() => {
  const NUM_CLOUDS = 6;
  const BASE_SPAWN_INTERVAL = 3000; // base: one drop every 3 seconds total
  const BASE_DROP_DURATION = 3000;  // base ms for drop to fall
  const CLEAN_PROB = 0.66;
  const MAX_SCORE = 30;
  const MAX_X = 3;

  // dynamic speed state
  let speedMultiplier = 1; // 1, 2, 4, ... doubles each interval-of-10
  let spawnIntervalCurrent = BASE_SPAWN_INTERVAL;
  let dropDurationCurrent = BASE_DROP_DURATION;
  let lastSpeedupScore = 0; // to avoid multiple triggers for same score

  // DOM references
  const game = document.getElementById('game');
  const clouds = Array.from(document.querySelectorAll('.cloud'));
  const cloudRow = document.querySelector('.cloud-row');
  const clickLayer = document.getElementById('click-layer');
  const welcome = document.getElementById('welcome');
  const startBtn = document.getElementById('startBtn');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const ocean = document.getElementById('ocean');
  const endScreen = document.getElementById('endScreen');
  const endTitle = document.getElementById('endTitle');
  const finalScore = document.getElementById('finalScore');
  const playAgain = document.getElementById('playAgain');
  const halfwayMsg = document.getElementById('halfwayMsg');

  let score = 0;
  let xCount = 0;
  let activeDrops = new Set();
  let running = false;
  let spawnTimer = null;
  let halfwayTriggered = false;

  // Reset everything
  function resetGameState() {
    score = 0;
    xCount = 0;
    scoreEl.textContent = score;
    clearLives();
    clearActiveDrops();
    endScreen.classList.add('hidden');
    welcome.classList.add('hidden');
    ocean.classList.remove('polluted');
    document.body.classList.remove('dark-sky');
    const sun = document.querySelector('.sun');
    if (sun) sun.classList.remove('hidden');
    if (cloudRow) cloudRow.classList.remove('hidden');

    // reset speed state
    speedMultiplier = 1;
    spawnIntervalCurrent = BASE_SPAWN_INTERVAL;
    dropDurationCurrent = BASE_DROP_DURATION;
    lastSpeedupScore = 0;
    halfwayTriggered = false;
    hideHalfwayMsg();
    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
  }

  function clearActiveDrops() {
    activeDrops.forEach(drop => {
      if (drop.removeTimers) drop.removeTimers.forEach(t => clearTimeout(t));
      if (drop.el && drop.el.parentElement) drop.el.remove();
    });
    activeDrops.clear();
  }

  function clearLives() {
    livesEl.innerHTML = '';
  }

  function addLifeX() {
    const x = document.createElement('div');
    x.className = 'life-x';
    x.textContent = '✕';
    livesEl.appendChild(x);
  }

  function showEndScreen(win) {
    running = false;
    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
    if (win) {
      endTitle.textContent = 'You Win!';
      ocean.classList.remove('polluted');
      document.body.classList.remove('dark-sky');
      const sun = document.querySelector('.sun');
      if (sun) sun.classList.remove('hidden');
      if (cloudRow) cloudRow.classList.add('hidden');
    } else {
      endTitle.textContent = 'You Lose';
      ocean.classList.add('polluted');
      document.body.classList.add('dark-sky');
      const sun = document.querySelector('.sun');
      if (sun) sun.classList.add('hidden');
      if (cloudRow) cloudRow.classList.remove('hidden');
    }
    finalScore.textContent = score;
    endScreen.classList.remove('hidden');
  }

  // Start spawning using the current spawn interval
  function startSpawning() {
    // spawn immediately then every spawnIntervalCurrent ms
    spawnDropRandom();
    if (spawnTimer) clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnDropRandom, spawnIntervalCurrent);
  }

  function adjustSpawnTimer() {
    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = setInterval(spawnDropRandom, spawnIntervalCurrent);
    }
  }

  function spawnDropRandom() {
    if (!running) return;
    const randomIndex = Math.floor(Math.random() * NUM_CLOUDS);
    const cloudEl = clouds[randomIndex];
    spawnDropUnderCloud(cloudEl);
  }

  // Create an inline SVG teardrop (pointed top, semicircle bottom)
  function makeTeardropSVG(isClean) {
    // Gradients for clean and polluted drops
    const cleanGrad = `
      <linearGradient id="cleanGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#3fd1ff" />
        <stop offset="100%" stop-color="#007fd1" />
      </linearGradient>`;
    const pollutedGrad = `
      <linearGradient id="pollutedGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#4ce07a" />
        <stop offset="100%" stop-color="#128a3d" />
      </linearGradient>`;

    // Teardrop with circular bottom
    const path = `
      <path class="drop-shape" d="
        M15 4
        Q15 2, 15 2
        Q15 10, 7 22
        A11 11 0 1 0 23 22
        Q15 10, 15 4
        Z" />`;

    // White crescent shine near the bottom (visible)
    const shine = `
      <g transform="translate(12, 34) rotate(-90)">
        <path class="shine" d="
          M0 3
          A5 4 4 1 1 10 0
        " fill="none" stroke="white" stroke-width="2" opacity="0.7"/>
      </g>
    `;

    return `
      <svg viewBox="0 0 30 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          ${cleanGrad}
          ${pollutedGrad}
        </defs>
        ${path}
        ${shine}
      </svg>
    `;
  }

  function spawnDropUnderCloud(cloudEl) {
    if (!running) return;

    const roll = Math.random();
    const isClean = roll < CLEAN_PROB;

    // container div
    const dropContainer = document.createElement('div');
    dropContainer.className = 'raindrop ' + (isClean ? 'clean' : 'polluted');
    dropContainer.dataset.clean = isClean ? '1' : '0';
    // insert SVG
    dropContainer.innerHTML = makeTeardropSVG(isClean);

    // position at cloud bottom center
    const cloudRect = cloudEl.getBoundingClientRect();
    const gameRect = game.getBoundingClientRect();
    const spawnX = cloudRect.left + cloudRect.width / 2 - gameRect.left;
    const spawnY = cloudRect.bottom - gameRect.top + 6;

    // center the container on spawnX (container width approx 34)
    dropContainer.style.left = `${spawnX - 17}px`;
    dropContainer.style.top = `${spawnY}px`;

    game.appendChild(dropContainer);

    const dropObj = {
      el: dropContainer,
      clean: isClean,
      inOcean: false,
      removeTimers: []
    };
    activeDrops.add(dropObj);

    const oceanRect = ocean.getBoundingClientRect();
    const endY = gameRect.bottom - gameRect.top + 20;
    const oceanEntryY = oceanRect.top - gameRect.top;

    // Animate drop by changing top with a CSS transition using current drop duration
    requestAnimationFrame(() => {
      dropContainer.style.transitionDuration = `${dropDurationCurrent}ms`;
      dropContainer.getBoundingClientRect(); // force reflow
      dropContainer.style.top = `${endY}px`;
    });

    const totalDistance = endY - spawnY;
    const distToOcean = Math.max(0, oceanEntryY - spawnY);
    const timeToOcean = totalDistance <= 0 ? 0 : Math.round((distToOcean / totalDistance) * dropDurationCurrent);

    const tOcean = setTimeout(() => {
      dropObj.inOcean = true;
      dropContainer.style.zIndex = 42;
    }, timeToOcean);
    dropObj.removeTimers.push(tOcean);

    const tEnd = setTimeout(() => {
      if (dropObj.el && dropObj.el.parentElement) dropObj.el.remove();
      activeDrops.delete(dropObj);
    }, dropDurationCurrent + 80);
    dropObj.removeTimers.push(tEnd);
  }

  // Handle clicks / taps
  clickLayer.addEventListener('pointerdown', () => {
    if (!running) return;

    // If any polluted drop is in the ocean, ripple + penalty + remove it (per request)
    const polluted = [...activeDrops].find(d => d.inOcean && !d.clean);
    if (polluted) {
      if (polluted.el) {
        const dropRect = polluted.el.getBoundingClientRect();
        const gameRect = game.getBoundingClientRect();
        const xCenter = dropRect.left + dropRect.width / 2 - gameRect.left;
        createRippleAt(xCenter);
        polluted.el.remove();
      }
      activeDrops.delete(polluted);
      doPollutedPenalty();
      return;
    }

    // otherwise handle clean drop collection
    const clean = [...activeDrops].find(d => d.inOcean && d.clean);
    if (clean) {
      collectCleanDrop(clean);
      return;
    }
  });

  // Allow pressing spacebar to simulate click
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    clickLayer.dispatchEvent(new PointerEvent('pointerdown'));
  }
});

  function doPollutedPenalty() {
    // If game is already over, keep ocean polluted and skip animation
    if (xCount >= MAX_X - 1) {
      ocean.classList.add('polluted');
      xCount++;
      addLifeX();
      setTimeout(() => showEndScreen(false), 400);
      return;
    }
    ocean.classList.add('polluted');
    setTimeout(() => ocean.classList.remove('polluted'), 1000);
    xCount++;
    addLifeX();
    if (xCount >= MAX_X) setTimeout(() => showEndScreen(false), 400);
  }

  function collectCleanDrop(dropObj) {
    dropObj.collected = true;
    if (dropObj.el) {
      const dropRect = dropObj.el.getBoundingClientRect();
      const gameRect = game.getBoundingClientRect();
      const xCenter = dropRect.left + dropRect.width / 2 - gameRect.left;
      createRippleAt(xCenter);
      dropObj.el.remove();
    }
    activeDrops.delete(dropObj);
    score++;
    scoreEl.textContent = score;

    // Check halfway
    if (!halfwayTriggered && score >= Math.ceil(MAX_SCORE / 2)) {
      halfwayTriggered = true;
      showHalfwayMsg();
    }

    // Check speedup on multiples of 10
    if (score % 10 === 0 && score > 0 && lastSpeedupScore !== score) {
      lastSpeedupScore = score;
      speedMultiplier *= 2;
      spawnIntervalCurrent = Math.max(100, Math.round(BASE_SPAWN_INTERVAL / speedMultiplier));
      dropDurationCurrent = Math.max(80, Math.round(BASE_DROP_DURATION / speedMultiplier));
      // restart spawn timer with new interval
      adjustSpawnTimer();
    }

    if (score >= MAX_SCORE) setTimeout(() => showEndScreen(true), 250);
  }

  function createRippleAt(x) {
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = `${x}px`;
    const oceanRect = ocean.getBoundingClientRect();
    const gameRect = game.getBoundingClientRect();
    const bottomOffset = (gameRect.bottom - oceanRect.top) - 28;
    r.style.bottom = `${bottomOffset}px`;
    game.appendChild(r);
    setTimeout(() => r.remove(), 1000);
  }

  function showHalfwayMsg() {
    if (!halfwayMsg) return;
    halfwayMsg.classList.remove('hidden');
    halfwayMsg.classList.add('visible');
    // hide after 2.5s
    setTimeout(() => {
      hideHalfwayMsg();
    }, 2500);
  }
  function hideHalfwayMsg() {
    if (!halfwayMsg) return;
    halfwayMsg.classList.remove('visible');
    // allow display:none after transition
    setTimeout(() => {
      halfwayMsg.classList.add('hidden');
    }, 350);
  }

  startBtn.addEventListener('click', startGame);
  playAgain.addEventListener('click', () => {
    resetGameState();
    startGame();
  });

  function startGame() {
    resetGameState();
    running = true;
    startSpawning();
  }

  window.addEventListener('load', () => {
    welcome.classList.remove('hidden');
    clearLives();
    scoreEl.textContent = '0';
  });
})();
