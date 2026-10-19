// Host Dashboard Client Logic with Authentic Real Show Rules
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM references
  const hostQuestionText = document.getElementById('host-question-text');
  const roundIndicator = document.getElementById('round-indicator');
  const hostAnswersList = document.getElementById('host-answers-list');
  const hostBankDisplay = document.getElementById('host-bank-display');
  const hostScoreTeamA = document.getElementById('host-score-team-a');
  const hostScoreTeamB = document.getElementById('host-score-team-b');
  const hostLabelTeamA = document.getElementById('host-label-team-a');
  const hostLabelTeamB = document.getElementById('host-label-team-b');
  const foNameA = document.getElementById('fo-name-a');
  const foNameB = document.getElementById('fo-name-b');

  const hostPhaseBadge = document.getElementById('host-phase-badge');
  const hostPhaseDesc = document.getElementById('host-phase-desc');
  const foBuzzerStatus = document.getElementById('fo-buzzer-status');
  const stealDeck = document.getElementById('steal-deck');

  const strikesCountBadge = document.getElementById('strikes-count-badge');
  const hostDots = [
    document.getElementById('host-dot-1'),
    document.getElementById('host-dot-2'),
    document.getElementById('host-dot-3')
  ];
  const buzzerLockStatus = document.getElementById('buzzer-lock-status');
  const firstBuzzSpotlight = document.getElementById('first-buzz-spotlight');
  const buzzHistoryList = document.getElementById('buzz-history-list');
  const multSelect = document.getElementById('mult-select');

  // Control Buttons
  const btnLoadQuestion = document.getElementById('btn-load-question');
  const btnRevealAll = document.getElementById('btn-reveal-all');
  const btnHideAll = document.getElementById('btn-hide-all');
  const btnAwardStrike = document.getElementById('btn-award-strike');
  const btnClearStrikes = document.getElementById('btn-clear-strikes');
  const btnAwardTeamA = document.getElementById('btn-award-team-a');
  const btnAwardTeamB = document.getElementById('btn-award-team-b');
  const btnResetBuzzer = document.getElementById('btn-reset-buzzer');
  const btnNextRound = document.getElementById('btn-next-round');
  const btnResetGame = document.getElementById('btn-reset-game');

  // Steal Controls
  const btnStealSuccess = document.getElementById('btn-steal-success');
  const btnStealFail = document.getElementById('btn-steal-fail');

  // Rename Teams Bar
  const btnRenameTeams = document.getElementById('btn-rename-teams');
  const renameBar = document.getElementById('rename-bar');
  const inputTeamAName = document.getElementById('input-team-a-name');
  const inputTeamBName = document.getElementById('input-team-b-name');
  const btnSaveNames = document.getElementById('btn-save-names');

  // Custom Question Drawer
  const btnToggleCustom = document.getElementById('btn-toggle-custom');
  const customDrawer = document.getElementById('custom-question-drawer');
  const customQInput = document.getElementById('custom-q-input');
  const customAnswersInputs = document.getElementById('custom-answers-inputs');
  const btnSaveCustom = document.getElementById('btn-save-custom');
  const btnCancelCustom = document.getElementById('btn-cancel-custom');

  // Fast Money Host Elements
  const btnStartFastMoneyNav = document.getElementById('btn-start-fast-money-nav');
  const btnTriggerFastMoney = document.getElementById('btn-trigger-fast-money');
  const fmHostTimer = document.getElementById('fm-host-timer');
  const btnFmTimerStart = document.getElementById('btn-fm-timer-start');
  const btnFmTimerPause = document.getElementById('btn-fm-timer-pause');
  const btnFmTimerReset = document.getElementById('btn-fm-timer-reset');
  const btnTabP1 = document.getElementById('btn-tab-p1');
  const btnTabP2 = document.getElementById('btn-tab-p2');
  const fmInputsList = document.getElementById('fm-inputs-list');
  const fmHostTotal = document.getElementById('fm-host-total');

  let currentGameState = null;
  let activeFmPlayer = 1;

  // Setup Custom Question inputs
  function setupCustomInputs() {
    customAnswersInputs.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const row = document.createElement('div');
      row.className = 'custom-ans-row';
      row.innerHTML = `
        <input type="text" class="input-text custom-ans-text" id="custom-text-${i}" placeholder="Answer #${i + 1}">
        <input type="number" class="input-text custom-ans-pts" id="custom-pts-${i}" placeholder="Pts" min="1" max="100">
      `;
      customAnswersInputs.appendChild(row);
    }
  }
  setupCustomInputs();

  // Render Answers Table
  function renderAnswersTable(answers = [], revealed = []) {
    hostAnswersList.innerHTML = '';
    if (answers.length === 0) {
      hostAnswersList.innerHTML = `<div class="empty-log">No answers loaded. Click "Load Random Question".</div>`;
      return;
    }

    answers.forEach((ans, idx) => {
      const isRevealed = revealed.includes(idx);
      const isTop = (idx === 0);
      const row = document.createElement('div');
      row.className = `answer-row-item ${isRevealed ? 'is-revealed' : ''}`;

      const actionBtnClass = isRevealed ? 'btn-hide' : 'btn-reveal';
      const actionBtnText = isRevealed ? '✓ Revealed (Hide)' : '👁 Reveal Answer';

      row.innerHTML = `
        <span class="row-index">#${idx + 1}${isTop ? ' ⭐' : ''}</span>
        <span class="row-text" title="${ans.text}">${ans.text}</span>
        <span class="row-points">${ans.points}</span>
        <button class="row-action-btn ${actionBtnClass}" data-idx="${idx}" data-revealed="${isRevealed}">
          ${actionBtnText}
        </button>
      `;

      const btn = row.querySelector('.row-action-btn');
      btn.addEventListener('click', () => {
        if (isRevealed) {
          socket.emit('hide-answer', idx);
        } else {
          socket.emit('reveal-answer', idx);
        }
      });

      hostAnswersList.appendChild(row);
    });
  }

  // Render Fast Money Question Inputs
  function renderFastMoneyInputs(fm) {
    if (!fm || !Array.isArray(fm.questions)) return;
    fmInputsList.innerHTML = '';

    const answersList = activeFmPlayer === 1 ? fm.player1Answers : fm.player2Answers;

    fm.questions.forEach((q, idx) => {
      const ansData = (answersList && answersList[idx]) || { text: '', points: 0, revealed: false };
      const row = document.createElement('div');
      row.className = 'fm-input-row';

      row.innerHTML = `
        <div class="fm-input-q-title">Q${idx + 1}: ${q.question}</div>
        <div class="fm-input-fields">
          <input type="text" class="input-text-sm fm-input-text" id="fm-text-${idx}" placeholder="Player answer" value="${ansData.text || ''}">
          <input type="number" class="input-text-sm fm-input-pts" id="fm-pts-${idx}" placeholder="Pts" min="0" max="100" value="${ansData.points || 0}">
          <button class="btn btn-gold btn-xs btn-fm-reveal" data-idx="${idx}">
            ${ansData.revealed ? '✓ Revealed' : '👁 Reveal'}
          </button>
        </div>
      `;

      const btnReveal = row.querySelector('.btn-fm-reveal');
      btnReveal.addEventListener('click', () => {
        const textVal = document.getElementById(`fm-text-${idx}`).value.trim();
        const ptsVal = parseInt(document.getElementById(`fm-pts-${idx}`).value, 10) || 0;
        socket.emit('fast-money-set-answer', {
          player: activeFmPlayer,
          qIndex: idx,
          text: textVal,
          points: ptsVal,
          revealed: true
        });
      });

      // Auto update text on change
      const textInput = row.querySelector(`#fm-text-${idx}`);
      textInput.addEventListener('blur', () => {
        const textVal = textInput.value.trim();
        const ptsVal = parseInt(document.getElementById(`fm-pts-${idx}`).value, 10) || 0;
        socket.emit('fast-money-set-answer', {
          player: activeFmPlayer,
          qIndex: idx,
          text: textVal,
          points: ptsVal,
          revealed: ansData.revealed
        });
      });

      fmInputsList.appendChild(row);
    });

    fmHostTotal.textContent = `${fm.totalScore || 0} / 200 PTS`;
    fmHostTimer.textContent = `${fm.timer || 20}s`;
  }

  // Update Whole Host UI
  function updateHostUI(state) {
    currentGameState = state;

    // Team Names
    const nameA = (state.teamNames && state.teamNames.teamA) || 'Team A';
    const nameB = (state.teamNames && state.teamNames.teamB) || 'Team B';
    hostLabelTeamA.textContent = nameA;
    hostLabelTeamB.textContent = nameB;
    foNameA.textContent = `${nameA.toUpperCase()} WINS FACE-OFF`;
    foNameB.textContent = `${nameB.toUpperCase()} WINS FACE-OFF`;

    btnAwardTeamA.textContent = `🏆 Award ${state.boardPoints || 0} Pts to ${nameA}`;
    btnAwardTeamB.textContent = `🏆 Award ${state.boardPoints || 0} Pts to ${nameB}`;

    // Question & Round
    hostQuestionText.textContent = state.currentQuestion || 'No question active';
    const mult = state.roundMultiplier || 1;
    roundIndicator.textContent = `ROUND ${state.currentRound || 1} (${mult}X)`;
    if (multSelect.value !== String(mult)) {
      multSelect.value = String(mult);
    }

    // Bank & Scores
    hostBankDisplay.textContent = `${state.boardPoints || 0} PTS`;
    hostScoreTeamA.textContent = state.scores.teamA || 0;
    hostScoreTeamB.textContent = state.scores.teamB || 0;

    // Strikes
    const strikeCount = state.strikes || 0;
    strikesCountBadge.textContent = `${strikeCount} STRIKE${strikeCount === 1 ? '' : 'S'}`;
    hostDots.forEach((dot, idx) => {
      if (idx < strikeCount) dot.classList.add('active');
      else dot.classList.remove('active');
    });

    // Answers Matrix
    renderAnswersTable(state.currentAnswers || [], state.revealedAnswers || []);

    // TV Show Phase Instructions & Steal Deck Toggle
    if (state.phase === 'FACE_OFF' || !state.phase) {
      hostPhaseBadge.textContent = 'PHASE: THE FACE-OFF';
      hostPhaseDesc.textContent = 'Players at buzzers. Read question. Top answer wins face-off; team chooses PLAY or PASS.';
      stealDeck.classList.add('hidden');
    } else if (state.phase === 'IN_PLAY') {
      const playingName = state.controllingTeam === 'teamA' ? nameA : nameB;
      hostPhaseBadge.textContent = `PHASE: IN PLAY (${playingName})`;
      hostPhaseDesc.textContent = `${playingName} is guessing answers. Click reveal for correct answers. Award Strike (+1) for wrong answers.`;
      stealDeck.classList.add('hidden');
    } else if (state.phase === 'STEAL_CHANCE') {
      const stealingName = state.stealingTeam === 'teamA' ? nameA : nameB;
      hostPhaseBadge.textContent = `PHASE: 3 STRIKES! STEAL ATTEMPT`;
      hostPhaseDesc.textContent = `${stealingName} is conferring! Ask their captain for ONE answer. Then click Steal Successful or Steal Failed below.`;
      stealDeck.classList.remove('hidden');
    } else if (state.phase === 'ROUND_OVER') {
      hostPhaseBadge.textContent = 'PHASE: ROUND COMPLETE';
      hostPhaseDesc.textContent = 'Points awarded! Reveal any remaining answers for the audience, then click Next Round.';
      stealDeck.classList.add('hidden');
    } else if (state.phase === 'GAME_OVER') {
      const champ = state.winner === 'teamA' ? nameA : nameB;
      hostPhaseBadge.textContent = `PHASE: 🏆 ${champ} WINS MATCH!`;
      hostPhaseDesc.textContent = `${champ} reached 300+ points! Click "Start Fast Money" to launch the $20,000 bonus round.`;
      stealDeck.classList.add('hidden');
    } else if (state.phase === 'FAST_MONEY') {
      hostPhaseBadge.textContent = 'PHASE: FAST MONEY BONUS ROUND';
      hostPhaseDesc.textContent = 'Player 1 gets 20 seconds; Player 2 gets 25 seconds. Enter their answers and reveal points!';
      stealDeck.classList.add('hidden');
      renderFastMoneyInputs(state.fastMoney);
    }

    // Buzzer Deck
    const bState = state.buzzerState || {};
    if (bState.locked && bState.buzzedTeam) {
      buzzerLockStatus.textContent = 'LOCKED OUT';
      buzzerLockStatus.className = 'status-pill locked';

      const teamName = bState.buzzedTeam === 'teamA' ? nameA : nameB;
      const teamColor = bState.buzzedTeam === 'teamA' ? 'var(--team-a-color)' : 'var(--team-b-color)';
      firstBuzzSpotlight.className = 'first-buzz-spotlight spotlight-active';
      firstBuzzSpotlight.innerHTML = `
        <div class="spotlight-badge">⚡ BUZZED IN FIRST</div>
        <div class="spotlight-player">${bState.playerName || 'Player'}</div>
        <div class="spotlight-team" style="color: ${teamColor}">${teamName}</div>
      `;
      foBuzzerStatus.textContent = `${teamName.toUpperCase()} BUZZED FIRST`;
    } else {
      buzzerLockStatus.textContent = 'READY / UNLOCKED';
      buzzerLockStatus.className = 'status-pill ready';
      firstBuzzSpotlight.className = 'first-buzz-spotlight';
      firstBuzzSpotlight.innerHTML = `<div class="spotlight-placeholder">Buzzer unlocked. Ready for face-off.</div>`;
      foBuzzerStatus.textContent = 'WAITING FOR BUZZ';
    }

    // Buzzer History
    renderBuzzHistory(state.buzzHistory || []);
  }

  // Render Buzzer History
  function renderBuzzHistory(history) {
    buzzHistoryList.innerHTML = '';
    if (!history || history.length === 0) {
      buzzHistoryList.innerHTML = `<li class="empty-log">History will appear here when players buzz.</li>`;
      return;
    }

    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'buzz-log-item';
      const teamLabel = item.team === 'teamA' 
        ? (currentGameState && currentGameState.teamNames ? currentGameState.teamNames.teamA : 'TEAM A')
        : (currentGameState && currentGameState.teamNames ? currentGameState.teamNames.teamB : 'TEAM B');
      const teamColor = item.team === 'teamA' ? 'var(--team-a-color)' : 'var(--team-b-color)';

      li.innerHTML = `
        <span class="buzz-log-team" style="color: ${teamColor}">${teamLabel}</span>
        <span class="buzz-log-player">${item.playerName || 'Player'}</span>
        <span class="buzz-log-time">${item.timeFormatted || ''}</span>
      `;
      buzzHistoryList.appendChild(li);
    });
  }

  // Socket sync
  socket.on('connect', () => {
    console.log('Host connected to server');
    socket.emit('request-state');
  });

  socket.on('state-update', (state) => {
    updateHostUI(state);
  });

  // Action listeners
  btnLoadQuestion.addEventListener('click', () => {
    socket.emit('load-question');
  });

  btnRevealAll.addEventListener('click', () => {
    socket.emit('reveal-all');
  });

  btnHideAll.addEventListener('click', () => {
    socket.emit('hide-all');
  });

  btnAwardStrike.addEventListener('click', () => {
    socket.emit('award-strike');
  });

  btnClearStrikes.addEventListener('click', () => {
    socket.emit('clear-strikes');
  });

  btnAwardTeamA.addEventListener('click', () => {
    socket.emit('award-points', { team: 'teamA' });
  });

  btnAwardTeamB.addEventListener('click', () => {
    socket.emit('award-points', { team: 'teamB' });
  });

  btnResetBuzzer.addEventListener('click', () => {
    socket.emit('reset-buzzer');
  });

  btnNextRound.addEventListener('click', () => {
    socket.emit('next-round');
  });

  btnResetGame.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset the entire game? Scores will reset to 0.')) {
      socket.emit('reset-game');
    }
  });

  // Face-Off Decision Buttons (Play or Pass)
  document.querySelectorAll('.btn-fo-decision').forEach(btn => {
    btn.addEventListener('click', () => {
      const winner = btn.dataset.winner;
      const action = btn.dataset.action;
      socket.emit('face-off-decision', { winner, action });
    });
  });

  // Steal Resolution Buttons
  btnStealSuccess.addEventListener('click', () => {
    socket.emit('resolve-steal', { success: true });
  });

  btnStealFail.addEventListener('click', () => {
    socket.emit('resolve-steal', { success: false });
  });

  // Edit Family Names
  btnRenameTeams.addEventListener('click', () => {
    renameBar.classList.toggle('hidden');
    if (currentGameState && currentGameState.teamNames) {
      inputTeamAName.value = currentGameState.teamNames.teamA;
      inputTeamBName.value = currentGameState.teamNames.teamB;
    }
  });

  btnSaveNames.addEventListener('click', () => {
    const a = inputTeamAName.value.trim() || 'Team A';
    const b = inputTeamBName.value.trim() || 'Team B';
    socket.emit('rename-teams', { teamA: a, teamB: b });
    renameBar.classList.add('hidden');
  });

  // Fast Money Launch
  btnStartFastMoneyNav.addEventListener('click', () => {
    if (confirm('Start Fast Money Bonus Round for $20,000?')) {
      socket.emit('start-fast-money');
    }
  });

  btnTriggerFastMoney.addEventListener('click', () => {
    socket.emit('start-fast-money');
  });

  // Fast Money Timer
  btnFmTimerStart.addEventListener('click', () => {
    socket.emit('fast-money-timer', { action: 'start' });
  });

  btnFmTimerPause.addEventListener('click', () => {
    socket.emit('fast-money-timer', { action: 'pause' });
  });

  btnFmTimerReset.addEventListener('click', () => {
    socket.emit('fast-money-timer', { action: 'reset', player: activeFmPlayer });
  });

  // Fast Money Tabs
  btnTabP1.addEventListener('click', () => {
    activeFmPlayer = 1;
    btnTabP1.classList.add('active');
    btnTabP2.classList.remove('active');
    socket.emit('fast-money-switch-player', 1);
    if (currentGameState) renderFastMoneyInputs(currentGameState.fastMoney);
  });

  btnTabP2.addEventListener('click', () => {
    activeFmPlayer = 2;
    btnTabP2.classList.add('active');
    btnTabP1.classList.remove('active');
    socket.emit('fast-money-switch-player', 2);
    if (currentGameState) renderFastMoneyInputs(currentGameState.fastMoney);
  });

  // Quick adjustments
  document.querySelectorAll('.btn-adj').forEach(btn => {
    btn.addEventListener('click', () => {
      const team = btn.dataset.team;
      const delta = parseInt(btn.dataset.delta, 10);
      socket.emit('adjust-score', { team, delta });
    });
  });

  multSelect.addEventListener('change', () => {
    socket.emit('set-multiplier', multSelect.value);
  });

  // Custom question drawer toggles
  btnToggleCustom.addEventListener('click', () => {
    customDrawer.classList.toggle('hidden');
  });

  btnCancelCustom.addEventListener('click', () => {
    customDrawer.classList.add('hidden');
  });

  btnSaveCustom.addEventListener('click', () => {
    const qText = customQInput.value.trim();
    if (!qText) {
      alert('Please enter a question prompt.');
      return;
    }

    const answers = [];
    for (let i = 0; i < 8; i++) {
      const textVal = document.getElementById(`custom-text-${i}`).value.trim();
      const ptsVal = parseInt(document.getElementById(`custom-pts-${i}`).value, 10) || 0;
      if (textVal) {
        answers.push({ text: textVal, points: ptsVal });
      }
    }

    if (answers.length < 2) {
      alert('Please enter at least 2 answers.');
      return;
    }

    socket.emit('set-custom-question', {
      question: qText,
      answers: answers
    });

    customDrawer.classList.add('hidden');
    customQInput.value = '';
    setupCustomInputs();
  });
});
