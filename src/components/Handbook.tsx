/** Handbook reference tables (as in the mockup). The numbers come from src/lib/rules. */
import { maternityPaidWeeks } from '@/lib/rules/benefits';

export function HandbookRules() {
  return (
    <div className="rules-grid">
      <div className="rule-card" style={{ gridColumn: '1 / -1' }}>
        <h4>Benefit eligibility</h4>
        <table className="rule-table">
          <thead>
            <tr>
              <th>Periods / week</th>
              <th>Pay</th>
              <th>Tuition &amp; parsonage</th>
              <th>PTO</th>
              <th>Yomtov &amp; vacation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1–8</td>
              <td>Hourly (paid when present)</td>
              <td>No</td>
              <td>No</td>
              <td>No</td>
            </tr>
            <tr>
              <td>9–14</td>
              <td>Per period / salaried</td>
              <td>Yes</td>
              <td>Yes</td>
              <td>No</td>
            </tr>
            <tr>
              <td>10–14, 10th year or more</td>
              <td>Per period / salaried</td>
              <td>Yes</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>15+</td>
              <td>Per period / salaried</td>
              <td>Yes</td>
              <td>Yes</td>
              <td>Paid</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 8 }}>
          Under 15 periods: paid only for time actually taught. End of May and June: employees must fully
          report during contracted hours or pay is prorated. PTO, Simcha and Maternity Leave apply only to
          eligible employees.
        </p>
      </div>
      <div className="rule-card">
        <h4>PTO allowance</h4>
        <ul>
          <li>1 week&apos;s worth of personal/sick days and lateness (e.g. 3 days/week = 3 days)</li>
          <li>Starts once the teacher starts teaching; delayed starts are not covered</li>
          <li>Leaves mid-year: reviewed at max 1 day per 2 months worked</li>
          <li>Does not carry over to the next school year</li>
          <li>Once used up, absences are deducted from pay</li>
        </ul>
      </div>
      <div className="rule-card">
        <h4>Attendance &amp; docking</h4>
        <ul>
          <li>Lateness is taken from PTO first, then deducted from pay</li>
          <li>Missed punch counts as an absence until the principal corrects it</li>
          <li>Day before/after a vacation or Yom Tov is double-docked</li>
          <li>Extra personal days: double-docked, or paid only for days worked</li>
          <li>Simcha, maternity and snow days must be marked excused by the attendance coordinator</li>
        </ul>
      </div>
      <div className="rule-card">
        <h4>Simcha days (paid, not from PTO)</h4>
        <table className="rule-table">
          <tbody>
            <tr>
              <td>Own wedding</td>
              <td>1 week</td>
            </tr>
            <tr>
              <td>Child&apos;s wedding</td>
              <td>3 days (before, day of, after)</td>
            </tr>
            <tr>
              <td>Grandchild&apos;s wedding</td>
              <td>2 days (3 if out of town)</td>
            </tr>
            <tr>
              <td>Sibling&apos;s wedding (yours or husband&apos;s)</td>
              <td>2 days</td>
            </tr>
            <tr>
              <td>Child&apos;s Bar/Bas Mitzvah</td>
              <td>1 day</td>
            </tr>
            <tr>
              <td>Own Lechaim</td>
              <td>Morning teachers 1.5 days · Afternoon teachers 1 day</td>
            </tr>
            <tr>
              <td>Child&apos;s Lechaim</td>
              <td>1 day (day of or morning after)</td>
            </tr>
            <tr>
              <td>Bris: nephew / grandchild</td>
              <td>2 hours / 1 day (2 if out of town)</td>
            </tr>
            <tr>
              <td>Shiva</td>
              <td>1 week</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 8 }}>
          A week = total scheduled hours in the employee&apos;s workweek. The principal must mark it as a
          simcha day and confirm.
        </p>
      </div>
      <div className="rule-card">
        <h4>Maternity leave</h4>
        <table className="rule-table">
          <thead>
            <tr>
              <th>Year of employment</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1 or 2</td>
              <td>{maternityPaidWeeks(1)} weeks</td>
            </tr>
            <tr>
              <td>3, 4, 5</td>
              <td>{maternityPaidWeeks(3)} weeks</td>
            </tr>
            <tr>
              <td>6–9</td>
              <td>{maternityPaidWeeks(6)} weeks</td>
            </tr>
            <tr>
              <td>10 or more</td>
              <td>{maternityPaidWeeks(10)} weeks</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 8 }}>
          Paid if she returns within 9 weeks. Starts at birth or on doctor&apos;s orders. Does not extend past
          the school year.
        </p>
      </div>
    </div>
  );
}
