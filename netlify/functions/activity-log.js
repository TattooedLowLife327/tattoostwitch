// GET /api/activity-log - Get recent activity logs
import { query, successResponse, errorResponse, handleOptions } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit) || 50;
    const eventType = params.type;

    let sql = 'SELECT * FROM activity_log';
    const sqlParams = [];

    if (eventType) {
      sql += ' WHERE event_type = $1';
      sqlParams.push(eventType);
      sql += ' ORDER BY created_at DESC LIMIT $2';
      sqlParams.push(limit);
    } else {
      sql += ' ORDER BY created_at DESC LIMIT $1';
      sqlParams.push(limit);
    }

    const logs = await query(sql, sqlParams);

    return successResponse({
      logs: logs || [],
      count: logs?.length || 0
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return errorResponse('Failed to fetch activity log');
  }
}
