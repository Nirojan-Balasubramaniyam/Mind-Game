import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_PATH = path.join(__dirname, 'leaderboard.json');

const DEFAULT = [];
const MAX_ENTRIES = 50;

function read() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function write(list) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
}

/**
 * Record a completed game (by question count / duration for "fastest" leaderboard).
 */
export function recordGameResult({ sessionId, duration, questionCount }) {
  const list = read();
  list.push({
    sessionId: sessionId.slice(0, 12),
    durationSeconds: duration,
    questionCount,
    completedAt: new Date().toISOString(),
  });
  list.sort((a, b) => a.questionCount - b.questionCount || a.durationSeconds - b.durationSeconds);
  const trimmed = list.slice(0, MAX_ENTRIES);
  write(trimmed);
}

/**
 * Get leaderboard: fastest games (fewest questions, then shortest time).
 */
export function getLeaderboard(limit = 10) {
  const list = read();
  return list.slice(0, limit);
}
