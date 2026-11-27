import { col, type RowOf } from './columns';
import { Table } from './table';

/**
 * Every table in the portal. Each is one CSV file in DATA_DIR (default ./data), named after the
 * table. Column order here is the column order in the file.
 */

export const ROLES = ['ADMIN', 'DEPT_HEAD', 'STAFF'] as const;
export const ABSENCE_TYPES = ['SICK', 'PERSONAL', 'SIMCHA', 'MATERNITY', 'SNOW_DAY', 'UNPAID'] as const;
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED'] as const;
export const CONTRACT_STATUSES = ['NOT_SENT', 'SENT', 'SIGNED'] as const;
export const CONTRACT_TYPES = ['FULL_YEAR', 'HOURLY'] as const;
export const PAY_PERIOD_STATUSES = ['DRAFT', 'SUBMITTED', 'PAID'] as const;
export const TIME_CARD_STATUSES = ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'] as const;
export const ADJUSTMENT_KINDS = ['BONUS', 'DEDUCTION', 'REIMBURSEMENT'] as const;
export const DOCUMENT_KINDS = ['W4', 'ID', 'I9', 'IT2104', 'DIRECT_DEPOSIT', 'OTHER'] as const;
export const TOKEN_KINDS = ['INVITE', 'RESET'] as const;

export const schoolYears = new Table('school_years', {
  id: col.text(),
  label: col.text(), // "2026-2027"
  startsOn: col.date(),
  endsOn: col.date(),
  current: col.bool(),
});

export const departments = new Table('departments', {
  id: col.text(),
  name: col.text(),
  handbook: col.textOpt(), // which handbook edition applies, e.g. "High School"
});

export const employees = new Table('employees', {
  id: col.text(),
  email: col.text(),
  name: col.text(),
  knownAs: col.textOpt(),
  role: col.enum(ROLES),
  active: col.bool(),
  passwordHash: col.internal(),
  department: col.text(),
  position: col.textOpt(),
  hiredOn: col.dateOpt(),
  // Inputs to the handbook rules (src/lib/rules)
  periodsPerWeek: col.int(),
  yearsAtSchool: col.int(),
  daysPerWeek: col.int(),
  // Pay inputs for the payroll export. Hourly staff use hourlyRateCents; everyone else annualSalaryCents.
  hourlyRateCents: col.intOpt(),
  annualSalaryCents: col.intOpt(),
  // Personal details (sensitive ones are encrypted in the file)
  gender: col.textOpt(),
  dateOfBirth: col.secret(),
  cellPhone: col.secret(),
  address: col.secret(),
  emergencyName: col.textOpt(),
  emergencyRelationship: col.textOpt(),
  emergencyPhone: col.secret(),
  createdAt: col.datetime(),
  updatedAt: col.datetime(),
});

export const contracts = new Table('contracts', {
  id: col.text(),
  employeeId: col.text(),
  schoolYearId: col.text(),
  type: col.enum(CONTRACT_TYPES),
  status: col.enum(CONTRACT_STATUSES),
  sentAt: col.datetimeOpt(),
  remindedAt: col.datetimeOpt(),
  signedAt: col.datetimeOpt(),
  signedName: col.textOpt(),
  signedIp: col.textOpt(),
  handbookVersion: col.textOpt(),
  // Terms as they were when sent, so the signed text never changes afterwards
  periodsPerWeek: col.int(),
  annualSalaryCents: col.intOpt(),
  hourlyRateCents: col.intOpt(),
});

export const documents = new Table('documents', {
  id: col.text(),
  employeeId: col.text(),
  kind: col.enum(DOCUMENT_KINDS),
  fileKey: col.text(), // name of the encrypted file in FILES_DIR — files are never stored in CSVs
  fileName: col.text(),
  mimeType: col.text(),
  size: col.int(),
  uploadedAt: col.datetime(),
  uploadedById: col.text(),
});

export const absences = new Table('absences', {
  id: col.text(),
  employeeId: col.text(),
  schoolYearId: col.text(),
  type: col.enum(ABSENCE_TYPES),
  occasion: col.textOpt(),
  startsOn: col.date(),
  endsOn: col.date(),
  schoolDays: col.int(),
  adjacentToVacation: col.bool(),
  // Result of the rules engine, stored so history never changes when rules change
  paidDays: col.num(),
  ptoDays: col.num(),
  dockedDays: col.num(),
  notes: col.textOpt(),
  postedById: col.text(),
  requestId: col.textOpt(),
  createdAt: col.datetime(),
});

export const timeOffRequests = new Table('time_off_requests', {
  id: col.text(),
  employeeId: col.text(),
  type: col.enum(ABSENCE_TYPES),
  occasion: col.textOpt(),
  startsOn: col.date(),
  endsOn: col.date(),
  adjacentToVacation: col.bool(),
  note: col.textOpt(),
  status: col.enum(REQUEST_STATUSES),
  decidedById: col.textOpt(),
  decidedAt: col.datetimeOpt(),
  decisionNote: col.textOpt(),
  createdAt: col.datetime(),
});

