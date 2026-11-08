#!/usr/bin/env node
/**
 * Imports a transcribed paper into Qubit as a DRAFT exam.
 *
 *   QUBIT_API=http://localhost:8080 QUBIT_EMAIL=admin@x.com QUBIT_PASSWORD=… \
 *     node docs/papers/import-paper.mjs docs/papers/jee-advanced-2026-paper-2/paper.mjs
 *
 * A paper module exports `exam` (exam settings), `questions` (Qubit question JSON; `image` is a file
 * name inside ./figures next to the paper) and optionally `verify` (notes printed at the end).
 * The same question JSON (with `imageData` data URLs) also works in Admin → Exam → Questions → Import JSON.
 */
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , paperPath] = process.argv;
if (!paperPath) {
  console.error('Usage: node import-paper.mjs <paper.mjs>');
  process.exit(1);
}
const API = process.env.QUBIT_API ?? 'http://localhost:8080';
const EMAIL = process.env.QUBIT_EMAIL;
const PASSWORD = process.env.QUBIT_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set QUBIT_EMAIL and QUBIT_PASSWORD (an admin account).');
  process.exit(1);
}

const abs = resolve(paperPath);
const { exam, questions, verify = [] } = await import(pathToFileURL(abs).href);
const figures = join(dirname(abs), 'figures');
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const { token } = await call('POST', '/api/auth/login', null, { email: EMAIL, password: PASSWORD });

const existing = await call('GET', '/api/admin/exams', token);
if (existing.some((e) => e.code.toUpperCase() === exam.code.toUpperCase())) {
  console.error(`An exam with code ${exam.code} already exists. Delete it (it must have no registrations) or change the code.`);
  process.exit(1);
}

const created = await call('POST', '/api/admin/exams', token, exam);
console.log(`Created exam #${created.id} ${created.code} (DRAFT)`);

const payload = questions.map(({ image, ...q }, i) => ({
  ...q,
  position: i + 1,
  imageData: image ? `data:${mime[extname(image).toLowerCase()]};base64,${readFileSync(join(figures, image)).toString('base64')}` : null,
}));

// Upload subject by subject to keep each request modest.
let detail;
for (const subject of [...new Set(payload.map((q) => q.subject))]) {
  const batch = payload.filter((q) => q.subject === subject);
  detail = await call('POST', `/api/admin/exams/${created.id}/questions/bulk`, token, batch);
  console.log(`  + ${batch.length} ${subject} questions`);
}

console.log(`Done: ${detail.questions.length} questions · ${detail.totalMarks} marks · ${detail.questions.filter((q) => q.imageData).length} figures`);
console.log(`Review it at /admin/exams/${created.id}, add slots, then publish.`);
if (verify.length) {
  console.log('\nCheck against the official key:');
  verify.forEach((v) => console.log('  • ' + v));
}
