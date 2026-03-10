export default function ThinkingAnimation() {
  return (
    <div className="chat-message chat-message-ai thinking-wrap">
      <span className="chat-message-label">AI</span>
      <div className="chat-message-bubble thinking-bubble">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
    </div>
  );
}
