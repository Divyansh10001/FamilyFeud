const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Use native fetch (Node 18+) or fallback to cross-fetch
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    fetchFn = require('cross-fetch');
  } catch (e) {
    console.warn('Native fetch not found and cross-fetch not available.');
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const GITHUB_QUESTIONS_URL = 'https://raw.githubusercontent.com/alessioamo/Family-Feud/main/allQuestions.json';

// In-memory dataset of eligible questions
let eligibleQuestions = [];

// Global Server-Side Game State following authentic Family Feud TV rules
const gameState = {
  currentRound: 1,
  roundMultiplier: 1, // Round 1: 1x, Round 2: 1x, Round 3: 2x, Round 4+: 3x
  scores: {
    teamA: 0,
    teamB: 0
  },
  teamNames: {
    teamA: 'Team A',
    teamB: 'Team B'
  },
  targetScore: 300, // 300 points to win the main game and advance to Fast Money
  currentQuestion: '',
  currentAnswers: [], // Array of { text: string, points: number }
  revealedAnswers: [], // Indices of revealed answers
  strikes: 0, // 0 to 3
  boardPoints: 0, // Current points accumulated in the bank

  // TV Show Phase:
  // 'FACE_OFF' | 'DECISION' | 'IN_PLAY' | 'STEAL_CHANCE' | 'ROUND_OVER' | 'FAST_MONEY' | 'GAME_OVER'
  phase: 'FACE_OFF',
  controllingTeam: null, // 'teamA' | 'teamB'
  stealingTeam: null,    // The opposing team when controllingTeam gets 3 strikes
  faceOffWinner: null,   // Team that won the face-off
  winner: null,          // Team that reached targetScore

  buzzerState: {
    locked: false,
    buzzedTeam: null,
    playerName: null,
    timestamp: null
  },
  buzzHistory: [],

  // Fast Money Bonus Round State
  fastMoney: {
    active: false,
    currentPlayer: 1, // 1 or 2
    timer: 20, // 20s for Player 1, 25s for Player 2
    timerRunning: false,
    timerMax: 20,
    questions: [], // 5 survey questions
    player1Answers: [
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false }
    ],
    player2Answers: [
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false },
      { text: '', points: 0, revealed: false }
    ],
    totalScore: 0,
    targetScore: 200,
    wonGrandPrize: false
  }
};

let fastMoneyInterval = null;

