import { revealField } from '@/app/(app)/employees/actions';
import { Reveal } from '@/components/client';
import { PageHead, ReadField } from '@/components/ui';
import { requireUser } from '@/lib/auth/current-user';
import { mask, type SensitiveField } from '@/lib/forms/employee';
import { fmtDate } from '@/lib/format';
import { employees } from '@/lib/store';
import { MyInfoForm } from './form';

export default async function MyInfoPage() {
  const user = await requireUser();
  const emp = (await employees.get(user.id))!;
  const secret = (field: SensitiveField, label: string, type = 'text') => (
    <div className="field">
      <label htmlFor={field}>{label}</label>
      <div className="value" style={{ marginBottom: 6 }}>
        <Reveal masked={mask(field, emp[field])} load={revealField.bind(null, emp.id, field)} />
      </div>
      <input
        id={field}
        name={field}
        type={type}
        placeholder="Enter a new value to change it"
        autoComplete="off"
      />
    </div>
  );
  return (
    <>
      <PageHead title="My info" sub="Keep your details current — HR is notified when you make changes" />
      <div className="panel">
        <div className="panel-body">
          <MyInfoForm>
            <div className="section-label">Personal</div>
            <div className="form-grid">
              <ReadField label="Legal name" value={emp.name} />
              <div className="field">
                <label htmlFor="knownAs">Known as</label>
                <input id="knownAs" name="knownAs" defaultValue={emp.knownAs ?? ''} />
              </div>
              {secret('dateOfBirth', 'Date of birth', 'date')}
              <div className="field">
                <label htmlFor="gender">Gender</label>
                <input id="gender" name="gender" defaultValue={emp.gender ?? ''} />
              </div>
            </div>
            <div className="section-label">Contact</div>
            <div className="form-grid">
              <ReadField label="Email" value={emp.email} />
              {secret('cellPhone', 'Cell phone', 'tel')}
              <div className="span-2">{secret('address', 'Address')}</div>
            </div>
            <div className="section-label">Emergency contact</div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="emergencyName">Name</label>
                <input id="emergencyName" name="emergencyName" defaultValue={emp.emergencyName ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="emergencyRelationship">Relationship</label>
                <input
                  id="emergencyRelationship"
                  name="emergencyRelationship"
                  defaultValue={emp.emergencyRelationship ?? ''}
                />
              </div>
              {secret('emergencyPhone', 'Phone', 'tel')}
            </div>
            <div className="section-label">Employment</div>
            <div className="form-grid">
              <ReadField label="Department" value={emp.department} />
              <ReadField label="Position" value={emp.position ?? '—'} />
              <ReadField label="Hired" value={fmtDate(emp.hiredOn)} />
              <ReadField label="Periods per week" value={emp.periodsPerWeek} />
            </div>
            <p className="faint">
              Ask the office to change your name, email or employment details. Birth date, phone numbers and
              address are encrypted.
            </p>
          </MyInfoForm>
        </div>
      </div>
    </>
  );
}
