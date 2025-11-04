// GET /api/settings - Get settings
// POST /api/settings - Update settings
import { query, queryOne, successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    if (event.httpMethod === 'GET') {
      // Get specific setting or all settings
      const params = event.queryStringParameters || {};
      const { key } = params;

      if (key) {
        const setting = await queryOne(
          'SELECT * FROM settings WHERE key = $1',
          [key]
        );
        if (!setting) {
          return errorResponse('Setting not found', 404);
        }
        return successResponse(setting);
      }

      // Get all settings
      const allSettings = await query('SELECT * FROM settings ORDER BY key');

      // Convert to key-value object for easier consumption
      const settingsObj = {};
      allSettings.forEach(row => {
        // Parse JSON values if they look like JSON
        try {
          if (row.value && (row.value.startsWith('[') || row.value.startsWith('{'))) {
            settingsObj[row.key] = JSON.parse(row.value);
          } else {
            settingsObj[row.key] = row.value;
          }
        } catch {
          settingsObj[row.key] = row.value;
        }
      });

      return successResponse(settingsObj);
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      // Handle bulk settings update from PWA
      if (body.specialUsers !== undefined || body.promoMinutes !== undefined || body.player1Name !== undefined || body.player2Name !== undefined) {
        const updates = [];

        if (body.specialUsers !== undefined) {
          updates.push(query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key)
             DO UPDATE SET value = $2, updated_at = NOW()`,
            ['specialUsers', JSON.stringify(body.specialUsers)]
          ));
        }

        if (body.promoMinutes !== undefined) {
          updates.push(query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key)
             DO UPDATE SET value = $2, updated_at = NOW()`,
            ['promoMinutes', body.promoMinutes.toString()]
          ));
        }

        if (body.player1Name !== undefined) {
          updates.push(query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key)
             DO UPDATE SET value = $2, updated_at = NOW()`,
            ['player1Name', body.player1Name]
          ));
        }

        if (body.player2Name !== undefined) {
          updates.push(query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key)
             DO UPDATE SET value = $2, updated_at = NOW()`,
            ['player2Name', body.player2Name]
          ));
        }

        await Promise.all(updates);
        await logActivity('settings_updated', null, body);

        return successResponse({ success: true });
      }

      // Handle single key-value update
      const { key, value } = body;

      if (!key) {
        return errorResponse('key is required', 400);
      }

      // Update or insert setting
      await query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );

      // Log activity
      await logActivity('setting_changed', null, { key, value });

      const updated = await queryOne(
        'SELECT * FROM settings WHERE key = $1',
        [key]
      );

      return successResponse({
        success: true,
        setting: updated
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error with settings:', error);
    return errorResponse('Failed to process settings request');
  }
}
