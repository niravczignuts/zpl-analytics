/**
 * ZPL calculation utilities
 */

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatLakhs(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)}L`;
}

export function calculateNRR(
  runsFor: number,
  oversFor: number,
  runsAgainst: number,
  oversAgainst: number
): number {
  if (oversFor === 0 || oversAgainst === 0) return 0;
  return runsFor / oversFor - runsAgainst / oversAgainst;
}

export function calculateStrikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return (runs / balls) * 100;
}

export function calculateEconomy(runs: number, overs: number): number {
  if (overs === 0) return 0;
  return runs / overs;
}

export function calculateBattingAverage(runs: number, innings: number, notOuts: number): number {
  const dismissals = innings - notOuts;
  if (dismissals === 0) return runs; // Not out every time
  return runs / dismissals;
}

export function calculateBowlingAverage(runs: number, wickets: number): number {
  if (wickets === 0) return 999;
  return runs / wickets;
}

export function calculateBowlingStrikeRate(balls: number, wickets: number): number {
  if (wickets === 0) return 999;
  return balls / wickets;
}

export function oversToDecimals(oversStr: string | number): number {
  const s = String(oversStr);
  const parts = s.split('.');
  const full = parseInt(parts[0]) || 0;
  const balls = parseInt(parts[1]) || 0;
  return full + balls / 6;
}

/**
 * Captain Value calculation:
 * Based on group rules — captain value = highest purchase price of a player
 * from Group 2, 3, or 4 that the team bought (excluding Group 1 stars).
 * This is configurable via season rules.
 */
export function calculateCaptainValue(
  purchases: { purchase_price: number; group_number: number }[],
  captainGroup: number
): number {
  // Sort by group relevance for captain value
  const eligibleGroups = [2, 3, 4].filter(g => g >= captainGroup);
  const eligible = purchases.filter(p => eligibleGroups.includes(p.group_number || 0));
  if (!eligible.length) return 0;
  return Math.max(...eligible.map(p => p.purchase_price));
}

export function getBudgetHealthColor(remainingPercent: number): string {
  if (remainingPercent > 50) return 'text-green-400';
  if (remainingPercent > 25) return 'text-yellow-400';
  return 'text-red-400';
}

export function getBudgetHealthBg(remainingPercent: number): string {
  if (remainingPercent > 50) return 'bg-green-500';
  if (remainingPercent > 25) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function getRoleIcon(role: string): string {
  if (!role) return '🏏';
  const r = role.toLowerCase();
  if (r.includes('wicket') || r.includes('keeper')) return '🧤';
  if (r.includes('bowler')) return '⚡';
  if (r.includes('all')) return '⭐';
  return '🏏';
}

export function getRoleBadgeColor(role: string): string {
  if (!role) return 'bg-gray-600';
  const r = role.toLowerCase();
  if (r.includes('wicket') || r.includes('keeper')) return 'bg-yellow-600';
  if (r.includes('bowler')) return 'bg-red-700';
  if (r.includes('all')) return 'bg-purple-700';
  if (r.includes('bat')) return 'bg-blue-700';
  return 'bg-gray-600';
}

export function getGroupLabel(group: number): string {
  const labels: Record<number, string> = {
    1: 'Star',
    2: 'A',
    3: 'B',
    4: 'Girls/Junior',
  };
  return labels[group] || `Group ${group}`;
}

export function getGroupColor(group: number): string {
  const colors: Record<number, string> = {
    1: 'text-yellow-400 bg-yellow-400/10',
    2: 'text-blue-400 bg-blue-400/10',
    3: 'text-green-400 bg-green-400/10',
    4: 'text-pink-400 bg-pink-400/10',
  };
  return colors[group] || 'text-gray-400 bg-gray-400/10';
}
