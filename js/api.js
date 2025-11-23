// API configuration and helper functions
// Always use Render backend (to save compute, don't run locally)
export const BOT_API_URL = 'https://tattoostwitch327.onrender.com';
export const FUNCTION_API_URL = 'https://tattoostwitch327.onrender.com';

export const botApi = (path = '') => `${BOT_API_URL}${path}`;
export const functionApi = (path = '') => `${FUNCTION_API_URL}${path}`;
