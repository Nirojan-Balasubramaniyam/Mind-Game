import { useState, useCallback, useMemo } from 'react';
import { gameApi } from '../api/client';
import AnswerButtons from './AnswerButtons';
import ResultScreen from './ResultScreen';
import ThinkingAnimation from './ThinkingAnimation';
import { playSound } from '../utils/sounds';

const STATES = { idle: 'idle', thinking: 'thinking', question: 'question', result: 'result' };
const THEMES = [
  {
    id: 'characters',
    label: 'Characters',
    description: 'Real people or fictional characters',
  },
  {
    id: 'objects',
    label: 'Objects',
    description: 'Tools, devices, household things',
  },
  {
    id: 'animals',
    label: 'Animals',
    description: 'Pets, wild animals, sea creatures',
  },
];

function getTurnsFromMessages(messages) {
  const turns = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant') {
      turns.push({ question: messages[i].content, answer: null, questionNumber: messages[i].questionNumber });
    } else if (messages[i].role === 'user' && turns.length > 0) {
      turns[turns.length - 1].answer = messages[i].content;
    }
  }
  return turns;
}

function getMessagesFromTurns(turns) {
  return turns.flatMap((turn) => {
    const messages = [
      {
        id: `${turn.questionNumber ?? turn.question}-q`,
        role: 'assistant',
        content: turn.question,
        questionNumber: turn.questionNumber,
      },
    ];

    if (turn.answer != null) {
      messages.push({
        id: `${turn.questionNumber ?? turn.question}-a`,
        role: 'user',
        content: turn.answer,
      });
    }

    return messages;
  });
}

