import Papa from 'papaparse';
import type { BattingStats, BowlingStats, FieldingStats, MvpStats } from '../types';

export function parseCsvContent<T>(content: string): T[] {
  const result = Papa.parse<T>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  return result.data;
}

export interface RawBattingRow {
  player_id: string | number;
  name: string;
  team_id: string | number;
  team_name: string;
  total_match: number;
  innings: number;
  total_runs: number;
  highest_run: number;
  average: number;
  not_out: number;
  strike_rate: number;
  ball_faced: number;
  batting_hand: string;
  '4s': number;
  '6s': number;
  '50s': number;
  '100s': number;
}

export interface RawBowlingRow {
  player_id: string | number;
  name: string;
  team_id: string | number;
  team_name: string;
  total_match: number;
  innings: number;
  total_wickets: number;
  balls: number;
  highest_wicket: number;
  economy: number;
  SR: number;
  maidens: number;
  avg: number;
  runs: number;
  bowling_style: string;
  overs: number;
  dot_balls: number;
}

export interface RawFieldingRow {
  player_id: string | number;
  name: string;
  team_id: string | number;
  team_name: string;
  total_match: number;
  catches: number;
  caught_behind: number;
  run_outs: number;
  assist_run_outs: number;
  stumpings: number;
  caught_and_bowl: number;
  total_catches: number;
  total_dismissal: number;
}

export interface RawMvpRow {
  'Player Name': string;
  'Team Name': string;
  'Player Role': string;
  'Bowling Style': string;
  'Batting Hand': string;
  Matches: number;
  Batting: number;
  Bowling: number;
  Fielding: number;
  Total: number;
}

export function parseBattingCsv(content: string): { external_id: string; name: string; stats: BattingStats }[] {
  const rows = parseCsvContent<RawBattingRow>(content);
  return rows.filter(r => r.name).map(r => ({
    external_id: String(r.player_id),
    name: r.name,
    stats: {
      player_id: String(r.player_id),
      name: r.name,
      team_name: r.team_name,
      total_match: Number(r.total_match) || 0,
      innings: Number(r.innings) || 0,
      total_runs: Number(r.total_runs) || 0,
      highest_run: Number(r.highest_run) || 0,
      average: Number(r.average) || 0,
      not_out: Number(r.not_out) || 0,
      strike_rate: Number(r.strike_rate) || 0,
      ball_faced: Number(r.ball_faced) || 0,
      batting_hand: r.batting_hand || 'RHB',
      fours: Number(r['4s']) || 0,
      sixes: Number(r['6s']) || 0,
      fifties: Number(r['50s']) || 0,
      hundreds: Number(r['100s']) || 0,
    },
  }));
}

export function parseBowlingCsv(content: string): { external_id: string; name: string; stats: BowlingStats }[] {
  const rows = parseCsvContent<RawBowlingRow>(content);
  return rows.filter(r => r.name).map(r => ({
    external_id: String(r.player_id),
    name: r.name,
    stats: {
      player_id: String(r.player_id),
      name: r.name,
      team_name: r.team_name,
      total_match: Number(r.total_match) || 0,
      innings: Number(r.innings) || 0,
      total_wickets: Number(r.total_wickets) || 0,
      balls: Number(r.balls) || 0,
      highest_wicket: Number(r.highest_wicket) || 0,
      economy: Number(r.economy) || 0,
      sr: Number(r.SR) || 0,
      maidens: Number(r.maidens) || 0,
      avg: Number(r.avg) || 0,
      runs: Number(r.runs) || 0,
      bowling_style: r.bowling_style || '',
      overs: Number(r.overs) || 0,
      dot_balls: Number(r.dot_balls) || 0,
    },
  }));
}

export function parseFieldingCsv(content: string): { external_id: string; name: string; stats: FieldingStats }[] {
  const rows = parseCsvContent<RawFieldingRow>(content);
  return rows.filter(r => r.name).map(r => ({
    external_id: String(r.player_id),
    name: r.name,
    stats: {
      player_id: String(r.player_id),
      name: r.name,
      team_name: r.team_name,
      total_match: Number(r.total_match) || 0,
      catches: Number(r.catches) || 0,
      caught_behind: Number(r.caught_behind) || 0,
      run_outs: Number(r.run_outs) || 0,
      assist_run_outs: Number(r.assist_run_outs) || 0,
      stumpings: Number(r.stumpings) || 0,
      caught_and_bowl: Number(r.caught_and_bowl) || 0,
      total_catches: Number(r.total_catches) || 0,
      total_dismissal: Number(r.total_dismissal) || 0,
    },
  }));
}

export function parseMvpCsv(content: string): { name: string; stats: MvpStats }[] {
  const rows = parseCsvContent<RawMvpRow>(content);
  return rows.filter(r => r['Player Name']).map(r => ({
    name: r['Player Name'],
    stats: {
      name: r['Player Name'],
      team_name: r['Team Name'],
      player_role: r['Player Role'] || '',
      bowling_style: r['Bowling Style'] || '',
      batting_hand: r['Batting Hand'] || 'RHB',
      matches: Number(r.Matches) || 0,
      batting_score: Number(r.Batting) || 0,
      bowling_score: Number(r.Bowling) || 0,
      fielding_score: Number(r.Fielding) || 0,
      total_score: Number(r.Total) || 0,
    },
  }));
}
