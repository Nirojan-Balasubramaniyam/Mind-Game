import { useState, useEffect } from 'react';
import { leaderboardApi } from '../api/client';

export default function Leaderboard() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardApi.get(15).then((data) => {
      setList(data.leaderboard || []);
    }).catch(() => setList([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="leaderboard">
      <h2>Fastest Guesses</h2>
      <p className="leaderboard-desc">Fewest questions, then shortest time.</p>
      {loading ? (
        <p>Loading...</p>
      ) : list.length === 0 ? (
        <p className="leaderboard-empty">No games completed yet. Play to appear here!</p>
      ) : (
        <ol className="leaderboard-list">
          {list.map((entry, i) => (
            <li key={entry.completedAt + i} className="leaderboard-item">
              <span className="rank">#{i + 1}</span>
              <span>{entry.questionCount} questions</span>
              <span>{entry.durationSeconds}s</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
