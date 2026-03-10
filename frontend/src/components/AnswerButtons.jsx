export default function AnswerButtons({ onAnswer, disabled }) {
  return (
    <div className="answer-buttons">
      <button
        type="button"
        className="btn btn-answer btn-yes"
        onClick={() => onAnswer('Yes')}
        disabled={disabled}
      >
        Yes
      </button>
      <button
        type="button"
        className="btn btn-answer btn-no"
        onClick={() => onAnswer('No')}
        disabled={disabled}
      >
        No
      </button>
      <button
        type="button"
        className="btn btn-answer btn-dunno"
        onClick={() => onAnswer("Don't know")}
        disabled={disabled}
      >
        Don't know
      </button>
    </div>
  );
}
