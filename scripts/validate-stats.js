const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('./data/zpl.db');
const DATA = './data/seed';

// ── helpers ───────────────────────────────────────────────────────────────────
function parseCSV(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
    return obj;
  });
}

function n(v)  { const x = parseFloat(v); return isNaN(x) ? null : x; }
function iv(v) { const x = parseInt(v);   return isNaN(x) ? null : x; }
function approxEq(a, b, tol) {
  tol = tol || 0.02;
  if (a == null && b == null) return true;
  if (a == null && b === 0)   return true; // CSV blank → DB 0 is acceptable
  if (b == null && a === 0)   return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tol;
}
function intEq(csvVal, dbVal) {
  // Empty CSV cell for count fields means 0 (player didn't bowl/field)
  const c = (csvVal === '' || csvVal == null) ? 0 : parseInt(csvVal);
  const d = (dbVal == null) ? 0 : dbVal;
  return c === d;
}

// ── Load all DB stats ─────────────────────────────────────────────────────────
const allStats = db.prepare(
  'SELECT ps.*, p.external_id FROM player_season_stats ps JOIN players p ON p.id = ps.player_id'
).all();

const statsMap = {};
for (const s of allStats) {
  const key = (s.external_id || '') + '|' + s.season_id + '|' + s.stat_type;
  statsMap[key] = JSON.parse(s.stats_json);
}

const YEAR_LABEL = { 'season-2025': '2025', 'season-2024': '2024' };

const issues = { batting: [], bowling: [], fielding: [], mvp: [] };
let total = 0, missing = 0, mismatches = 0;

