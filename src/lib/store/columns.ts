import { z } from 'zod';

/**
 * A column knows how to read its CSV cell (a Zod schema that takes the raw string) and how to
 * write a value back. Dates are kept as ISO strings ("2026-09-08"), timestamps as full ISO.
 */
export type Col<T> = {
  schema: z.ZodType<T>;
  format(v: T): string;
  /** Encrypted at rest; left out of exports unless sensitive data is requested. */
  secret?: boolean;
  /** Never exported or imported (e.g. password hashes). */
  internal?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cols = Record<string, Col<any>>;
export type RowOf<C extends Cols> = { [K in keyof C]: C[K] extends Col<infer T> ? T : never };

const blank = (v: unknown) => (v === '' || v === undefined ? null : v);
const opt = <T>(s: z.ZodType<T>) => z.preprocess(blank, s.nullable()) as unknown as z.ZodType<T | null>;
const required = (v: unknown) => (v === '' ? undefined : v);
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const isoDate = z.iso.date({ error: 'must be a date like 2026-09-08' });
const isoDateTime = z.iso.datetime({ offset: true, error: 'must be a timestamp like 2026-09-08T13:00:00Z' });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

export const col = {
  text: (): Col<string> => ({ schema: z.string(), format: str }),
  textOpt: (): Col<string | null> => ({ schema: opt(z.string()), format: str }),
  int: (): Col<number> => ({
    schema: z.preprocess(
      required,
      z.coerce.number({ error: 'must be a whole number' }).int({ error: 'must be a whole number' }),
    ) as unknown as z.ZodType<number>,
    format: str,
  }),
  intOpt: (): Col<number | null> => ({ schema: opt(z.coerce.number().int()), format: str }),
  num: (): Col<number> => ({
    schema: z.preprocess(
      required,
      z.coerce.number({ error: 'must be a number' }).finite({ error: 'must be a number' }),
    ) as unknown as z.ZodType<number>,
    format: str,
  }),
  bool: (): Col<boolean> => ({
    schema: z.preprocess(
      (v) => (typeof v === 'string' ? ['true', '1', 'yes', 'y'].includes(v.trim().toLowerCase()) : v),
      z.boolean(),
    ) as unknown as z.ZodType<boolean>,
    format: (v) => (v ? 'true' : 'false'),
  }),
  date: (): Col<string> => ({ schema: isoDate, format: str }),
  dateOpt: (): Col<string | null> => ({ schema: opt(isoDate), format: str }),
  datetime: (): Col<string> => ({ schema: isoDateTime, format: str }),
  datetimeOpt: (): Col<string | null> => ({ schema: opt(isoDateTime), format: str }),
  time: (): Col<string> => ({ schema: time, format: str }),
  enum: <const T extends readonly [string, ...string[]]>(values: T): Col<T[number]> => ({
    schema: z.enum(values) as unknown as z.ZodType<T[number]>,
    format: str,
  }),
  enumOpt: <const T extends readonly [string, ...string[]]>(values: T): Col<T[number] | null> => ({
    schema: opt(z.enum(values) as unknown as z.ZodType<T[number]>),
    format: str,
  }),
  /** Free text that is encrypted in the file. */
  secret: (): Col<string | null> => ({ schema: opt(z.string()), format: str, secret: true }),
  internal: (): Col<string | null> => ({ schema: opt(z.string()), format: str, internal: true }),
};

/** Zod object that turns a CSV record (all strings) into a typed row. */
export function rowSchema<C extends Cols>(cols: C) {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, c] of Object.entries(cols)) shape[k] = c.schema;
  return z.object(shape) as unknown as z.ZodType<RowOf<C>>;
}
