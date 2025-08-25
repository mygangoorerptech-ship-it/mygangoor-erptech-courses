// mygf/src/admin/api/client.ts
import axios from 'axios';
import { ensureCsrfToken, getCsrfToken } from '../../config/csrf';
import { logAxiosMutation } from './audit';

// In dev, LEAVE VITE_API_URL UNSET so baseURL '/api' hits the Vite proxy.
// In prod, set VITE_API_URL to your API origin (e.g., https://api.example.com)
export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'),
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => {
    try { logAxiosMutation(true, r.config, r); } catch {}
    return r;
  },
  (err) => {
    try { logAxiosMutation(false, err?.config, err); } catch {}
    return Promise.reject(new Error(err?.response?.data?.message || err.message || 'Request failed'));
  }
);

// Auto-attach CSRF header on unsafe methods
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post','put','patch','delete'].includes(method)) {
    await ensureCsrfToken();
    const token = getCsrfToken();
    config.headers = config.headers ?? {};
    (config.headers as any)['X-CSRF-Token'] = token;
  }
  return config;
});

let refreshing = false;
let queue: any[] = [];
function enqueue(config:any){return new Promise((resolve)=>{queue.push({resolve,config})})}
function flush(){const q=[...queue];queue=[];q.forEach(i=>i.resolve(i.config))}

api.interceptors.response.use(
  (r)=>r,
  async (error)=>{
    const {config, response} = error || {};
    if (!response || response.status !== 401 || (config as any)?._retry) {
      return Promise.reject(error);
    }
    (config as any)._retry = true;

    if (refreshing){
      await enqueue(config);
      return api(config);
    }

    refreshing = true;
    try {
      // Correct refresh path (under /api/auth)
      await api.post('/auth/refresh', {});
      flush();
      return api(config);
    } finally {
      refreshing = false;
    }
  }
);
