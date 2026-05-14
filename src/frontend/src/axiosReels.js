import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_REELS_API_URL || 'http://localhost:9003',
});

export default instance;
