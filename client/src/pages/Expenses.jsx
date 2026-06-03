import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

export function Expenses() {
  const projects = useApi('/projects?limit=100', { data: [] });
  const categories = useApi('/expenses/categories', { data: [] });
  const expenses = useApi('/expenses?limit=100', { data: [] });
  const [form, setForm] = useState({ project_id: '', category_id: '', title: '', amount: 0, expense_date: new Date().toISOString().slice(0, 10), vendor_name: '' });

  async function submit(event) {
    event.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if ((key === 'project_id' || key === 'category_id') && !value) return;
      fd.append(key, value);
    });
    await api.post('/expenses', fd);
    setForm({ project_id: '', category_id: '', title: '', amount: 0, expense_date: new Date().toISOString().slice(0, 10), vendor_name: '' });
    expenses.reload();
  }

  return (
    <>
      <PageHeader title="Expenses" subtitle="Record project costs, vendor spend, invoices, and approval status." />
      <section className="panel">
        <form className="inline-form" onSubmit={submit}>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}><option value="">Project</option>{projects.data.data.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Category</option>{categories.data.data.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input type="number" min="0" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          <button className="primary"><Plus size={16} />Record</button>
        </form>
      </section>
      <DataTable rows={expenses.data.data} columns={[
        { key: 'title', label: 'Expense' },
        { key: 'project_name', label: 'Project' },
        { key: 'category_name', label: 'Category' },
        { key: 'amount', label: 'Amount' },
        { key: 'expense_date', label: 'Date' },
        { key: 'approval_status', label: 'Status', render: (row) => <span className={`pill ${row.approval_status}`}>{row.approval_status}</span> }
      ]} />
    </>
  );
}
