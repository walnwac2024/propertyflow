import axios from 'axios';

const defaultApiUrl = window.location.protocol === 'http:'
  ? 'http://localhost:4000/api'
  : 'https://api.proproperty.cloud/api';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiUrl
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('propertyflow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('propertyflow_token');
      localStorage.removeItem('propertyflow_user');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
