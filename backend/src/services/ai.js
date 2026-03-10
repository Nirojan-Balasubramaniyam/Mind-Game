import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { readLearnedAnswers, appendLearnedAnswer } from '../data/learnedAnswers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Prefer OpenAI when both keys are set, so user's choice is respected
const USE_GEMINI = !!GEMINI_API_KEY && !OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are playing a guessing game similar to Akinator. The user is thinking of something (animal, job, place, object, or thing) and has NOT told you what it is.

Your job:
1. Ask strategic yes/no questions to narrow down what they are thinking of.
2. Each question must be answerable with: Yes, No, or Don't know.
3. Be concise: one clear question per message, no preamble.
4. After several questions, when you have enough information, you may make a guess.

When making a guess, respond with a JSON object on its own line, exactly in this format:
{"action":"guess","answer":"the thing you guessed","confidence":75}

Where confidence is 0-100. Only output this JSON when you are ready to guess, not before.

Otherwise, output only the next question as plain text, nothing else. No "Question:", no numbering.`;

/**
 * Build messages for the LLM from game history and optional learned answers.
 */
function buildMessages(history, learnedSnippets = []) {
  const learned = learnedSnippets.length
    ? `\nPast wrong guesses to avoid or learn from:\n${learnedSnippets.join('\n')}`
    : '';
  return [
    { role: 'system', content: SYSTEM_PROMPT + learned },
    ...history.map(({ role, content }) => ({ role, content })),
  ];
}

/**
 * Build Gemini contents array (role: "user" | "model").
 */
function buildGeminiContents(history, learnedSnippets = []) {
  const learned = learnedSnippets.length
    ? `\nPast wrong guesses to avoid or learn from:\n${learnedSnippets.join('\n')}`
    : '';
  const system = { role: 'user', parts: [{ text: `System instructions (follow these):\n${SYSTEM_PROMPT}${learned}` }] };
  const turns = history.map(({ role, content }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: [{ text: content }],
  }));
  return [system, ...turns];
}

/**
 * Parse LLM response: either a guess JSON or a plain question.
 */
function parseResponse(content) {
  const trimmed = (content || '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*"action"\s*:\s*"guess"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action === 'guess' && parsed.answer != null) {
        return {
          type: 'guess',
          answer: String(parsed.answer).trim(),
          confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
        };
      }
    } catch (_) {}
  }
  return { type: 'question', text: trimmed || 'Is it something you can hold in your hands?' };
}

function getLearnedSnippets(limit = 10) {
  const learned = readLearnedAnswers();
  return learned
    .slice(-limit)
    .map((e) => `Correct answer was: "${e.correctAnswer}" (user said no to guess: "${e.guessedAnswer}")`);
}

function ensureApiKey() {
  if (USE_GEMINI && gemini) return;
  if (openai) return;
  throw new Error('Set either GEMINI_API_KEY or OPENAI_API_KEY in .env');
}

/**
 * Call Gemini and return parsed response.
 */
async function callGemini(contents, isFirstTurn) {
  const response = await gemini.models.generateContent({
    model: 'gemini-2.0-flash',
    contents,
    config: {
      maxOutputTokens: 250,
      temperature: isFirstTurn ? 0.7 : 0.5,
    },
  });
  const text = response?.text ?? '';
  return parseResponse(text);
}

/**
 * Generate first question for a new game.
 */
export async function getFirstQuestion() {
  ensureApiKey();
  const learned = getLearnedSnippets(5);
  const userPrompt = 'Start the game. Ask the first yes/no question to guess what I am thinking of. It can be an animal, job, place, or thing. One question only.';

  if (USE_GEMINI && gemini) {
    const learnedBlock = learned.length ? `\nPast wrong guesses to avoid or learn from:\n${learned.join('\n')}` : '';
    const text = SYSTEM_PROMPT + learnedBlock + '\n\n' + userPrompt;
    const contents = [{ role: 'user', parts: [{ text }] }];
    return callGemini(contents, true);
  }

  const messages = buildMessages([{ role: 'user', content: userPrompt }], learned);
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 200,
    temperature: 0.7,
  });
  const content = completion.choices[0]?.message?.content ?? '';
  return parseResponse(content);
}

/**
 * Send user answer and get next question or guess.
 */
export async function getNextTurn(history) {
  ensureApiKey();
  const learned = getLearnedSnippets(10);
  const conversation = history.flatMap(({ question, answer }) => [
    { role: 'assistant', content: question },
    { role: 'user', content: answer },
  ]);
  conversation.push({
    role: 'user',
    content: 'Based on my answers, either ask exactly one new yes/no question, or if you are confident enough, make your guess using the JSON format.',
  });

  if (USE_GEMINI && gemini) {
    const contents = buildGeminiContents(conversation, learned);
    return callGemini(contents, false);
  }

  const messages = buildMessages(conversation, learned);
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 250,
    temperature: 0.5,
  });
  const content = completion.choices[0]?.message?.content ?? '';
  return parseResponse(content);
}

export function submitLearnedAnswer(guessedAnswer, correctAnswer) {
  appendLearnedAnswer({ guessedAnswer, correctAnswer });
}
