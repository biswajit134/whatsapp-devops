import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_STATUS_API_URL || 'http://localhost:9002',
});

export default instance;
