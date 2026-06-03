import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

export function UsersAdmin() {
  const users = useApi('/auth/users', { data: [] });
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'property_manager',
    phone: '',
    national_id: '',
    address: ''
  });

  async function submit(event) {
    event.preventDefault();
    await api.post('/auth/users', {
      ...form,
      phone: form.phone || null,
      national_id: form.national_id || null,
      address: form.address || null
    });
    setForm({ name: '', email: '', password: '', role: 'property_manager', phone: '', national_id: '', address: '' });
    users.reload();
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Create secure logins and assign system roles." />
      <section className="panel">
        <form className="inline-form user-form" onSubmit={submit}>
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input placeholder="Password" type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="property_manager">Property Manager</option>
            <option value="accountant">Accountant</option>
            <option value="owner">Owner</option>
            <option value="tenant">Tenant</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="National ID" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
          <button className="primary"><Plus size={16} />Create user</button>
        </form>
      </section>
      <DataTable rows={users.data.data} columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (row) => <span className="pill"><ShieldCheck size={12} /> {row.role.replace('_', ' ')}</span> },
        { key: 'phone', label: 'Phone' },
        { key: 'contact_type', label: 'Linked contact', render: (row) => row.contact_type || '-' },
        { key: 'status', label: 'Status' }
      ]} />
    </>
  );
}
