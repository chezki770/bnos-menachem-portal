import type { Contract } from '@/lib/store';
import { Badge } from './ui';

export function ContractBadge({ contract }: { contract?: Pick<Contract, 'status'> }) {
  if (contract?.status === 'SIGNED') return <Badge tone="moss">Signed</Badge>;
  if (contract?.status === 'SENT') return <Badge tone="brass">Pending</Badge>;
  return <Badge tone="brick">Missing</Badge>;
}

const REQUEST_TONE = { PENDING: 'brass', APPROVED: 'moss', DECLINED: 'brick', CANCELLED: 'neutral' } as const;
export function RequestBadge({ status }: { status: keyof typeof REQUEST_TONE }) {
  return <Badge tone={REQUEST_TONE[status]}>{status[0] + status.slice(1).toLowerCase()}</Badge>;
}

const CARD = {
  MISSING: ['brick', 'Missing'],
  SUBMITTED: ['brass', 'Submitted'],
  APPROVED: ['moss', 'Approved'],
  NEEDS_CHANGES: ['brick', 'Needs changes'],
  CHANGED: ['brick', 'Changed since approval'],
} as const;
export function TimeCardBadge({ status }: { status: string }) {
  const [tone, label] = CARD[status as keyof typeof CARD] ?? (['neutral', status] as const);
  return <Badge tone={tone}>{label}</Badge>;
}
