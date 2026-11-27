import { auditLog } from '@/lib/store';

/** Every change, and every read of sensitive HR data, is recorded in audit_log.csv. */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: string,
): Promise<void> {
  await auditLog.append({
    at: new Date().toISOString(),
    actorId,
    action,
    entity,
    entityId: entityId ?? null,
    detail: detail ?? null,
  });
}