export default function Game() {
  const [state, setState] = useState(STATES.idle);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState('characters');

  const turns = useMemo(() => getTurnsFromMessages(messages), [messages]);
  const currentTurn = turns[viewIndex];
  const isCurrentQuestion = viewIndex === turns.length - 1 && currentTurn && currentTurn.answer === null;
  const isAnsweredTurn = !!currentTurn && currentTurn.answer != null;
  const canGoPrev = viewIndex > 0;
  const canGoNext = viewIndex < turns.length - 1;
  const selectedThemeLabel = THEMES.find((theme) => theme.id === selectedTheme)?.label || 'Characters';

  const addMessage = useCallback((role, content, meta = {}) => {
    setMessages((prev) => [...prev, { id: Date.now(), role, content, ...meta }]);
  }, []);

  const quitGame = useCallback(() => {
    setState(STATES.idle);
    setMessages([]);
    setQuestionNumber(0);
    setResult(null);
    setSessionId(null);
    setError(null);
    setViewIndex(0);
  }, []);

  const startGame = useCallback(async () => {
    setError(null);
    setMessages([]);
    setQuestionNumber(0);
    setResult(null);
    setSessionId(null);
    setViewIndex(0);
    setState(STATES.thinking);
    playSound('start');
    try {
      const data = await gameApi.start(selectedTheme);
      setSessionId(data.sessionId);
      if (data.action === 'guess') {
        setResult({ answer: data.answer, confidence: data.confidence, questionNumber: data.questionNumber });
        setState(STATES.result);
        playSound('result');
        return;
      }
      addMessage('assistant', data.question, { questionNumber: data.questionNumber });
      setQuestionNumber(data.questionNumber);
      setState(STATES.question);
      setViewIndex(0);
    } catch (err) {
      setError(err.message);
      setState(STATES.idle);
      playSound('error');
    }
  }, [addMessage, selectedTheme]);

  const sendAnswer = useCallback(
    async (answer) => {
      if (!sessionId || state !== STATES.question) return;
      const lastMsg = messages[messages.length - 1];
      addMessage('user', answer, { question: lastMsg?.content });
      setState(STATES.thinking);
      playSound('answer');
      try {
        const data = await gameApi.answer(sessionId, answer);
        if (data.action === 'guess') {
          setResult({
            answer: data.answer,
            confidence: data.confidence,
            questionNumber: data.questionNumber,
            durationSeconds: data.durationSeconds,
          });
          setState(STATES.result);
          playSound('result');
          return;
        }
        addMessage('assistant', data.question, { questionNumber: data.questionNumber });
        setQuestionNumber(data.questionNumber);
        setState(STATES.question);
        setViewIndex((i) => i + 1);
      } catch (err) {
        setError(err.message);
        setState(STATES.question);
        playSound('error');
      }
    },
    [sessionId, state, messages, addMessage]
  );

  const reviseAnswer = useCallback(
    async (answer) => {
      if (!sessionId || state !== STATES.question || !isAnsweredTurn || !currentTurn) return;

      setError(null);
      setState(STATES.thinking);
      playSound('answer');

      try {
        const data = await gameApi.reviseAnswer(sessionId, viewIndex, answer);
        const rebuiltTurns = [
          ...turns.slice(0, viewIndex),
          {
            question: currentTurn.question,
            answer,
            questionNumber: currentTurn.questionNumber ?? viewIndex + 1,
          },
        ];

        setMessages(
          getMessagesFromTurns(
            data.action === 'question'
              ? [...rebuiltTurns, { question: data.question, answer: null, questionNumber: data.questionNumber }]
              : rebuiltTurns
          )
        );

        if (data.action === 'guess') {
          setResult({
            answer: data.answer,
            confidence: data.confidence,
            questionNumber: data.questionNumber,
            durationSeconds: data.durationSeconds,
          });
          setState(STATES.result);
          playSound('result');
          return;
        }

        setQuestionNumber(data.questionNumber);
        setViewIndex(rebuiltTurns.length);
        setState(STATES.question);
      } catch (err) {
        setError(err.message);
        setState(STATES.question);
        playSound('error');
      }
    },
    [sessionId, state, isAnsweredTurn, currentTurn, viewIndex, turns]
  );

  const handleResultClose = useCallback(() => {
    setResult(null);
    setState(STATES.idle);
    setMessages([]);
    setSessionId(null);
    setViewIndex(0);
  }, []);

  const handleFeedbackWrong = useCallback(
    async (guessedAnswer, correctAnswer) => {
      try {
        await gameApi.feedback(guessedAnswer, correctAnswer);
      } catch (_) {}
      handleResultClose();
    },
    [handleResultClose]
  );

  if (state === STATES.result && result) {
    return (
      <ResultScreen
        result={result}
        onClose={handleResultClose}
        onQuit={quitGame}
        onFeedbackWrong={handleFeedbackWrong}
      />
    );
  }

  return (
    <div className="game">
      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}
      {state === STATES.idle && (
        <div className="start-screen">
          <p>Select the game thematic first. That keeps the search space smaller and the questions sharper.</p>
          <div className="theme-grid" role="radiogroup" aria-label="Game thematic">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`theme-card ${selectedTheme === theme.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedTheme(theme.id)}
                aria-pressed={selectedTheme === theme.id}
              >
                <span className="theme-card-title">{theme.label}</span>
                <span className="theme-card-description">{theme.description}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={startGame}>
            Start {selectedThemeLabel} Game
          </button>
        </div>
      )}
      {(state === STATES.question || state === STATES.thinking) && (
        <>
          <div className="progress-bar">
            <span>Question {questionNumber}</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(100, (questionNumber / 20) * 100)}%` }} />
            </div>
          </div>

          <div className="single-question-view">
            {currentTurn ? (
              <>
                <div className="question-card">
                  <p className="question-card-label">Question {currentTurn.questionNumber ?? viewIndex + 1}</p>
                  <p className="question-card-text">{currentTurn.question}</p>
                  {currentTurn.answer != null && (
                    <p className="question-card-answer">You answered: <strong>{currentTurn.answer}</strong></p>
                  )}
                </div>
                {state === STATES.thinking && (
                  <div className="thinking-inline">
                    <ThinkingAnimation />
                  </div>
                )}
                {isAnsweredTurn && state === STATES.question && (
                  <div className="revise-answer-panel">
                    <p className="revise-answer-label">Change this answer and rebuild the next questions.</p>
                    <AnswerButtons onAnswer={reviseAnswer} disabled={false} />
                  </div>
                )}
                {isCurrentQuestion && state === STATES.question && (
                  <AnswerButtons onAnswer={sendAnswer} disabled={false} />
                )}
              </>
            ) : state === STATES.thinking ? (
              <ThinkingAnimation />
            ) : null}
          </div>

          <div className="step-nav">
            <button
              type="button"
              className="btn btn-ghost btn-step"
              onClick={() => setViewIndex((i) => Math.max(0, i - 1))}
              disabled={!canGoPrev}
              aria-label="Previous question"
            >
              &lt; Prev
            </button>
            <span className="step-indicator">
              {turns.length > 0 ? `${viewIndex + 1} of ${turns.length}` : '-'}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-step"
              onClick={() => setViewIndex((i) => Math.min(turns.length - 1, i + 1))}
              disabled={!canGoNext}
              aria-label="Next question"
            >
              Next &gt;
            </button>
          </div>

          <div className="game-actions">
            <button type="button" className="btn btn-outline btn-quit" onClick={quitGame}>
              Quit Game
            </button>
            <button type="button" className="btn btn-ghost btn-reset" onClick={startGame}>
              New Game
            </button>
          </div>
        </>
      )}
    </div>
  );
}
