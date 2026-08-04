const CURSOR_TRAILER = 'Co-authored-by: Cursor <cursoragent@cursor.com>';

// UnitとIntent統合で同じメッセージ正規化契約を共有する。
export function normalizeCommitMessage(raw, { allowUnit = true } = {}) {
  const body = String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*Co-authored-by:\s*Cursor\s*<?cursoragent@cursor\.com>?\s*$/gim, '')
    .trim();
  const firstLine = body.split('\n', 1)[0] ?? '';
  if (isUnitCommitSubject(firstLine)) {
    if (!allowUnit) throw new Error('Intent integration requires a Why/What/Verify message.');
    validateSubject(firstLine);
    if (
      body
        .split('\n')
        .slice(1)
        .some((line) => line.trim())
    ) {
      throw new Error('Unit commit messages must contain one subject line only.');
    }
    return `${firstLine}\n\n${CURSOR_TRAILER}`;
  }

  const match = body.match(
    /^([^\n]+)\n\nWhy:\n([\s\S]*?)\n\nWhat:\n([\s\S]*?)\n\nVerify:\n([\s\S]*)$/,
  );
  if (!match) {
    throw new Error('Commit message must contain Subject, Why, What, and Verify sections.');
  }

  const [, subject, why, what, verify] = match;
  validateSubject(subject);
  if (!why.trim()) throw new Error('Commit message Why section is empty.');
  if (!what.trim()) throw new Error('Commit message What section is empty.');
  if (!verify.trim()) throw new Error('Commit message Verify section is empty.');
  if (!verify.split('\n').some((line) => line.startsWith('- ') || line.startsWith('N/A:'))) {
    throw new Error('Commit message Verify section needs a check bullet or N/A reason.');
  }

  return `${body}\n\n${CURSOR_TRAILER}`;
}

export function isUnitCommitSubject(subject) {
  // PlanのUnit IDとSkillが生成するunit prefix付きsubjectの両形式を受け入れる。
  return /^(?:unit-[a-z0-9]+(?:-[a-z0-9]+)*-\d+|[a-z0-9]+(?:-[a-z0-9]+)*-unit-\d+):\s+\S.*$/i.test(
    subject,
  );
}

function validateSubject(subject) {
  if (subject.length > 72) throw new Error('Commit subject must be 72 characters or fewer.');
  if (subject.endsWith('.')) throw new Error('Commit subject must not end with a period.');
}
