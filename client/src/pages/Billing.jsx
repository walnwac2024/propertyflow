import { useEffect, useMemo, useState } from 'react';
import { Calculator, Edit3, Eye, Layers3, Plus, Printer } from 'lucide-react';
import { api } from '../api.js';
import { DataTable } from '../components/DataTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

const today = new Date();
const monthValue = today.toISOString().slice(0, 7);
const dateValue = today.toISOString().slice(0, 10);

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatMonth(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function inputDate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function inputMonth(value) {
  if (!value) return monthValue;
  return new Date(value).toISOString().slice(0, 7);
}

function numberValue(value) {
  return Number(value || 0);
}

function multiplierValue(value) {
  const next = Number(value);
  return next > 0 ? next : 1;
}

function billStatusLabel(status) {
  if (status === 'draft') return 'Pending';
  if (status === 'issued') return 'Approved';
  return String(status || '-').replace('_', ' ');
}

function billStatusClass(status) {
  if (status === 'draft') return 'pending';
  if (status === 'issued') return 'approved';
  return status || '';
}

function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
}

function BillSlip({ bill }) {
  if (!bill) return null;

  return (
    <section className="bill-slip">
      <h1>BUILDING MANAGEMENT SERVICES</h1>
      <div className="bill-subtitle">ELECTRICITY CONSUMER BILL</div>

      <div className="slip-grid top-slip">
        <div className="black">BILL NUMBER</div>
        <div className="black">BILLING MONTH</div>
        <div className="black">READING DATE</div>
        <div className="black">ISSUE DATE</div>
        <div className="black red-text">DUE DATE</div>
        <div className="blue-cell">{bill.bill_no}</div>
        <div>{formatMonth(bill.bill_month)}</div>
        <div>{formatDate(bill.reading_date)}</div>
        <div>{formatDate(bill.issue_date)}</div>
        <div className="red-text">{formatDate(bill.due_date)}</div>
        <div className="black">CONSUMER ID</div>
        <div className="black">TARIFF</div>
        <div className="black">BUILDING</div>
        <div className="span-2">{bill.project_name}</div>
        <div>{bill.consumer_id || bill.unit_id}</div>
        <div>{Number(bill.tariff || 0).toFixed(2)}</div>
        <div className="black">FLOOR</div>
        <div className="span-2">{bill.floor_number}</div>
        <div className="blank"></div>
        <div className="blank"></div>
        <div className="black">UNIT</div>
        <div className="span-2">{bill.unit_number}</div>
      </div>

      <div className="slip-main">
        <div className="consumer-box">
          <p><strong>NAME & ADDRESS</strong> <u>{bill.tenant_name || bill.owner_name || '-'}</u></p>
          <p><strong>ADDRESS:</strong> {bill.project_address || '-'} <strong>Floor</strong> {bill.floor_number} <strong>Unit No.</strong> {bill.unit_number}</p>
          <p>ELECTRICITY WILL DISCONTINUE AFTER 2 DAYS OF DUE DATE</p>
          <table>
            <thead>
              <tr><th>METER NO</th><th>PREVIOUS</th><th>PRESENT</th><th>MF</th><th>UNITS</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{bill.meter_no || '-'}</td>
                <td>{bill.previous_reading}</td>
                <td>{bill.present_reading}</td>
                <td>{bill.multiplier_factor}</td>
                <td>{bill.units_consumed}</td>
                <td>{bill.status}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="project-share-box">
          <table>
            <thead><tr><th>Project</th><th>Percentage</th><th>Payment</th></tr></thead>
            <tbody>
              <tr><td>{bill.project_name}</td><td></td><td></td></tr>
              <tr><td>Common Area</td><td></td><td></td></tr>
              <tr><td>Service</td><td></td><td></td></tr>
              <tr><td>Maintenance</td><td></td><td></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="charges-grid">
        <table>
          <thead><tr><th colSpan="2">ELECTRICITY CHARGES</th></tr></thead>
          <tbody>
            <tr><td>UNITS CONSUMED</td><td>{bill.units_consumed}</td></tr>
            <tr><td>COST OF ELECTRICITY</td><td>{formatMoney(bill.electricity_cost)}</td></tr>
            <tr><td>Water Charges</td><td>{formatMoney(bill.water_charges)}</td></tr>
            <tr><td>Lift Charges</td><td>{formatMoney(bill.lift_charges)}</td></tr>
            <tr><td>Maintenance</td><td>{formatMoney(bill.maintenance_charges)}</td></tr>
            <tr><td>Service Charges</td><td>{formatMoney(bill.service_charges)}</td></tr>
            <tr><td>Wifi Charges</td><td>{formatMoney(bill.wifi_charges)}</td></tr>
            <tr><td>Bill Adjustment</td><td>{formatMoney(bill.bill_adjustment)}</td></tr>
            <tr><td>Installment</td><td>{formatMoney(bill.installment_amount)}</td></tr>
            <tr><td>Subsidy</td><td>-{formatMoney(bill.subsidy_amount)}</td></tr>
            <tr><th>TOTAL</th><th>{formatMoney(bill.current_bill)}</th></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th colSpan="2">BILL CALCULATION</th></tr></thead>
          <tbody>
            <tr><td>Tariff</td><td>{Number(bill.tariff || 0).toFixed(2)}</td></tr>
            <tr><td>Units</td><td>{bill.units_consumed}</td></tr>
            <tr><td>Tariff x Units</td><td>{formatMoney(bill.electricity_cost)}</td></tr>
            <tr><td>Other Charges + Adjustments</td><td>{formatMoney(numberValue(bill.current_bill) - numberValue(bill.electricity_cost))}</td></tr>
            <tr><td>Arrearage</td><td>{formatMoney(bill.previous_arrears)}</td></tr>
            <tr><th>TOTAL BILL</th><th>{formatMoney(bill.payable_within_due)}</th></tr>
          </tbody>
        </table>
        <table>
          <thead><tr><th colSpan="2">TOTAL CHARGES</th></tr></thead>
          <tbody>
            <tr><td>ARREARAGE</td><td>{formatMoney(bill.previous_arrears)}</td></tr>
            <tr><td className="blue-label">CURRENT BILL</td><td>{formatMoney(bill.current_bill)}</td></tr>
            <tr><td>BILL ADJUSTMENT</td><td>{formatMoney(bill.bill_adjustment)}</td></tr>
            <tr><td>INSTALLMENT</td><td>{formatMoney(bill.installment_amount)}</td></tr>
            <tr><td>SUBSIDIES</td><td>{formatMoney(bill.subsidy_amount)}</td></tr>
            <tr><th className="red-text">PAYABLE WITHIN DUE DATE</th><th className="red-text">{formatMoney(bill.payable_within_due)}</th></tr>
            <tr><td>L.P.SURCHARGE</td><td>{formatMoney(bill.lp_surcharge)}</td></tr>
            <tr><th className="red-text">PAYABLE AFTER DUE DATE</th><th className="red-text">{formatMoney(bill.payable_after_due)}</th></tr>
          </tbody>
        </table>
      </div>

      <div className="cut-line">CUT HERE</div>
      <h1>BUILDING MANAGEMENT SERVICES</h1>
      <div className="bill-subtitle">ELECTRICITY CONSUMER BILL</div>
      <div className="voucher-grid">
        <div><strong>ADDRESS:</strong> {bill.project_name}</div>
        <div><strong>Floor</strong> {bill.floor_number}</div>
        <div><strong>Unit No.</strong> {bill.unit_number}</div>
        <div className="black">CONSUMER ID</div>
        <div className="black">BILL NUMBER</div>
        <div></div>
        <div></div>
        <div></div>
        <div>{bill.consumer_id || bill.unit_id}</div>
        <div>{bill.bill_no}</div>
        <div className="black">BILLING MONTH</div>
        <div className="black red-text">DUE DATE</div>
        <div className="black red-text span-2">PAYABLE WITHIN DUE DATE</div>
        <div className="amount">{formatMoney(bill.payable_within_due)}</div>
        <div>{formatMonth(bill.bill_month)}</div>
        <div className="red-text">{formatDate(bill.due_date)}</div>
        <div className="red-text span-2">PAYABLE AFTER DUE DATE</div>
        <div className="red-text amount">{formatMoney(bill.payable_after_due)}</div>
      </div>
    </section>
  );
}

