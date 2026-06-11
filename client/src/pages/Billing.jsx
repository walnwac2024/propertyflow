import { useEffect, useMemo, useState } from 'react';
import { Calculator, Download, Edit3, Eye, Layers3, Plus, Printer } from 'lucide-react';
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

function addMonths(value, offset) {
  const date = new Date(value || Date.now());
  date.setMonth(date.getMonth() + offset);
  return date;
}

function multiplierValue(value) {
  const next = Number(value);
  return next > 0 ? next : 1;
}

function billStatusLabel(status) {
  if (status === 'draft') return 'Pending';
  if (status === 'issued') return 'Completed';
  return String(status || '-').replace('_', ' ');
}

function billStatusClass(status) {
  if (status === 'draft') return 'pending';
  if (status === 'issued') return 'completed';
  return status || '';
}

function Field({ label, children }) {
  return <label className="field">{label}{children}</label>;
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

export function FloorSummaryPrint({ title, rows, totals }) {
  return (
    <section className="floor-summary-print">
      <h1>{title}</h1>
      <table>
        <thead>
          <tr>{summaryHead.map((head) => <th key={head}>{head}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.floor}</td>
              <td>{row.shopNo}</td>
              <td>{row.name}</td>
              <td>{row.meterNo}</td>
              <td>{row.previousReading}</td>
              <td>{row.presentReading}</td>
              <td>{row.unitsConsumed}</td>
              <td>{row.tariff}</td>
              <td>{formatMoney(row.maintenanceCharges)}</td>
              <td>{formatMoney(row.billAmount)}</td>
              <td>{formatMoney(row.previousArrears)}</td>
              <td>{formatMoney(row.totalBillAmount)}</td>
              <td>{formatMoney(row.receivedAmount)}</td>
              <td>{formatMoney(row.balance)}</td>
            </tr>
          ))}
          <tr className="summary-total-row">
            <th colSpan="8">Total</th>
            <th>{formatMoney(totals.maintenanceCharges)}</th>
            <th>{formatMoney(totals.billAmount)}</th>
            <th>{formatMoney(totals.previousArrears)}</th>
            <th>{formatMoney(totals.totalBillAmount)}</th>
            <th>{formatMoney(totals.receivedAmount)}</th>
            <th>{formatMoney(totals.balance)}</th>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function billHistoryRows(bill) {
  const historyByMonth = new Map((bill.history || []).map((item) => [
    inputMonth(item.bill_month),
    item
  ]));
  return Array.from({ length: 9 }, (_, index) => ({
    monthDate: addMonths(bill.bill_month, index - 9)
  })).map((row) => {
    const key = row.monthDate.toISOString().slice(0, 7);
    const item = historyByMonth.get(key);
    return {
      month: formatMonth(row.monthDate),
      units: item?.units_consumed || '',
      bill: item?.payable_within_due ? formatMoney(item.payable_within_due) : '',
      payment: item?.paid_amount ? formatMoney(item.paid_amount) : ''
    };
  });
}

export function BillSlip({ bill }) {
  if (!bill) return null;
  const displayName = bill.unit_name || bill.tenant_name || bill.owner_name || '-';
  const historyRows = billHistoryRows(bill);

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
          <p><strong>NAME & ADDRESS</strong> <u>{displayName}</u></p>
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
        <div className="month-history-box">
          <table>
            <thead><tr><th>MONTH</th><th>UNITS</th><th>BILL</th><th>PAYMENT</th></tr></thead>
            <tbody>
              {historyRows.map((item) => (
                <tr key={item.month}>
                  <td>{item.month}</td>
                  <td>{item.units}</td>
                  <td>{item.bill}</td>
                  <td>{item.payment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="charges-grid">
        <table className="electricity-charge-table">
          <thead><tr><th colSpan="2">ELECTRICITY CHARGES</th></tr></thead>
          <tbody>
            <tr><td>UNITS CONSUMED</td><td>{bill.units_consumed}</td></tr>
            <tr><td>COST OF ELECTRICITY</td><td>{formatMoney(bill.electricity_cost)}</td></tr>
            <tr><td>Water Charges</td><td>{formatMoney(bill.water_charges)}</td></tr>
            <tr><td>Lift Charges</td><td>{formatMoney(bill.lift_charges)}</td></tr>
            <tr><td>Maintenance</td><td>{formatMoney(bill.maintenance_charges)}</td></tr>
            <tr><td>Service Charges</td><td>{formatMoney(bill.service_charges)}</td></tr>
            <tr><td>Wifi Charges</td><td>{formatMoney(bill.wifi_charges)}</td></tr>
            <tr><td>T.R SURCHARGE</td><td>{formatMoney(bill.other_charges)}</td></tr>
            <tr><th>TOTAL</th><th>{formatMoney(bill.current_bill)}</th></tr>
            <tr className="bill-calc-title"><th colSpan="2">BILL CALCULATION</th></tr>
            <tr className="bill-calc-row">
              <td colSpan="2">
                <div className="bill-calc-formula">
                  <span>Tariff</span>
                  <span>X</span>
                  <span>Units</span>
                  <strong>{Number(bill.tariff || 0).toFixed(2)}</strong>
                  <strong></strong>
                  <strong>{bill.units_consumed}</strong>
                </div>
              </td>
            </tr>
            <tr className="bill-calc-spacer"><td></td><td></td></tr>
            <tr className="bill-calc-spacer"><td></td><td></td></tr>
            <tr className="bill-total-row"><th>TOTAL BILL</th><th>{formatMoney(bill.current_bill)}</th></tr>
          </tbody>
        </table>
        <table className="other-charge-table">
          <thead><tr><th colSpan="2">OTHER CHARGES</th></tr></thead>
          <tbody>
            <tr><td>ABC</td><td>-</td></tr>
            <tr><td></td><td></td></tr>
            <tr><td></td><td></td></tr>
            <tr><td>XYZ</td><td>-</td></tr>
            <tr><td></td><td></td></tr>
            <tr><td></td><td></td></tr>
            <tr className="dashed-row"><td colSpan="2"></td></tr>
            <tr><th>TOTAL OTHER CHARGES</th><th>{formatMoney(bill.other_charges)}</th></tr>
            <tr><td></td><td></td></tr>
            <tr><td></td><td></td></tr>
            <tr><td></td><td></td></tr>
            <tr><td></td><td></td></tr>
          </tbody>
        </table>
        <table className="total-charge-table">
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
        <div><strong>ADDRESS:</strong> {displayName}</div>
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

function BillingWorkspace({ view = 'billing' }) {
  const isSummaryView = view === 'summary';
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
  const [printingSummary, setPrintingSummary] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkGenerating, setBulkGenerating] = useState(false);
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

  const floorSummaryRows = useMemo(() => {
    if (!selectedFloor) return [];
    return floorUnits.map((unit) => {
      const bill = billForUnit(unit);
      const billAmount = numberValue(bill?.current_bill);
      const previousArrears = numberValue(bill?.previous_arrears);
      const totalBillAmount = numberValue(bill?.payable_within_due);
      const receivedAmount = numberValue(bill?.paid_amount);
      return {
        id: unit.id,
        floor: unit.floor_number || selectedFloor.floor_number,
        shopNo: unit.unit_number,
        name: bill?.unit_name || unit.unit_name || bill?.tenant_name || bill?.owner_name || unit.tenant_name || unit.owner_name || '-',
        meterNo: bill?.meter_no || '',
        previousReading: bill?.previous_reading || '',
        presentReading: bill?.present_reading || '',
        unitsConsumed: bill?.units_consumed || '',
        tariff: bill?.tariff ? Number(bill.tariff).toFixed(2) : '',
        maintenanceCharges: numberValue(bill?.maintenance_charges),
        billAmount,
        previousArrears,
        totalBillAmount,
        receivedAmount,
        balance: totalBillAmount - receivedAmount,
        status: bill?.status || 'not_billed'
      };
    });
  }, [floorUnits, electricityBills.data.data, selectedFloor]);

  const floorSummaryTotals = useMemo(() => floorSummaryRows.reduce((sum, row) => ({
    maintenanceCharges: sum.maintenanceCharges + row.maintenanceCharges,
    billAmount: sum.billAmount + row.billAmount,
    previousArrears: sum.previousArrears + row.previousArrears,
    totalBillAmount: sum.totalBillAmount + row.totalBillAmount,
    receivedAmount: sum.receivedAmount + row.receivedAmount,
    balance: sum.balance + row.balance
  }), {
    maintenanceCharges: 0,
    billAmount: 0,
    previousArrears: 0,
    totalBillAmount: 0,
    receivedAmount: 0,
    balance: 0
  }), [floorSummaryRows]);

  const floorSummaryTitle = `${selectedProject?.name || 'Project'} ${selectedFloor ? `Floor ${selectedFloor.floor_number}` : ''} Summary For the Month of ${formatMonth(`${month}-01`)}`;

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

  async function generateMonthBills() {
    if (!selectedProject) {
      setError('Select a project first.');
      return;
    }
    setBulkGenerating(true);
    setError('');
    setBulkMessage('');
    try {
      const response = await api.post('/billing/electricity-bills/bulk-month', {
        project_id: selectedProject.id,
        floor_id: selectedFloor?.id || null,
        bill_month: month
      });
      electricityBills.reload();
      ledgerBills.reload();
      setBulkMessage(`${response.data.created || 0} bills generated${response.data.skippedNoPrevious ? `, ${response.data.skippedNoPrevious} skipped` : ''}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to generate monthly bills');
    } finally {
      setBulkGenerating(false);
    }
  }

  async function printBill(row) {
    await viewBill(row);
    setTimeout(() => window.print(), 100);
  }

  function ensureFloorSelected() {
    if (!selectedProject || !selectedFloor) {
      setError('Select a project and floor first to export the monthly floor summary.');
      return false;
    }
    setError('');
    return true;
  }

  function printFloorSummary() {
    if (!ensureFloorSelected()) return;
    setSelectedBill(null);
    setPrintingSummary(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintingSummary(false), 500);
    }, 100);
  }

  async function downloadFloorSummaryPdf() {
    if (!ensureFloorSelected()) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(floorSummaryTitle, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [summaryHead],
      body: floorSummaryRows.map((row) => [
        row.floor,
        row.shopNo,
        row.name,
        row.meterNo,
        row.previousReading,
        row.presentReading,
        row.unitsConsumed,
        row.tariff,
        formatMoney(row.maintenanceCharges),
        formatMoney(row.billAmount),
        formatMoney(row.previousArrears),
        formatMoney(row.totalBillAmount),
        formatMoney(row.receivedAmount),
        formatMoney(row.balance)
      ]),
      foot: [[
        'Total', '', '', '', '', '', '', '',
        formatMoney(floorSummaryTotals.maintenanceCharges),
        formatMoney(floorSummaryTotals.billAmount),
        formatMoney(floorSummaryTotals.previousArrears),
        formatMoney(floorSummaryTotals.totalBillAmount),
        formatMoney(floorSummaryTotals.receivedAmount),
        formatMoney(floorSummaryTotals.balance)
      ]],
      styles: { fontSize: 7, cellPadding: 1.4 },
      headStyles: { fillColor: [45, 45, 45] },
      footStyles: { fillColor: [235, 235, 235], textColor: [20, 20, 20], fontStyle: 'bold' },
      margin: { left: 8, right: 8 }
    });
    doc.save(`${selectedProject.name}-${selectedFloor.floor_number}-${month}-summary.pdf`.replace(/\s+/g, '-'));
  }

  function downloadFloorSummaryCsv() {
    if (!ensureFloorSelected()) return;
    const lines = [
      [floorSummaryTitle],
      summaryHead,
      ...floorSummaryRows.map((row) => [
        row.floor,
        row.shopNo,
        row.name,
        row.meterNo,
        row.previousReading,
        row.presentReading,
        row.unitsConsumed,
        row.tariff,
        row.maintenanceCharges,
        row.billAmount,
        row.previousArrears,
        row.totalBillAmount,
        row.receivedAmount,
        row.balance
      ]),
      [
        'Total', '', '', '', '', '', '', '',
        floorSummaryTotals.maintenanceCharges,
        floorSummaryTotals.billAmount,
        floorSummaryTotals.previousArrears,
        floorSummaryTotals.totalBillAmount,
        floorSummaryTotals.receivedAmount,
        floorSummaryTotals.balance
      ]
    ];
    const csv = lines.map((line) => line.map(csvCell).join(',')).join('\n');
    downloadBlob(`${selectedProject.name}-${selectedFloor.floor_number}-${month}-summary.csv`.replace(/\s+/g, '-'), csv, 'text/csv;charset=utf-8');
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
        title={isSummaryView ? 'Billing Summary' : 'Electricity Billing'}
        subtitle={isSummaryView ? 'Browse project and floor billing totals, print floor summaries, and export monthly data.' : 'Generate monthly unit bills, calculate tariff, carry arrears, and print consumer slips.'}
        action={!isSummaryView && <button className="secondary" onClick={() => window.print()}><Printer size={16} />Print Slip</button>}
      />

      {!isSummaryView && <section className="panel">
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
      </section>}

      {isSummaryView && <section className="panel no-print">
        <div className="section-title">
          <h2><Layers3 size={18} />Billing by project and floor</h2>
          <div className="actions">
            <label className="month-filter">Month <input type="month" value={month} onChange={(e) => updateMonth(e.target.value)} /></label>
            <button className="secondary" type="button" onClick={generateMonthBills} disabled={!selectedProject || bulkGenerating}><Plus size={16} />Generate month</button>
            <button className="secondary" type="button" onClick={printFloorSummary} disabled={!selectedFloor}><Printer size={16} />Print floor</button>
            <button className="secondary" type="button" onClick={downloadFloorSummaryPdf} disabled={!selectedFloor}><Download size={16} />PDF</button>
            <button className="secondary" type="button" onClick={downloadFloorSummaryCsv} disabled={!selectedFloor}><Download size={16} />CSV</button>
          </div>
        </div>
        {bulkMessage && <div className="success-message">{bulkMessage}</div>}
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
                        {!isSummaryView && (bill
                          ? <button className="mini-btn" onClick={() => loadBillForEdit(bill)}><Edit3 size={14} />Edit bill</button>
                          : <button className="mini-btn" onClick={() => loadUnitForBill(row)}><Plus size={14} />Create bill</button>)}
                        {bill?.status === 'draft' && <button className="mini-btn" onClick={() => changeBillStatus(bill.bill_id, 'approved')}>Complete</button>}
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
      </section>}

      {isSummaryView && <section className="panel">
        <div className="section-title">
          <h2>Summary for {month}</h2>
          <span className="pill">{electricityBills.data.data.length} bills</span>
        </div>
        <DataTable rows={electricityBills.data.data} columns={[
          { key: 'floor_number', label: 'Floor' },
          { key: 'unit_number', label: 'Shop No' },
          { key: 'tenant_name', label: 'Shop/Flat Name', render: (row) => row.unit_name || row.tenant_name || row.owner_name || '-' },
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
                {row.status === 'draft' && <button className="mini-btn" onClick={() => changeBillStatus(row.bill_id, 'approved')}>Complete</button>}
                {row.status === 'issued' && <button className="mini-btn" onClick={() => changeBillStatus(row.bill_id, 'pending')}>Pending</button>}
              </div>
            )
          }
        ]} />
      </section>}

      {selectedBill && (
        <div className="print-area">
          <BillSlip bill={selectedBill} />
        </div>
      )}

      {printingSummary && (
        <div className="print-area">
          <FloorSummaryPrint title={floorSummaryTitle} rows={floorSummaryRows} totals={floorSummaryTotals} />
        </div>
      )}

      {!isSummaryView && <section className="panel no-print">
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
                {row.status === 'draft' && <button className="mini-btn" onClick={() => changeBillStatus(row.id, 'approved')}>Complete</button>}
                {row.status === 'issued' && <button className="mini-btn" onClick={() => changeBillStatus(row.id, 'pending')}>Pending</button>}
              </div>
            )
          }
        ]} />
      </section>}
    </>
  );
}

export function Billing() {
  return <BillingWorkspace view="billing" />;
}

export function BillingSummary() {
  return <BillingWorkspace view="summary" />;
}
