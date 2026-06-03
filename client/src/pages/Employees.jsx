import { useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const emptyEmployee = { name: '', designation: '', phone: '', email: '', address: '', status: 'active' };

function emptyPayroll() {
  return {
    project_id: '',
    employee_id: '',
    payroll_month: today().slice(0, 7),
    payment_date: today(),
    amount: 0,
    payment_method: 'cash',
    status: 'paid',
    notes: ''
  };
}

export function Employees() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const projects = useApi(`/projects?limit=100&month=${month}`, { data: [] });
  const employees = useApi('/employees?limit=100', { data: [] });
  const payroll = useApi(`/employees/payroll?limit=100&month=${month}`, { data: [] });
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [employeeEditingId, setEmployeeEditingId] = useState(null);
  const [payrollForm, setPayrollForm] = useState(emptyPayroll());
  const [payrollEditingId, setPayrollEditingId] = useState(null);

  async function saveEmployee(event) {
    event.preventDefault();
    const payload = {
      ...employeeForm,
      designation: employeeForm.designation || null,
      phone: employeeForm.phone || null,
      email: employeeForm.email || null,
      address: employeeForm.address || null
    };
    if (employeeEditingId) {
      await api.put(`/employees/${employeeEditingId}`, payload);
    } else {
      await api.post('/employees', payload);
    }
    setEmployeeForm(emptyEmployee);
    setEmployeeEditingId(null);
    employees.reload();
  }

  async function savePayroll(event) {
    event.preventDefault();
    const selectedEmployee = employees.data.data.find((employee) => Number(employee.id) === Number(payrollForm.employee_id));
    const payload = {
      ...payrollForm,
      payroll_month: `${payrollForm.payroll_month}-01`,
      employee_name: selectedEmployee?.name || null,
      designation: selectedEmployee?.designation || null,
      notes: payrollForm.notes || null
    };
    if (payrollEditingId) {
      await api.put(`/employees/payroll/${payrollEditingId}`, payload);
    } else {
      await api.post('/employees/payroll', payload);
    }
    setPayrollForm(emptyPayroll());
    setPayrollEditingId(null);
    payroll.reload();
    projects.reload();
  }

  function editEmployee(row) {
    setEmployeeEditingId(row.id);
    setEmployeeForm({
      name: row.name || '',
      designation: row.designation || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      status: row.status || 'active'
    });
  }

  function editPayroll(row) {
    setPayrollEditingId(row.id);
    setPayrollForm({
      project_id: row.project_id || '',
      employee_id: row.employee_id || '',
      payroll_month: String(row.payroll_month || '').slice(0, 7),
      payment_date: String(row.payment_date || '').slice(0, 10),
      amount: row.amount || 0,
      payment_method: row.payment_method || 'cash',
      status: row.status || 'paid',
      notes: row.notes || ''
    });
  }

  async function changePayrollStatus(row, status) {
    await api.patch(`/employees/payroll/${row.id}/status`, { status });
    payroll.reload();
    projects.reload();
  }

  const payrollTotal = payroll.data.data.reduce((sum, row) => {
    if (row.status === 'paid') return sum + Number(row.amount || 0);
    return sum;
  }, 0);

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Add employees first, then record monthly salary against a project."
        action={(
          <label className="month-filter">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
      />

      <section className="panel">
        <div className="section-title">
          <h2>{employeeEditingId ? 'Update employee' : 'Add employee'}</h2>
          {employeeEditingId && <button type="button" className="mini-btn" onClick={() => { setEmployeeEditingId(null); setEmployeeForm(emptyEmployee); }}>Cancel edit</button>}
        </div>
        <form className="inline-form employee-form" onSubmit={saveEmployee}>
          <Field label="Employee / client name">
            <input placeholder="e.g. Ali Khan" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} required />
          </Field>
          <Field label="Designation">
            <input placeholder="e.g. Manager, guard, accountant" value={employeeForm.designation} onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input placeholder="Phone number" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" placeholder="Email address" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
          </Field>
          <Field label="Status">
            <select value={employeeForm.status} onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="form-action-field">
            <button className="primary"><Plus size={16} />{employeeEditingId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{payrollEditingId ? 'Update salary payment' : 'Send monthly salary'}</h2>
          <span className="pill">Paid this month: {money(payrollTotal)}</span>
        </div>
        <form className="inline-form payroll-form" onSubmit={savePayroll}>
          <Field label="Project">
            <select value={payrollForm.project_id} onChange={(e) => setPayrollForm({ ...payrollForm, project_id: e.target.value })} required>
              <option value="">Select project</option>
              {projects.data.data.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </Field>
          <Field label="Employee">
            <select value={payrollForm.employee_id} onChange={(e) => setPayrollForm({ ...payrollForm, employee_id: e.target.value })} required>
              <option value="">Select employee</option>
              {employees.data.data.filter((employee) => employee.status === 'active').map((employee) => (
                <option value={employee.id} key={employee.id}>{employee.name}{employee.designation ? ` - ${employee.designation}` : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Payroll month">
            <input type="month" value={payrollForm.payroll_month} onChange={(e) => setPayrollForm({ ...payrollForm, payroll_month: e.target.value })} required />
          </Field>
          <Field label="Payment date">
            <input type="date" value={payrollForm.payment_date} onChange={(e) => setPayrollForm({ ...payrollForm, payment_date: e.target.value })} required />
          </Field>
          <Field label="Amount">
            <input type="number" min="0" step="0.01" value={payrollForm.amount} onChange={(e) => setPayrollForm({ ...payrollForm, amount: e.target.value })} required />
          </Field>
          <Field label="Method">
            <select value={payrollForm.payment_method} onChange={(e) => setPayrollForm({ ...payrollForm, payment_method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={payrollForm.status} onChange={(e) => setPayrollForm({ ...payrollForm, status: e.target.value })}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Notes">
            <input placeholder="Optional notes" value={payrollForm.notes} onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })} />
          </Field>
          <div className="form-action-field">
            <button className="primary"><Plus size={16} />{payrollEditingId ? 'Update' : 'Send'}</button>
          </div>
        </form>
      </section>

      <DataTable rows={payroll.data.data} columns={[
        { key: 'employee_name', label: 'Employee' },
        { key: 'designation', label: 'Designation', render: (row) => row.designation || '-' },
        { key: 'project_name', label: 'Project' },
        { key: 'payroll_month', label: 'Month', render: (row) => String(row.payroll_month || '').slice(0, 7) },
        { key: 'payment_date', label: 'Paid on', render: (row) => String(row.payment_date || '').slice(0, 10) },
        { key: 'amount', label: 'Amount', render: (row) => money(row.amount) },
        { key: 'status', label: 'Status', render: (row) => <span className={`pill ${row.status}`}>{row.status}</span> },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <div className="row-actions">
              <button className="mini-btn" onClick={() => editPayroll(row)}><Edit3 size={14} />Edit</button>
              {row.status !== 'paid' && <button className="mini-btn" onClick={() => changePayrollStatus(row, 'paid')}>Mark paid</button>}
              {row.status === 'paid' && <button className="mini-btn" onClick={() => changePayrollStatus(row, 'pending')}>Mark pending</button>}
            </div>
          )
        }
      ]} empty="No payroll entries for this month" />

      <section className="panel">
        <div className="section-title">
          <h2>Employee list</h2>
          <span className="pill">{employees.data.data.length} people</span>
        </div>
        <DataTable rows={employees.data.data} columns={[
          { key: 'name', label: 'Name' },
          { key: 'designation', label: 'Designation', render: (row) => row.designation || '-' },
          { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
          { key: 'email', label: 'Email', render: (row) => row.email || '-' },
          { key: 'status', label: 'Status', render: (row) => <span className={`pill ${row.status}`}>{row.status}</span> },
          { key: 'actions', label: 'Actions', render: (row) => <button className="mini-btn" onClick={() => editEmployee(row)}><Edit3 size={14} />Edit</button> }
        ]} empty="No employees added yet" />
      </section>
    </>
  );
}
