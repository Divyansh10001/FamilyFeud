// Mobile Player Buzzer Client Logic
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const connStatus = document.getElementById('connection-status');
  const playerNameInput = document.getElementById('player-name-input');
  const btnSelectTeamA = document.getElementById('btn-select-team-a');
  const btnSelectTeamB = document.getElementById('btn-select-team-b');
  const mainBuzzBtn = document.getElementById('main-buzz-btn');
  const buzzerStatusPill = document.getElementById('buzzer-status-pill');
  const buzzIcon = document.getElementById('buzz-icon');
  const buzzLabelPrimary = document.getElementById('buzz-label-primary');
  const buzzLabelSub = document.getElementById('buzz-label-sub');
  const buzzerFeedback = document.getElementById('buzzer-feedback');

  // Match Strip DOM Elements
  const stripTeamA = document.getElementById('strip-team-a');
  const stripTeamB = document.getElementById('strip-team-b');
  const stripNameA = document.getElementById('strip-name-a');
  const stripNameB = document.getElementById('strip-name-b');
  const stripScoreA = document.getElementById('strip-score-a');
  const stripScoreB = document.getElementById('strip-score-b');
  const stripRound = document.getElementById('strip-round');
  const stripBank = document.getElementById('strip-bank');

  // Player state
  let selectedTeam = localStorage.getItem('feud_team') || 'teamA';
  let playerName = localStorage.getItem('feud_name') || '';
  let isLockedLocally = false;
  let didIBuzzFirst = false;
  let latestTeamNames = { teamA: 'TEAM A', teamB: 'TEAM B' };

  // Restore saved player profile
  if (playerName) {
    playerNameInput.value = playerName;
  }
  setTeam(selectedTeam);

  function getTeamDisplayName(teamKeyOrName) {
    if (teamKeyOrName === 'teamA') return latestTeamNames.teamA || 'TEAM A';
    if (teamKeyOrName === 'teamB') return latestTeamNames.teamB || 'TEAM B';
    return teamKeyOrName || 'Opposing Team';
  }

  // Team Selection
  function setTeam(team) {
    selectedTeam = team;
    localStorage.setItem('feud_team', team);

    if (team === 'teamA') {
      btnSelectTeamA.classList.add('active');
      btnSelectTeamA.setAttribute('aria-checked', 'true');
      btnSelectTeamB.classList.remove('active');
      btnSelectTeamB.setAttribute('aria-checked', 'false');
    } else {
      btnSelectTeamB.classList.add('active');
      btnSelectTeamB.setAttribute('aria-checked', 'true');
      btnSelectTeamA.classList.remove('active');
      btnSelectTeamA.setAttribute('aria-checked', 'false');
    }
  }

  btnSelectTeamA.addEventListener('click', () => setTeam('teamA'));
  btnSelectTeamB.addEventListener('click', () => setTeam('teamB'));

  playerNameInput.addEventListener('input', (e) => {
    playerName = e.target.value.trim();
    localStorage.setItem('feud_name', playerName);
  });

  // Buzzer States UI
  function setBuzzerState(state, info = {}) {
    mainBuzzBtn.className = 'massive-buzz-btn';

    if (state === 'ready') {
      isLockedLocally = false;
      didIBuzzFirst = false;
      mainBuzzBtn.classList.add('ready');
      buzzerStatusPill.className = 'buzzer-status-pill';
      buzzerStatusPill.textContent = 'BUZZER UNLOCKED • READY';
      buzzIcon.textContent = '⚡';
      buzzLabelPrimary.textContent = 'BUZZ IN!';
      buzzLabelSub.textContent = 'TAP QUICKLY';
      buzzerFeedback.textContent = 'Ready! Tap the button the instant you know the answer.';
    } else if (state === 'winner') {
      isLockedLocally = true;
      didIBuzzFirst = true;
      mainBuzzBtn.classList.add('winner');
      buzzerStatusPill.className = 'buzzer-status-pill winner';
      buzzerStatusPill.textContent = '🎉 YOU WERE FIRST!';
      buzzIcon.textContent = '🏆';
      buzzLabelPrimary.textContent = 'YOU BUZZED!';
      buzzLabelSub.textContent = 'LOCKED IN FIRST';
      buzzerFeedback.textContent = 'Awesome! The host and game board see you buzzed first.';

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([120, 60, 120]);
      }
    } else if (state === 'locked') {
      isLockedLocally = true;
      didIBuzzFirst = false;
      mainBuzzBtn.classList.add('locked');
      buzzerStatusPill.className = 'buzzer-status-pill locked';
      buzzerStatusPill.textContent = 'LOCKED OUT';
      buzzIcon.textContent = '🔒';
      buzzLabelPrimary.textContent = 'LOCKED';

      const teamName = getTeamDisplayName(info.team);
      const player = info.playerName || 'Player';
      buzzLabelSub.textContent = `${player} (${teamName})`;
      buzzerFeedback.textContent = `${player} from ${teamName} buzzed in first! Waiting for host to reset.`;
    }
  }

  // Handle Trigger
  let lastTapTime = 0;
  function triggerBuzz(e) {
    if (e) {
      e.preventDefault();
    }
    const now = Date.now();
    if (now - lastTapTime < 280) return; // Prevent double trigger
    lastTapTime = now;

    if (isLockedLocally) {
      return;
    }

    const currentName = playerNameInput.value.trim() || 'Player';
    socket.emit('buzz', {
      team: selectedTeam,
      playerName: currentName
    });

    window.soundEngine.playBuzz();
  }

  // Mobile zero-delay touch events
  mainBuzzBtn.addEventListener('pointerdown', triggerBuzz);

  // Socket synchronization
  socket.on('connect', () => {
    connStatus.textContent = 'ONLINE';
    connStatus.className = 'conn-badge online';
    socket.emit('request-state');
  });

  socket.on('disconnect', () => {
    connStatus.textContent = 'OFFLINE';
    connStatus.className = 'conn-badge offline';
  });

  socket.on('state-update', (state) => {
    if (state.teamNames) {
      latestTeamNames = {
        teamA: state.teamNames.teamA || 'TEAM A',
        teamB: state.teamNames.teamB || 'TEAM B'
      };
      btnSelectTeamA.textContent = latestTeamNames.teamA;
      btnSelectTeamB.textContent = latestTeamNames.teamB;
      if (stripNameA) stripNameA.textContent = latestTeamNames.teamA;
      if (stripNameB) stripNameB.textContent = latestTeamNames.teamB;
    }

    // Update Match Scoreboard Strip
    if (stripScoreA && state.scores) stripScoreA.textContent = state.scores.teamA || 0;
    if (stripScoreB && state.scores) stripScoreB.textContent = state.scores.teamB || 0;
    if (stripRound) stripRound.textContent = `RD ${state.currentRound || 1} (${state.roundMultiplier || 1}X)`;
    if (stripBank) stripBank.textContent = `${state.boardPoints || 0} PTS`;

    // Highlight controlling team on strip
    if (stripTeamA && stripTeamB) {
      stripTeamA.classList.toggle('is-playing', state.controllingTeam === 'teamA');
      stripTeamB.classList.toggle('is-playing', state.controllingTeam === 'teamB');
    }

    const bState = state.buzzerState || {};
    if (bState.locked && bState.buzzedTeam) {
      const currentName = playerNameInput.value.trim() || 'Player';
      if (bState.buzzedTeam === selectedTeam && bState.playerName === currentName) {
        setBuzzerState('winner');
      } else {
        setBuzzerState('locked', { team: bState.buzzedTeam, playerName: bState.playerName });
      }
    } else {
      setBuzzerState('ready');
    }
  });

  socket.on('buzzed', (data) => {
    const currentName = playerNameInput.value.trim() || 'Player';
    if (data.team === selectedTeam && data.playerName === currentName) {
      setBuzzerState('winner');
    } else {
      setBuzzerState('locked', { team: data.team, playerName: data.playerName });
    }
  });

  socket.on('buzzer-reset', () => {
    setBuzzerState('ready');
  });

  socket.on('buzzer-locked-out', (data) => {
    setBuzzerState('locked', { team: data.buzzedTeam, playerName: data.playerName });
  });
});
