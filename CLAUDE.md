# Bnos Menachem Portal

Staff and department portal for Bnos Menachem. Design reference: `Bnos Menachem Portal — Preview.html` (clickable mockup).

## Commands

- `npm run dev` — dev server
- `npm test` — rules, CSV store and import tests (Vitest)
- `npm run lint` / `npm run typecheck` / `npm run format`
- `npm run seed` (`-- --force` to reset) — demo data into `./data`
- `npm run create-admin -- "Name" email` — first admin on a new server
- `npm run backup` — tar the data folder into `backups/`

## Conventions

- TypeScript strict. Use the `@/` alias for imports from `src/`.
- Data is stored in CSV files (one per table) through `src/lib/store`. Don't add a SQL database. Define new tables or columns in `src/lib/store/index.ts`, and change data only through `Table` methods (`mutate`, `insert`, `update`, `append`), never by writing files directly. Don't nest two `mutate` calls on the same table (it deadlocks).
- The app runs as a single server process. The per-file locks rely on that.
- Handbook rules (benefits, PTO, simcha, maternity, docking) and payroll math live only in `src/lib/rules` as pure functions with tests. Never re-implement them in components or routes.
- Validate every API input and server action with Zod. Check auth inside every server action and route (`assert*` helpers in `src/lib/auth/current-user.ts`). Absence results and submitted payroll are stored when posted, so history doesn't change if rules change.
- Sensitive HR data (birth dates, phones, address, uploaded W-4/I-9/direct deposit): use `col.secret()` columns or encrypted files in `FILES_DIR`. Restrict them by role and write to the audit log on every read or change. Never put files in the CSVs.
- Use the mockup's look (colors and fonts are CSS variables in its `:root`, ported into `src/app/globals.css`).
