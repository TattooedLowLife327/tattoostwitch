// API configuration and helper functions
export const BOT_API_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:8787'
  : 'https://tattoostwitch327.onrender.com';

export const FUNCTION_API_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:8888'
  : 'https://tattoostwitch.netlify.app';

export const botApi = (path = '') => `${BOT_API_URL}${path}`;
export const functionApi = (path = '') => `${FUNCTION_API_URL}${path}`;
