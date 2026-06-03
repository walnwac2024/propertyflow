import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Edit3, Eye, Layers3, Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
}

export function ProjectFloors() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const floors = useApi(`/floors?project_id=${projectId}`, { data: [] });
  const project = location.state?.project;
  const projectName = project?.name || floors.data.data[0]?.project_name || `Project #${projectId}`;
  const user = JSON.parse(localStorage.getItem('propertyflow_user') || '{}');
  const canManageFloors = ['super_admin', 'property_manager'].includes(user.role);
  const [form, setForm] = useState({ project_id: projectId, floor_number: '', description: '' });
  const [editingId, setEditingId] = useState(null);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, project_id: projectId };
    if (editingId) {
      await api.put(`/floors/${editingId}`, payload);
    } else {
      await api.post('/floors', payload);
    }
    setForm({ project_id: projectId, floor_number: '', description: '' });
    setEditingId(null);
    floors.reload();
  }

  function editFloor(floor) {
    setEditingId(floor.id);
    setForm({
      project_id: projectId,
      floor_number: floor.floor_number || '',
      description: floor.description || ''
    });
  }

  return (
    <>
      <PageHeader
        title={`${projectName} Floors`}
        subtitle="Select a floor to view its units on the next page."
        action={<button className="secondary" onClick={() => navigate('/projects')}><ArrowLeft size={16} />Projects</button>}
      />
      {canManageFloors && (
        <section className="panel">
          <div className="section-title">
            <h2><Layers3 size={18} />{editingId ? 'Update floor' : 'Add floor'}</h2>
            {editingId && <button type="button" className="mini-btn" onClick={() => { setEditingId(null); setForm({ project_id: projectId, floor_number: '', description: '' }); }}>Cancel edit</button>}
          </div>
          <form className="inline-form floor-form" onSubmit={submit}>
            <Field label="Project">
              <input value={projectName} disabled />
            </Field>
            <Field label="Floor name / number">
              <input placeholder="e.g. Ground, First, 5th" value={form.floor_number} onChange={(e) => setForm({ ...form, floor_number: e.target.value })} required />
            </Field>
            <Field label="Description">
              <input placeholder="e.g. Retail level, residential floor" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="form-action-field">
              <button className="primary"><Plus size={16} />{editingId ? 'Update' : 'Add floor'}</button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="section-title">
          <h2><Layers3 size={18} />Floors</h2>
          <span className="pill">{floors.data.data.length} floors</span>
        </div>
        <DataTable rows={floors.data.data} columns={[
          { key: 'floor_number', label: 'Floor' },
          { key: 'description', label: 'Description' },
          { key: 'unit_count', label: 'Units' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="row-actions">
                <button
                  className="mini-btn"
                  onClick={() => navigate(`/projects/${projectId}/floors/${row.id}/units`, { state: { projectName, floor: row } })}
                >
                  <Eye size={14} />View units
                </button>
                {canManageFloors && <button className="mini-btn" onClick={() => editFloor(row)}><Edit3 size={14} />Edit</button>}
              </div>
            )
          }
        ]} empty="No floors found for this project" />
      </section>
    </>
  );
}
