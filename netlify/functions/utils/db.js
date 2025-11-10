// Shared database connection utility for Netlify Functions
import { neon } from '@neondatabase/serverless';

let cachedSql = null;

function getConnection() {
  if (cachedSql) return cachedSql;

  const connectionString =
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    '';

  if (!connectionString) {
    throw new Error('Missing database connection string. Set NETLIFY_DATABASE_URL or DATABASE_URL.');
  }

  cachedSql = neon(connectionString);
  return cachedSql;
}

// Helper function to run a query
export async function query(sqlString, params = []) {
  try {
    const sql = getConnection();
    return await sql(sqlString, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function to get a single row
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

// Helper function to log activity
export async function logActivity(eventType, username = null, details = null) {
  try {
    await query(
      'SELECT log_activity($1, $2, $3)',
      [eventType, username, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Standard success response
export function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data)
  };
}

// Standard error response
export function errorResponse(message, statusCode = 500) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message })
  };
}

// Handle OPTIONS requests (CORS preflight)
export function handleOptions() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ''
  };
}
