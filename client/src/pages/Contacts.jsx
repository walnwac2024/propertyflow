import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

export function Contacts() {
  const contacts = useApi('/contacts?limit=100', { data: [] });
  const [form, setForm] = useState({ contact_type: 'owner', name: '', email: '', phone: '', national_id: '', address: '' });

  async function submit(event) {
    event.preventDefault();
    await api.post('/contacts', {
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      national_id: form.national_id || null,
      address: form.address || null
    });
    setForm({ contact_type: 'owner', name: '', email: '', phone: '', national_id: '', address: '' });
    contacts.reload();
  }

  return (
    <>
      <PageHeader title="Owners & Tenants" subtitle="Manage contact records, roles, phone numbers, IDs, and addresses." />
      <section className="panel">
        <form className="inline-form" onSubmit={submit}>
          <select value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })}><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="vendor">Vendor</option><option value="other">Other</option></select>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="National ID" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
          <button className="primary"><Plus size={16} />Create</button>
        </form>
      </section>
      <DataTable rows={contacts.data.data} columns={[
        { key: 'contact_type', label: 'Type', render: (row) => <span className="pill">{row.contact_type}</span> },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'national_id', label: 'National ID' },
        { key: 'status', label: 'Status' }
      ]} />
    </>
  );
}
