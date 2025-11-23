// API configuration and helper functions
// BOT_API_URL: Render backend for bot operations
// FUNCTION_API_URL: Netlify Functions for PWA operations
export const BOT_API_URL = 'https://tattoostwitch327.onrender.com';
export const FUNCTION_API_URL = 'https://tattoostwitch.netlify.app';

export const botApi = (path = '') => `${BOT_API_URL}${path}`;
export const functionApi = (path = '') => `${FUNCTION_API_URL}${path}`;
