-- =====================================================
-- MIGRATION: Add color column to admins table
-- =====================================================
-- Run this in your Neon DB console to add color support to existing admins

ALTER TABLE admins ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#8b5cf6';

-- Update existing admins to have the default purple color
UPDATE admins SET color = '#8b5cf6' WHERE color IS NULL;