// ════════════════════════════════════════════════════════════════════════════
// BATTING
// ════════════════════════════════════════════════════════════════════════════
function validateBatting(prefix, seasonId) {
  const rows = parseCSV(path.join(DATA, prefix + '_batting_leaderboard.csv'));
  const year = YEAR_LABEL[seasonId];
  for (const r of rows) {
    if (!r.player_id) continue;
    total++;
    const d = statsMap[r.player_id + '|' + seasonId + '|batting'];
    if (!d) { missing++; issues.batting.push({ year, player: r.name, msg: 'MISSING in DB' }); continue; }
    const errs = [];
    if (iv(r.total_runs)  !== d.total_runs)                    errs.push('runs: csv=' + r.total_runs + ' db=' + d.total_runs);
    if (iv(r.innings)     !== d.innings)                       errs.push('innings: csv=' + r.innings + ' db=' + d.innings);
    if (iv(r.total_match) !== d.total_match)                   errs.push('matches: csv=' + r.total_match + ' db=' + d.total_match);
    if (iv(r.highest_run) !== d.highest_run)                   errs.push('hs: csv=' + r.highest_run + ' db=' + d.highest_run);
    if (iv(r['4s'])       !== d.fours)                         errs.push('4s: csv=' + r['4s'] + ' db=' + d.fours);
    if (iv(r['6s'])       !== d.sixes)                         errs.push('6s: csv=' + r['6s'] + ' db=' + d.sixes);
    if (iv(r['50s'])      !== d.fifties)                       errs.push('50s: csv=' + r['50s'] + ' db=' + d.fifties);
    if (iv(r['100s'])     !== d.hundreds)                      errs.push('100s: csv=' + r['100s'] + ' db=' + d.hundreds);
    if (iv(r.not_out)     !== d.not_out)                       errs.push('not_out: csv=' + r.not_out + ' db=' + d.not_out);
    if (iv(r.ball_faced)  !== d.ball_faced)                    errs.push('balls: csv=' + r.ball_faced + ' db=' + d.ball_faced);
    if (!approxEq(n(r.average),     d.average,     0.02))     errs.push('avg: csv=' + r.average + ' db=' + d.average);
    if (!approxEq(n(r.strike_rate), d.strike_rate, 0.02))     errs.push('sr: csv=' + r.strike_rate + ' db=' + d.strike_rate);
    if (errs.length) { mismatches++; issues.batting.push({ year, player: r.name, msg: errs.join('  |  ') }); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BOWLING  (DB fields: total_wickets, balls, sr, avg, economy, maidens, runs, dot_balls)
// ════════════════════════════════════════════════════════════════════════════
function validateBowling(prefix, seasonId) {
  const rows = parseCSV(path.join(DATA, prefix + '_bowling_leaderboard.csv'));
  const year = YEAR_LABEL[seasonId];
  for (const r of rows) {
    if (!r.player_id) continue;
    total++;
    const d = statsMap[r.player_id + '|' + seasonId + '|bowling'];
    if (!d) { missing++; issues.bowling.push({ year, player: r.name, msg: 'MISSING in DB' }); continue; }
    const errs = [];
    // For players with no bowling (empty wickets/balls in CSV), 0 in DB is correct
    if (!intEq(r.total_wickets, d.total_wickets)) errs.push('wickets: csv=' + (r.total_wickets||'0') + ' db=' + d.total_wickets);
    if (!intEq(r.total_match,   d.total_match))   errs.push('matches: csv=' + r.total_match + ' db=' + d.total_match);
    if (!intEq(r.maidens,       d.maidens))        errs.push('maidens: csv=' + (r.maidens||'0') + ' db=' + d.maidens);
    if (!intEq(r.dot_balls,     d.dot_balls))      errs.push('dots: csv=' + (r.dot_balls||'0') + ' db=' + d.dot_balls);
    if (!intEq(r.runs,          d.runs))           errs.push('runs: csv=' + (r.runs||'0') + ' db=' + d.runs);
    if (!intEq(r.balls,         d.balls))          errs.push('balls: csv=' + (r.balls||'0') + ' db=' + d.balls);
    if (r.economy && !approxEq(n(r.economy), d.economy, 0.05)) errs.push('economy: csv=' + r.economy + ' db=' + d.economy);
    if (r.SR  && !approxEq(n(r.SR),  d.sr,  0.1))             errs.push('sr: csv=' + r.SR + ' db=' + d.sr);
    if (r.avg && !approxEq(n(r.avg), d.avg, 0.05))            errs.push('avg: csv=' + r.avg + ' db=' + d.avg);
    if (errs.length) { mismatches++; issues.bowling.push({ year, player: r.name, msg: errs.join('  |  ') }); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FIELDING
// ════════════════════════════════════════════════════════════════════════════
function validateFielding(prefix, seasonId) {
  const rows = parseCSV(path.join(DATA, prefix + '_fielding_leaderboard.csv'));
  const year = YEAR_LABEL[seasonId];
  for (const r of rows) {
    if (!r.player_id) continue;
    total++;
    const d = statsMap[r.player_id + '|' + seasonId + '|fielding'];
    if (!d) { missing++; issues.fielding.push({ year, player: r.name, msg: 'MISSING in DB (player not seeded)' }); continue; }
    const errs = [];
    if (!intEq(r.catches,         d.catches))         errs.push('catches: csv=' + r.catches + ' db=' + d.catches);
    if (!intEq(r.caught_behind,   d.caught_behind))   errs.push('caught_behind: csv=' + r.caught_behind + ' db=' + d.caught_behind);
    if (!intEq(r.run_outs,        d.run_outs))        errs.push('run_outs: csv=' + r.run_outs + ' db=' + d.run_outs);
    if (!intEq(r.stumpings,       d.stumpings))       errs.push('stumpings: csv=' + r.stumpings + ' db=' + d.stumpings);
    if (!intEq(r.caught_and_bowl, d.caught_and_bowl)) errs.push('c&b: csv=' + r.caught_and_bowl + ' db=' + d.caught_and_bowl);
    if (!intEq(r.total_dismissal, d.total_dismissal)) errs.push('total_dismissal: csv=' + r.total_dismissal + ' db=' + d.total_dismissal);
    if (errs.length) { mismatches++; issues.fielding.push({ year, player: r.name, msg: errs.join('  |  ') }); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MVP
// ════════════════════════════════════════════════════════════════════════════
function validateMvp(prefix, seasonId) {
  const rows = parseCSV(path.join(DATA, prefix + '_mvp_leaderboard.csv'));
  const year = YEAR_LABEL[seasonId];
  const dbMvp = allStats.filter(s => s.season_id === seasonId && s.stat_type === 'mvp');

  for (const r of rows) {
    const csvName = (r['Player Name'] || '').toLowerCase().trim();
    if (!csvName) continue;
    total++;

    // Match by exact name first, then first-word partial
    let found = dbMvp.find(s => (JSON.parse(s.stats_json).name || '').toLowerCase().trim() === csvName);
    if (!found) {
      const firstWord = csvName.split(' ')[0];
      found = dbMvp.find(s => {
        const dbName = (JSON.parse(s.stats_json).name || '').toLowerCase();
        return dbName.startsWith(firstWord) || dbName.split(' ').some(w => w === firstWord);
      });
    }

    if (!found) { missing++; issues.mvp.push({ year, player: r['Player Name'], msg: 'MISSING — player name not matched in DB (possible name variant)' }); continue; }

    const d = JSON.parse(found.stats_json);
    const errs = [];
    if (!approxEq(n(r.Batting),  d.batting_score,  0.01)) errs.push('batting_score: csv=' + r.Batting + ' db=' + d.batting_score);
    if (!approxEq(n(r.Bowling),  d.bowling_score,  0.01)) errs.push('bowling_score: csv=' + r.Bowling + ' db=' + d.bowling_score);
    if (!approxEq(n(r.Fielding), d.fielding_score, 0.01)) errs.push('fielding_score: csv=' + r.Fielding + ' db=' + d.fielding_score);
    if (!approxEq(n(r.Total),    d.total_score,    0.01)) errs.push('total_score: csv=' + r.Total + ' db=' + d.total_score);
    if (errs.length) { mismatches++; issues.mvp.push({ year, player: r['Player Name'], msg: errs.join('  |  ') }); }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
validateBatting('936991',  'season-2025');
validateBatting('1410878', 'season-2024');
validateBowling('936991',  'season-2025');
validateBowling('1410878', 'season-2024');
validateFielding('936991', 'season-2025');
validateFielding('1410878','season-2024');
validateMvp('936991',  'season-2025');
validateMvp('1410878', 'season-2024');

// ── Report ────────────────────────────────────────────────────────────────────
const BAR = '═'.repeat(65);
const accurate = total - missing - mismatches;
const pct = (accurate / total * 100).toFixed(1);

console.log('\n' + BAR);
console.log('          ZPL PLAYER DATA ACCURACY VALIDATION REPORT');
console.log(BAR);
console.log('\n  Source files  : 936991 (ZPL 2025)  +  1410878 (ZPL 2024)');
console.log('  Categories    : batting · bowling · fielding · mvp  ×  2 seasons\n');
console.log('  Total records checked : ' + total);
console.log('  ✅ Accurate           : ' + accurate + '  (' + pct + '%)');
console.log('  ❌ Missing from DB    : ' + missing);
console.log('  ⚠️  Value mismatches  : ' + mismatches);

function printSection(title, arr) {
  console.log('\n' + '─'.repeat(65));
  if (arr.length === 0) {
    console.log('  ✅  ' + title + '  —  ALL RECORDS ACCURATE');
  } else {
    console.log('  ❌  ' + title + '  —  ' + arr.length + ' issue(s)');
    for (const e of arr) {
      const tag = e.msg.startsWith('MISSING') ? '⛔' : '⚠️ ';
      console.log('     ' + tag + ' [' + e.year + '] ' + e.player);
      console.log('          ' + e.msg);
    }
  }
}

printSection('BATTING  (2024 + 2025)', issues.batting);
printSection('BOWLING  (2024 + 2025)', issues.bowling);
printSection('FIELDING (2024 + 2025)', issues.fielding);
printSection('MVP      (2024 + 2025)', issues.mvp);

console.log('\n' + BAR);
if (missing === 0 && mismatches === 0) {
  console.log('  ✅  ALL DATA IS 100% ACCURATE AND COMPLETE');
} else {
  console.log('  RESULT  :  ' + accurate + '/' + total + ' records accurate  (' + pct + '%)');
  if (missing > 0) console.log('  ACTION  :  ' + missing + ' player(s) need to be added/re-seeded');
  if (mismatches > 0) console.log('  ACTION  :  ' + mismatches + ' record(s) have value mismatches — check above');
}
console.log(BAR + '\n');
