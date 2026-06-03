import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Edit3, Eye, Plus } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

function assignedTo(unit) {
  const owner = unit.owner_user_name || unit.owner_name;
  const tenant = unit.tenant_user_name || unit.tenant_name;
  if (owner && tenant) return `Owner: ${owner} / Tenant: ${tenant}`;
  if (tenant) return `Tenant: ${tenant}`;
  if (owner) return `Owner: ${owner}`;
  return '-';
}

function assigneeOption(contact) {
  return `${contact.name}${contact.email ? ` - ${contact.email}` : ''}${contact.user_id ? ' (login user)' : ''}`;
}

export function Units() {
  const location = useLocation();
  const floors = useApi('/floors', { data: [] });
  const contacts = useApi('/contacts?limit=100', { data: [] });
  const units = useApi('/units?limit=100', { data: [] });
  const [form, setForm] = useState({ floor_id: '', unit_number: '', unit_type: 'apartment', area_sqft: 0, owner_id: '', tenant_id: '', occupancy_status: 'vacant' });
  const [editingId, setEditingId] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const user = JSON.parse(localStorage.getItem('propertyflow_user') || '{}');
  const canManageUnits = ['super_admin', 'property_manager'].includes(user.role);

  useEffect(() => {
    if (location.state?.editUnit) {
      editUnit(location.state.editUnit);
    }
  }, [location.state]);

  async function submit(event) {
    event.preventDefault();
    const payload = { ...form, owner_id: form.owner_id || null, tenant_id: form.tenant_id || null };
    if (editingId) {
      await api.put(`/units/${editingId}`, payload);
    } else {
      await api.post('/units', payload);
    }
    setForm({ floor_id: '', unit_number: '', unit_type: 'apartment', area_sqft: 0, owner_id: '', tenant_id: '', occupancy_status: 'vacant' });
    setEditingId(null);
    units.reload();
  }

  function editUnit(unit) {
    setEditingId(unit.id);
    setForm({
      floor_id: unit.floor_id,
      unit_number: unit.unit_number,
      unit_type: unit.unit_type,
      area_sqft: unit.area_sqft || 0,
      owner_id: unit.owner_id || '',
      tenant_id: unit.tenant_id || '',
      occupancy_status: unit.occupancy_status || 'vacant'
    });
    setSelectedUnit(unit);
  }

  const owners = contacts.data.data.filter((contact) => contact.contact_type === 'owner');
  const tenants = contacts.data.data.filter((contact) => contact.contact_type === 'tenant');

  return (
    <>
      <PageHeader title="Units" subtitle="Track apartments, offices, shops, warehouses, custom units, and occupancy." />
      {canManageUnits && (
        <section className="panel">
          <form className="inline-form unit-form" onSubmit={submit}>
            <select value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })} required>
              <option value="">Floor</option>
              {floors.data.data.map((floor) => <option value={floor.id} key={floor.id}>{floor.project_name} / {floor.floor_number}</option>)}
            </select>
            <input placeholder="Unit number" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} required />
            <select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}>
              <option value="apartment">Apartment</option><option value="office">Office</option><option value="shop">Shop</option><option value="warehouse">Warehouse</option><option value="other">Other</option>
            </select>
            <input type="number" min="0" placeholder="Area sq ft" value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: e.target.value })} />
            <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}><option value="">Owner</option>{owners.map((c) => <option value={c.id} key={c.id}>{assigneeOption(c)}</option>)}</select>
            <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}><option value="">Tenant</option>{tenants.map((c) => <option value={c.id} key={c.id}>{assigneeOption(c)}</option>)}</select>
            <select value={form.occupancy_status} onChange={(e) => setForm({ ...form, occupancy_status: e.target.value })}><option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="reserved">Reserved</option><option value="maintenance">Maintenance</option></select>
            <button className="primary"><Plus size={16} />{editingId ? 'Update' : 'Create'}</button>
          </form>
        </section>
      )}
      <DataTable rows={units.data.data} columns={[
        { key: 'project_name', label: 'Project' },
        { key: 'floor_number', label: 'Floor' },
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
      ]} />
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
