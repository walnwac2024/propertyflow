import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Eye, Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function Projects() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, reload } = useApi(`/projects?limit=50&month=${month}`, { data: [] });
  const user = JSON.parse(localStorage.getItem('propertyflow_user') || '{}');
  const canManageProjects = ['super_admin', 'property_manager'].includes(user.role);
  const [form, setForm] = useState({ name: '', address: '', description: '', total_floors: '', status: 'active' });
  const [editingId, setEditingId] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (editingId) {
      await api.put(`/projects/${editingId}`, form);
    } else {
      await api.post('/projects', form);
    }
    setForm({ name: '', address: '', description: '', total_floors: '', status: 'active' });
    setEditingId(null);
    reload();
  }

  function editProject(project) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      address: project.address,
      description: project.description || '',
      total_floors: project.total_floors || 0,
      status: project.status
    });
  }

  const columns = [
    { key: 'name', label: 'Project' },
    { key: 'address', label: 'Address' },
    { key: 'floor_count', label: 'Floors' },
    { key: 'unit_count', label: 'Units' },
    { key: 'status', label: 'Status', render: (row) => <span className={`pill ${row.status}`}>{row.status}</span> }
  ];

  if (user.role === 'super_admin') {
    columns.push(
      { key: 'recovered_amount', label: 'Recovered', render: (row) => money(row.recovered_amount) },
      { key: 'pending_amount', label: 'Pending bills', render: (row) => money(row.pending_amount) },
      { key: 'expense_amount', label: 'Expenses', render: (row) => money(row.expense_amount) },
      { key: 'payroll_amount', label: 'Salary', render: (row) => money(row.payroll_amount) },
      {
        key: 'total_expense_amount',
        label: 'Total expense',
        render: (row) => money(Number(row.expense_amount || 0) + Number(row.payroll_amount || 0))
      },
      {
        key: 'cash_in_hand',
        label: 'Cash in hand',
        render: (row) => money(Number(row.recovered_amount || 0) - Number(row.expense_amount || 0) - Number(row.payroll_amount || 0))
      },
      {
        key: 'net_amount',
        label: 'Net',
        render: (row) => money(Number(row.recovered_amount || 0) - Number(row.expense_amount || 0) - Number(row.payroll_amount || 0))
      }
    );
  }

  columns.push({
    key: 'actions',
    label: 'Actions',
    render: (row) => (
      <div className="row-actions">
        <button className="mini-btn" onClick={() => navigate(`/projects/${row.id}/floors`, { state: { project: row } })}><Eye size={14} />View</button>
        {canManageProjects && <button className="mini-btn" onClick={() => editProject(row)}><Edit3 size={14} />Edit</button>}
      </div>
    )
  });

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Create buildings and manage the top level of your property hierarchy."
        action={user.role === 'super_admin' && (
          <label className="month-filter">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
      />
      {canManageProjects && (
        <section className="panel">
          <form className="inline-form project-form" onSubmit={submit}>
            <input placeholder="Project name, e.g. Green Heights" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Full address, e.g. Gulberg, Lahore" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            <input placeholder="Description / notes" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input type="number" min="0" placeholder="Total floors" value={form.total_floors} onChange={(e) => setForm({ ...form, total_floors: e.target.value })} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option><option value="planning">Planning</option><option value="maintenance">Maintenance</option><option value="completed">Completed</option>
            </select>
            <button className="primary"><Plus size={16} />{editingId ? 'Update' : 'Create'}</button>
          </form>
        </section>
      )}
      <DataTable rows={data.data} columns={columns} />
    </>
  );
}
