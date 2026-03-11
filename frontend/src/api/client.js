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
  start(theme, sessionId = null) {
    return request('/game/start', {
      method: 'POST',
      body: JSON.stringify(sessionId ? { sessionId, theme } : { theme }),
    });
  },
  answer(sessionId, answer) {
    return request('/game/answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, answer }),
    });
  },
  reviseAnswer(sessionId, turnIndex, answer) {
    return request('/game/revise-answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, turnIndex, answer }),
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

/** Fetch image URL for a guessed answer (e.g. "dog"). Returns { url } or { url: null } on 404. */
export async function fetchAnswerImage(query) {
  if (!query || !String(query).trim()) return { url: null };
  try {
    const res = await fetch(`${API_BASE}/image?q=${encodeURIComponent(String(query).trim())}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) return { url: data.url };
  } catch (_) {}
  return { url: null };
}
