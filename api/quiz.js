// POST /api/quiz: the full snapshot of everything answered so far, sent after each question.
import { proxy, param, sessionOf, parseAnswers } from './_lib.js';

function buildQuiz(body) {
  const session = sessionOf(body.session);
  if (!session) return { error: 'invalid_session' };
  const answers = parseAnswers(body.answers);
  if (!answers) return { error: 'invalid_answers' };
  const total = Number.isInteger(body.total) && body.total >= 1 && body.total <= 12 ? body.total : 8;
  const payload = { session, answers, total, completed: body.completed === true };
  const quizEventId = param(body.quiz_event_id, 100);
  if (quizEventId) payload.quiz_event_id = quizEventId;
  return { payload };
}

export default async function handler(req, res) {
  // one visit sends 8 snapshots plus going back and retries, and this route only updates an existing lead
  return proxy(req, res, { name: 'quiz', path: '/api/landing/quiz', rateMax: 60, build: buildQuiz });
}
