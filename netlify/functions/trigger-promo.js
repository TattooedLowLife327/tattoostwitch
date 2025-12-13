// POST /api/trigger-promo - Trigger social media promo
import fetch from 'node-fetch';
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
    const body = event.body ? JSON.parse(event.body) : {};
    const promoIndex = Number.isInteger(body.index) ? body.index : 0;
    const botBase =
      (process.env.BOT_BASE_URL && process.env.BOT_BASE_URL.replace(/\/$/, '')) ||
      'https://tattoostwitch327.onrender.com';

    // Log promo trigger request that bot.js will pick up
    await logActivity('promo_requested', null, {
      timestamp: new Date().toISOString(),
      index: promoIndex
    });

    // Fire bot endpoint directly for immediate overlays
    try {
      await fetch(`${botBase}/api/trigger-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: promoIndex, source: 'netlify' })
      });
    } catch (err) {
      console.error('Failed to hit bot trigger endpoint:', err.message);
    }

    return successResponse({
      success: true,
      message: 'Promo request sent to bot',
      index: promoIndex
    });
  } catch (error) {
    console.error('Error requesting promo:', error);
    return errorResponse('Failed to request promo');
  }
}
