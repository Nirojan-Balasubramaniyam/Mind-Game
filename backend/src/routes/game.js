import { Router } from 'express';
import { getFirstQuestion, getNextTurn, submitLearnedAnswer } from '../services/ai.js';
import { recordGameResult } from '../data/leaderboard.js';

const router = Router();

function isQuotaError(err) {
  const msg = (err?.message || '').toLowerCase();
  const code = err?.status ?? err?.code ?? err?.statusCode;
  return code === 429 || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('429');
}

function sendApiError(res, err, defaultStatus = 500) {
  if (isQuotaError(err)) {
    return res.status(429).json({
      error: 'Quota exceeded',
      message:
        'Your API quota is used up or not available. Check your plan and billing, or try again later.',
    });
  }
  const message = err?.message || 'Something went wrong';
  res.status(defaultStatus).json({ error: message, message });
}

// In-memory game state by sessionId (use Redis/DB in production)
const games = new Map();

function getOrCreateGame(sessionId) {
  if (!games.has(sessionId)) {
    games.set(sessionId, {
      history: [],
      questionCount: 0,
      startedAt: Date.now(),
      theme: 'characters',
    });
  }
  return games.get(sessionId);
}

function normalizeTheme(theme) {
  const value = String(theme || '').trim().toLowerCase();
  if (value === 'animals') return 'animals';
  if (value === 'objects') return 'objects';
  return 'characters';
}

function clearGame(sessionId) {
  games.delete(sessionId);
}

function normalizeAnswer(answer) {
  return answer === "Don't know" ? "Don't know" : answer === 'Yes' ? 'Yes' : 'No';
}

/**
 * POST /api/game/start
 * Start a new game. Optionally pass sessionId in body to resume; omit to get a new game.
 * Returns: { sessionId, question, questionNumber }
 */
router.post('/start', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const theme = normalizeTheme(req.body.theme);
    clearGame(sessionId);
    const game = getOrCreateGame(sessionId);
    game.theme = theme;

    const result = await getFirstQuestion(theme);
    if (result.type === 'guess') {
      return res.json({
        sessionId,
        theme,
        action: 'guess',
        answer: result.answer,
        confidence: result.confidence,
        questionNumber: 1,
      });
    }

    game.questionCount = 1;
    game.lastQuestion = result.text;
    return res.json({
      sessionId,
      theme,
      action: 'question',
      question: result.text,
      questionNumber: 1,
    });
  } catch (err) {
    console.error('Game start error:', err);
    sendApiError(res, err, 500);
  }
});

/**
 * POST /api/game/answer
 * Body: { sessionId, answer: "Yes" | "No" | "Don't know" }
 * Returns: next question or guess.
 */
router.post('/answer', async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const normalized = normalizeAnswer(answer);

    const game = getOrCreateGame(sessionId);
    if (!game.lastQuestion) return res.status(400).json({ error: 'No current question; start a game first' });

    game.history.push({ question: game.lastQuestion, answer: normalized });
    game.questionCount = (game.questionCount || 0) + 1;

    const result = await getNextTurn(game.history, game.theme);

    if (result.type === 'guess') {
      const duration = Math.round((Date.now() - game.startedAt) / 1000);
      recordGameResult({ sessionId, duration, questionCount: game.questionCount });
      clearGame(sessionId);
      return res.json({
        action: 'guess',
        answer: result.answer,
        confidence: result.confidence,
        questionNumber: game.questionCount,
        durationSeconds: duration,
      });
    }

    game.lastQuestion = result.text;
    return res.json({
      action: 'question',
      question: result.text,
      questionNumber: game.questionCount,
    });
  } catch (err) {
    console.error('Game answer error:', err);
    sendApiError(res, err, 500);
  }
});

/**
 * POST /api/game/revise-answer
 * Body: { sessionId, turnIndex, answer }
 * Rewinds the game to a previous answered turn, replaces the answer, and regenerates from there.
 */
router.post('/revise-answer', async (req, res) => {
  try {
    const { sessionId, turnIndex, answer } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    if (!Number.isInteger(turnIndex) || turnIndex < 0) {
      return res.status(400).json({ error: 'Valid turnIndex required' });
    }

    const game = getOrCreateGame(sessionId);
    if (!game.history.length) {
      return res.status(400).json({ error: 'No answered questions to revise' });
    }
    if (turnIndex >= game.history.length) {
      return res.status(400).json({ error: 'turnIndex out of range' });
    }

    const normalized = normalizeAnswer(answer);
    const revisedTurn = game.history[turnIndex];

    game.history = game.history.slice(0, turnIndex);
    game.lastQuestion = revisedTurn.question;
    game.questionCount = turnIndex + 1;

    game.history.push({ question: revisedTurn.question, answer: normalized });
    game.questionCount += 1;

    const result = await getNextTurn(game.history, game.theme);

    if (result.type === 'guess') {
      const duration = Math.round((Date.now() - game.startedAt) / 1000);
      recordGameResult({ sessionId, duration, questionCount: game.questionCount });
      clearGame(sessionId);
      return res.json({
        action: 'guess',
        answer: result.answer,
        confidence: result.confidence,
        questionNumber: game.questionCount,
        durationSeconds: duration,
      });
    }

    game.lastQuestion = result.text;
    return res.json({
      action: 'question',
      question: result.text,
      questionNumber: game.questionCount,
    });
  } catch (err) {
    console.error('Game revise answer error:', err);
    sendApiError(res, err, 500);
  }
});

/**
 * POST /api/game/feedback
 * When AI guessed wrong: { sessionId, guessedAnswer, correctAnswer }
 */
router.post('/feedback', (req, res) => {
  try {
    const { guessedAnswer, correctAnswer } = req.body;
    if (!guessedAnswer || !correctAnswer) {
      return res.status(400).json({ error: 'guessedAnswer and correctAnswer required' });
    }
    submitLearnedAnswer(guessedAnswer, correctAnswer);
    res.json({ ok: true });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

/**
 * POST /api/game/reset
 * Clear game state for session (optional, client can also just call start again).
 */
router.post('/reset', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) clearGame(sessionId);
  res.json({ ok: true });
});

export default router;
