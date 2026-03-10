import { useState, useCallback } from 'react';
import { gameApi } from '../api/client';
import ChatMessage from './ChatMessage';
import AnswerButtons from './AnswerButtons';
import ResultScreen from './ResultScreen';
import ThinkingAnimation from './ThinkingAnimation';
import { playSound } from '../utils/sounds';

const STATES = { idle: 'idle', thinking: 'thinking', question: 'question', result: 'result' };

export default function Game() {
  const [state, setState] = useState(STATES.idle);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const addMessage = useCallback((role, content, meta = {}) => {
    setMessages((prev) => [...prev, { id: Date.now(), role, content, ...meta }]);
  }, []);

  const startGame = useCallback(async () => {
    setError(null);
    setMessages([]);
    setQuestionNumber(0);
    setResult(null);
    setSessionId(null);
    setState(STATES.thinking);
    playSound('start');
    try {
      const data = await gameApi.start();
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
    } catch (err) {
      setError(err.message);
      setState(STATES.idle);
      playSound('error');
    }
  }, [addMessage]);

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
      } catch (err) {
        setError(err.message);
        setState(STATES.question);
        playSound('error');
      }
    },
    [sessionId, state, messages, addMessage]
  );

  const handleResultClose = useCallback(() => {
    setResult(null);
    setState(STATES.idle);
    setMessages([]);
    setSessionId(null);
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
          <p>Think of an animal, job, place, or thing. I'll ask yes/no questions and try to guess it.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={startGame}>
            Start Game
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
          <div className="chat">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {state === STATES.thinking && <ThinkingAnimation />}
          </div>
          {state === STATES.question && (
            <AnswerButtons onAnswer={sendAnswer} disabled={false} />
          )}
          <button type="button" className="btn btn-ghost btn-reset" onClick={startGame}>
            Reset Game
          </button>
        </>
      )}
    </div>
  );
}
