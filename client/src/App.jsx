import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bell,
  Building2,
  ChartNoAxesCombined,
  DoorOpen,
  FileBarChart,
  HandCoins,
  Home,
  Layers3,
  LogOut,
  Receipt,
  Search,
  ShieldCheck,
  Users
} from 'lucide-react';
import { api } from './api.js';
import { Dashboard } from './pages/Dashboard.jsx';
import { Projects } from './pages/Projects.jsx';
import { ProjectFloors } from './pages/ProjectFloors.jsx';
import { FloorUnits } from './pages/FloorUnits.jsx';
import { Floors } from './pages/Floors.jsx';
import { Units } from './pages/Units.jsx';
import { Contacts } from './pages/Contacts.jsx';
import { Billing } from './pages/Billing.jsx';
import { Expenses } from './pages/Expenses.jsx';
import { Employees } from './pages/Employees.jsx';
import { Reports } from './pages/Reports.jsx';
import { Notifications } from './pages/Notifications.jsx';
import { UsersAdmin } from './pages/UsersAdmin.jsx';

const nav = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/projects', label: 'Projects', icon: Building2 },
  { to: '/floors', label: 'Floors', icon: Layers3 },
  { to: '/units', label: 'Units', icon: DoorOpen },
  { to: '/contacts', label: 'People', icon: Users },
  { to: '/billing', label: 'Billing', icon: Receipt },
  { to: '/expenses', label: 'Expenses', icon: BadgeDollarSign },
  { to: '/employees', label: 'Employees', icon: HandCoins, roles: ['super_admin'] },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/notifications', label: 'Alerts', icon: Bell },
  { to: '/users', label: 'Users', icon: ShieldCheck, roles: ['super_admin'] }
];

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'admin@propertyflow.local', password: 'Admin@12345' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('propertyflow_token', data.token);
      localStorage.setItem('propertyflow_user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark"><Building2 size={28} /></div>
        <h1>PropertyFlow</h1>
        <p>Secure ERP workspace for projects, units, billing, expenses, and reports.</p>
        <form onSubmit={submit} className="form-stack">
          <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" /></label>
          <label>Password<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" /></label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section>
      <aside className="login-visual">
        <div>
          <ShieldCheck size={34} />
          <h2>Role-based access</h2>
          <p>Super admins, property managers, accountants, owners, and tenants share one controlled system.</p>
        </div>
      </aside>
    </main>
  );
}

function Shell() {
  const navigate = useNavigate();
  const user = useMemo(() => JSON.parse(localStorage.getItem('propertyflow_user') || '{}'), []);

  function logout() {
    localStorage.removeItem('propertyflow_token');
    localStorage.removeItem('propertyflow_user');
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><Building2 size={24} /><span>PropertyFlow</span></div>
        <nav>
          {nav.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
            const Icon = item.icon;
            return <a href={item.to} key={item.to}><Icon size={18} />{item.label}</a>;
          })}
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="search-box"><Search size={17} /><input placeholder="Search projects, units, tenants" /></div>
          <div className="user-chip"><span>{user.name || 'Admin'}</span><small>{(user.role || '').replace('_', ' ')}</small></div>
          <button className="icon-btn" onClick={logout} title="Log out"><LogOut size={18} /></button>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId/floors" element={<ProjectFloors />} />
            <Route path="/projects/:projectId/floors/:floorId/units" element={<FloorUnits />} />
            <Route path="/floors" element={<Floors />} />
            <Route path="/units" element={<Units />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/users" element={<UsersAdmin />} />
          </Routes>
        </main>
      </section>
    </div>
  );
}

function Protected() {
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('propertyflow_token');
    if (!token) {
      setChecked(true);
      return;
    }
    api.get('/auth/me')
      .then(() => setOk(true))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return <div className="loading">Loading PropertyFlow...</div>;
  return ok ? <Shell /> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Protected />} />
    </Routes>
  );
}
