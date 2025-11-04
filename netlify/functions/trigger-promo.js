// POST /api/trigger-promo - Trigger social media promo
import { successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Log promo trigger request that bot.js will pick up
    await logActivity('promo_requested', null, { timestamp: new Date().toISOString() });

    return successResponse({
      success: true,
      message: 'Promo request sent to bot'
    });
  } catch (error) {
    console.error('Error requesting promo:', error);
    return errorResponse('Failed to request promo');
  }
}
