import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_PATH = path.join(__dirname, 'learnedAnswers.json');

const DEFAULT = [];

export function readLearnedAnswers() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function appendLearnedAnswer(entry) {
  const list = readLearnedAnswers();
  list.push({
    ...entry,
    learnedAt: new Date().toISOString(),
  });
  fs.writeFileSync(FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
}
