// Family Feud Lobby Portal Client Logic
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const liveTeamAName = document.getElementById('live-team-a-name');
  const liveTeamBName = document.getElementById('live-team-b-name');
  const liveTeamAScore = document.getElementById('live-team-a-score');
  const liveTeamBScore = document.getElementById('live-team-b-score');
  const liveRoundNum = document.getElementById('live-round-num');
  const liveRoundMult = document.getElementById('live-round-mult');
  const livePhasePill = document.getElementById('live-phase-pill');
  const liveQuestionTicker = document.getElementById('live-question-ticker');

  const shareUrlText = document.getElementById('share-url-text');
  const btnCopyShareUrl = document.getElementById('btn-copy-share-url');
  const qrImage = document.getElementById('qr-image');
  const toastNotice = document.getElementById('toast-notice');

  const btnPopoutBoard = document.getElementById('btn-popout-board');
  const btnShowQr = document.getElementById('btn-show-qr');

  let currentBuzzerUrl = `${window.location.origin}/buzzer`;

  // Fetch Network Info & QR Code
  async function loadNetworkInfo() {
    try {
      const netRes = await fetch('/api/network-info');
      if (netRes.ok) {
        const netData = await netRes.json();
        if (netData.buzzerUrl) {
          currentBuzzerUrl = netData.buzzerUrl;
          shareUrlText.textContent = currentBuzzerUrl;
        }
      }
    } catch (e) {
      shareUrlText.textContent = currentBuzzerUrl;
    }

    try {
      const qrRes = await fetch(`/api/qr?url=${encodeURIComponent(currentBuzzerUrl)}`);
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        if (qrData.qr) {
          qrImage.src = qrData.qr;
        }
      }
    } catch (e) {
      console.warn('Could not load QR code:', e);
    }
  }
  loadNetworkInfo();

  // Copy Link Handler
  btnCopyShareUrl.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentBuzzerUrl).then(() => {
        showToast('✓ Buzzer Link Copied to Clipboard!');
      }).catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  });

  function fallbackCopy() {
    const tempInput = document.createElement('input');
    tempInput.value = currentBuzzerUrl;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('✓ Buzzer Link Copied to Clipboard!');
  }

  function showToast(msg) {
    toastNotice.textContent = msg;
    toastNotice.classList.add('show');
    setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 2500);
  }

  // Popout Board Window
  if (btnPopoutBoard) {
    btnPopoutBoard.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('/board', 'FamilyFeudBoard', 'width=1280,height=720,menubar=no,toolbar=no');
    });
  }

  // Scroll to QR frame
  if (btnShowQr) {
    btnShowQr.addEventListener('click', (e) => {
      e.preventDefault();
      const qrDeck = document.getElementById('party-share-deck');
      if (qrDeck) {
        qrDeck.scrollIntoView({ behavior: 'smooth' });
        qrDeck.style.borderColor = '#F2A900';
        setTimeout(() => {
          qrDeck.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }, 1200);
      }
    });
  }

  // Sound Test Buttons
  document.querySelectorAll('.sound-test-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const soundType = btn.dataset.sound;
      if (soundType === 'ding') window.soundEngine.playDing();
      else if (soundType === 'strike') window.soundEngine.playStrike();
      else if (soundType === 'buzz') window.soundEngine.playBuzz();
      else if (soundType === 'win') window.soundEngine.playWin();
    });
  });

  // Socket.io Live State Updates
  socket.on('connect', () => {
    socket.emit('request-state');
  });

  socket.on('state-update', (state) => {
    if (!state) return;

    // Team Names & Scores
    const nameA = (state.teamNames && state.teamNames.teamA) || 'Team A';
    const nameB = (state.teamNames && state.teamNames.teamB) || 'Team B';
    liveTeamAName.textContent = nameA;
    liveTeamBName.textContent = nameB;
    liveTeamAScore.textContent = state.scores.teamA || 0;
    liveTeamBScore.textContent = state.scores.teamB || 0;

    // Round & Multiplier
    liveRoundNum.textContent = `ROUND ${state.currentRound || 1}`;
    liveRoundMult.textContent = `${state.roundMultiplier || 1}X`;

    // Phase Pill
    const phase = state.phase || 'FACE_OFF';
    if (phase === 'FACE_OFF') {
      livePhasePill.textContent = '🔔 The Face-Off';
      livePhasePill.style.background = 'linear-gradient(90deg, #1E2D50, #2b3e6c)';
      livePhasePill.style.color = '#FFD166';
    } else if (phase === 'IN_PLAY') {
      const playingName = state.controllingTeam === 'teamA' ? nameA : nameB;
      livePhasePill.textContent = `▶ In Play: ${playingName}`;
      livePhasePill.style.background = 'linear-gradient(90deg, #0077b6, #00b4d8)';
      livePhasePill.style.color = '#FFFFFF';
    } else if (phase === 'STEAL_CHANCE') {
      livePhasePill.textContent = '⚡ 3 Strikes! Steal Attempt';
      livePhasePill.style.background = 'linear-gradient(90deg, #D90429, #990011)';
      livePhasePill.style.color = '#FFFFFF';
    } else if (phase === 'ROUND_OVER') {
      livePhasePill.textContent = '✓ Round Complete';
      livePhasePill.style.background = 'linear-gradient(90deg, #F2A900, #ffb703)';
      livePhasePill.style.color = '#0A1128';
    } else if (phase === 'GAME_OVER') {
      livePhasePill.textContent = '👑 Match Champions!';
      livePhasePill.style.background = 'linear-gradient(90deg, #F2A900, #ffb703)';
      livePhasePill.style.color = '#0A1128';
    } else if (phase === 'FAST_MONEY') {
      livePhasePill.textContent = '💵 Fast Money Bonus Round';
      livePhasePill.style.background = 'linear-gradient(90deg, #00c853, #00e676)';
      livePhasePill.style.color = '#0A1128';
    }

    // Question Ticker
    liveQuestionTicker.textContent = state.currentQuestion || 'Survey question waiting to be loaded...';
  });
});
