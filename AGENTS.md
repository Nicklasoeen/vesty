# Vesty Engineering Contract

This file is the primary engineering instruction source for AI-assisted development in this repository.

## General engineering

- Use TypeScript for application code.
- Keep TypeScript strict mode enabled.
- Avoid `any`; prefer explicit types at domain boundaries.
- Write small, cohesive modules.
- Avoid premature abstraction and unnecessary dependencies.
- Do not rewrite unrelated code.
- Inspect the existing architecture before modifying it.
- Keep implementations simple until complexity is justified.

## Architecture

- Screens and components should focus on presentation and interaction.
- Core business and domain logic must not live directly inside UI components.
- Financial calculations must live in deterministic, testable modules.
- The backend/server will ultimately be authoritative for security-sensitive operations.
- The mobile client must never be considered a trusted authority.
- Infrastructure integrations should eventually be abstracted behind clear boundaries.

## Financial engineering

- Never use JavaScript floating point as authoritative monetary storage.
- Monetary values should eventually use integer minor units or precise database numeric types.
- Currency must always be explicit when money enters the domain model.
- Financial calculations must be deterministic.
- Avoid silently rounding financial values.
- Do not present software-generated information as personalized financial advice unless it becomes an explicit, legally reviewed product feature.

## Security

- Never expose server or private API keys in mobile code.
- Mobile clients may use only publishable or otherwise explicitly public client credentials; service-role and secret keys stay server-side.
- Never trust a `user_id` supplied manually by the client for authorization.
- Authentication identity must eventually come from validated sessions or tokens.
- Authorization must ultimately be enforced server-side or database-side.
- Never rely only on hidden UI to protect data or actions.

## Future database rules

- Use PostgreSQL and Supabase.
- Apply all schema changes through migrations.
- Use `snake_case` for database naming.
- Enable Row Level Security for private or user-owned data.
- Enforce club membership authorization server-side or database-side.
- Make migrations reversible when reasonably possible.
- Never manually mutate the production schema without migration history.
- Develop database changes locally first and capture them in version-controlled migrations.
- Once remote environments exist, do not make Dashboard-only schema changes.

## Workflow

Before implementing a task:

1. Inspect the relevant code.
2. Understand the existing architecture.
3. Make a concise plan.
4. Implement the smallest coherent change.
5. Run appropriate validation.
6. Report what changed.

After implementation:

- Run lint.
- Run typecheck.
- Fix errors introduced by the task.
- Do not silently ignore failures.
- Report remaining warnings clearly.
- Do not commit or push unless explicitly instructed.
