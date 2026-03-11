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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Prefer OpenAI when both keys are set, so user's choice is respected
const USE_GEMINI = !!GEMINI_API_KEY && !OPENAI_API_KEY;

function parseBooleanEnv(value, defaultValue) {
  if (value == null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

const OPENAI_ENABLE_WEB_SEARCH = parseBooleanEnv(process.env.OPENAI_ENABLE_WEB_SEARCH, true);
const QUESTION_POLICY_REMINDER = `
Do not ask direct identity-confirmation questions such as "Is it [name]?" or "Is this [name]?".
If you are highly confident, output the final JSON guess immediately.
If you are not highly confident, ask one trait-based yes/no question that separates the remaining candidates.
If the user already ruled out a specific person, do not test other names one by one.
`;


const SYSTEM_PROMPT = `
You are an intelligent guessing engine inspired by the Akinator game.

Primary audience context:
- Most players are Sri Lankan users.
- When a player chooses the characters theme, they are more likely to think of figures from Indian cinema than Sri Lankan cinema.
- In ambiguous cases, prioritize likely Asian candidates and contexts before Western ones.
- Do not force Sri Lankan-specific guesses unless the answers support that.

The user is thinking of ONE entity such as:
- real person
- fictional character
- animal
- place
- object
- profession
- brand or organization

Your goal is to identify the entity using the FEWEST yes/no questions.

WEB SEARCH BEHAVIOR

You have access to web search tools.

If the entity might involve:
- current events
- recent news
- modern celebrities
- politics
- sports
- public controversies
- recent achievements

you SHOULD perform a web search before asking questions.

Use web search to gather:
- recent activities
- public roles
- notable hobbies
- major achievements
- political involvement
- sports participation
- controversies or news
- unique distinguishing traits

Use the web results to craft better questions.

GAME RULES

1. Ask only YES / NO / DON'T KNOW questions.

2. Keep questions natural and short (6–14 words).

3. Start broad and narrow gradually.

Typical narrowing flow:

category
→ living or non-living
→ person / place / object
→ profession or role
→ country or industry
→ reputation and traits
→ distinguishing characteristics

4. NEVER repeat the same topic.

5. Always respect earlier answers.
If an answer eliminates a possibility, do not ask about it again.

6. NEVER ask checklist questions like:
"Did this person act in Movie X?"
"Did this person appear in Film Y?"

Instead ask broader trait-based questions.

Good examples:

"Is this person involved in politics recently?"
"Is this actor known for high-energy action films?"
"Is this figure often discussed in the news lately?"
"Is this person known for a unique hobby outside their career?"

7. When several candidates are similar (for example actors),
ask questions about distinguishing traits such as:

career length
public reputation
side activities
directing or producing work
political involvement
sports hobbies
recent media presence

8. Avoid revealing the identity too early.

8a. NEVER ask direct name-confirmation questions such as:
"Is it Sumanthiran?"
"Is this Rajinikanth?"

If confidence is high enough to ask a specific-name confirmation, make the final JSON guess instead.
If confidence is not high enough, ask another logical trait-based yes/no question.

9. Maintain a hidden shortlist of possible answers and update it after each answer.

10. Each new question should help separate the remaining candidates.

11. If multiple strong candidates remain, ask one more distinguishing question.

12. Ask at most 15 questions.

GUESSING

Only guess when one candidate clearly fits the answers.

When guessing output EXACTLY:

{"action":"guess","answer":"name of the entity","confidence":85}

Confidence must be between 0 and 100.

If you are not guessing yet,
output ONLY the next question text.

No explanation.
No numbering.
`;
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

function isDirectIdentityQuestion(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;

  const normalized = trimmed.replace(/[?.!]+$/, '').trim();
  const lower = normalized.toLowerCase();

  if (!/^(is it|is this|are they|is he|is she)\s+/.test(lower)) return false;

  const candidate = normalized.replace(/^(is it|is this|are they|is he|is she)\s+/i, '').trim();
  if (!candidate || candidate.length > 60) return false;
  if (/\b(a|an|the|your|their|his|her)\b/i.test(candidate)) return false;
  if (/\b(person|character|actor|actress|politician|singer|animal|object|place|city|country|thing|profession|movie|film)\b/i.test(candidate)) {
    return false;
  }

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  return words.some((word) => /^[A-Z][\p{L}'’. -]*$/u.test(word));
}

function extractDirectIdentityCandidate(text) {
  const normalized = String(text || '').trim().replace(/[?.!]+$/, '').trim();
  return normalized.replace(/^(is it|is this|are they|is he|is she)\s+/i, '').trim();
}

function extractResponseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const text = response?.output
    ?.filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text || '')
    .join('\n')
    .trim();

  return text || '';
}

async function resolvePolicyViolation({ parsed, retry }) {
  if (parsed.type !== 'question' || !isDirectIdentityQuestion(parsed.text)) {
    return parsed;
  }

  const retried = await retry();
  if (retried.type === 'question' && isDirectIdentityQuestion(retried.text)) {
    return {
      type: 'guess',
      answer: extractDirectIdentityCandidate(retried.text),
      confidence: 70,
    };
  }

  return retried;
}

function getThemeInstructions(theme) {
  if (theme === 'animals') {
    return `
Current game thematic: Animals.

The answer must be an animal or animal species.
Do not ask whether it is a person, character, object, place, business, or landmark.
Use hidden candidate scoring based on habitat, size, diet, domestication, body type, movement, and visible traits.
Avoid species-name confirmation questions until the final guess.
`;
  }

  if (theme === 'objects') {
    return `
Current game thematic: Objects.

The answer must be a physical object or everyday thing.
Do not ask whether it is a person, character, animal, place, business, or landmark.
Use hidden candidate scoring based on purpose, size, material, portability, location of use, and everyday context.
If the object is modern, branded, or linked to recent releases, use web search first.
Avoid direct object-name confirmation questions until the final guess.
`;
  }

  return `
Current game thematic: Characters.

The answer must be a real person or fictional character.
Do not ask whether it is an animal, object, place, business, or landmark.
Use hidden candidate scoring based on profession, achievements, public image, genre, personality, cultural influence, hobbies, appearance, and recognisable style.
When answers are ambiguous, prioritize Asian candidates first, especially Indian cinema, Indian television, and widely known South Asian public figures.
Assume Sri Lankan users are more likely to mean Indian film characters or actors than Sri Lankan cinema figures unless the answers indicate Sri Lanka specifically.
If the character is a real, modern, or publicly active person, web search first and use current events, recent work, or present public relevance in the question strategy.
Do not ask direct nickname checks, fan-title checks, or near-identity reveal questions as normal questions.
`;
}

function getStageInstructions(historyLength) {
  if (historyLength <= 2) {
    return `
Early game.
Stay broad.
Do not ask any near-identity question.
Focus on category, field, scale, and broad distinguishing traits.
`;
  }

  if (historyLength <= 5) {
    return `
Mid game.
Narrow using achievements, personality, style, influence, or typical roles.
If the candidate may be modern or publicly active, prefer recent-event and current-role questions informed by web search.
Still avoid direct nickname checks, title checks, or unique single-work clues.
`;
  }

  return `
Late game.
You may ask sharper differentiators, but do not ask a direct name confirmation question.
If the entity is modern or in the news, use web-searched current relevance to separate the final candidates.
If one candidate is far ahead, make the final guess instead of asking "Is it [name]?"
`;
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

async function callGemini(contents, isFirstTurn) {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      maxOutputTokens: 250,
      temperature: isFirstTurn ? 0.8 : 0.6,
    },
  });
  const text = response?.text ?? '';
  const parsed = parseResponse(text);
  return resolvePolicyViolation({
    parsed,
    retry: async () => {
      const retriedResponse = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          ...contents,
          {
            role: 'user',
            parts: [{ text: QUESTION_POLICY_REMINDER }],
          },
        ],
        config: {
          maxOutputTokens: 250,
          temperature: Math.min(0.7, isFirstTurn ? 0.8 : 0.6),
        },
      });
      return parseResponse(retriedResponse?.text ?? '');
    },
  });
}

