import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { useApi } from '../hooks/useApi.js';

export function Reports() {
  const financial = useApi(`/reports/financial-summary?year=${new Date().getFullYear()}`, { data: [] });
  const outstanding = useApi('/reports/outstanding-balances', { data: [] });

  function rows() {
    return outstanding.data.data || [];
  }

  function exportExcel() {
    const body = rows().map((r) => `
      <tr>
        <td>${r.bill_no}</td><td>${r.project_name}</td><td>${r.unit_number}</td>
        <td>${r.tenant_name || ''}</td><td>${r.due_date}</td><td>${r.balance}</td>
      </tr>
    `).join('');
    const html = `<table><thead><tr><th>Bill</th><th>Project</th><th>Unit</th><th>Tenant</th><th>Due</th><th>Balance</th></tr></thead><tbody>${body}</tbody></table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'propertyflow-outstanding.xls';
    link.click();
  }

  async function exportPdf() {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    doc.text('PropertyFlow Outstanding Balances', 14, 16);
    autoTable(doc, {
      startY: 24,
      head: [['Bill', 'Project', 'Unit', 'Tenant', 'Due', 'Balance']],
      body: rows().map((r) => [r.bill_no, r.project_name, r.unit_number, r.tenant_name || '', r.due_date, r.balance])
    });
    doc.save('propertyflow-outstanding.pdf');
  }

  function exportCsv() {
    const csv = ['Bill,Project,Unit,Tenant,Balance'].concat(rows().map((r) => [r.bill_no, r.project_name, r.unit_number, r.tenant_name || '', r.balance].join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'propertyflow-outstanding.csv';
    link.click();
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Financial summaries, outstanding balances, billing, occupancy, and export-ready tables."
        action={<div className="actions"><button className="secondary" onClick={exportPdf}><Download size={16} />PDF</button><button className="secondary" onClick={exportExcel}><Download size={16} />Excel</button><button className="secondary" onClick={exportCsv}><Download size={16} />CSV</button></div>}
      />
      <section className="panel">
        <h2>Profit and loss</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={financial.data.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dfe5e1" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="income" fill="#1f8a70" />
            <Bar dataKey="expenses" fill="#cf4f3f" />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <DataTable rows={outstanding.data.data} columns={[
        { key: 'bill_no', label: 'Bill' },
        { key: 'project_name', label: 'Project' },
        { key: 'unit_number', label: 'Unit' },
        { key: 'tenant_name', label: 'Tenant' },
        { key: 'due_date', label: 'Due' },
        { key: 'balance', label: 'Balance' }
      ]} />
    </>
  );
}
