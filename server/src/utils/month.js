export function monthRange(value) {
  const source = value || new Date().toISOString().slice(0, 7);
  const match = String(source).match(/^(\d{4})-(\d{2})/);
  if (!match) {
    const error = new Error('Month must be in YYYY-MM format');
    error.status = 400;
    throw error;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    const error = new Error('Month must be in YYYY-MM format');
    error.status = 400;
    throw error;
  }
  const start = `${match[1]}-${match[2]}-01`;
  const next = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { start, next, label: `${match[1]}-${match[2]}` };
}
