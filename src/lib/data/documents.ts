import { documents, type DocumentKind, type DocumentRow } from '@/lib/store';

/** Documents every employee must hand in. OTHER is optional. */
export const REQUIRED_DOCS: DocumentKind[] = ['W4', 'ID', 'I9', 'IT2104', 'DIRECT_DEPOSIT'];

export const DOC_HINT: Partial<Record<DocumentKind, string>> = {
  I9: 'Needed to finalize your contract',
  DIRECT_DEPOSIT: 'Needed to receive payment',
};

/** Latest upload per kind for one employee. */
export async function latestDocuments(employeeId: string): Promise<Map<DocumentKind, DocumentRow>> {
  const rows = await documents.where((d) => d.employeeId === employeeId);
  const map = new Map<DocumentKind, DocumentRow>();
  for (const d of rows.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))) map.set(d.kind, d);
  return map;
}

export async function documentsByEmployee(): Promise<Map<string, Set<DocumentKind>>> {
  const map = new Map<string, Set<DocumentKind>>();
  for (const d of await documents.all()) {
    if (!map.has(d.employeeId)) map.set(d.employeeId, new Set());
    map.get(d.employeeId)!.add(d.kind);
  }
  return map;
}

export function missingRequired(have: Set<DocumentKind> | undefined): DocumentKind[] {
  return REQUIRED_DOCS.filter((k) => !have?.has(k));
}