async function callOpenAI(input, isFirstTurn) {
  const buildRequest = (requestInput) => ({
    model: OPENAI_MODEL,
    instructions: SYSTEM_PROMPT,
    input: requestInput,
    max_output_tokens: isFirstTurn ? 200 : 250,
    temperature: isFirstTurn ? 0.8 : 0.6,
  });

  const request = buildRequest(input);

  if (OPENAI_ENABLE_WEB_SEARCH) {
    request.tools = [{ type: 'web_search' }];
    request.tool_choice = 'auto';
    request.include = ['web_search_call.action.sources'];
  }

  const response = await openai.responses.create(request);
  const parsed = parseResponse(extractResponseText(response));

  return resolvePolicyViolation({
    parsed,
    retry: async () => {
      const retryInput = Array.isArray(input)
        ? [...input, { role: 'user', content: QUESTION_POLICY_REMINDER }]
        : `${input}\n\n${QUESTION_POLICY_REMINDER}`;
      const retryRequest = buildRequest(retryInput);
      if (OPENAI_ENABLE_WEB_SEARCH) {
        retryRequest.tools = [{ type: 'web_search' }];
        retryRequest.tool_choice = 'auto';
        retryRequest.include = ['web_search_call.action.sources'];
      }
      const retriedResponse = await openai.responses.create(retryRequest);
      return parseResponse(extractResponseText(retriedResponse));
    },
  });
}

