import Link from 'next/link';
import { Badge } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { latestDocuments, REQUIRED_DOCS } from '@/lib/data/documents';
import { currentContract, getEmployeeBenefits } from '@/lib/data/employees';
import { shiftsBetween } from '@/lib/data/shifts';
import { DOC_LABEL, fmtTime, todayIso, addDays } from '@/lib/format';
import { timeOffRequests } from '@/lib/store';

export default async function StaffHome() {
  const user = await requireUser();
  const data = await getEmployeeBenefits(user.id);
  if (!data) return <p className="muted">Your employee record was not found.</p>;
  const emp = data.employee;
  const docs = await latestDocuments(emp.id);
  const missing = REQUIRED_DOCS.filter((k) => !docs.has(k));
  const contract = await currentContract(emp.id);
  const today = todayIso();
  const upcoming = await shiftsBetween(today, addDays(today, 13), (s) => s.employeeId === emp.id);
  const next = upcoming[0];
  const infoComplete = !!(emp.dateOfBirth && emp.cellPhone && emp.address && emp.emergencyName);
  const pendingReq = await timeOffRequests.where((r) => r.employeeId === emp.id && r.status === 'PENDING');
  const weekday = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

  return (
    <>
      <div className="page-head">
        <h1>Welcome, {emp.knownAs ?? emp.name.split(' ')[0]}</h1>
        <p>
          {emp.department} · {emp.position ?? 'Staff'}
        </p>
      </div>
      <div className="home-cards">
        <div className="home-card">
          <div className="hc-top">
            <h4>Your info</h4>
            <Badge tone={infoComplete ? 'moss' : 'brass'}>{infoComplete ? 'Complete' : 'Incomplete'}</Badge>
          </div>
          <p>
            {infoComplete
              ? 'Personal, contact, and emergency details are up to date.'
              : 'Please add your birth date, phone, address and an emergency contact.'}
          </p>
          <Link className="btn btn-secondary btn-sm" href="/me/info">
            Review
          </Link>
        </div>
        <div className="home-card">
          <div className="hc-top">
            <h4>Documents</h4>
            <Badge tone={missing.length ? 'brass' : 'moss'}>
              {REQUIRED_DOCS.length - missing.length} of {REQUIRED_DOCS.length} submitted
            </Badge>
          </div>
          <p>
            {missing.length
              ? `${missing.map((k) => DOC_LABEL[k]).join(' and ')} ${missing.length === 1 ? 'is' : 'are'} still needed before your contract can be finalized.`
              : 'All required documents are on file.'}
          </p>
          <Link className="btn btn-secondary btn-sm" href="/me/documents">
            {missing.length ? 'Continue' : 'View'}
          </Link>
        </div>
        <div className="home-card">
          <div className="hc-top">
            <h4>Your schedule</h4>
            <Badge tone="neutral">
              {next ? `Next: ${weekday(next.date)}, ${fmtTime(next.startTime)}` : 'No shifts'}
            </Badge>
          </div>
          <p>
            {upcoming.length
              ? `${upcoming.length} shift${upcoming.length === 1 ? '' : 's'} in the next two weeks, ${emp.department} department.`
              : 'No shifts scheduled in the next two weeks.'}
          </p>
          <Link className="btn btn-secondary btn-sm" href="/me/schedule">
            View schedule
          </Link>
        </div>
        <div className="home-card">
          <div className="hc-top">
            <h4>Pay</h4>
            <Badge tone={contract?.status === 'SIGNED' ? 'moss' : 'brass'}>
              {contract?.status === 'SIGNED' ? 'Unlocked' : 'Locked'}
            </Badge>
          </div>
          <p>
            {contract?.status === 'SIGNED'
              ? `PTO balance: ${data.pto.left} of ${data.pto.allowance} days.`
              : contract?.status === 'SENT'
                ? 'Sign your contract to unlock pay and adjustment history.'
                : 'Your contract has not been sent yet.'}
          </p>
          <Link
            className="btn btn-secondary btn-sm"
            href={contract?.status === 'SENT' ? '/me/contract' : '/me/pay'}
          >
            {contract?.status === 'SENT' ? 'Sign contract' : 'Go to My pay'}
          </Link>
        </div>
        <div className="home-card">
          <div className="hc-top">
            <h4>Time off</h4>
            <Badge tone={pendingReq.length ? 'brass' : 'neutral'}>{pendingReq.length} pending</Badge>
          </div>
          <p>
            Request sick, personal or simcha days. You&apos;ll see what the handbook rules give before you
            send it.
          </p>
          <Link className="btn btn-secondary btn-sm" href="/me/time-off">
            Request time off
          </Link>
        </div>
      </div>
    </>
  );
}