export const shifts = new Table('shifts', {
  id: col.text(),
  date: col.date(),
  startTime: col.time(),
  endTime: col.time(),
  department: col.text(),
  employeeId: col.textOpt(), // blank = open shift
  reason: col.textOpt(),
  createdById: col.text(),
});

export const shiftTemplates = new Table('shift_templates', {
  id: col.text(),
  template: col.text(), // rows with the same name form one weekly pattern
  weekday: col.int(), // 1 = Monday … 5 = Friday
  startTime: col.time(),
  endTime: col.time(),
  department: col.text(),
  employeeId: col.textOpt(),
});

export const timeEntries = new Table('time_entries', {
  id: col.text(),
  employeeId: col.text(),
  clockIn: col.datetime(),
  clockOut: col.datetimeOpt(),
  source: col.enum(['CLOCK', 'MANUAL'] as const),
  note: col.textOpt(),
  editedById: col.textOpt(),
});

export const timeCards = new Table('time_cards', {
  id: col.text(),
  employeeId: col.text(),
  payPeriodId: col.text(),
  status: col.enum(TIME_CARD_STATUSES),
  submittedAt: col.datetime(),
  decidedById: col.textOpt(),
  decidedAt: col.datetimeOpt(),
  note: col.textOpt(),
});

export const payPeriods = new Table('pay_periods', {
  id: col.text(),
  schoolYearId: col.text(),
  startsOn: col.date(),
  endsOn: col.date(),
  payDate: col.date(),
  status: col.enum(PAY_PERIOD_STATUSES),
  submittedAt: col.datetimeOpt(),
  submittedById: col.textOpt(),
});

export const adjustments = new Table('adjustments', {
  id: col.text(),
  payPeriodId: col.text(),
  employeeId: col.text(),
  kind: col.enum(ADJUSTMENT_KINDS),
  cents: col.int(), // always positive; kind decides the sign
  note: col.text(),
  createdById: col.text(),
  createdAt: col.datetime(),
});

/** Snapshot of each submitted run, so pay history doesn't change when inputs change later. */
export const payrollLines = new Table('payroll_lines', {
  id: col.text(),
  payPeriodId: col.text(),
  employeeId: col.text(),
  basis: col.enum(['HOURLY', 'SALARIED'] as const),
  regularHours: col.num(),
  overtimeHours: col.num(),
  dockedDays: col.num(),
  grossCents: col.int(),
  dockedCents: col.int(),
  adjustmentsCents: col.int(),
  totalCents: col.int(),
});

export const tokens = new Table('tokens', {
  id: col.text(),
  employeeId: col.text(),
  kind: col.enum(TOKEN_KINDS),
  tokenHash: col.internal(),
  expiresAt: col.datetime(),
  usedAt: col.datetimeOpt(),
  createdAt: col.datetime(),
});

export const auditLog = new Table('audit_log', {
  id: col.text(),
  at: col.datetime(),
  actorId: col.textOpt(),
  action: col.text(),
  entity: col.text(),
  entityId: col.textOpt(),
  detail: col.textOpt(),
});

export const reportRuns = new Table('report_runs', {
  id: col.text(),
  report: col.text(),
  format: col.enum(['CSV', 'PDF'] as const),
  generatedById: col.text(),
  at: col.datetime(),
});

/** Tables shown on the Data page, in display order. */
export const TABLES = {
  employees,
  departments,
  school_years: schoolYears,
  contracts,
  documents,
  absences,
  time_off_requests: timeOffRequests,
  shifts,
  shift_templates: shiftTemplates,
  time_entries: timeEntries,
  time_cards: timeCards,
  pay_periods: payPeriods,
  adjustments,
  payroll_lines: payrollLines,
  report_runs: reportRuns,
  audit_log: auditLog,
} as const;
export type TableName = keyof typeof TABLES;

/** Tables admins may upload a CSV into. The rest are exported only (their rows come from portal workflows). */
export const IMPORTABLE: TableName[] = [
  'employees',
  'departments',
  'school_years',
  'absences',
  'shifts',
  'shift_templates',
  'time_entries',
  'pay_periods',
  'adjustments',
];

export type SchoolYear = RowOf<typeof schoolYears.cols>;
export type Department = RowOf<typeof departments.cols>;
export type Employee = RowOf<typeof employees.cols>;
export type Contract = RowOf<typeof contracts.cols>;
export type DocumentRow = RowOf<typeof documents.cols>;
export type Absence = RowOf<typeof absences.cols>;
export type TimeOffRequest = RowOf<typeof timeOffRequests.cols>;
export type Shift = RowOf<typeof shifts.cols>;
export type ShiftTemplate = RowOf<typeof shiftTemplates.cols>;
export type TimeEntry = RowOf<typeof timeEntries.cols>;
export type TimeCard = RowOf<typeof timeCards.cols>;
export type PayPeriod = RowOf<typeof payPeriods.cols>;
export type Adjustment = RowOf<typeof adjustments.cols>;
export type PayrollLine = RowOf<typeof payrollLines.cols>;
export type Role = (typeof ROLES)[number];
export type AbsenceType = (typeof ABSENCE_TYPES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
