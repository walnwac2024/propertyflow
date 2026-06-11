import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Download, Edit3, Eye, Plus, Printer } from 'lucide-react';
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

const todayMonth = new Date().toISOString().slice(0, 7);

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function reportMonth(value) {
  return new Date(`${value}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function FloorSummaryPrint({ title, rows, totals }) {
  return (
    <div className="print-area">
      <section className="floor-summary-print">
        <h1>{title}</h1>
        <table>
          <thead>
            <tr>{summaryHead.map((head) => <th key={head}>{head}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.floor}-${row.shopNo}`}>
                <td>{row.floor}</td>
                <td>{row.shopNo}</td>
                <td>{row.name}</td>
                <td>{row.meterNo}</td>
                <td>{row.previousReading}</td>
                <td>{row.presentReading}</td>
                <td>{row.unitsConsumed}</td>
                <td>{row.tariff}</td>
                <td>{money(row.maintenanceCharges)}</td>
                <td>{money(row.billAmount)}</td>
                <td>{money(row.previousArrears)}</td>
                <td>{money(row.totalBillAmount)}</td>
                <td>{money(row.receivedAmount)}</td>
                <td>{money(row.balance)}</td>
              </tr>
            ))}
            <tr className="summary-total-row">
              <th colSpan="8">Total</th>
              <th>{money(totals.maintenanceCharges)}</th>
              <th>{money(totals.billAmount)}</th>
              <th>{money(totals.previousArrears)}</th>
              <th>{money(totals.totalBillAmount)}</th>
              <th>{money(totals.receivedAmount)}</th>
              <th>{money(totals.balance)}</th>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

const summaryHead = [
  'Floor',
  'Shop No',
  'Shop/Flat Name',
  'Meter No',
  'Previous Reading',
  'Present Reading',
  'Unit Consumed',
  'Tariff',
  'Maintenance Charges',
  'Bill Amount',
  'Previous Arrears',
  'Total Bill Amount',
  'Received Amount',
  'Balance R/A'
];

