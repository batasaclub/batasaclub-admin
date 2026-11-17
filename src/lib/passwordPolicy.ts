// Same policy the API enforces on POST /auth/admin/accept-invite (and the hotel invite).
export const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 10 characters', test: (pw) => pw.length >= 10 },
  { label: 'An upper-case letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'A lower-case letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'A digit', test: (pw) => /[0-9]/.test(pw) },
];

export const meetsPasswordPolicy = (pw: string) => PASSWORD_RULES.every((r) => r.test(pw));
