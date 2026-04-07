-- Migration 008: Add notes column to transactions (AI-generated or user-written)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;
