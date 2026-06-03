import { useEffect, useState } from 'react';
import { api } from '../api.js';

export function useApi(path, fallback) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(path);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [path]);

  return { data, setData, loading, error, reload: load };
}