export function Billing() {
  const projects = useApi('/projects?limit=100', { data: [] });
  const units = useApi('/units?limit=100', { data: [] });
  const [month, setMonth] = useState(monthValue);
  const electricityBills = useApi(`/billing/electricity-bills?month=${month}`, { data: [] });
  const ledgerBills = useApi('/billing/bills?limit=100', { data: [] });
  const [selectedBill, setSelectedBill] = useState(null);
  const [form, setForm] = useState({
    project_id: '',
    unit_id: '',
    bill_month: monthValue,
    reading_date: dateValue,
    issue_date: dateValue,
    due_date: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    consumer_id: '',
    meter_no: '',
    previous_reading: '',
    present_reading: '',
    multiplier_factor: 1,
    total_supply_payable: '',
    total_supply_units: '',
    tariff: '',
    water_charges: 0,
    lift_charges: 0,
    maintenance_charges: 0,
    service_charges: 0,
    wifi_charges: 0,
    other_charges: 0,
    previous_arrears: '',
    bill_adjustment: 0,
    installment_amount: 0,
    subsidy_amount: 0,
    lp_surcharge_percent: 10,
    lp_surcharge: '',
    payable_after_due: ''
  });
  const [previousArrears, setPreviousArrears] = useState(0);
  const [error, setError] = useState('');
  const [editingBillId, setEditingBillId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const projectFloors = useApi(selectedProject ? `/floors?project_id=${selectedProject.id}` : '/floors?project_id=-1', { data: [] });

  const filteredUnits = useMemo(() => {
    if (!form.project_id) return units.data.data;
    return units.data.data.filter((unit) => Number(unit.project_id) === Number(form.project_id));
  }, [units.data.data, form.project_id]);

  const floorUnits = useMemo(() => {
    if (!selectedFloor) return [];
    return units.data.data.filter((unit) => Number(unit.floor_id) === Number(selectedFloor.id));
  }, [selectedFloor, units.data.data]);

  const preview = useMemo(() => {
    const unitsConsumed = Math.max(0, (numberValue(form.present_reading) - numberValue(form.previous_reading)) * multiplierValue(form.multiplier_factor));
    const tariff = form.tariff !== '' ? numberValue(form.tariff) : (numberValue(form.total_supply_units) > 0 ? numberValue(form.total_supply_payable) / numberValue(form.total_supply_units) : 0);
    const electricityCost = unitsConsumed * tariff;
    const currentBill = electricityCost + numberValue(form.water_charges) + numberValue(form.lift_charges) + numberValue(form.maintenance_charges) + numberValue(form.service_charges) + numberValue(form.wifi_charges) + numberValue(form.other_charges) + numberValue(form.bill_adjustment) + numberValue(form.installment_amount) - numberValue(form.subsidy_amount);
    const effectiveArrears = form.previous_arrears === '' ? previousArrears : numberValue(form.previous_arrears);
    const payableWithinDue = effectiveArrears + currentBill;
    const percentSurcharge = currentBill * (numberValue(form.lp_surcharge_percent || 0) / 100);
    const lpSurcharge = form.lp_surcharge === '' ? percentSurcharge : numberValue(form.lp_surcharge);
    const payableAfterDue = form.payable_after_due === '' ? payableWithinDue + lpSurcharge : numberValue(form.payable_after_due);
    return { unitsConsumed, tariff, electricityCost, currentBill, effectiveArrears, payableWithinDue, lpSurcharge, payableAfterDue };
  }, [form, previousArrears]);

  useEffect(() => {
    if (!form.unit_id || !form.bill_month) {
      setPreviousArrears(0);
      return;
    }
    api.get(`/billing/electricity-arrears?unit_id=${form.unit_id}&month=${form.bill_month}`)
      .then((response) => setPreviousArrears(numberValue(response.data.previous_arrears)))
      .catch(() => setPreviousArrears(0));
  }, [form.unit_id, form.bill_month]);

  async function submitElectricityBill(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        multiplier_factor: form.multiplier_factor || 1,
        tariff: form.tariff || null,
        lp_surcharge_percent: form.lp_surcharge_percent || 0,
        payable_after_due: form.payable_after_due || null,
        lp_surcharge: form.lp_surcharge || null
      };
      if (form.previous_arrears === '') delete payload.previous_arrears;
      if (editingBillId) {
        await api.put(`/billing/electricity-bills/${editingBillId}`, payload);
      } else {
        await api.post('/billing/electricity-bills', payload);
      }
      setSelectedBill(null);
      setEditingBillId(null);
      electricityBills.reload();
      ledgerBills.reload();
    } catch (err) {
      const details = err.response?.data?.details?.map((item) => `${item.field}: ${item.message}`).join(', ');
      setError(details || err.response?.data?.message || 'Unable to generate electricity bill');
    }
  }

  async function viewBill(row) {
    const response = await api.get(`/billing/electricity-bills/${row.id}`);
    setSelectedBill(response.data.data);
  }

  async function changeBillStatus(billId, status) {
    await api.patch(`/billing/bills/${billId}/status`, { status });
    electricityBills.reload();
    ledgerBills.reload();
    if (selectedBill?.bill_id === billId) {
      setSelectedBill({ ...selectedBill, status: status === 'approved' ? 'issued' : 'draft' });
    }
  }

  async function printBill(row) {
    await viewBill(row);
    setTimeout(() => window.print(), 100);
  }

  function billForUnit(unit) {
    return electricityBills.data.data.find((bill) => Number(bill.unit_id) === Number(unit.id));
  }

  function selectProject(project) {
    setSelectedProject(project);
    setSelectedFloor(null);
    setSelectedUnit(null);
  }

  function selectFloor(floor) {
    setSelectedFloor(floor);
    setSelectedUnit(null);
  }

  function loadUnitForBill(unit) {
    setSelectedUnit(unit);
    setEditingBillId(null);
    setSelectedBill(null);
    setError('');
    setForm((current) => ({
      ...current,
      project_id: unit.project_id,
      unit_id: unit.id,
      bill_month: month,
      meter_no: current.meter_no || '',
      consumer_id: current.consumer_id || ''
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadBillForEdit(bill) {
    setEditingBillId(bill.id);
    setSelectedUnit(units.data.data.find((unit) => Number(unit.id) === Number(bill.unit_id)) || null);
    setSelectedBill(bill);
    setError('');
    setForm({
      project_id: bill.project_id,
      unit_id: bill.unit_id,
      bill_month: inputMonth(bill.bill_month),
      reading_date: inputDate(bill.reading_date),
      issue_date: inputDate(bill.issue_date),
      due_date: inputDate(bill.due_date),
      consumer_id: bill.consumer_id || '',
      meter_no: bill.meter_no || '',
      previous_reading: bill.previous_reading || '',
      present_reading: bill.present_reading || '',
      multiplier_factor: bill.multiplier_factor || 1,
      total_supply_payable: bill.total_supply_payable || '',
      total_supply_units: bill.total_supply_units || '',
      tariff: bill.tariff || '',
      water_charges: bill.water_charges || 0,
      lift_charges: bill.lift_charges || 0,
      maintenance_charges: bill.maintenance_charges || 0,
      service_charges: bill.service_charges || 0,
      wifi_charges: bill.wifi_charges || 0,
      other_charges: bill.other_charges || 0,
      previous_arrears: bill.previous_arrears || '',
      bill_adjustment: bill.bill_adjustment || 0,
      installment_amount: bill.installment_amount || 0,
      subsidy_amount: bill.subsidy_amount || 0,
      lp_surcharge_percent: '',
      lp_surcharge: bill.lp_surcharge || '',
      payable_after_due: bill.payable_after_due || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateMonth(value) {
    setMonth(value);
    setForm((current) => ({ ...current, bill_month: value }));
  }

  return (
    <>
      <PageHeader
        title="Electricity Billing"
        subtitle="Generate monthly unit bills, calculate tariff, carry arrears, and print consumer slips."
        action={<button className="secondary" onClick={() => window.print()}><Printer size={16} />Print Slip</button>}
      />

      <section className="panel">
        <div className="section-title">
          <h2><Calculator size={18} />Monthly electricity bill</h2>
          <label className="month-filter">Month <input type="month" value={month} onChange={(e) => updateMonth(e.target.value)} /></label>
        </div>
        <form className="electricity-section-form" onSubmit={submitElectricityBill}>
          <div className="form-section">
            <h3>Bill Information</h3>
            <div className="section-fields">
              <Field label="Project / Building">
                <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value, unit_id: '' })} required>
                  <option value="">Select project</option>
                  {projects.data.data.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Floor / Unit">
                <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} required>
                  <option value="">Select unit</option>
                  {filteredUnits.map((u) => <option value={u.id} key={u.id}>{u.floor_number} / {u.unit_number}</option>)}
                </select>
              </Field>
              <Field label="Billing Month">
                <input type="month" value={form.bill_month} onChange={(e) => setForm({ ...form, bill_month: e.target.value })} required />
              </Field>
              <Field label="Consumer ID">
                <input placeholder="e.g. 90" value={form.consumer_id} onChange={(e) => setForm({ ...form, consumer_id: e.target.value })} />
              </Field>
              <Field label="Meter No">
                <input placeholder="e.g. 51424" value={form.meter_no} onChange={(e) => setForm({ ...form, meter_no: e.target.value })} />
              </Field>
              <Field label="Reading Date">
                <input type="date" value={form.reading_date} onChange={(e) => setForm({ ...form, reading_date: e.target.value })} required />
              </Field>
              <Field label="Issue Date">
                <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} required />
              </Field>
              <Field label="Due Date">
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <h3>Electricity Charges</h3>
            <div className="section-fields">
              <Field label="Previous Reading">
                <input type="number" placeholder="e.g. 23309" value={form.previous_reading} onChange={(e) => setForm({ ...form, previous_reading: e.target.value })} required />
              </Field>
              <Field label="Present Reading">
                <input type="number" placeholder="e.g. 23701" value={form.present_reading} onChange={(e) => setForm({ ...form, present_reading: e.target.value })} required />
              </Field>
              <Field label="Multiplier Factor">
                <input type="number" placeholder="MF" value={form.multiplier_factor} onChange={(e) => setForm({ ...form, multiplier_factor: e.target.value })} />
              </Field>
              <Field label="Total Supply Payable">
                <input type="number" placeholder="Total pay of supply bill" value={form.total_supply_payable} onChange={(e) => setForm({ ...form, total_supply_payable: e.target.value })} />
              </Field>
              <Field label="Total Supply Units">
                <input type="number" placeholder="Total units consumed" value={form.total_supply_units} onChange={(e) => setForm({ ...form, total_supply_units: e.target.value })} />
              </Field>
              <Field label="Manual Tariff">
                <input type="number" min="0" step="0.01" placeholder="Optional manual tariff" value={form.tariff} onChange={(e) => setForm({ ...form, tariff: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <h3>Other Charges</h3>
            <div className="section-fields">
              <Field label="Service Charges">
                <input type="number" placeholder="0" value={form.service_charges} onChange={(e) => setForm({ ...form, service_charges: e.target.value })} />
              </Field>
              <Field label="Maintenance Charges">
                <input type="number" placeholder="0" value={form.maintenance_charges} onChange={(e) => setForm({ ...form, maintenance_charges: e.target.value })} />
              </Field>
              <Field label="Wifi Charges">
                <input type="number" placeholder="0" value={form.wifi_charges} onChange={(e) => setForm({ ...form, wifi_charges: e.target.value })} />
              </Field>
              <Field label="Water Charges">
                <input type="number" placeholder="0" value={form.water_charges} onChange={(e) => setForm({ ...form, water_charges: e.target.value })} />
              </Field>
              <Field label="Lift Charges">
                <input type="number" placeholder="0" value={form.lift_charges} onChange={(e) => setForm({ ...form, lift_charges: e.target.value })} />
              </Field>
              <Field label="Other Charges">
                <input type="number" placeholder="0" value={form.other_charges} onChange={(e) => setForm({ ...form, other_charges: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <h3>Total Charges</h3>
            <div className="section-fields">
              <Field label="Arrearage">
                <input type="number" placeholder={`Auto ${formatMoney(previousArrears)}`} value={form.previous_arrears} onChange={(e) => setForm({ ...form, previous_arrears: e.target.value })} />
              </Field>
              <Field label="Bill Adjustment">
                <input type="number" placeholder="0" value={form.bill_adjustment} onChange={(e) => setForm({ ...form, bill_adjustment: e.target.value })} />
              </Field>
              <Field label="Installment">
                <input type="number" placeholder="0" value={form.installment_amount} onChange={(e) => setForm({ ...form, installment_amount: e.target.value })} />
              </Field>
              <Field label="Subsidy">
                <input type="number" placeholder="0" value={form.subsidy_amount} onChange={(e) => setForm({ ...form, subsidy_amount: e.target.value })} />
              </Field>
              <Field label="L.P. Surcharge %">
                <input type="number" min="0" step="0.01" placeholder="% of current bill" value={form.lp_surcharge_percent} onChange={(e) => setForm({ ...form, lp_surcharge_percent: e.target.value, lp_surcharge: '', payable_after_due: '' })} />
              </Field>
              <Field label="Manual L.P. Surcharge">
                <input type="number" placeholder="Optional amount" value={form.lp_surcharge} onChange={(e) => setForm({ ...form, lp_surcharge: e.target.value, payable_after_due: '' })} />
              </Field>
              <Field label="Payable After Due Date">
                <input type="number" placeholder="Auto calculated" value={form.payable_after_due} onChange={(e) => setForm({ ...form, payable_after_due: e.target.value })} />
              </Field>
              <div className="form-action-field">
                <button className="primary"><Plus size={16} />{editingBillId ? 'Update bill' : 'Generate'}</button>
              </div>
            </div>
          </div>
        </form>
        {error && <div className="error form-error">{error}</div>}
        <div className="calc-strip">
          <span>Unit consumed: <strong>{preview.unitsConsumed.toFixed(2)}</strong></span>
          <span>Tariff: <strong>{preview.tariff.toFixed(2)}</strong></span>
          <span>Cost of electricity: <strong>{formatMoney(preview.electricityCost)}</strong></span>
          <span>Current charges: <strong>{formatMoney(preview.currentBill)}</strong></span>
          <span>Arrearage: <strong>{formatMoney(preview.effectiveArrears)}</strong></span>
          <span>Current total bill: <strong>{formatMoney(preview.payableWithinDue)}</strong></span>
          <span>L.P. surcharge: <strong>{formatMoney(preview.lpSurcharge)}</strong></span>
          <span>Payable after due: <strong>{formatMoney(preview.payableAfterDue)}</strong></span>
        </div>
      </section>

      <section className="panel no-print">
        <div className="section-title">
          <h2><Layers3 size={18} />Billing by project and floor</h2>
          <span className="pill">{month}</span>
        </div>
        <div className="billing-browser">
          <div className="browser-column">
            <h3>Projects</h3>
            {projects.data.data.map((project) => (
              <button className={`browser-item ${selectedProject?.id === project.id ? 'active' : ''}`} key={project.id} onClick={() => selectProject(project)}>
                <strong>{project.name}</strong>
                <span>{project.unit_count || 0} units</span>
              </button>
            ))}
          </div>
          <div className="browser-column">
            <h3>Floors</h3>
            {selectedProject ? projectFloors.data.data.map((floor) => (
              <button className={`browser-item ${selectedFloor?.id === floor.id ? 'active' : ''}`} key={floor.id} onClick={() => selectFloor(floor)}>
                <strong>Floor {floor.floor_number}</strong>
                <span>{floor.unit_count} units</span>
              </button>
            )) : <div className="empty-state compact">Select a project first.</div>}
          </div>
          <div className="browser-column wide">
            <h3>Units</h3>
            {selectedFloor ? (
              <DataTable rows={floorUnits} columns={[
                { key: 'unit_number', label: 'Unit' },
                { key: 'unit_type', label: 'Type' },
                { key: 'tenant_name', label: 'Tenant', render: (row) => row.tenant_name || '-' },
                { key: 'status', label: 'Bill', render: (row) => {
                  const bill = billForUnit(row);
                  return bill ? <span className={`pill ${billStatusClass(bill.status)}`}>{billStatusLabel(bill.status)}</span> : <span className="pill vacant">Not billed</span>;
                } },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => {
                    const bill = billForUnit(row);
                    return (
                      <div className="row-actions">
                        {bill
                          ? <button className="mini-btn" onClick={() => loadBillForEdit(bill)}><Edit3 size={14} />Edit bill</button>
                          : <button className="mini-btn" onClick={() => loadUnitForBill(row)}><Plus size={14} />Create bill</button>}
                        {bill?.status === 'draft' && <button className="mini-btn" onClick={() => changeBillStatus(bill.bill_id, 'approved')}>Approve</button>}
                        {bill?.status === 'issued' && <button className="mini-btn" onClick={() => changeBillStatus(bill.bill_id, 'pending')}>Pending</button>}
                        {bill && <button className="mini-btn" onClick={() => printBill(bill)}><Printer size={14} />Print slip</button>}
                        {bill && <button className="mini-btn" onClick={() => viewBill(bill)}><Eye size={14} />View</button>}
                      </div>
                    );
                  }
                }
              ]} empty="No units found for this floor" />
            ) : <div className="empty-state compact">Select a floor to view units.</div>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Summary for {month}</h2>
          <span className="pill">{electricityBills.data.data.length} bills</span>
        </div>
        <DataTable rows={electricityBills.data.data} columns={[
          { key: 'floor_number', label: 'Floor' },
          { key: 'unit_number', label: 'Shop No' },
          { key: 'tenant_name', label: 'Shop/Flat Name', render: (row) => row.tenant_name || row.owner_name || '-' },
          { key: 'meter_no', label: 'Meter No' },
          { key: 'previous_reading', label: 'Previous Reading' },
          { key: 'present_reading', label: 'Present Reading' },
          { key: 'units_consumed', label: 'Unit Consumed' },
          { key: 'tariff', label: 'Tariff', render: (row) => Number(row.tariff).toFixed(2) },
          { key: 'wifi_charges', label: 'Wifi Charges' },
          { key: 'maintenance_charges', label: 'Maintenance Charges' },
          { key: 'current_bill', label: 'Current Charges', render: (row) => formatMoney(row.current_bill) },
          { key: 'previous_arrears', label: 'Previous Arrears', render: (row) => formatMoney(row.previous_arrears) },
          { key: 'payable_within_due', label: 'Current Total Bill', render: (row) => formatMoney(row.payable_within_due) },
          { key: 'paid_amount', label: 'Received Amount', render: (row) => formatMoney(row.paid_amount) },
          { key: 'balance', label: 'Balance R/A', render: (row) => formatMoney(numberValue(row.payable_within_due) - numberValue(row.paid_amount)) },
          { key: 'status', label: 'Status', render: (row) => <span className={`pill ${billStatusClass(row.status)}`}>{billStatusLabel(row.status)}</span> },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="row-actions">
                <button className="mini-btn" onClick={() => viewBill(row)}><Eye size={14} />Slip</button>
                {row.status === 'draft' && <button className="mini-btn" onClick={() => changeBillStatus(row.bill_id, 'approved')}>Approve</button>}
                {row.status === 'issued' && <button className="mini-btn" onClick={() => changeBillStatus(row.bill_id, 'pending')}>Pending</button>}
              </div>
            )
          }
        ]} />
      </section>

      {selectedBill && (
        <div className="print-area">
          <BillSlip bill={selectedBill} />
        </div>
      )}

      <section className="panel no-print">
        <div className="section-title">
          <h2>Billing ledger</h2>
          <span className="pill">{ledgerBills.data.data.length} records</span>
        </div>
        <DataTable rows={ledgerBills.data.data} columns={[
          { key: 'bill_no', label: 'Bill no' },
          { key: 'project_name', label: 'Project' },
          { key: 'unit_number', label: 'Unit' },
          { key: 'due_date', label: 'Due' },
          { key: 'total_amount', label: 'Total', render: (row) => formatMoney(row.total_amount) },
          { key: 'paid_amount', label: 'Paid', render: (row) => formatMoney(row.paid_amount) },
          { key: 'status', label: 'Status', render: (row) => <span className={`pill ${billStatusClass(row.status)}`}>{billStatusLabel(row.status)}</span> },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="row-actions">
                {row.status === 'draft' && <button className="mini-btn" onClick={() => changeBillStatus(row.id, 'approved')}>Approve</button>}
                {row.status === 'issued' && <button className="mini-btn" onClick={() => changeBillStatus(row.id, 'pending')}>Pending</button>}
              </div>
            )
          }
        ]} />
      </section>
    </>
  );
}
