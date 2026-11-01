# Bnos Menachem Portal

Staff and department portal for Bnos Menachem. Design reference: `Bnos Menachem Portal — Preview.html` (clickable mockup).

## Commands

- `npm run dev` — dev server
- `npm test` — rules tests (Vitest)
- `npm run lint` / `npm run typecheck` / `npm run format`
- `npm run db:up` then `npm run db:migrate` — local Postgres and migrations

## Conventions

- TypeScript strict. Use the `@/` alias for imports from `src/`.
- Handbook rules (benefits, PTO, simcha, maternity, docking) live only in `src/lib/rules` as pure functions with tests. Never re-implement them in components or routes.
- Validate every API input with Zod. Absence results are stored when posted, so history doesn't change if rules change.
- Sensitive HR data (W-4, I-9, birth dates, bank details): encrypted, role-restricted, audited. Never put files in the database.
- Use the mockup's look (colors and fonts are CSS variables in its `:root`).
