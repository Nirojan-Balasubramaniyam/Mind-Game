# Mind Game – AI Guessing Game

A web game where you think of something (animal, job, place, or thing) and the AI guesses it by asking yes/no questions—similar to Akinator.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **AI:** Google Gemini (gemini-1.5-flash) or OpenAI (GPT-4o-mini)
- **Communication:** REST API

## Project Structure

```
Mind-Game/
├── backend/
│   ├── src/
│   │   ├── index.js           # Express app entry
│   │   ├── routes/
│   │   │   ├── game.js        # Game start, answer, feedback, reset
│   │   │   └── leaderboard.js # Leaderboard GET
│   │   ├── services/
│   │   │   └── ai.js          # OpenAI prompts & next-question/guess logic
│   │   └── data/
│   │       ├── learnedAnswers.js  # Read/append learned answers
│   │       ├── learnedAnswers.json
│   │       ├── leaderboard.js
│   │       └── leaderboard.json
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/client.js      # API client
│   │   ├── components/        # Game, ChatMessage, AnswerButtons, ResultScreen, Leaderboard, ThinkingAnimation
│   │   ├── utils/sounds.js    # Optional sound effects
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Run Locally

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set either GEMINI_API_KEY or OPENAI_API_KEY
npm install
npm run dev
```

- **Gemini (recommended, free tier):** Get a key at [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY=your_key`.
- **OpenAI:** Set `OPENAI_API_KEY=sk-...` to use GPT-4o-mini.

API runs at **http://localhost:3001**.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173** and proxies `/api` to the backend.

### 3. Play

Open http://localhost:5173, click **Start Game**, answer Yes / No / Don't know. The AI asks questions and then guesses; you can correct wrong guesses so they’re stored for future games.

## API Examples

### Start game

**Request**

```http
POST /api/game/start
Content-Type: application/json

{}
```

**Response**

```json
{
  "sessionId": "sess_1234567890_abc123",
  "action": "question",
  "question": "Is it something that can fly?",
  "questionNumber": 1
}
```

### Send answer

**Request**

```http
POST /api/game/answer
Content-Type: application/json

{
  "sessionId": "sess_1234567890_abc123",
  "answer": "Yes"
}
```

**Response (next question)**

```json
{
  "action": "question",
  "question": "Is it typically kept as a pet?",
  "questionNumber": 2
}
```

**Response (AI guess)**

```json
{
  "action": "guess",
  "answer": "Bird",
  "confidence": 78,
  "questionNumber": 7,
  "durationSeconds": 45
}
```

### Submit feedback when AI was wrong

**Request**

```http
POST /api/game/feedback
Content-Type: application/json

{
  "guessedAnswer": "Bird",
  "correctAnswer": "Bat"
}
```

### Leaderboard

**Request**

```http
GET /api/leaderboard?limit=10
```

**Response**

```json
{
  "leaderboard": [
    { "sessionId": "sess_...", "questionCount": 5, "durationSeconds": 32, "completedAt": "2025-03-09T12:00:00.000Z" }
  ]
}
```

## Features

- Chat-style UI with Yes / No / Don't know buttons
- Progress indicator (question number)
- “AI thinking” animation while waiting for the next question
- Result screen with guessed answer and confidence
- If the guess was wrong, submit the correct answer; it’s stored to improve future games
- Leaderboard (fastest guesses by question count and time)
- Reset game button
- Optional sound effects: add MP3 files in `frontend/public/sounds/` as `start.mp3`, `click.mp3`, `success.mp3`, `error.mp3` to enable

## AI Logic

- **System prompt:** Instructs the model to ask one yes/no question at a time and to output a guess as JSON when confident: `{"action":"guess","answer":"...","confidence":75}`.
- **Context:** Full Q&A history is sent each turn; up to 10 recent “learned” correct answers (from wrong guesses) are added to the system prompt to avoid repeating mistakes.
- **Model:** `gpt-4o-mini` for low latency and cost; you can change it in `backend/src/services/ai.js`.

## Extending

- **Different LLM:** The app supports Gemini (set `GEMINI_API_KEY`) or OpenAI (set `OPENAI_API_KEY`). To add another provider, edit `backend/src/services/ai.js` and keep the same exports and response parsing.
- **Persistence:** Replace in-memory `games` in `backend/src/routes/game.js` with Redis or a DB; keep the same route contracts.
- **Sounds:** Implement `frontend/src/utils/sounds.js` to use your own assets or Web Audio beeps.
