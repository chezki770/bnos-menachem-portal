import { z } from 'zod';
import { ROLES } from '@/lib/store';
import { parseMoney } from '@/lib/format';

const optText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null)
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const money = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const c = parseMoney(v);
    if (c === null || c < 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount like 22.50' });
      return z.NEVER;
    }
    return c;
  });

/** Admin edit/create form for an employee. */
export const employeeForm = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  knownAs: optText,
  role: z.enum(ROLES),
  department: z.string().trim().min(1, 'Choose a department'),
  position: optText,
  hiredOn: z.union([z.iso.date(), z.literal('')]).transform((v) => v || null),
  periodsPerWeek: z.coerce.number().int().min(0).max(60),
  yearsAtSchool: z.coerce.number().int().min(0).max(60),
  daysPerWeek: z.coerce.number().int().min(1).max(6),
  hourlyRate: money,
  annualSalary: money,
  active: z.boolean(),
});

/** What staff may change about themselves on My info. */
export const selfInfoForm = z.object({
  knownAs: optText,
  gender: optText,
  dateOfBirth: z.union([z.iso.date(), z.literal('')]).optional(),
  cellPhone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional(),
  emergencyName: optText,
  emergencyRelationship: optText,
  emergencyPhone: z.string().trim().max(40).optional(),
});

export const SENSITIVE_FIELDS = ['dateOfBirth', 'cellPhone', 'address', 'emergencyPhone'] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export function mask(field: SensitiveField, value: string | null): string {
  if (!value) return '—';
  if (field === 'dateOfBirth') return '•• / •• / ••••';
  if (field === 'address') return '••••••••';
  const digits = value.replace(/\D/g, '');
  return `(•••) •••-••${digits.slice(-2)}`;
}
