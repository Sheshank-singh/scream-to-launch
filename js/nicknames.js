const BANNED = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot',
  'slut', 'whore', 'retard', 'dick', 'piss', 'cock', 'rape', 'nazi',
];

/** Keep nicknames short, readable, and free of a few obvious slurs. */
export function sanitizeNickname(raw) {
  const nickname = String(raw || '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  if (nickname.length < 2) return { ok: false, error: 'Use 2–16 characters.' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u.test(nickname)) {
    return { ok: false, error: 'Letters, numbers, and spaces only.' };
  }
  const flat = nickname.toLowerCase().replace(/[^a-z]/g, '');
  if (BANNED.some((word) => flat.includes(word))) {
    return { ok: false, error: 'Pick a different nickname.' };
  }
  return { ok: true, nickname };
}
