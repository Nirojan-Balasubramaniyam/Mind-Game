import { useState } from 'react';

export default function ResultScreen({ result, onClose, onFeedbackWrong }) {
  const [wrong, setWrong] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState('');

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
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="result-screen">
      <h2>I think you're thinking of...</h2>
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
      </div>
    </div>
  );
}
