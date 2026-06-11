import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, Plus, Printer, Search } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';
import { BillSlip, FloorSummaryPrint } from './Billing.jsx';

const todayMonth = new Date().toISOString().slice(0, 7);

function moneyValue(value) {
  return Number(value || 0);
}

function formatMoney(value) {
  return moneyValue(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatMonth(value) {
  return new Date(`${value}-01`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function floorSummaryRows(row, units, bills) {
  return units.map((unit) => {
    const bill = bills.find((item) => Number(item.unit_id) === Number(unit.id));
    const totalBillAmount = moneyValue(bill?.payable_within_due);
    const receivedAmount = moneyValue(bill?.paid_amount);
    return {
      id: unit.id,
      floor: unit.floor_number || row.floor_number,
      shopNo: unit.unit_number,
      name: bill?.unit_name || unit.unit_name || bill?.tenant_name || bill?.owner_name || unit.tenant_name || unit.owner_name || '-',
      meterNo: bill?.meter_no || '',
      previousReading: bill?.previous_reading || '',
      presentReading: bill?.present_reading || '',
      unitsConsumed: bill?.units_consumed || '',
      tariff: bill?.tariff ? Number(bill.tariff).toFixed(2) : '',
      maintenanceCharges: moneyValue(bill?.maintenance_charges),
      billAmount: moneyValue(bill?.current_bill),
      previousArrears: moneyValue(bill?.previous_arrears),
      totalBillAmount,
      receivedAmount,
      balance: totalBillAmount - receivedAmount
    };
  });
}

function floorSummaryTotals(rows) {
  return rows.reduce((sum, row) => ({
    maintenanceCharges: sum.maintenanceCharges + row.maintenanceCharges,
    billAmount: sum.billAmount + row.billAmount,
    previousArrears: sum.previousArrears + row.previousArrears,
    totalBillAmount: sum.totalBillAmount + row.totalBillAmount,
    receivedAmount: sum.receivedAmount + row.receivedAmount,
    balance: sum.balance + row.balance
  }), { maintenanceCharges: 0, billAmount: 0, previousArrears: 0, totalBillAmount: 0, receivedAmount: 0, balance: 0 });
}

export function Floors() {
  const navigate = useNavigate();
  const projects = useApi('/projects?limit=100', { data: [] });
  const floors = useApi('/floors', { data: [] });
  const [month, setMonth] = useState(todayMonth);
  const [form, setForm] = useState({ project_id: '', floor_number: '', description: '' });
  const [printSummary, setPrintSummary] = useState(null);
  const [printBills, setPrintBills] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const filteredFloors = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return floors.data.data;
    return floors.data.data.filter((floor) => [
      floor.project_name,
      floor.floor_number,
      floor.description,
      floor.unit_count
    ].some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [floors.data.data, search]);

  async function submit(event) {
    event.preventDefault();
    await api.post('/floors', form);
    setForm({ project_id: '', floor_number: '', description: '' });
    floors.reload();
  }

  async function getFloorPrintData(row) {
    const [unitsResponse, billsResponse] = await Promise.all([
      api.get(`/units?floor_id=${row.id}&limit=500`),
      api.get(`/billing/electricity-bills?month=${month}`)
    ]);
    const units = unitsResponse.data.data || [];
    const bills = (billsResponse.data.data || []).filter((bill) => Number(bill.floor_id) === Number(row.id));
    return { units, bills };
  }

  function printAfterRender(clear) {
    setTimeout(() => {
      window.print();
      setTimeout(clear, 500);
    }, 100);
  }

  async function printFloorSummary(row) {
    setMessage('');
    const { units, bills } = await getFloorPrintData(row);
    const rows = floorSummaryRows(row, units, bills);
    const totals = floorSummaryTotals(rows);
    setPrintBills([]);
    setPrintSummary({
      title: `${row.project_name} Floor ${row.floor_number} Summary For the Month of ${formatMonth(month)}`,
      rows,
      totals
    });
    printAfterRender(() => setPrintSummary(null));
  }

  async function printFloorBills(row) {
    setMessage('');
    const { bills } = await getFloorPrintData(row);
    if (!bills.length) {
      setMessage(`No bills found for ${row.project_name} floor ${row.floor_number} in ${month}.`);
      return;
    }
    const details = await Promise.all(bills.map((bill) => api.get(`/billing/electricity-bills/${bill.id}`).then((response) => response.data.data)));
    setPrintSummary(null);
    setPrintBills(details);
    printAfterRender(() => setPrintBills([]));
  }

  return (
    <>
      <PageHeader
        title="Floors"
        subtitle="Organize each project into numbered or named levels."
        action={<label className="month-filter">Month <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
      />
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
      {message && <div className="success-message no-print">{message}</div>}
      <div className="no-print">
        <div className="table-tools">
          <label className="local-search">
            <Search size={16} />
            <input placeholder="Search floors, projects, descriptions, units" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>
        <DataTable rows={filteredFloors} columns={[
          { key: 'project_name', label: 'Project' },
          { key: 'floor_number', label: 'Floor' },
          { key: 'description', label: 'Description' },
          { key: 'unit_count', label: 'Units' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="row-actions">
                <button className="mini-btn" onClick={() => navigate(`/projects/${row.project_id}/floors/${row.id}/units`, { state: { projectName: row.project_name, floor: row } })}><Eye size={14} />View units</button>
                <button className="mini-btn" onClick={() => printFloorSummary(row)}><FileText size={14} />Print summary</button>
                <button className="mini-btn" onClick={() => printFloorBills(row)}><Printer size={14} />Print bills</button>
              </div>
            )
          }
        ]} />
      </div>
      {printSummary && (
        <div className="print-area">
          <FloorSummaryPrint title={printSummary.title} rows={printSummary.rows} totals={printSummary.totals} />
        </div>
      )}
      {printBills.length > 0 && (
        <div className="print-area print-stack">
          {printBills.map((bill) => <BillSlip bill={bill} key={bill.id} />)}
        </div>
      )}
    </>
  );
}
