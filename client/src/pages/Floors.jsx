import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

export function Floors() {
  const projects = useApi('/projects?limit=100', { data: [] });
  const floors = useApi('/floors', { data: [] });
  const [form, setForm] = useState({ project_id: '', floor_number: '', description: '' });

  async function submit(event) {
    event.preventDefault();
    await api.post('/floors', form);
    setForm({ project_id: '', floor_number: '', description: '' });
    floors.reload();
  }

  return (
    <>
      <PageHeader title="Floors" subtitle="Organize each project into numbered or named levels." />
      <section className="panel">
        <form className="inline-form" onSubmit={submit}>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required>
            <option value="">Project</option>
            {projects.data.data.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
          </select>
          <input placeholder="Floor number" value={form.floor_number} onChange={(e) => setForm({ ...form, floor_number: e.target.value })} required />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="primary"><Plus size={16} />Create</button>
        </form>
      </section>
      <DataTable rows={floors.data.data} columns={[
        { key: 'project_name', label: 'Project' },
        { key: 'floor_number', label: 'Floor' },
        { key: 'description', label: 'Description' },
        { key: 'unit_count', label: 'Units' }
      ]} />
    </>
  );
}
