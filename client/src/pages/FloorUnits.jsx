import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Edit3, Eye, Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
}

function assigneeLabel(contact) {
  const loginState = contact.user_id ? 'login user' : 'contact only';
  return `${contact.name}${contact.email ? ` - ${contact.email}` : ''} (${loginState})`;
}

function assignedTo(unit) {
  const owner = unit.owner_user_name || unit.owner_name;
  const tenant = unit.tenant_user_name || unit.tenant_name;
  if (owner && tenant) return `Owner: ${owner} / Tenant: ${tenant}`;
  if (tenant) return `Tenant: ${tenant}`;
  if (owner) return `Owner: ${owner}`;
  return '-';
}

export function FloorUnits() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, floorId } = useParams();
  const units = useApi(`/units?floor_id=${floorId}&limit=100`, { data: [] });
  const contacts = useApi('/contacts?limit=100', { data: [] });
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    floor_id: floorId,
    unit_number: '',
    unit_type: 'apartment',
    area_sqft: 0,
    owner_id: '',
    tenant_id: '',
    occupancy_status: 'vacant',
    status: 'active'
  });
  const user = JSON.parse(localStorage.getItem('propertyflow_user') || '{}');
  const canManageUnits = ['super_admin', 'property_manager'].includes(user.role);
  const floorName = location.state?.floor?.floor_number || units.data.data[0]?.floor_number || floorId;
  const projectName = location.state?.projectName || units.data.data[0]?.project_name || `Project #${projectId}`;
  const owners = contacts.data.data.filter((contact) => contact.contact_type === 'owner');
  const tenants = contacts.data.data.filter((contact) => contact.contact_type === 'tenant');

  function resetForm() {
    setEditingId(null);
    setForm({
      floor_id: floorId,
      unit_number: '',
      unit_type: 'apartment',
      area_sqft: 0,
      owner_id: '',
      tenant_id: '',
      occupancy_status: 'vacant',
      status: 'active'
    });
  }

  async function submit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      floor_id: floorId,
      owner_id: form.owner_id || null,
      tenant_id: form.tenant_id || null
    };
    if (editingId) {
      await api.put(`/units/${editingId}`, payload);
    } else {
      await api.post('/units', payload);
    }
    resetForm();
    setSelectedUnit(null);
    units.reload();
  }

  function editUnit(unit) {
    setEditingId(unit.id);
    setSelectedUnit(unit);
    setForm({
      floor_id: floorId,
      unit_number: unit.unit_number || '',
      unit_type: unit.unit_type || 'apartment',
      area_sqft: unit.area_sqft || 0,
      owner_id: unit.owner_id || '',
      tenant_id: unit.tenant_id || '',
      occupancy_status: unit.occupancy_status || 'vacant',
      status: unit.status || 'active'
    });
  }

  return (
    <>
      <PageHeader
        title={`Units on floor ${floorName}`}
        subtitle={projectName}
        action={<button className="secondary" onClick={() => navigate(`/projects/${projectId}/floors`)}><ArrowLeft size={16} />Floors</button>}
      />
      {canManageUnits && (
        <section className="panel">
          <div className="section-title">
            <h2>{editingId ? `Update unit ${form.unit_number}` : 'Add unit to this floor'}</h2>
            {editingId && <button type="button" className="mini-btn" onClick={resetForm}>Cancel edit</button>}
          </div>
          <form className="inline-form floor-unit-form" onSubmit={submit}>
            <Field label="Project / floor">
              <input value={`${projectName} / ${floorName}`} disabled />
            </Field>
            <Field label="Unit name / number">
              <input placeholder="e.g. 101, Shop 4, Office A" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} required />
            </Field>
            <Field label="Unit type">
              <select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}>
                <option value="apartment">Apartment</option>
                <option value="office">Office</option>
                <option value="shop">Shop</option>
                <option value="warehouse">Warehouse</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Area sq ft">
              <input type="number" min="0" placeholder="e.g. 850" value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: e.target.value })} />
            </Field>
            <Field label="Assign owner user">
              <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}>
                <option value="">No owner assigned</option>
                {owners.map((contact) => <option value={contact.id} key={contact.id}>{assigneeLabel(contact)}</option>)}
              </select>
            </Field>
            <Field label="Assign tenant user">
              <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
                <option value="">No tenant assigned</option>
                {tenants.map((contact) => <option value={contact.id} key={contact.id}>{assigneeLabel(contact)}</option>)}
              </select>
            </Field>
            <Field label="Occupancy status">
              <select value={form.occupancy_status} onChange={(e) => setForm({ ...form, occupancy_status: e.target.value })}>
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>
            <div className="form-action-field">
              <button className="primary"><Plus size={16} />{editingId ? 'Update unit' : 'Add unit'}</button>
            </div>
          </form>
        </section>
      )}
      <DataTable rows={units.data.data} columns={[
        { key: 'unit_number', label: 'Unit' },
        { key: 'unit_type', label: 'Type' },
        { key: 'area_sqft', label: 'Area' },
        { key: 'owner_name', label: 'Owner' },
        { key: 'tenant_name', label: 'Tenant' },
        { key: 'assigned_to', label: 'Assigned to', render: assignedTo },
        { key: 'occupancy_status', label: 'Status', render: (row) => <span className={`pill ${row.occupancy_status}`}>{row.occupancy_status}</span> },
        {
          key: 'actions',
          label: 'Actions',
          render: (row) => (
            <div className="row-actions">
              <button className="mini-btn" onClick={() => setSelectedUnit(row)}><Eye size={14} />View</button>
              {canManageUnits && <button className="mini-btn" onClick={() => editUnit(row)}><Edit3 size={14} />Edit</button>}
            </div>
          )
        }
      ]} empty="No units found for this floor" />
      {selectedUnit && (
        <section className="panel detail-panel">
          <div className="section-title">
            <h2>Unit {selectedUnit.unit_number}</h2>
            <span className={`pill ${selectedUnit.occupancy_status}`}>{selectedUnit.occupancy_status}</span>
          </div>
          <div className="detail-grid">
            <div><span>Project</span><strong>{selectedUnit.project_name}</strong></div>
            <div><span>Floor</span><strong>{selectedUnit.floor_number}</strong></div>
            <div><span>Type</span><strong>{selectedUnit.unit_type}</strong></div>
            <div><span>Area</span><strong>{selectedUnit.area_sqft}</strong></div>
            <div><span>Owner</span><strong>{selectedUnit.owner_name || '-'}</strong></div>
            <div><span>Tenant</span><strong>{selectedUnit.tenant_name || '-'}</strong></div>
            <div><span>Assigned To</span><strong>{assignedTo(selectedUnit)}</strong></div>
          </div>
        </section>
      )}
    </>
  );
}
