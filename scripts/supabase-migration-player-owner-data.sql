-- Migration: Add player_owner_data table
-- Run this in: Supabase → SQL Editor → New query
-- This table stores owner assessments: stars, grade, buy flag, notes

CREATE TABLE IF NOT EXISTS player_owner_data (
  player_id      TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  batting_stars  DOUBLE PRECISION,
  bowling_stars  DOUBLE PRECISION,
  fielding_stars DOUBLE PRECISION,
  owner_note     TEXT DEFAULT '',
  grade          TEXT,
  should_buy     BOOLEAN,
  overall_rating DOUBLE PRECISION,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE player_owner_data DISABLE ROW LEVEL SECURITY;
