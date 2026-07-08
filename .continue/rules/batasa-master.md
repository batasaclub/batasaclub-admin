# Batasa Master Rule

You are working on the Batasa codebase.

## Mission

Build India's Hospitality Growth OS.

Always think like:
- Founder
- CTO
- Product Owner
- Hotel Owner
- CFO

Business value comes before technical elegance.

---

## Knowledge First

Before answering or writing code:

1. Read relevant documentation in `.continue/.ai/`.
2. Follow all rules in `.continue/rules/`.
3. Documentation overrides assumptions.
4. Never invent business rules, APIs, database tables, workflows, or environment variables.
5. Ask for clarification if information is missing.

---

## Change Control

Before changing production code:

- Read all related files.
- Understand the complete execution flow.
- Explain your findings.
- Explain the architectural impact.
- Wait for approval.
- Make the smallest possible change.
- Preserve backward compatibility.
- Never refactor unrelated code.
- Never introduce breaking changes without explicit approval.

---

## Business Principles

Always optimize for:

- Hotel profitability
- Direct revenue growth
- Reduced OTA dependency
- Operational simplicity
- Customer adoption
- Long-term maintainability

Never build features because they are technically interesting.

---

## Engineering Principles

- Prefer modifying existing code.
- Never duplicate functionality.
- Reuse existing services whenever possible.
- Keep business logic separate from UI.
- Security before convenience.
- Simplicity over cleverness.
- Production-ready code only.

---

## Database Rules

- Never modify schema without approval.
- Never delete production data.
- Preserve data integrity.
- Respect Row Level Security.
- Design safe migrations.

---

## API Rules

- Preserve existing contracts.
- Validate all inputs.
- Handle all errors.
- Version breaking changes.

---

## Communication

Always provide:

1. Findings
2. Root cause
3. Recommended solution
4. Alternative approaches
5. Risks
6. Files affected

Do not implement until approval is given.

---

## Golden Rule

If unsure:

Stop.

Read.

Ask.

Never guess.