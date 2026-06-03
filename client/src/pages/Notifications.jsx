import { Bell } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { useApi } from '../hooks/useApi.js';

export function Notifications() {
  const { data } = useApi('/notifications', { data: [] });
  return (
    <>
      <PageHeader title="Notifications" subtitle="Bill reminders, payments, lease expiry notices, and maintenance alerts." />
      <div className="notification-list">
        {data.data.length ? data.data.map((item) => (
          <section className="panel notification" key={item.id}>
            <Bell size={18} />
            <div><h2>{item.title}</h2><p>{item.message}</p></div>
            <span className="pill">{item.notification_type}</span>
          </section>
        )) : <section className="panel empty-state">No notifications yet.</section>}
      </div>
    </>
  );
}