export async function getFirstQuestion(theme = 'characters') {
  ensureApiKey();
  const learned = getLearnedSnippets(5);
  const themeInstructions = getThemeInstructions(theme);
  const stageInstructions = getStageInstructions(0);
  const userPrompt = `Start the game.\n${themeInstructions}\n${stageInstructions}\nAsk the first yes/no question only.`;

  if (USE_GEMINI && gemini) {
    const learnedBlock = learned.length ? `\nPast wrong guesses to avoid or learn from:\n${learned.join('\n')}` : '';
    const text = SYSTEM_PROMPT + learnedBlock + '\n\n' + userPrompt;
    const contents = [{ role: 'user', parts: [{ text }] }];
    return callGemini(contents, true);
  }

  const learnedBlock = learned.length ? `Past wrong guesses to avoid or learn from:\n${learned.join('\n')}\n\n` : '';
  return callOpenAI(`${learnedBlock}${userPrompt}`, true);
}

export async function getNextTurn(history, theme = 'characters') {
  ensureApiKey();
  const learned = getLearnedSnippets(10);
  const themeInstructions = getThemeInstructions(theme);
  const stageInstructions = getStageInstructions(history.length);
  const conversation = history.flatMap(({ question, answer }) => [
    { role: 'assistant', content: question },
    { role: 'user', content: answer },
  ]);
  conversation.push({
    role: 'user',
    content: `${themeInstructions}\n${stageInstructions}\nUpdate your hidden candidate probability scores based on all answers so far. Then either ask exactly one fresh trait-based yes/no question or, if confidence is high enough, make the final guess using the JSON format. Do not ask a direct identity-confirmation question like "Is it [name]?" as a normal turn.`,
  });

  if (USE_GEMINI && gemini) {
    const contents = buildGeminiContents(conversation, learned);
    return callGemini(contents, false);
  }

  const learnedBlock = learned.length
    ? [{ role: 'user', content: `Past wrong guesses to avoid or learn from:\n${learned.join('\n')}` }]
    : [];

  return callOpenAI([...learnedBlock, ...conversation], false);
}

export function submitLearnedAnswer(guessedAnswer, correctAnswer) {
  appendLearnedAnswer({ guessedAnswer, correctAnswer });
}
