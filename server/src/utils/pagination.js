export function pagination(query) {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 10), 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

export function like(value) {
  return `%${String(value || '').trim()}%`;
}