// Helper to decode HTML entities and clean text
function cleanText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&x22;/g, '"')
    .replace(/&#x22;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Calculate board points based on revealed answers and round multiplier
function calculateBoardPoints() {
  const basePoints = gameState.revealedAnswers.reduce((sum, idx) => {
    const ans = gameState.currentAnswers[idx];
    return sum + (ans && typeof ans.points === 'number' ? ans.points : 0);
  }, 0);
  gameState.boardPoints = basePoints * (gameState.roundMultiplier || 1);
  return gameState.boardPoints;
}

// Calculate Fast Money total score
function calculateFastMoneyTotal() {
  let total = 0;
  gameState.fastMoney.player1Answers.forEach(item => {
    if (item.revealed) total += (parseInt(item.points, 10) || 0);
  });
  gameState.fastMoney.player2Answers.forEach(item => {
    if (item.revealed) total += (parseInt(item.points, 10) || 0);
  });
  gameState.fastMoney.totalScore = total;
  gameState.fastMoney.wonGrandPrize = (total >= gameState.fastMoney.targetScore);
  return total;
}

// Format raw question entry into standard structure
function formatQuestionData(questionKey, rawAnswers) {
  if (!Array.isArray(rawAnswers)) return null;
  const answers = rawAnswers
    .map(item => ({
      text: cleanText(Array.isArray(item) ? item[0] : item.text || ''),
      points: parseInt(Array.isArray(item) ? item[1] : item.points, 10) || 0
    }))
    .filter(a => a.text.length > 0)
    .sort((a, b) => b.points - a.points);

  if (answers.length < 2 || answers.length > 8) {
    return null; // Ignore questions with more than 8 answers as required
  }

  return {
    question: cleanText(questionKey),
    answers: answers
  };
}

// Parse raw data object into eligibleQuestions array
function parseQuestionsDataset(rawData) {
  const parsed = [];
  for (const [key, answers] of Object.entries(rawData)) {
    const formatted = formatQuestionData(key, answers);
    if (formatted) {
      parsed.push(formatted);
    }
  }
  return parsed;
}

// Load Questions from GitHub with local fallback
async function loadQuestions() {
  console.log('🔄 Fetching Family Feud questions from GitHub URL:', GITHUB_QUESTIONS_URL);
  let rawData = null;

  try {
    if (fetchFn) {
      const response = await fetchFn(GITHUB_QUESTIONS_URL);
      if (response.ok) {
        rawData = await response.json();
        console.log('✅ Successfully downloaded questions from GitHub!');
      } else {
        throw new Error(`GitHub responded with status: ${response.status}`);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Network fetch failed: ${err.message}. Attempting local allQuestions.json fallback...`);
  }

  // Fallback to local file if fetch failed or returned null
  if (!rawData) {
    try {
      const localPath = path.join(__dirname, 'allQuestions.json');
      if (fs.existsSync(localPath)) {
        const fileContent = fs.readFileSync(localPath, 'utf8');
        rawData = JSON.parse(fileContent);
        console.log('✅ Successfully loaded questions from local allQuestions.json fallback.');
      }
    } catch (localErr) {
      console.error('❌ Failed to load local questions file:', localErr.message);
    }
  }

  if (rawData) {
    eligibleQuestions = parseQuestionsDataset(rawData);
    console.log(`📋 Total eligible questions (<= 8 answers): ${eligibleQuestions.length}`);
  } else {
    // Hardcoded safety fallback in case neither source succeeded
    console.warn('⚠️ Using embedded emergency question set.');
    eligibleQuestions = [
      {
        question: "Name something you associate with Egypt",
        answers: [
          { text: "Pyramids", points: 77 },
          { text: "Sphinx", points: 7 },
          { text: "Camels", points: 4 },
          { text: "Nile River", points: 3 },
          { text: "Desert", points: 3 },
          { text: "Cleopatra", points: 2 },
          { text: "Pharaoh", points: 2 },
          { text: "Mummies", points: 1 }
        ]
      }
    ];
  }

  // Select initial random question
  selectRandomQuestion();
}

// Select a random question and update game state for standard round
function selectRandomQuestion() {
  if (eligibleQuestions.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * eligibleQuestions.length);
  const selected = eligibleQuestions[randomIndex];

  gameState.currentQuestion = selected.question;
  gameState.currentAnswers = selected.answers;
  gameState.revealedAnswers = [];
  gameState.strikes = 0;
  gameState.phase = 'FACE_OFF';
  gameState.controllingTeam = null;
  gameState.stealingTeam = null;
  gameState.faceOffWinner = null;
  gameState.buzzerState = {
    locked: false,
    buzzedTeam: null,
    playerName: null,
    timestamp: null
  };
  calculateBoardPoints();

  console.log(`🎯 Loaded Question: "${gameState.currentQuestion}" with ${gameState.currentAnswers.length} answers.`);
  return selected;
}

// Setup Fast Money with 5 questions
function setupFastMoney() {
  if (eligibleQuestions.length < 5) return;
  const shuffled = [...eligibleQuestions].sort(() => 0.5 - Math.random());
  const selected5 = shuffled.slice(0, 5);

  gameState.fastMoney = {
    active: true,
    currentPlayer: 1,
    timer: 20,
    timerRunning: false,
    timerMax: 20,
    questions: selected5,
    player1Answers: selected5.map(() => ({ text: '', points: 0, revealed: false })),
    player2Answers: selected5.map(() => ({ text: '', points: 0, revealed: false })),
    totalScore: 0,
    targetScore: 200,
    wonGrandPrize: false
  };
  gameState.phase = 'FAST_MONEY';
  if (fastMoneyInterval) {
    clearInterval(fastMoneyInterval);
    fastMoneyInterval = null;
  }
}

// Check if a team has won the overall match (300 points)
function checkMatchWinner() {
  if (gameState.scores.teamA >= gameState.targetScore) {
    gameState.winner = 'teamA';
    gameState.phase = 'GAME_OVER';
    io.emit('game-over', { winner: 'teamA', score: gameState.scores.teamA });
    return true;
  } else if (gameState.scores.teamB >= gameState.targetScore) {
    gameState.winner = 'teamB';
    gameState.phase = 'GAME_OVER';
    io.emit('game-over', { winner: 'teamB', score: gameState.scores.teamB });
    return true;
  }
  return false;
}

// Middleware & Static files
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Specific View Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/board', (req, res) => res.sendFile(path.join(__dirname, 'public', 'board.html')));
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/buzzer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'buzzer.html')));

const os = require('os');
const QRCode = require('qrcode');

// REST API endpoints
app.get('/api/state', (req, res) => res.json(gameState));
app.get('/api/random-question', (req, res) => {
  const q = selectRandomQuestion();
  io.emit('state-update', gameState);
  io.emit('question-loaded', { question: gameState.currentQuestion, answersCount: gameState.currentAnswers.length });
  res.json(q);
});

app.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  const hostIp = ips[0] || 'localhost';
  res.json({
    localIp: hostIp,
    port: PORT,
    buzzerUrl: `http://${hostIp}:${PORT}/buzzer`
  });
});

app.get('/api/qr', async (req, res) => {
  try {
    const text = req.query.url || `http://localhost:${PORT}/buzzer`;
    const dataUrl = await QRCode.toDataURL(text, {
      margin: 2,
      width: 280,
      color: {
        dark: '#0A1128',
        light: '#FFFFFF'
      }
    });
    res.json({ qr: dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io Real-Time Synchronization
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send initial state to newly connected client
  socket.emit('state-update', gameState);

  // Request latest state
  socket.on('request-state', () => {
    socket.emit('state-update', gameState);
  });

  // Host loads new random question
  socket.on('load-question', () => {
    selectRandomQuestion();
    io.emit('state-update', gameState);
    io.emit('question-loaded', {
      question: gameState.currentQuestion,
      answersCount: gameState.currentAnswers.length
    });
  });

  // Rename Teams
  socket.on('rename-teams', (data) => {
    if (data) {
      if (data.teamA) gameState.teamNames.teamA = cleanText(data.teamA);
      if (data.teamB) gameState.teamNames.teamB = cleanText(data.teamB);
      io.emit('state-update', gameState);
    }
  });

  // Host sets custom question
  socket.on('set-custom-question', (data) => {
    if (data && data.question && Array.isArray(data.answers)) {
      gameState.currentQuestion = cleanText(data.question);
      gameState.currentAnswers = data.answers.slice(0, 8).map(a => ({
        text: cleanText(a.text),
        points: parseInt(a.points, 10) || 0
      }));
      gameState.revealedAnswers = [];
      gameState.strikes = 0;
      gameState.phase = 'FACE_OFF';
      gameState.controllingTeam = null;
      gameState.stealingTeam = null;
      gameState.buzzerState = {
        locked: false,
        buzzedTeam: null,
        playerName: null,
        timestamp: null
      };
      calculateBoardPoints();
      io.emit('state-update', gameState);
      io.emit('question-loaded', {
        question: gameState.currentQuestion,
        answersCount: gameState.currentAnswers.length
      });
    }
  });

  // Face-Off Resolution: Winner chosen & Play or Pass
  // data: { winner: 'teamA'|'teamB', action: 'play'|'pass' }
  socket.on('face-off-decision', (data) => {
    if (!data || !data.winner) return;
    const winningTeam = data.winner;
    gameState.faceOffWinner = winningTeam;

    if (data.action === 'play') {
      gameState.controllingTeam = winningTeam;
    } else {
      // Passed to opposing team
      gameState.controllingTeam = winningTeam === 'teamA' ? 'teamB' : 'teamA';
    }

    gameState.stealingTeam = gameState.controllingTeam === 'teamA' ? 'teamB' : 'teamA';
    gameState.phase = 'IN_PLAY';
    gameState.buzzerState.locked = true; // Lock buzzer during play

    io.emit('face-off-decided', {
      winner: winningTeam,
      controllingTeam: gameState.controllingTeam,
      action: data.action
    });
    io.emit('state-update', gameState);
  });

  // Host reveals specific answer index
  socket.on('reveal-answer', (index) => {
    const idx = parseInt(index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < gameState.currentAnswers.length) {
      if (!gameState.revealedAnswers.includes(idx)) {
        gameState.revealedAnswers.push(idx);
        calculateBoardPoints();
        const ans = gameState.currentAnswers[idx];

        io.emit('answer-revealed', {
          index: idx,
          answer: ans,
          boardPoints: gameState.boardPoints,
          isTopAnswer: idx === 0
        });

        // Check if all answers on board are cleared while in play
        if (gameState.phase === 'IN_PLAY' && gameState.revealedAnswers.length === gameState.currentAnswers.length) {
          // Playing team cleared the board! Automatic win of the bank points
          const team = gameState.controllingTeam;
          if (team) {
            const wonPts = gameState.boardPoints;
            gameState.scores[team] += wonPts;
            gameState.phase = 'ROUND_OVER';
            gameState.boardPoints = 0;

            io.emit('board-cleared', {
              team,
              pointsAwarded: wonPts,
              newScore: gameState.scores[team]
            });
            checkMatchWinner();
          }
        }

        io.emit('state-update', gameState);
      }
    }
  });

  // Host hides specific answer index
  socket.on('hide-answer', (index) => {
    const idx = parseInt(index, 10);
    if (!isNaN(idx)) {
      gameState.revealedAnswers = gameState.revealedAnswers.filter(i => i !== idx);
      calculateBoardPoints();
      io.emit('state-update', gameState);
    }
  });

  // Host reveals all answers
  socket.on('reveal-all', () => {
    gameState.revealedAnswers = gameState.currentAnswers.map((_, i) => i);
    calculateBoardPoints();
    io.emit('state-update', gameState);
  });

  // Host hides all answers
  socket.on('hide-all', () => {
    gameState.revealedAnswers = [];
    calculateBoardPoints();
    io.emit('state-update', gameState);
  });

  // Award Strike according to real rules
  socket.on('award-strike', () => {
    if (gameState.strikes < 3) {
      gameState.strikes += 1;
    }

    io.emit('strike-awarded', { strikes: gameState.strikes });

    // REAL SHOW RULE: If 3 strikes reached while in play, OPPOSING TEAM GETS CHANCE TO STEAL!
    if (gameState.strikes === 3 && gameState.phase === 'IN_PLAY') {
      gameState.phase = 'STEAL_CHANCE';
      gameState.stealingTeam = gameState.controllingTeam === 'teamA' ? 'teamB' : 'teamA';
      io.emit('steal-chance', {
        stealingTeam: gameState.stealingTeam,
        controllingTeam: gameState.controllingTeam,
        boardPoints: gameState.boardPoints
      });
    }

    io.emit('state-update', gameState);
  });

  // Host clears strikes
  socket.on('clear-strikes', () => {
    gameState.strikes = 0;
    io.emit('strikes-cleared');
    io.emit('state-update', gameState);
  });

  // Resolve The Steal (Real Show Rule)
  // data: { success: boolean, answerIndex?: number }
  socket.on('resolve-steal', (data) => {
    if (gameState.phase !== 'STEAL_CHANCE') return;
    const isSuccess = Boolean(data && data.success);
    const awardedPoints = gameState.boardPoints;

    if (isSuccess) {
      // Steal SUCCESSFUL! Opposing team gets all bank points
      const winnerTeam = gameState.stealingTeam;
      gameState.scores[winnerTeam] += awardedPoints;

      // Reveal the stolen answer if specified
      if (typeof data.answerIndex === 'number' && !gameState.revealedAnswers.includes(data.answerIndex)) {
        gameState.revealedAnswers.push(data.answerIndex);
      }

      gameState.phase = 'ROUND_OVER';
      gameState.boardPoints = 0;

      io.emit('steal-resolved', {
        success: true,
        winningTeam: winnerTeam,
        pointsAwarded: awardedPoints,
        newScore: gameState.scores[winnerTeam]
      });
    } else {
      // Steal FAILED! Original playing team keeps the bank points
      const winnerTeam = gameState.controllingTeam;
      gameState.scores[winnerTeam] += awardedPoints;

      gameState.phase = 'ROUND_OVER';
      gameState.boardPoints = 0;

      // Strike sound for failed steal
      io.emit('strike-awarded', { strikes: 3 });

      io.emit('steal-resolved', {
        success: false,
        winningTeam: winnerTeam,
        pointsAwarded: awardedPoints,
        newScore: gameState.scores[winnerTeam]
      });
    }

    // Automatically reveal remaining answers so viewers and families see the board
    gameState.revealedAnswers = gameState.currentAnswers.map((_, i) => i);
    checkMatchWinner();
    io.emit('state-update', gameState);
  });

  // Award points to a team directly
  socket.on('award-points', (data) => {
    const team = data && (data.team === 'teamA' || data.team === 'teamB') ? data.team : null;
    if (team) {
      const awarded = gameState.boardPoints;
      gameState.scores[team] += awarded;
      gameState.boardPoints = 0;
      gameState.phase = 'ROUND_OVER';
      
      io.emit('points-awarded', {
        team: team,
        pointsAwarded: awarded,
        newScore: gameState.scores[team],
        scores: gameState.scores
      });

      checkMatchWinner();
      io.emit('state-update', gameState);
    }
  });

  // Manual score adjustments
  socket.on('adjust-score', (data) => {
    if (data && (data.team === 'teamA' || data.team === 'teamB')) {
      const delta = parseInt(data.delta, 10) || 0;
      gameState.scores[data.team] = Math.max(0, gameState.scores[data.team] + delta);
      checkMatchWinner();
      io.emit('state-update', gameState);
    }
  });

  // Mobile Buzzer: Player buzzes in
  socket.on('buzz', (data) => {
    const team = data && (data.team === 'teamA' || data.team === 'teamB') ? data.team : 'teamA';
    const playerName = (data && data.playerName && data.playerName.trim()) || 'Player';

    // Only allow buzz during FACE_OFF phase when unlocked
    if (!gameState.buzzerState.locked && (gameState.phase === 'FACE_OFF' || !gameState.phase)) {
      gameState.buzzerState.locked = true;
      gameState.buzzerState.buzzedTeam = team;
      gameState.buzzerState.playerName = playerName;
      gameState.buzzerState.timestamp = Date.now();

      const buzzRecord = {
        id: Date.now(),
        team,
        playerName,
        timeFormatted: new Date().toLocaleTimeString(),
        timestamp: Date.now()
      };
      gameState.buzzHistory.unshift(buzzRecord);
      if (gameState.buzzHistory.length > 20) gameState.buzzHistory.pop();

      console.log(`🚨 BUZZ! ${playerName} (${team}) buzzed in first!`);

      io.emit('buzzed', {
        team,
        playerName,
        timestamp: gameState.buzzerState.timestamp
      });
      io.emit('state-update', gameState);
    } else {
      socket.emit('buzzer-locked-out', {
        buzzedTeam: gameState.buzzerState.buzzedTeam,
        playerName: gameState.buzzerState.playerName
      });
    }
  });

  // Host resets / unlocks buzzer
  socket.on('reset-buzzer', () => {
    gameState.buzzerState = {
      locked: false,
      buzzedTeam: null,
      playerName: null,
      timestamp: null
    };
    io.emit('buzzer-reset');
    io.emit('state-update', gameState);
    console.log('🔔 Buzzer unlocked by host.');
  });

  // Next Round flow with automatic real show multipliers
  socket.on('next-round', () => {
    gameState.currentRound += 1;
    const r = gameState.currentRound;

    // Real TV Show Multiplier progression:
    // Round 1: 1X
    // Round 2: 1X
    // Round 3: 2X (Double)
    // Round 4+: 3X (Triple)
    if (r === 1 || r === 2) gameState.roundMultiplier = 1;
    else if (r === 3) gameState.roundMultiplier = 2;
    else gameState.roundMultiplier = 3;

    selectRandomQuestion();
    io.emit('state-update', gameState);
    io.emit('question-loaded', {
      question: gameState.currentQuestion,
      answersCount: gameState.currentAnswers.length
    });
  });

  socket.on('set-multiplier', (mult) => {
    gameState.roundMultiplier = Math.max(1, parseInt(mult, 10) || 1);
    calculateBoardPoints();
    io.emit('state-update', gameState);
  });

  // Start Fast Money bonus round
  socket.on('start-fast-money', () => {
    setupFastMoney();
    io.emit('state-update', gameState);
    io.emit('fast-money-started');
  });

  // Fast Money Timer Controls
  // data: { action: 'start' | 'pause' | 'reset', player: 1 | 2 }
  socket.on('fast-money-timer', (data) => {
    if (!data) return;

    if (data.action === 'start') {
      if (fastMoneyInterval) clearInterval(fastMoneyInterval);
      gameState.fastMoney.timerRunning = true;
      io.emit('fast-money-timer-update', {
        timer: gameState.fastMoney.timer,
        running: true
      });

      fastMoneyInterval = setInterval(() => {
        if (gameState.fastMoney.timer > 0) {
          gameState.fastMoney.timer -= 1;
          io.emit('fast-money-timer-update', {
            timer: gameState.fastMoney.timer,
            running: true
          });
        } else {
          // Time expired!
          clearInterval(fastMoneyInterval);
          fastMoneyInterval = null;
          gameState.fastMoney.timerRunning = false;
          io.emit('fast-money-timer-expired');
          io.emit('state-update', gameState);
        }
      }, 1000);
    } else if (data.action === 'pause') {
      if (fastMoneyInterval) {
        clearInterval(fastMoneyInterval);
        fastMoneyInterval = null;
      }
      gameState.fastMoney.timerRunning = false;
      io.emit('fast-money-timer-update', {
        timer: gameState.fastMoney.timer,
        running: false
      });
      io.emit('state-update', gameState);
    } else if (data.action === 'reset') {
      if (fastMoneyInterval) {
        clearInterval(fastMoneyInterval);
        fastMoneyInterval = null;
      }
      const playerNum = data.player || gameState.fastMoney.currentPlayer;
      const initialSec = playerNum === 1 ? 20 : 25; // Real rule: 20s for P1, 25s for P2
      gameState.fastMoney.timer = initialSec;
      gameState.fastMoney.timerMax = initialSec;
      gameState.fastMoney.timerRunning = false;
      io.emit('fast-money-timer-update', {
        timer: gameState.fastMoney.timer,
        running: false
      });
      io.emit('state-update', gameState);
    }
  });

  // Fast Money: Switch between Player 1 and Player 2
  socket.on('fast-money-switch-player', (playerNum) => {
    const num = playerNum === 2 ? 2 : 1;
    gameState.fastMoney.currentPlayer = num;
    const initialSec = num === 1 ? 20 : 25;
    gameState.fastMoney.timer = initialSec;
    gameState.fastMoney.timerMax = initialSec;
    gameState.fastMoney.timerRunning = false;
    if (fastMoneyInterval) {
      clearInterval(fastMoneyInterval);
      fastMoneyInterval = null;
    }
    io.emit('state-update', gameState);
  });

  // Fast Money: Set answer text & points
  socket.on('fast-money-set-answer', (data) => {
    // data: { player: 1|2, qIndex: 0..4, text: string, points: number, revealed: boolean }
    if (!data) return;
    const list = data.player === 1 ? gameState.fastMoney.player1Answers : gameState.fastMoney.player2Answers;
    if (list[data.qIndex]) {
      if (data.text !== undefined) list[data.qIndex].text = cleanText(data.text);
      if (data.points !== undefined) list[data.qIndex].points = Math.max(0, parseInt(data.points, 10) || 0);
      if (data.revealed !== undefined) list[data.qIndex].revealed = Boolean(data.revealed);
      calculateFastMoneyTotal();
      io.emit('state-update', gameState);
      if (data.revealed) {
        io.emit('fast-money-reveal', {
          player: data.player,
          qIndex: data.qIndex,
          points: list[data.qIndex].points,
          total: gameState.fastMoney.totalScore
        });
      }
    }
  });

  // Reset entire game
  socket.on('reset-game', () => {
    gameState.currentRound = 1;
    gameState.roundMultiplier = 1;
    gameState.scores = { teamA: 0, teamB: 0 };
    gameState.winner = null;
    gameState.buzzHistory = [];
    gameState.fastMoney.active = false;
    if (fastMoneyInterval) {
      clearInterval(fastMoneyInterval);
      fastMoneyInterval = null;
    }
    selectRandomQuestion();
    io.emit('state-update', gameState);
    console.log('🔄 Game reset to Round 1 with scores 0-0.');
  });

  socket.on('disconnect', () => {});
});

// Start Server
server.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`🌟 Family Feud Server running on port ${PORT}`);
  console.log(`📺 Board view:   http://localhost:${PORT}/board`);
  console.log(`🎛️ Host control: http://localhost:${PORT}/host`);
  console.log(`📱 Player buzzer: http://localhost:${PORT}/buzzer`);
  console.log(`🏠 Lobby/Hub:    http://localhost:${PORT}/`);
  console.log(`=========================================`);
  await loadQuestions();
});
