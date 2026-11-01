# Bnos Menachem Portal

Staff and department portal: employees, contracts, documents, scheduling, absences/PTO and payroll.

The clickable mockup is `Bnos Menachem Portal — Preview.html` (in the repo root). It is the design reference for every screen.

## Stack
Next.js (App Router) + TypeScript, PostgreSQL + Prisma, Zod for validation, Vitest for tests.

## Run it
```bash
npm install
cp .env.example .env
npm run db:up          # Postgres in Docker
npm run db:migrate     # creates the tables from prisma/schema.prisma
npm run dev            # http://localhost:3000
npm test               # handbook rules tests
```

## What is here
- `src/lib/rules/` — the handbook rules as pure, tested functions (benefit tiers, PTO, simcha days, maternity, docking). The server is the only place that decides these; screens just display the result.
- `src/app/api/absences/preview` — stateless endpoint that returns what the rules would do for an absence.
- `prisma/schema.prisma` — data model (employees, contracts, documents, absences, requests, pay periods, adjustments, audit log).

## Build order
1. Auth.js logins with ADMIN / STAFF roles; seed one admin.
2. Employees list + drawer (Benefits tab reads from `rules`).
3. Absences, PTO balance and time-off requests (port from the mockup, persist in `Absence` / `TimeOffRequest`; read PTO used from the database instead of the client).
4. Contracts + documents (file storage in S3-compatible storage, e-sign provider).
5. Scheduling and time clock.
6. Payroll (or export to the school's payroll provider first).

## Security notes
W-4, I-9, birth dates and bank details are sensitive: encrypt at rest, keep files in object storage (not the database), restrict by role, and write to `AuditLog` on every read or change of those records.
