# Bnos Menachem Portal

Staff and department portal: employees, contracts, documents, scheduling and time clock, absences/PTO, payroll export and reports.

The clickable mockup `Bnos Menachem Portal — Preview.html` (repo root) is the design reference for every screen.

## How data is stored

There is no database server. **Each table is a CSV file** in `DATA_DIR` (default `./data`):

| File                                                      | What's in it                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `employees.csv`                                           | People, roles, handbook inputs (periods/week, years, days/week), pay rates, personal details |
| `departments.csv`, `school_years.csv`                     | Setup                                                                                        |
| `contracts.csv`                                           | One contract per employee per school year, with the terms as sent and the signature          |
| `documents.csv`                                           | List of uploaded files (W‑4, I‑9, …). The files themselves are encrypted in `data/files/`    |
| `absences.csv`, `time_off_requests.csv`                   | Posted absences (with the rule results saved) and staff requests                             |
| `shifts.csv`, `shift_templates.csv`                       | Schedule and reusable weekly patterns                                                        |
| `time_entries.csv`, `time_cards.csv`                      | Time clock punches and submitted/approved time cards (hourly staff)                          |
| `pay_periods.csv`, `adjustments.csv`, `payroll_lines.csv` | Pay calendar, bonuses/deductions, frozen totals of submitted runs                            |
| `audit_log.csv`, `report_runs.csv`                        | Who did what, and report history                                                             |

- **Import / export:** admins use **Data (CSV)** in the portal to download any table, edit it in Excel or Google Sheets, check the file, and import it again. Import checks every row (types, dates, references such as `employeeId`) and changes nothing if any row is wrong. Merge mode updates matching rows (by `id`, or by email for employees) and changes only the columns in the file. Replace mode makes the file the whole table.
- **Sensitive columns** (birth date, phones, address) are encrypted inside the CSV with `DATA_ENCRYPTION_KEY`. They are left out of exports unless "with sensitive fields" is chosen, and that export is audited. Password hashes are never exported.
- **Safe writes:** each file has a write lock and is replaced atomically (written to a temp file, then renamed). The portal runs as **one server process**. Don't run two copies against the same folder.
- You can edit a CSV directly on the server. The portal re-reads a file when it changes. If a row is invalid, the page shows which file, line and column.

## Run it locally

```bash
npm install
cp .env.example .env     # then fill in DATA_ENCRYPTION_KEY and AUTH_SECRET (openssl rand -base64 32)
npm run seed             # demo data (local only)
npm run dev              # http://localhost:3000
```

Demo sign-ins (password `bnos-dev-password`): `jreyes@example.org` (admin), `amorgan@example.org` (department head, Judaic Studies), `tbrooks@example.org` (staff), `clin@example.org` (hourly staff, time clock).

```bash
npm test            # rules, CSV store and import tests (Vitest)
npm run lint
npm run typecheck
```

## Roles

- **Admin** (office/HR): everything.
- **Department head**: their department's employees (read-only), scheduling, and absences and time-off approvals.
- **Staff**: their own info, documents, contract signing, schedule and time clock, time-off requests, pay and PTO.

Everyone also has the staff pages for themselves.

## Deploy on one server

```bash
git clone … /srv/bnos-portal && cd /srv/bnos-portal
cp .env.example .env     # set DATA_ENCRYPTION_KEY, AUTH_SECRET, APP_URL=https://<domain>, DOMAIN, RESEND_API_KEY, EMAIL_FROM
docker compose up -d --build
docker compose run --rm tools npm run create-admin -- "Full Name" you@school.org
```

`create-admin` prints a one-time link to set the password. Then, in the portal:

1. **Settings**: check the school year and generate pay periods.
2. **Data (CSV)**: import existing staff, or add them one by one under **Employees**.
3. On each employee, **Send invite**. They get an email with a link to set a password.

Caddy (in `docker-compose.yml`) provides HTTPS automatically for `DOMAIN`. The portal's data is the host folder `./data`.

Start the portal with `docker compose`, not `docker run --env-file .env`. Plain `docker run` keeps the quote marks around values in `.env`, so the secrets come out wrong and nobody can sign in.

### Backups

```bash
npm run backup        # → backups/portal-<timestamp>.tar.gz, keeps the newest 30
```

Run it nightly from cron and copy `backups/` off the server. **Keep `DATA_ENCRYPTION_KEY` somewhere safe and separate.** Without it, the encrypted columns and uploaded files can't be read.

### Email

Set `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain you verified in Resend). The portal sends invites, password resets, contracts, time-off requests and decisions, and time card notes. Without these settings no email is sent. In development the messages are printed to the server log; in production only a one-line "not sent" warning is logged (never the message, since it may contain a password link). The invite button always shows the link so the office can send it another way, but "Forgot password" won't work until email is set up.

## Code map

- `src/lib/rules/`: handbook rules (benefits, PTO, simcha, maternity, docking) and payroll rules (overtime, gross, docking amounts, pay periods). Pure, tested functions; the only place these rules live.
- `src/lib/store/`: the CSV tables: column types (`columns.ts`), parsing and writing (`csv.ts`), locking and caching (`table.ts`), encryption (`crypto.ts`), and every table's schema (`index.ts`).
- `src/lib/data/`: services built on the store (absences, payroll run, time cards, reports, CSV import/export).
- `src/app/(app)/`: screens. Server actions sit next to each screen in `actions.ts` and validate input with Zod.
- `src/app/api/`: file upload/download, CSV export/import, report CSVs, payroll export, and the absence rules preview.

## Payroll

The portal works out, for each pay period:

- Hourly staff: approved time-clock hours, with overtime past 40 hours per Monday–Sunday week at 1.5×.
- Salaried / per-period staff: the annual salary split evenly across the year's pay periods, minus docked days. A docked day costs the annual salary ÷ contracted working days.
- Bonuses, reimbursements and deductions.

Employees are skipped until their contract is signed, direct deposit is on file and, for hourly staff, their time card is approved. **Submit run** freezes the totals, and **Export CSV for provider** downloads the file for the payroll company. The portal does no tax math.
