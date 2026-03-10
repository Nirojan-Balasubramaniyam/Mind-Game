export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`chat-message ${isUser ? 'chat-message-user' : 'chat-message-ai'}`}>
      <span className="chat-message-label">{isUser ? 'You' : 'AI'}</span>
      <div className="chat-message-bubble">
        {isUser ? (
          <span className="chat-answer">{message.content}</span>
        ) : (
          <p className="chat-question">{message.content}</p>
        )}
      </div>
    </div>
  );
}
