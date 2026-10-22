// Main Game Board Client Logic with Authentic Real Show Rules
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const standardStage = document.getElementById('standard-stage');
  const fastMoneyStage = document.getElementById('fast-money-stage');

  const phaseBanner = document.getElementById('phase-banner');
  const phaseText = document.getElementById('phase-text');

  const questionEl = document.getElementById('board-question');
  const answersGrid = document.getElementById('answers-grid');
  const scoreTeamAEl = document.getElementById('score-team-a');
  const scoreTeamBEl = document.getElementById('score-team-b');
  const labelTeamA = document.getElementById('label-team-a');
  const labelTeamB = document.getElementById('label-team-b');
  const indicatorTeamA = document.getElementById('indicator-team-a');
  const indicatorTeamB = document.getElementById('indicator-team-b');
  const podiumTeamA = document.getElementById('podium-team-a');
  const podiumTeamB = document.getElementById('podium-team-b');
  const bankPointsEl = document.getElementById('bank-points');
  const roundBadgeEl = document.getElementById('round-badge');

  const strikeOverlay = document.getElementById('strike-overlay');
  const strikeBox = document.getElementById('strike-box');
  const dots = [
    document.getElementById('dot-strike-1'),
    document.getElementById('dot-strike-2'),
    document.getElementById('dot-strike-3')
  ];

  const buzzerBanner = document.getElementById('buzzer-banner');
  const buzzerBannerText = document.getElementById('buzzer-banner-text');
  const buzzFlashOverlay = document.getElementById('buzz-flash-overlay');
  const buzzFlashTeam = document.getElementById('buzz-flash-team');
  const buzzFlashPlayer = document.getElementById('buzz-flash-player');

  const stealAlertOverlay = document.getElementById('steal-alert-overlay');
  const stealAlertTeam = document.getElementById('steal-alert-team');
  const stealStruckTeam = document.getElementById('steal-struck-team');
  const stealAlertPoints = document.getElementById('steal-alert-points');

  const championOverlay = document.getElementById('champion-overlay');
  const championTeamName = document.getElementById('champion-team-name');
  const championFinalScore = document.getElementById('champion-final-score');

  const grandPrizeOverlay = document.getElementById('grand-prize-overlay');
  const gpFinalScore = document.getElementById('gp-final-score');

  // Fast Money DOM Elements
  const fmTimerDisplay = document.getElementById('fm-timer-display');
  const fmTotalScore = document.getElementById('fm-total-score');
  const fmRowsContainer = document.getElementById('fm-rows-container');

  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');

  let currentGameState = null;
  let strikeOverlayTimeout = null;
  let buzzSplashTimeout = null;
  let stealOverlayTimeout = null;

  // Initialize standard 8 board slots
  function renderBoardSlots(answers = [], revealedIndices = []) {
    answersGrid.innerHTML = '';
    const totalSlots = 8;

    for (let i = 0; i < totalSlots; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'answer-slot';
      slotEl.id = `slot-${i}`;

      const cardEl = document.createElement('div');
      cardEl.className = 'answer-card';
      cardEl.id = `card-${i}`;

      const ans = answers[i];
      const isRevealed = revealedIndices.includes(i);

      if (ans) {
        cardEl.innerHTML = `
          <div class="card-front">
            <div class="slot-number">${i + 1}</div>
          </div>
          <div class="card-back">
            <span class="answer-text">${ans.text}</span>
            <div class="answer-points-box">${ans.points}</div>
          </div>
        `;
        if (isRevealed) {
          cardEl.classList.add('revealed');
        }
      } else {
        slotEl.classList.add('empty');
        cardEl.innerHTML = `
          <div class="card-front">
            <div class="slot-number">${i + 1}</div>
          </div>
          <div class="card-back"></div>
        `;
      }

      slotEl.appendChild(cardEl);
      answersGrid.appendChild(slotEl);
    }
  }

  // Render Fast Money 5-Question Board
  function renderFastMoneyBoard(fm) {
    if (!fm || !Array.isArray(fm.questions)) return;
    fmRowsContainer.innerHTML = '';

    fm.questions.forEach((q, idx) => {
      const p1 = (fm.player1Answers && fm.player1Answers[idx]) || { text: '', points: 0, revealed: false };
      const p2 = (fm.player2Answers && fm.player2Answers[idx]) || { text: '', points: 0, revealed: false };

      const row = document.createElement('div');
      row.className = 'fm-row';
      row.innerHTML = `
        <div class="fm-q-title">#${idx + 1}. ${q.question}</div>
        <div class="fm-ans-box">${p1.revealed || p1.text ? p1.text : ''}</div>
        <div class="fm-pts-box">${p1.revealed ? p1.points : '-'}</div>
        <div class="fm-ans-box">${p2.revealed || p2.text ? p2.text : ''}</div>
        <div class="fm-pts-box">${p2.revealed ? p2.points : '-'}</div>
      `;
      fmRowsContainer.appendChild(row);
    });

    fmTotalScore.textContent = fm.totalScore || 0;
  }

  // Update Game State UI according to Real Show Rules
  function updateGameState(state) {
    currentGameState = state;

    // Team Names
    const nameA = (state.teamNames && state.teamNames.teamA) || 'TEAM A';
    const nameB = (state.teamNames && state.teamNames.teamB) || 'TEAM B';
    labelTeamA.textContent = nameA;
    labelTeamB.textContent = nameB;

    // Scores
    scoreTeamAEl.textContent = state.scores.teamA || 0;
    scoreTeamBEl.textContent = state.scores.teamB || 0;

    // Round & Multiplier
    const mult = state.roundMultiplier || 1;
    roundBadgeEl.textContent = `ROUND ${state.currentRound || 1} (${mult}X)`;

    // Bank Points
    bankPointsEl.textContent = state.boardPoints || 0;

    // Strikes
    dots.forEach((dot, idx) => {
      if (idx < (state.strikes || 0)) dot.classList.add('active');
      else dot.classList.remove('active');
    });

    // Check Stage View: Standard vs Fast Money
    if (state.phase === 'FAST_MONEY') {
      standardStage.classList.add('hidden');
      fastMoneyStage.classList.remove('hidden');
      phaseBanner.className = 'phase-banner face-off';
      phaseText.textContent = 'FAST MONEY • $20,000 BONUS ROUND';
      renderFastMoneyBoard(state.fastMoney);
      if (state.fastMoney && state.fastMoney.wonGrandPrize) {
        showGrandPrizeCelebration(state.fastMoney.totalScore);
      }
      return;
    } else {
      standardStage.classList.remove('hidden');
      fastMoneyStage.classList.add('hidden');
    }

    // Question & Answers Grid
    questionEl.textContent = state.currentQuestion || 'Waiting for host to load question...';
    renderBoardSlots(state.currentAnswers || [], state.revealedAnswers || []);

    // TV Show Phase Handlers
    podiumTeamA.classList.remove('is-active');
    podiumTeamB.classList.remove('is-active');
    indicatorTeamA.className = 'team-indicator';
    indicatorTeamB.className = 'team-indicator';

    if (state.phase === 'FACE_OFF' || !state.phase) {
      phaseBanner.className = 'phase-banner face-off';
      phaseText.textContent = `ROUND ${state.currentRound || 1} • THE FACE-OFF`;
      indicatorTeamA.textContent = 'AT BUZZER';
      indicatorTeamB.textContent = 'AT BUZZER';
    } else if (state.phase === 'IN_PLAY') {
      const playingName = state.controllingTeam === 'teamA' ? nameA : nameB;
      const isTeamA = state.controllingTeam === 'teamA';
      phaseBanner.className = `phase-banner ${isTeamA ? 'in-play-teama' : 'in-play-teamb'}`;
      phaseText.textContent = `IN PLAY • ${playingName}`;

      if (isTeamA) {
        podiumTeamA.classList.add('is-active');
        indicatorTeamA.classList.add('active');
        indicatorTeamA.textContent = 'PLAYING';
        indicatorTeamB.textContent = 'WAITING';
      } else {
        podiumTeamB.classList.add('is-active');
        indicatorTeamB.classList.add('active');
        indicatorTeamB.textContent = 'PLAYING';
        indicatorTeamA.textContent = 'WAITING';
      }
    } else if (state.phase === 'STEAL_CHANCE') {
      const stealingName = state.stealingTeam === 'teamA' ? nameA : nameB;
      phaseBanner.className = 'phase-banner steal-chance';
      phaseText.textContent = `⚡ 3 STRIKES! ${stealingName} CAN STEAL!`;

      if (state.stealingTeam === 'teamA') {
        podiumTeamA.classList.add('is-active');
        indicatorTeamA.className = 'team-indicator stealing';
        indicatorTeamA.textContent = 'STEALING!';
        indicatorTeamB.textContent = '3 STRIKES';
      } else {
        podiumTeamB.classList.add('is-active');
        indicatorTeamB.className = 'team-indicator stealing';
        indicatorTeamB.textContent = 'STEALING!';
        indicatorTeamA.textContent = '3 STRIKES';
      }
    } else if (state.phase === 'ROUND_OVER') {
      phaseBanner.className = 'phase-banner round-won';
      phaseText.textContent = `ROUND ${state.currentRound || 1} COMPLETE`;
    } else if (state.phase === 'GAME_OVER') {
      const winnerName = state.winner === 'teamA' ? nameA : nameB;
      phaseBanner.className = 'phase-banner round-won';
      phaseText.textContent = `👑 CHAMPIONS: ${winnerName}!`;
      showChampionCelebration(winnerName, state.scores[state.winner]);
    }

    // Buzzer banner
    if (state.buzzerState && state.buzzerState.locked && state.buzzerState.buzzedTeam && state.phase === 'FACE_OFF') {
      const teamLabel = state.buzzerState.buzzedTeam === 'teamA' ? nameA : nameB;
      const player = state.buzzerState.playerName ? ` (${state.buzzerState.playerName})` : '';
      buzzerBannerText.textContent = `${teamLabel}${player} BUZZED IN!`;
      buzzerBanner.classList.remove('hidden');
    } else {
      buzzerBanner.classList.add('hidden');
    }
  }

  // Strike Animation
  function showStrikeAnimation(strikeCount) {
    if (strikeOverlayTimeout) clearTimeout(strikeOverlayTimeout);
    strikeBox.innerHTML = '';

    const count = Math.min(3, Math.max(1, strikeCount || 1));
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'big-strike-x';
      span.textContent = '✕';
      strikeBox.appendChild(span);
    }

    strikeOverlay.classList.remove('hidden');
    window.soundEngine.playStrike();

    strikeOverlayTimeout = setTimeout(() => {
      strikeOverlay.classList.add('hidden');
    }, 1500);
  }

  // Face-off Buzz Splash
  function showBuzzerSplash(team, playerName) {
    if (buzzSplashTimeout) clearTimeout(buzzSplashTimeout);
    const teamLabel = team === 'teamA' 
      ? (currentGameState && currentGameState.teamNames ? currentGameState.teamNames.teamA : 'TEAM A')
      : (currentGameState && currentGameState.teamNames ? currentGameState.teamNames.teamB : 'TEAM B');

    buzzFlashTeam.textContent = teamLabel;
    buzzFlashTeam.style.color = team === 'teamA' ? 'var(--team-a-color)' : 'var(--team-b-color)';
    buzzFlashPlayer.textContent = playerName || 'Player';

    buzzFlashOverlay.classList.remove('hidden');
    window.soundEngine.playBuzz();

    buzzSplashTimeout = setTimeout(() => {
      buzzFlashOverlay.classList.add('hidden');
    }, 2200);
  }

  // Studio Broadcast Confetti Engine
  const confettiCanvas = document.getElementById('confetti-canvas');
  let confettiCtx = null;
  let confettiParticles = [];
  let confettiAnimId = null;

  if (confettiCanvas) {
    confettiCtx = confettiCanvas.getContext('2d');
    function resizeCanvas() {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  function launchConfetti(durationMs = 4000) {
    if (!confettiCtx || !confettiCanvas) return;
    const colors = ['#F2A900', '#FFD166', '#00D4FF', '#FF8800', '#D90429', '#FFFFFF', '#00E676'];
    const particleCount = 130;

    for (let i = 0; i < particleCount; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: -20 - Math.random() * 50,
        w: 8 + Math.random() * 10,
        h: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 5,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        opacity: 1
      });
    }

    if (!confettiAnimId) {
      animateConfetti();
    }

    setTimeout(() => {
      // fade out remaining
      confettiParticles.forEach(p => p.fading = true);
    }, Math.max(1000, durationMs - 1200));
  }

  function animateConfetti() {
    if (!confettiCtx || !confettiCanvas) return;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;

      if (p.fading) {
        p.opacity -= 0.02;
      }

      if (p.opacity <= 0 || p.y > confettiCanvas.height + 30) {
        confettiParticles.splice(i, 1);
        continue;
      }

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rot * Math.PI) / 180);
      confettiCtx.globalAlpha = Math.max(0, p.opacity);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
    }

    if (confettiParticles.length > 0) {
      confettiAnimId = requestAnimationFrame(animateConfetti);
    } else {
      confettiAnimId = null;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  // Steal Opportunity Alert Overlay
  function showStealAlert(stealingTeam, controllingTeam, boardPoints) {
    if (stealOverlayTimeout) clearTimeout(stealOverlayTimeout);
    
    // Resolve clean custom team names
    const nameA = (currentGameState && currentGameState.teamNames && currentGameState.teamNames.teamA) || 'TEAM A';
    const nameB = (currentGameState && currentGameState.teamNames && currentGameState.teamNames.teamB) || 'TEAM B';

    const stealingKey = stealingTeam || (controllingTeam === 'teamA' ? 'teamB' : 'teamA');
    const struckKey = controllingTeam || (stealingKey === 'teamA' ? 'teamB' : 'teamA');

    const stealingName = stealingKey === 'teamA' ? nameA : nameB;
    const struckName = struckKey === 'teamA' ? nameA : nameB;

    if (stealAlertTeam) stealAlertTeam.textContent = stealingName;
    if (stealStruckTeam) stealStruckTeam.textContent = struckName;
    if (stealAlertPoints) stealAlertPoints.textContent = `${boardPoints || (currentGameState ? currentGameState.boardPoints : 0)} PTS`;

    stealAlertOverlay.classList.remove('hidden');
    window.soundEngine.playStealAlert();

    stealOverlayTimeout = setTimeout(() => {
      stealAlertOverlay.classList.add('hidden');
    }, 3800);
  }

  // Match Champions Popup (300+ Points)
  function showChampionCelebration(winnerName, score) {
    championTeamName.textContent = winnerName;
    championFinalScore.textContent = `${score} POINTS`;
    championOverlay.classList.remove('hidden');
    window.soundEngine.playWin();
    launchConfetti(6500);

    setTimeout(() => {
      championOverlay.classList.add('hidden');
    }, 6000);
  }

  // Grand Prize Celebration (200+ Points in Fast Money)
  function showGrandPrizeCelebration(score) {
    gpFinalScore.textContent = `${score} POINTS!`;
    grandPrizeOverlay.classList.remove('hidden');
    window.soundEngine.playGrandPrize();
    launchConfetti(8000);

    setTimeout(() => {
      grandPrizeOverlay.classList.add('hidden');
    }, 8000);
  }

  // Socket Events
  socket.on('connect', () => {
    console.log('Board connected to server');
    socket.emit('request-state');
  });

  socket.on('state-update', (state) => {
    updateGameState(state);
  });

  socket.on('answer-revealed', (data) => {
    const cardEl = document.getElementById(`card-${data.index}`);
    if (cardEl && !cardEl.classList.contains('revealed')) {
      cardEl.classList.add('revealed');
    }
    bankPointsEl.textContent = data.boardPoints || 0;
    window.soundEngine.playDing();
  });

  socket.on('strike-awarded', (data) => {
    showStrikeAnimation(data.strikes);
  });

  socket.on('strikes-cleared', () => {
    dots.forEach(dot => dot.classList.remove('active'));
    strikeOverlay.classList.add('hidden');
  });

  socket.on('steal-chance', (data) => {
    showStealAlert(data.stealingTeam, data.controllingTeam, data.boardPoints);
  });

  socket.on('steal-resolved', (data) => {
    if (data.success) {
      window.soundEngine.playWin();
      launchConfetti(4000);
    } else {
      window.soundEngine.playStrike();
    }
  });

  socket.on('board-cleared', () => {
    window.soundEngine.playWin();
    launchConfetti(4500);
  });

  socket.on('buzzed', (data) => {
    showBuzzerSplash(data.team, data.playerName);
  });

  socket.on('buzzer-reset', () => {
    buzzerBanner.classList.add('hidden');
    buzzFlashOverlay.classList.add('hidden');
  });

  socket.on('points-awarded', () => {
    window.soundEngine.playWin();
    launchConfetti(3000);
  });

  socket.on('game-over', (data) => {
    const teamName = data.winner === 'teamA' 
      ? (currentGameState && currentGameState.teamNames ? currentGameState.teamNames.teamA : 'TEAM A')
      : (currentGameState && currentGameState.teamNames ? currentGameState.teamNames.teamB : 'TEAM B');
    showChampionCelebration(teamName, data.score);
  });

  // Fast Money Events
  socket.on('fast-money-timer-update', (data) => {
    fmTimerDisplay.textContent = data.timer;
    if (data.timer <= 5 && data.running) {
      window.soundEngine.playTick();
    }
  });

  socket.on('fast-money-timer-expired', () => {
    window.soundEngine.playStrike();
  });

  socket.on('fast-money-reveal', (data) => {
    window.soundEngine.playDing();
    fmTotalScore.textContent = data.total;
    if (data.total >= 200) {
      showGrandPrizeCelebration(data.total);
    }
  });

  // Fullscreen button
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
      btnFullscreen.textContent = '✕';
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
      btnFullscreen.textContent = '⛶';
    }
  });

  btnSoundToggle.addEventListener('click', () => {
    const isMuted = window.soundEngine.toggleMute();
    btnSoundToggle.textContent = isMuted ? '🔇' : '🔊';
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') btnFullscreen.click();
    else if (e.key === 'm' || e.key === 'M') btnSoundToggle.click();
  });
});
