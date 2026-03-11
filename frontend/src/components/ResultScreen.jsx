import { useState, useEffect } from 'react';
import { fetchAnswerImage } from '../api/client';

/** Fallback emoji when no image is available - works for any answer. */
function getEmojiForAnswer(answer) {
  const a = (answer || '').toLowerCase();
  if (/\bdog|puppy\b/.test(a)) return '🐶';
  if (/\bcat|kitten\b/.test(a)) return '🐱';
  if (/\bbird|parrot|eagle\b/.test(a)) return '🐦';
  if (/\bcar|vehicle|truck\b/.test(a)) return '🚗';
  if (/\bear|bear\b/.test(a)) return '🐻';
  if (/\belephant\b/.test(a)) return '🐘';
  if (/\blion\b/.test(a)) return '🦁';
  if (/\bhorse\b/.test(a)) return '🐴';
  if (/\bfish\b/.test(a)) return '🐟';
  if (/\bdoctor|nurse|job|profession\b/.test(a)) return '👨‍⚕️';
  if (/\bplace|city|country|paris|london\b/.test(a)) return '🌍';
  if (/\bfood|pizza|apple\b/.test(a)) return '🍕';
  return '🧠';
}

export default function ResultScreen({ result, onClose, onQuit, onFeedbackWrong }) {
  const [wrong, setWrong] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [imageUrl, setImageUrl] = useState(null);

  const emoji = getEmojiForAnswer(result?.answer);

  useEffect(() => {
    if (!result?.answer) return;
    setImageUrl(null);
    let cancelled = false;
    fetchAnswerImage(result.answer).then(({ url }) => {
      if (!cancelled && url) setImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [result?.answer]);

  const handleSubmitCorrect = (e) => {
    e.preventDefault();
    const trimmed = correctAnswer.trim();
    if (trimmed) {
      onFeedbackWrong(result.answer, trimmed);
    }
  };

  if (wrong) {
    return (
      <div className="result-screen result-feedback">
        <div className="result-visual">
          {imageUrl ? (
            <img src={imageUrl} alt={result.answer} onError={() => setImageUrl(null)} />
          ) : (
            <span className="result-emoji" aria-hidden="true">{emoji}</span>
          )}
        </div>
        <h2>Thanks for teaching me!</h2>
        <p>I guessed: <strong>{result.answer}</strong></p>
        <form onSubmit={handleSubmitCorrect}>
          <label htmlFor="correct">What was the correct answer?</label>
          <input
            id="correct"
            type="text"
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            placeholder="e.g. Elephant"
            autoFocus
          />
          <div className="result-actions">
            <button type="submit" className="btn btn-primary">Submit &amp; Play Again</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Skip &amp; Play Again</button>
            {onQuit && (
              <button type="button" className="btn btn-outline btn-quit" onClick={onQuit}>
                Quit Game
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="result-screen">
      <div className="result-visual">
        {imageUrl ? (
          <img src={imageUrl} alt={result.answer} onError={() => setImageUrl(null)} />
        ) : (
          <span className="result-emoji" aria-hidden="true">{emoji}</span>
        )}
      </div>
      <h2>I think the answer is:</h2>
      <p className="result-answer">{result.answer}</p>
      <p className="result-confidence">Confidence: {result.confidence}%</p>
      {result.durationSeconds != null && (
        <p className="result-meta">Guessed in {result.questionNumber} questions ({result.durationSeconds}s)</p>
      )}
      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Play Again
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setWrong(true)}>
          That was wrong
        </button>
        {onQuit && (
          <button type="button" className="btn btn-ghost btn-quit" onClick={onQuit}>
            Quit Game
          </button>
        )}
      </div>
    </div>
  );
}