export function FloorUnits() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId, floorId } = useParams();
  const units = useApi(`/units?floor_id=${floorId}&limit=100`, { data: [] });
  const contacts = useApi('/contacts?limit=100', { data: [] });
  const [month, setMonth] = useState(todayMonth);
  const bills = useApi(`/billing/electricity-bills?month=${month}`, { data: [] });
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [printingSummary, setPrintingSummary] = useState(false);
  const [form, setForm] = useState({
    floor_id: floorId,
    unit_number: '',
    unit_name: '',
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
      unit_name: '',
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
      unit_name: unit.unit_name || '',
      unit_type: unit.unit_type || 'apartment',
      area_sqft: unit.area_sqft || 0,
      owner_id: unit.owner_id || '',
      tenant_id: unit.tenant_id || '',
      occupancy_status: unit.occupancy_status || 'vacant',
      status: unit.status || 'active'
    });
  }

  function billForUnit(unit) {
    return bills.data.data.find((bill) => Number(bill.unit_id) === Number(unit.id));
  }

  function summaryRows() {
    return units.data.data.map((unit) => {
      const bill = billForUnit(unit);
      const totalBillAmount = Number(bill?.payable_within_due || 0);
      const receivedAmount = Number(bill?.paid_amount || 0);
      return {
        floor: unit.floor_number || floorName,
        shopNo: unit.unit_number,
        name: bill?.tenant_name || bill?.owner_name || bill?.unit_name || unit.unit_name || unit.tenant_name || unit.owner_name || '-',
        meterNo: bill?.meter_no || '',
        previousReading: bill?.previous_reading || '',
        presentReading: bill?.present_reading || '',
        unitsConsumed: bill?.units_consumed || '',
        tariff: bill?.tariff ? Number(bill.tariff).toFixed(2) : '',
        maintenanceCharges: Number(bill?.maintenance_charges || 0),
        billAmount: Number(bill?.current_bill || 0),
        previousArrears: Number(bill?.previous_arrears || 0),
        totalBillAmount,
        receivedAmount,
        balance: totalBillAmount - receivedAmount
      };
    });
  }

  function summaryTotals(rows) {
    return rows.reduce((sum, row) => ({
      maintenanceCharges: sum.maintenanceCharges + row.maintenanceCharges,
      billAmount: sum.billAmount + row.billAmount,
      previousArrears: sum.previousArrears + row.previousArrears,
      totalBillAmount: sum.totalBillAmount + row.totalBillAmount,
      receivedAmount: sum.receivedAmount + row.receivedAmount,
      balance: sum.balance + row.balance
    }), { maintenanceCharges: 0, billAmount: 0, previousArrears: 0, totalBillAmount: 0, receivedAmount: 0, balance: 0 });
  }

  function filename(ext) {
    return `${projectName}-${floorName}-${month}-summary.${ext}`.replace(/\s+/g, '-');
  }

  function summaryTitle() {
    return `${projectName} Floor ${floorName} Summary For the Month of ${reportMonth(month)}`;
  }

  function printSummary() {
    setPrintingSummary(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintingSummary(false), 500);
    }, 100);
  }

  async function downloadPdf() {
    const rows = summaryRows();
    const totals = summaryTotals(rows);
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(summaryTitle(), 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [summaryHead],
      body: rows.map((row) => [
        row.floor, row.shopNo, row.name, row.meterNo, row.previousReading, row.presentReading, row.unitsConsumed,
        row.tariff, money(row.maintenanceCharges), money(row.billAmount), money(row.previousArrears),
        money(row.totalBillAmount), money(row.receivedAmount), money(row.balance)
      ]),
      foot: [[
        'Total', '', '', '', '', '', '', '', money(totals.maintenanceCharges), money(totals.billAmount),
        money(totals.previousArrears), money(totals.totalBillAmount), money(totals.receivedAmount), money(totals.balance)
      ]],
      styles: { fontSize: 7, cellPadding: 1.4 },
      headStyles: { fillColor: [45, 45, 45] },
      footStyles: { fillColor: [235, 235, 235], textColor: [20, 20, 20], fontStyle: 'bold' },
      margin: { left: 8, right: 8 }
    });
    doc.save(filename('pdf'));
  }

  function downloadCsv() {
    const rows = summaryRows();
    const totals = summaryTotals(rows);
    const csvRows = [
      [summaryTitle()],
      summaryHead,
      ...rows.map((row) => [
        row.floor, row.shopNo, row.name, row.meterNo, row.previousReading, row.presentReading, row.unitsConsumed,
        row.tariff, row.maintenanceCharges, row.billAmount, row.previousArrears, row.totalBillAmount, row.receivedAmount, row.balance
      ]),
      ['Total', '', '', '', '', '', '', '', totals.maintenanceCharges, totals.billAmount, totals.previousArrears, totals.totalBillAmount, totals.receivedAmount, totals.balance]
    ];
    downloadBlob(filename('csv'), csvRows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  return (
    <>
      <PageHeader
        title={`Units on floor ${floorName}`}
        subtitle={projectName}
        action={(
          <div className="actions">
            <label className="month-filter">Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
            <button className="secondary" onClick={printSummary}><Printer size={16} />Print</button>
            <button className="secondary" onClick={downloadPdf}><Download size={16} />PDF</button>
            <button className="secondary" onClick={downloadCsv}><Download size={16} />CSV</button>
            <button className="secondary" onClick={() => navigate(`/projects/${projectId}/floors`)}><ArrowLeft size={16} />Floors</button>
          </div>
        )}
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
            <Field label="Unit name">
              <input placeholder="e.g. Fast Track, Flat 105" value={form.unit_name} onChange={(e) => setForm({ ...form, unit_name: e.target.value })} />
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
        { key: 'unit_name', label: 'Unit Name', render: (row) => row.unit_name || '-' },
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
            <div><span>Unit Name</span><strong>{selectedUnit.unit_name || '-'}</strong></div>
            <div><span>Type</span><strong>{selectedUnit.unit_type}</strong></div>
            <div><span>Area</span><strong>{selectedUnit.area_sqft}</strong></div>
            <div><span>Owner</span><strong>{selectedUnit.owner_name || '-'}</strong></div>
            <div><span>Tenant</span><strong>{selectedUnit.tenant_name || '-'}</strong></div>
            <div><span>Assigned To</span><strong>{assignedTo(selectedUnit)}</strong></div>
          </div>
        </section>
      )}
      {printingSummary && (
        <FloorSummaryPrint title={summaryTitle()} rows={summaryRows()} totals={summaryTotals(summaryRows())} />
      )}
    </>
  );
}
