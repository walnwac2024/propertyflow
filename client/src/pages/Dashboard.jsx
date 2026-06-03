import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { BadgeCheck, BadgeDollarSign, Building2, CircleDollarSign, DoorOpen, Layers3, Receipt, Wallet } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

const trend = [
  { month: 'Jan', income: 48000, expenses: 21000 },
  { month: 'Feb', income: 52000, expenses: 23500 },
  { month: 'Mar', income: 61000, expenses: 26000 },
  { month: 'Apr', income: 59000, expenses: 22000 },
  { month: 'May', income: 68000, expenses: 28000 },
  { month: 'Jun', income: 74000, expenses: 31000 }
];

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function Dashboard() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const user = JSON.parse(localStorage.getItem('propertyflow_user') || '{}');
  const isAdmin = user.role === 'super_admin';
  const { data } = useApi(`/dashboard?month=${month}`, { totals: {}, occupancy: [], recentTransactions: [] });
  const stats = [
    { label: 'Projects', value: data.totals.projects || 0, icon: Building2 },
    { label: 'Floors', value: data.totals.floors || 0, icon: Layers3 },
    { label: 'Units', value: data.totals.units || 0, icon: DoorOpen },
    { label: 'Pending approval', value: data.totals.pendingBills || 0, icon: Receipt },
    { label: 'Approved bills', value: data.totals.approvedBills || 0, icon: BadgeCheck },
    { label: 'Completed bills', value: data.totals.completedBills || 0, icon: CircleDollarSign }
  ];
  const financeStats = [
    { label: 'Cash in hand', value: money(data.totals.cashInHand), icon: Wallet },
    { label: 'Recovered', value: money(data.totals.recoveredAmount), icon: CircleDollarSign },
    { label: 'Pending amount', value: money(data.totals.pendingAmount), icon: Receipt },
    { label: 'Project expenses', value: money(data.totals.expenseAmount), icon: BadgeDollarSign },
    { label: 'Salary paid', value: money(data.totals.payrollAmount), icon: BadgeCheck },
    { label: 'Total expense', value: money(data.totals.totalExpenseAmount), icon: BadgeDollarSign }
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Portfolio health, cash movement, and open operational work."
        action={isAdmin && (
          <label className="month-filter">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
      />
      <div className="stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return <div className="stat-card" key={stat.label}><Icon size={20} /><span>{stat.label}</span><strong>{stat.value}</strong></div>;
        })}
      </div>
      {isAdmin && (
        <div className="stat-grid finance-grid">
          {financeStats.map((stat) => {
            const Icon = stat.icon;
            return <div className="stat-card" key={stat.label}><Icon size={20} /><span>{stat.label}</span><strong>{stat.value}</strong></div>;
          })}
        </div>
      )}
      <div className="split">
        <section className="panel wide">
          <h2>Monthly financial trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="income" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#1f8a70" stopOpacity={0.4} /><stop offset="95%" stopColor="#1f8a70" stopOpacity={0} /></linearGradient>
                <linearGradient id="expenses" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="#cf4f3f" stopOpacity={0.35} /><stop offset="95%" stopColor="#cf4f3f" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe5e1" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area dataKey="income" stroke="#1f8a70" fill="url(#income)" />
              <Area dataKey="expenses" stroke="#cf4f3f" fill="url(#expenses)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
        <section className="panel">
          <h2>Occupancy</h2>
          <div className="status-list">
            {['occupied', 'vacant', 'reserved', 'maintenance'].map((status) => {
              const found = data.occupancy.find((row) => row.occupancy_status === status);
              return <div key={status}><span>{status}</span><strong>{found?.total || 0}</strong></div>;
            })}
          </div>
        </section>
      </div>
    </>
  );
}
