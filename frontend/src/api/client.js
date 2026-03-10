const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
}

export const gameApi = {
  start(sessionId = null) {
    return request('/game/start', {
      method: 'POST',
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    });
  },
  answer(sessionId, answer) {
    return request('/game/answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, answer }),
    });
  },
  feedback(guessedAnswer, correctAnswer) {
    return request('/game/feedback', {
      method: 'POST',
      body: JSON.stringify({ guessedAnswer, correctAnswer }),
    });
  },
  reset(sessionId) {
    return request('/game/reset', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },
};

export const leaderboardApi = {
  get(limit = 10) {
    return request(`/leaderboard?limit=${limit}`);
  },
};
