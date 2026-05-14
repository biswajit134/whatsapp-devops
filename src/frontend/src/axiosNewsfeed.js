import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_NEWSFEED_API_URL || 'http://localhost:9001',
});

export default instance;
