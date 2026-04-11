'use client';

import { AIContent } from '@/components/ui/AIContent';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSeason } from '@/components/providers/SeasonProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  getGroupLabel,
  getGroupFullLabel,
  getGroupColor,
  getRoleIcon,
  getRoleBadgeColor,
  getBudgetHealthColor,
  getBudgetHealthBg,
} from '@/lib/calculations';
import { getZPL2025Price } from '@/lib/zpl2025-db';
import {
  Gavel,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Users,
  Wallet,
  Trophy,
  Search,
  Filter,
  Loader2,
  Undo2,
  AlertCircle,
  Star,
  Tag,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AvailablePlayer {
  id: string;
  first_name: string;
  last_name: string;
  player_role: string | null;
  gender: string | null;
  batting_hand: string | null;
  bowling_style: string | null;
  photo_url: string | null;
  group_number: number | null;
  base_price: number | null;
  is_captain_eligible?: number;
  registration_status?: string;
  batting?: { total_runs?: number; average?: number; strike_rate?: number } | null;
  bowling?: { total_wickets?: number; economy?: number } | null;
  mvp?: { total_score?: number } | null;
}

interface TeamWithBudget {
  id: string;
  name: string;
  short_name: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  logo_url: string | null;
  total_budget: number;
  captain_value: number;
  auction_budget: number;
  spent: number;
  remaining: number;
  boys_spent: number;
  girls_spent: number;
  boys_remaining: number;
  girls_remaining: number;
  players_bought: number;
  max_players: number;
  avg_per_remaining_slot: number;
}

interface AuctionPurchase {
  id: string;
  team_id: string;
  player_id: string;
  purchase_price: number;
  player_name?: string;
  team_name?: string;
  team_role?: 'player' | 'captain' | 'manager' | 'unsold';
  is_captain?: number;
}

interface AISuggestion {
  // Nested structure returned by getAuctionSuggestion
  recommendation?: {
    player_name?: string;
    reason?: string;
    price_range?: { min?: number; max?: number };
    priority?: string;
  };
  alternative_targets?: { player_name?: string; reason?: string }[];
  team_balance?: {
    assessment?: string;
    batting_strength?: string;
    bowling_strength?: string;
    gaps?: string[];
  };
  risks?: string[];
  budget_advice?: string;
  // Flat fallback fields (older format)
  recommended_player?: string;
  player_name?: string;
  reason?: string;
  price_range?: string | { min?: number; max?: number };
  suggested_max_bid?: number;
  balance_assessment?: string;
  strategy?: string;
  alternatives?: (string | { player_name?: string; reason?: string })[];
  warning?: string;
  raw?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function playerFullName(p: AvailablePlayer) {
  return `${p.first_name} ${p.last_name}`.trim();
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin', className)} />
  );
}

// ── Auction Rules Card ──────────────────────────────────────────────────────────

function AuctionRulesCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#FFD700]/70" />
          Auction Rules
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-[10px] leading-relaxed text-muted-foreground border-t border-border/40">
          {/* Budget */}
          <div className="pt-3">
            <p className="font-semibold text-foreground/80 mb-1">💰 Total Budget per Team: ₹2.50 Cr</p>
            <div className="pl-3 space-y-0.5">
              <p>• <span className="text-blue-400">Boys:</span> ₹2.30 Cr</p>
              <p>• <span className="text-pink-400">Girls:</span> ₹20 L base (+ any unspent boys budget)</p>
              <p className="text-muted-foreground/60">Girls auction happens last. Remaining boys budget carries over to girls.</p>
            </div>
          </div>
          {/* Groups */}
          <div>
            <p className="font-semibold text-foreground/80 mb-1">👥 Player Groups</p>
            <div className="pl-3 space-y-0.5">
              <p><span className="text-yellow-400 font-bold">Grp A</span> — Star (best performers)</p>
              <p><span className="text-blue-400 font-bold">Grp B</span> — Good</p>
              <p><span className="text-green-400 font-bold">Grp C</span> — Average</p>
              <p><span className="text-pink-400 font-bold">Grp D</span> — Poor</p>
            </div>
          </div>
          {/* Captain value */}
          <div>
            <p className="font-semibold text-foreground/80 mb-1">🏆 Captain Value</p>
            <div className="pl-3 space-y-0.5">
              <p>Each captain has a <span className="text-amber-400">fixed pre-set valuation</span> deducted from the team's 3 CR budget.</p>
              <p className="text-muted-foreground/60">Example: Sagar Bhayani (75 L) → team budget = 3 CR − 75 L = 2.25 CR</p>
              <p>Captain + Manager count toward the <span className="text-amber-400">13-player squad limit</span>.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function AuctionPage() {
  const { currentSeasonId, seasons, setCurrentSeasonId } = useSeason();

  // Data state
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [teams, setTeams] = useState<TeamWithBudget[]>([]);
  const [purchases, setPurchases] = useState<AuctionPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedPlayer, setSelectedPlayer] = useState<AvailablePlayer | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');

  // AI suggestion state
  const [aiTeamId, setAiTeamId] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiError, setAiError] = useState('');
  const [useAI, setUseAI] = useState(false);

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'players' | 'auction' | 'ai'>('auction');

  // Player detail (history + notes) state
  const [playerDetail, setPlayerDetail] = useState<any>(null);
  const [playerDetailLoading, setPlayerDetailLoading] = useState(false);
  const [bidAdvice, setBidAdvice] = useState<any>(null);
  const [bidAdviceLoading, setBidAdviceLoading] = useState(false);
  const [bidAdviceError, setBidAdviceError] = useState('');

  // Unsold state
  const [markingUnsold, setMarkingUnsold] = useState<string | null>(null);

  // Owner ratings + notes state
  const [ownerData, setOwnerData] = useState<{ batting_stars: number|null; bowling_stars: number|null; fielding_stars: number|null; owner_note: string; grade: string|null; should_buy: boolean|null; overall_rating: number|null }>({
    batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '', grade: null, should_buy: null, overall_rating: null
  });
  const [ownerDataSaving, setOwnerDataSaving] = useState(false);
  const [ownerDataSaved, setOwnerDataSaved] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!currentSeasonId) return;
    setLoading(true);
    try {
      const [playersRes, teamsRes, purchasesRes] = await Promise.all([
        fetch(`/api/auction/available?season_id=${currentSeasonId}`),
        fetch(`/api/teams?season_id=${currentSeasonId}`),
        fetch(`/api/auction?season_id=${currentSeasonId}`),
      ]);
      const [playersData, teamsData, purchasesData] = await Promise.all([
        playersRes.json(),
        teamsRes.json(),
        purchasesRes.json(),
      ]);
      setAvailablePlayers(Array.isArray(playersData) ? playersData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
      setPurchases(Array.isArray(purchasesData) ? purchasesData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentSeasonId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fetch player detail + owner data together when a player is selected (batched into one effect)
  useEffect(() => {
    if (!selectedPlayer) {
      setPlayerDetail(null);
      setBidAdvice(null);
      setBidAdviceError('');
      setOwnerData({ batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '', grade: null, should_buy: null, overall_rating: null });
      return;
    }
    setPlayerDetailLoading(true);
    setBidAdvice(null);
    setBidAdviceError('');
    Promise.all([
      fetch(`/api/players/${selectedPlayer.id}`).then(r => r.json()),
      fetch(`/api/player-owner-data/${selectedPlayer.id}`).then(r => r.json()),
    ])
      .then(([detail, ownerRaw]) => {
        setPlayerDetail(detail);
        if (ownerRaw && !ownerRaw.error) {
          setOwnerData({
            batting_stars: ownerRaw.batting_stars ?? null,
            bowling_stars: ownerRaw.bowling_stars ?? null,
            fielding_stars: ownerRaw.fielding_stars ?? null,
            owner_note: ownerRaw.owner_note ?? '',
            grade: ownerRaw.grade ?? null,
            should_buy: ownerRaw.should_buy ?? null,
            overall_rating: ownerRaw.overall_rating ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setPlayerDetailLoading(false));
  }, [selectedPlayer]);

  // All auction-tracked purchases — excludes pre-assigned captain/manager entries
  const auctionPurchases = purchases.filter(p => !p.team_role || p.team_role === 'player' || p.team_role === 'unsold');

  // ── Filtered player list ───────────────────────────────────────────────────

  const filteredPlayers = useMemo(() => availablePlayers.filter(p => {
    const name = playerFullName(p).toLowerCase();
    if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false;
    if (filterGroup === 'none' && p.group_number) return false;
    if (filterGroup !== 'all' && filterGroup !== 'none' && String(p.group_number) !== filterGroup) return false;
    if (filterGender !== 'all') {
      const g = (p.gender || '').toLowerCase();
      if (filterGender === 'male' && g !== 'male') return false;
      if (filterGender === 'female' && g !== 'female') return false;
    }
    return true;
  }), [availablePlayers, searchQuery, filterGroup, filterGender]);

  // ── Purchase handler ───────────────────────────────────────────────────────

  const handlePurchase = async () => {
    if (!selectedPlayer || !selectedTeamId || !purchasePrice) {
      setPurchaseError('Select a player, team, and enter a price.');
      return;
    }
    const price = Number(purchasePrice);
    if (isNaN(price) || price <= 0) {
      setPurchaseError('Enter a valid price.');
      return;
    }
    const team = teams.find(t => t.id === selectedTeamId);
    if (team && price > team.remaining) {
      setPurchaseError(`Exceeds available budget. Remaining: ${formatCurrency(Math.max(0, team.remaining))}`);
      return;
    }

    setPurchasing(true);
    setPurchaseError('');
    setPurchaseSuccess('');
    try {
      const res = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeasonId,
          team_id: selectedTeamId,
          player_id: selectedPlayer.id,
          purchase_price: price,
          group_number: selectedPlayer.group_number,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Purchase failed');
      }
      const name = playerFullName(selectedPlayer);
      const teamName = team?.name || '';
      setPurchaseSuccess(`${name} sold to ${teamName} for ${formatCurrency(price)}!`);
      setSelectedPlayer(null);
      setSelectedTeamId('');
      setPurchasePrice('');
      setAiSuggestion(null);
      setBidAdvice(null);
      await fetchAll();
    } catch (e: any) {
      setPurchaseError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  // ── Mark player as Unsold / undo ──────────────────────────────────────────

  const handleMarkUnsold = async (player: AvailablePlayer, undo = false) => {
    setMarkingUnsold(player.id);
    try {
      await fetch('/api/auction/mark-unsold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: currentSeasonId, player_id: player.id, undo }),
      });
      const newStatus = undo ? 'registered' : 'unsold';
      setAvailablePlayers(prev => prev.map(p => p.id === player.id ? { ...p, registration_status: newStatus } : p));
      if (selectedPlayer?.id === player.id) {
        setSelectedPlayer(prev => prev ? { ...prev, registration_status: newStatus } : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingUnsold(null);
    }
  };

  // ── Add unsold player to team (no budget / squad-limit check) ─────────────

  const handleAddUnsold = async () => {
    if (!selectedPlayer || !selectedTeamId) {
      setPurchaseError('Select a team to add this player to.');
      return;
    }
    setPurchasing(true);
    setPurchaseError('');
    setPurchaseSuccess('');
    try {
      const res = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeasonId,
          team_id: selectedTeamId,
          player_id: selectedPlayer.id,
          purchase_price: 0,
          group_number: selectedPlayer.group_number,
          team_role: 'unsold',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add player');
      }
      const teamName = teams.find(t => t.id === selectedTeamId)?.name || '';
      setPurchaseSuccess(`${playerFullName(selectedPlayer)} added to ${teamName} as an additional (unsold) player.`);
      setSelectedPlayer(null);
      setSelectedTeamId('');
      setAiSuggestion(null);
      await fetchAll();
    } catch (e: any) {
      setPurchaseError(e.message);
    } finally {
      setPurchasing(false);
    }
  };

  // ── Undo last purchase ─────────────────────────────────────────────────────

  const handleUndoLast = async () => {
    // Only undo real auction purchases — never touch captain/manager pre-assignments
    const last = [...auctionPurchases].pop();
    if (!last) return;
    try {
      await fetch(`/api/auction/${last.id}`, { method: 'DELETE' });
      await fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  // ── AI Suggestion ──────────────────────────────────────────────────────────

  const handleGetAiSuggestion = async () => {
    const teamId = aiTeamId || selectedTeamId;
    if (!teamId) {
      setAiError('Select a team to get an AI suggestion.');
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    setAiError('');
    try {
      const res = await fetch('/api/ai/auction-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, season_id: currentSeasonId, useAI }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI suggestion failed');
      }
      const data = await res.json();
      setAiSuggestion(data);
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveOwnerData = async (overrideData?: typeof ownerData) => {
    if (!selectedPlayer) return;
    setOwnerDataSaving(true);
    setOwnerDataSaved(false);
    const dataToSave = overrideData ?? ownerData;
    try {
      await fetch(`/api/player-owner-data/${selectedPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      setOwnerDataSaved(true);
      setTimeout(() => setOwnerDataSaved(false), 1500);
    } catch {}
    finally { setOwnerDataSaving(false); }
  };

  const handleStarClick = (key: 'batting_stars' | 'bowling_stars' | 'fielding_stars', val: number) => {
    setOwnerData(prev => {
      const newVal = prev[key] === val ? null : val;
      const updated = { ...prev, [key]: newVal };
      // Compute average of rated stars and persist as overall_rating
      const stars = [updated.batting_stars, updated.bowling_stars, updated.fielding_stars].filter(v => v != null) as number[];
      if (stars.length > 0) {
        updated.overall_rating = Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10;
      }
      handleSaveOwnerData(updated);
      return updated;
    });
  };

  // ── AI Bid Advice for selected player ──────────────────────────────────────

  const handleGetBidAdvice = async () => {
    if (!selectedPlayer) return;
    setBidAdviceLoading(true);
    setBidAdvice(null);
    setBidAdviceError('');
    try {
      const endpoint = useAI ? '/api/ai/bid-advice' : '/api/ai/player-bid';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: selectedPlayer.id,
          season_id: currentSeasonId,
          team_id: selectedTeamId || '',
          current_bid_price: purchasePrice ? Number(purchasePrice) : null,
          owner_ratings: {
            batting: ownerData.batting_stars,
            bowling: ownerData.bowling_stars,
            fielding: ownerData.fielding_stars,
          },
          owner_note: ownerData.owner_note,
          useAI,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Bid advice failed');
      }
      setBidAdvice(await res.json());
    } catch (e: any) {
      setBidAdviceError(e.message);
    } finally {
      setBidAdviceLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-[#FFD700]/20 border-t-[#FFD700] rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading auction data…</p>
        </div>
      </div>
    );
  }

  const aiTargetTeam = teams.find(t => t.id === (aiTeamId || selectedTeamId));

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Mobile Tab Bar ── */}
      <div className="md:hidden flex border-b border-border shrink-0" style={{ background: 'rgba(5,11,31,0.95)' }}>
        {([
          { key: 'players', label: '👥 Players', badge: availablePlayers.length },
          { key: 'auction', label: '🔨 Auction', badge: null },
          { key: 'ai',      label: '✨ AI Advisor', badge: null },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={[
              'flex-1 py-2.5 text-xs font-semibold transition-all relative',
              mobileTab === tab.key
                ? 'text-[#FFD700] border-b-2 border-[#FFD700]'
                : 'text-white/40 border-b-2 border-transparent',
            ].join(' ')}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="ml-1 text-[9px] bg-white/10 rounded-full px-1">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Panels row ── */}
      <div className="flex flex-1 overflow-hidden">
      {/* ── LEFT PANEL: Player Pool ─────────────────────────────────────── */}
      <div className={[
        'flex flex-col border-r border-border bg-card/50 overflow-hidden',
        'w-full md:w-[25%] md:min-w-[220px]',
        mobileTab === 'players' ? 'flex' : 'hidden md:flex',
      ].join(' ')}>
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFD700]" />
                Player Pool
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredPlayers.length} of {availablePlayers.length} available
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-[#FFD700]"
              onClick={fetchAll}
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search players…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background border-border"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1.5">
            <select
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value)}
              className="flex-1 bg-background border border-border text-xs rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            >
              <option value="all">All Groups</option>
              <option value="1">Group A – Star</option>
              <option value="2">Group B – Good</option>
              <option value="3">Group C – Average</option>
              <option value="4">Group D – Poor</option>
              <option value="none">No Group</option>
            </select>
            <select
              value={filterGender}
              onChange={e => setFilterGender(e.target.value)}
              className="flex-1 bg-background border border-border text-xs rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto">
          {filteredPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <p className="text-3xl mb-2">🏏</p>
              <p className="text-xs text-muted-foreground">No players match your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredPlayers.map(player => {
                const isSelected = selectedPlayer?.id === player.id;
                const groupColor = getGroupColor(player.group_number || 0);
                return (
                  <div
                    key={player.id}
                    className={cn(
                      'w-full text-left px-3 py-2.5 transition-all hover:bg-[#FFD700]/5 flex items-start gap-2 group/row',
                      isSelected && 'bg-[#FFD700]/10 border-l-2 border-[#FFD700]',
                      player.registration_status === 'unsold' && 'bg-orange-500/5 border-l-2 border-orange-500/40'
                    )}
                  >
                    {/* Clickable area */}
                    <button
                      className="flex items-start gap-2 flex-1 min-w-0"
                      onClick={() => {
                        setSelectedPlayer(isSelected ? null : player);
                        setPurchaseError('');
                        setPurchaseSuccess('');
                      }}
                    >
                      {/* Player mini avatar */}
                      <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden bg-[#1B3A8C] flex items-center justify-center text-xs mt-0.5 border border-white/10">
                        {player.photo_url ? (
                          <img src={player.photo_url} alt={playerFullName(player)}
                            className="w-full h-full object-cover" />
                        ) : (
                          <span>{player.gender === 'Female' ? '👩' : '👨'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn('text-xs font-medium truncate', isSelected && 'text-[#FFD700]')}>
                            {playerFullName(player)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', groupColor)}>
                            {getGroupLabel(player.group_number || 0)}
                          </span>
                          {player.player_role && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded text-white', getRoleBadgeColor(player.player_role))}>
                              {player.player_role.replace('Wicket Keeper', 'WK')}
                            </span>
                          )}
                          {player.gender === 'Female' && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-pink-500/20 text-pink-300">♀</span>
                          )}
                          {player.registration_status === 'unsold' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold">UNSOLD</span>
                          )}
                        </div>
                      </div>
                      {player.base_price != null && player.registration_status !== 'not_for_sale' && player.registration_status !== 'unsold' && (
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {formatCurrency(player.base_price)}
                        </span>
                      )}
                    </button>

                    {/* Mark Unsold / Undo Unsold button */}
                    {player.registration_status !== 'not_for_sale' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarkUnsold(player, player.registration_status === 'unsold'); }}
                        disabled={markingUnsold === player.id}
                        title={player.registration_status === 'unsold' ? 'Undo Unsold' : 'Mark as Unsold'}
                        className={cn(
                          'shrink-0 mt-1 p-1 rounded transition-all opacity-0 group-hover/row:opacity-100',
                          player.registration_status === 'unsold'
                            ? 'text-orange-400 hover:bg-orange-500/20 opacity-100'
                            : 'text-muted-foreground/40 hover:text-orange-400 hover:bg-orange-500/10'
                        )}
                      >
                        {markingUnsold === player.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Tag className="w-3 h-3" />
                        }
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER PANEL: Active Auction ────────────────────────────────── */}
      <div className={[
        'flex-1 flex flex-col overflow-hidden',
        mobileTab === 'auction' ? 'flex' : 'hidden md:flex',
      ].join(' ')}>
        {/* Season selector + header */}
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black font-display text-[#FFD700] flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              Live Auction Board
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {auctionPurchases.length} players sold · {availablePlayers.length} remaining
            </p>
          </div>
          <div className="flex items-center gap-3">
            {auctionPurchases.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndoLast}
                className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo Last
              </Button>
            )}
            {seasons.length > 1 && (
              <select
                value={currentSeasonId}
                onChange={e => setCurrentSeasonId(e.target.value)}
                className="bg-card border border-border text-sm rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
              >
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Active player card */}
          {selectedPlayer ? (
            <Card className="bg-card border-border border-[#FFD700]/20 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Player photo — large */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#1B3A8C] flex items-center justify-center text-3xl border border-white/10">
                      {selectedPlayer.photo_url ? (
                        <img src={selectedPlayer.photo_url} alt={playerFullName(selectedPlayer)}
                          className="w-full h-full object-cover" />
                      ) : (
                        <span>{selectedPlayer.gender === 'Female' ? '👩' : '👨'}</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-[#FFD700]">{playerFullName(selectedPlayer)}</h2>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {selectedPlayer.player_role && (
                          <Badge className={cn('text-xs text-white border-0', getRoleBadgeColor(selectedPlayer.player_role))}>
                            {selectedPlayer.player_role}
                          </Badge>
                        )}
                        <Badge className={cn('text-xs border-0', getGroupColor(selectedPlayer.group_number || 0))}>
                          {getGroupLabel(selectedPlayer.group_number || 0)}
                        </Badge>
                        {selectedPlayer.gender && (
                          <span className="text-xs text-muted-foreground">{selectedPlayer.gender}</span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        {selectedPlayer.batting_hand && <span>Bats: {selectedPlayer.batting_hand}</span>}
                        {selectedPlayer.bowling_style && <span>Bowls: {selectedPlayer.bowling_style}</span>}
                      </div>
                      {/* ZPL 2025 Price */}
                      {(() => {
                        const zpl = getZPL2025Price(playerFullName(selectedPlayer));
                        return (
                          <div className="mt-1">
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                              zpl ? 'bg-[#FFD700]/15 text-[#FFD700]' : 'bg-white/5 text-muted-foreground'
                            )}>
                              ZPL 2025: {zpl ? `₹${zpl.price}L — ${zpl.team}` : 'New Player'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Base Price</p>
                    <p className="text-lg font-bold text-foreground">
                      {selectedPlayer.base_price != null ? formatCurrency(selectedPlayer.base_price) : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Compact stats strip */}
                {(selectedPlayer.batting || selectedPlayer.bowling || selectedPlayer.mvp) && (
                  <div className="flex items-center gap-3 flex-wrap text-xs py-2 border-y border-border/40 mb-3">
                    {selectedPlayer.batting && (
                      <span className="text-blue-400 font-semibold">
                        {selectedPlayer.batting.total_runs ?? 0}r
                        <span className="text-muted-foreground font-normal ml-1">
                          avg {Number(selectedPlayer.batting.average ?? 0).toFixed(1)} · SR {Number(selectedPlayer.batting.strike_rate ?? 0).toFixed(0)}
                        </span>
                      </span>
                    )}
                    {selectedPlayer.bowling && (
                      <span className="text-red-400 font-semibold">
                        {selectedPlayer.bowling.total_wickets ?? 0}w
                        <span className="text-muted-foreground font-normal ml-1">
                          eco {Number(selectedPlayer.bowling.economy ?? 0).toFixed(2)}
                        </span>
                      </span>
                    )}
                    {selectedPlayer.mvp && (
                      <span className="text-[#FFD700] font-semibold">
                        MVP {Number(selectedPlayer.mvp.total_score ?? 0).toFixed(1)}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Historical Performance / Notes ── */}
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Past Performance</p>

                  {playerDetailLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history…
                    </div>
                  ) : playerDetail && Object.keys(playerDetail.stats || {}).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(playerDetail.stats as Record<string, any>).map(([sid, s]: [string, any]) => (
                        <div key={sid} className="bg-background/50 rounded-lg border border-border/50 px-3 py-2 text-xs">
                          <p className="text-[10px] text-[#FFD700]/80 font-semibold mb-1.5 uppercase tracking-wide">ZPL {sid.startsWith('season-') ? sid.slice(7) : sid}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {s.batting && (
                              <>
                                <span className="text-muted-foreground">Runs</span>
                                <span className="font-medium text-blue-400">{s.batting.total_runs ?? '–'} <span className="text-muted-foreground font-normal">(avg {Number(s.batting.average ?? 0).toFixed(1)}, SR {Number(s.batting.strike_rate ?? 0).toFixed(0)})</span></span>
                              </>
                            )}
                            {s.bowling && (
                              <>
                                <span className="text-muted-foreground">Wickets</span>
                                <span className="font-medium text-red-400">{s.bowling.total_wickets ?? '–'} <span className="text-muted-foreground font-normal">(eco {Number(s.bowling.economy ?? 0).toFixed(2)})</span></span>
                              </>
                            )}
                            {s.fielding && (s.fielding.catches > 0 || s.fielding.run_outs > 0) && (
                              <>
                                <span className="text-muted-foreground">Fielding</span>
                                <span className="font-medium">{s.fielding.catches ?? 0}c / {s.fielding.run_outs ?? 0}ro</span>
                              </>
                            )}
                            {s.mvp && (
                              <>
                                <span className="text-muted-foreground">MVP Score</span>
                                <span className="font-medium text-[#FFD700]">{Number(s.mvp.total_score ?? 0).toFixed(1)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : playerDetail?.remarks?.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-amber-400/80 italic">New player — no historical stats. Admin notes:</p>
                      {playerDetail.remarks.map((r: any) => (
                        <div key={r.id} className="bg-amber-400/5 border border-amber-400/20 rounded-md px-3 py-2 text-xs text-muted-foreground">
                          <span className="text-amber-400/70 text-[10px] uppercase font-semibold mr-1">[{r.remark_type}]</span>
                          {r.remark}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">New player — no historical data or notes available.</p>
                  )}

                  {/* ── Scouting Data (imported + live avg) ── */}
                  {(() => {
                    // Live average from manual stars takes priority over imported overall_rating
                    const manualStars = [ownerData.batting_stars, ownerData.bowling_stars, ownerData.fielding_stars].filter(v => v != null) as number[];
                    const liveRating = manualStars.length > 0
                      ? Math.round((manualStars.reduce((a, b) => a + b, 0) / manualStars.length) * 10) / 10
                      : ownerData.overall_rating;
                    const hasScoutingData = liveRating != null || ownerData.grade || ownerData.should_buy != null;
                    if (!hasScoutingData) return null;
                    return (
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1B3A8C]/10 rounded-lg border border-[#1B3A8C]/30 flex-wrap text-[11px]">
                      <span className="text-muted-foreground/60 text-[10px] uppercase font-semibold tracking-wide shrink-0">Scouting</span>
                      <span className="text-border/60">|</span>
                      {liveRating != null && (
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground/70">Rating:</span>
                          <span className="font-semibold text-[#FFD700]">{liveRating}</span>
                          {manualStars.length > 0 && <span className="text-muted-foreground/40 text-[9px]">(avg)</span>}
                        </span>
                      )}
                      {ownerData.grade && (
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground/70">Grade:</span>
                          <span className="font-bold text-foreground">{ownerData.grade}</span>
                        </span>
                      )}
                      {ownerData.should_buy != null && (
                        <span className={`flex items-center gap-1 font-semibold ${ownerData.should_buy ? 'text-green-400' : 'text-red-400'}`}>
                          {ownerData.should_buy ? '✓ Buy' : '✗ Skip'}
                        </span>
                      )}
                    </div>
                    );
                  })()}

                  {/* ── Owner Assessment — compact ── */}
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-background/40 rounded-lg border border-border/50 flex-wrap">
                    {/* Stars for each category */}
                    {([
                      { key: 'batting_stars' as const, icon: '🏏' },
                      { key: 'bowling_stars' as const, icon: '🎳' },
                      { key: 'fielding_stars' as const, icon: '🤸' },
                    ] as const).map(({ key, icon }) => (
                      <div key={key} className="flex items-center gap-0.5">
                        <span className="text-[11px] mr-0.5">{icon}</span>
                        {[1,2,3,4,5].map(s => (
                          <button
                            key={s}
                            onClick={() => handleStarClick(key, s)}
                            onMouseDown={e => e.preventDefault()}
                            className="text-[13px] leading-none text-[#FFD700] transition-transform active:scale-110 select-none"
                          >
                            {(ownerData[key] ?? 0) >= s ? '★' : '☆'}
                          </button>
                        ))}
                      </div>
                    ))}
                    {/* Divider */}
                    <span className="text-border/60 text-xs">|</span>
                    {/* Note input */}
                    <div className="flex items-center gap-1 flex-1 min-w-[80px]">
                      <span className="text-[10px] shrink-0">📝</span>
                      <input
                        type="text"
                        value={ownerData.owner_note}
                        onChange={e => setOwnerData(prev => ({ ...prev, owner_note: e.target.value.slice(0, 200) }))}
                        onBlur={() => handleSaveOwnerData()}
                        placeholder="Note…"
                        className="flex-1 min-w-0 text-[10px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40 focus:ring-0"
                      />
                      {ownerDataSaved && <span className="text-[10px] text-green-400 shrink-0">✓</span>}
                      {ownerDataSaving && <span className="text-[10px] text-muted-foreground shrink-0">…</span>}
                    </div>
                  </div>

                  {/* AI Bid Advice */}
                  <Button
                    onClick={handleGetBidAdvice}
                    disabled={bidAdviceLoading}
                    size="sm"
                    className="w-full bg-[#1B3A8C]/80 hover:bg-[#1B3A8C] text-white border border-[#1B3A8C]/60 gap-2 text-xs"
                  >
                    {bidAdviceLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing player…</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> {useAI ? 'AI: Should I bid on this player?' : 'Should I bid on this player?'}</>
                    )}
                  </Button>

                  {bidAdviceError && (
                    <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {bidAdviceError}
                    </div>
                  )}

                  {bidAdvice && !bidAdviceLoading && (
                    <div className={cn(
                      'rounded-xl border p-3 space-y-2.5',
                      bidAdvice.recommend === true ? 'bg-green-500/5 border-green-500/30' :
                      bidAdvice.recommend === false ? 'bg-red-500/5 border-red-500/30' :
                      'bg-[#FFD700]/5 border-[#FFD700]/30'
                    )}>
                      {/* Header: team label + verdict */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className={cn('w-3.5 h-3.5 shrink-0', bidAdvice.recommend ? 'text-green-400' : 'text-red-400')} />
                          <span className={cn('text-xs font-black uppercase tracking-wider',
                            bidAdvice.recommend ? 'text-green-400' : 'text-red-400'
                          )}>
                            {bidAdvice.verdict || (bidAdvice.recommend ? 'BUY' : 'PASS')}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {bidAdvice.ss_team_name || 'Super Smashers'}
                        </span>
                      </div>

                      {/* ZPL 2025 anchor */}
                      {bidAdvice.zpl2025_price && (
                        <p className="text-[10px] text-[#FFD700]/70 font-medium">
                          📅 {bidAdvice.zpl2025_price}
                        </p>
                      )}

                      {/* Reasoning */}
                      {bidAdvice.reason && <AIContent text={bidAdvice.reason} />}

                      {/* Max bid + quick-fill */}
                      {bidAdvice.max_bid > 0 && (
                        <div className="flex items-center justify-between bg-background/60 rounded-md px-2.5 py-2 border border-border/50">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Recommended Max Bid</p>
                            <p className="text-base font-black text-[#FFD700]">{formatCurrency(bidAdvice.max_bid)}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 h-7"
                            onClick={() => setPurchasePrice(String(bidAdvice.max_bid))}
                          >
                            Use this price
                          </Button>
                        </div>
                      )}

                      {/* Key trade-off / squad fit */}
                      {bidAdvice.squad_fit && (
                        <div className="bg-background/40 rounded-md px-2.5 py-1.5 border border-border/40">
                          <p className="text-[10px] text-amber-400/80 font-semibold mb-0.5">⚖️ Trade-off</p>
                          <AIContent text={bidAdvice.squad_fit} />
                        </div>
                      )}

                      {/* Comparable players */}
                      {bidAdvice.comparable_players && (
                        <div className="bg-background/40 rounded-md px-2.5 py-1.5 border border-border/40">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">🔁 Comparables</p>
                          <AIContent text={bidAdvice.comparable_players} />
                        </div>
                      )}

                      {/* Risks */}
                      {bidAdvice.risks && bidAdvice.risks.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Risks</p>
                          <ul className="space-y-0.5">
                            {bidAdvice.risks.map((r: string, i: number) => (
                              <li key={i} className="text-xs text-amber-400/90 flex items-start gap-1.5">
                                <span className="mt-0.5 shrink-0">•</span>{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Budget impact */}
                      {bidAdvice.budget_impact && (
                        <div className="bg-background/40 rounded-md px-2.5 py-1.5 border border-border/40">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">💰 Budget Impact</p>
                          <AIContent text={bidAdvice.budget_impact} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Purchase controls */}
                {selectedPlayer.registration_status === 'not_for_sale' ? (
                  <div className="border-t border-border pt-4">
                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-400">Not For Sale</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          This player is a pre-assigned captain or manager and cannot be purchased at auction.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : selectedPlayer.registration_status === 'unsold' ? (
                  /* ── Unsold additional player flow ── */
                  <div className="border-t border-orange-500/30 pt-4 space-y-3">
                    <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3">
                      <Tag className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-400">Unsold Player</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Can be added to any team as an additional player at ₹0, beyond squad limit and budget.
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkUnsold(selectedPlayer, true)}
                        disabled={markingUnsold === selectedPlayer.id}
                        className="text-[10px] text-muted-foreground hover:text-orange-400 underline shrink-0"
                      >
                        Undo
                      </button>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Add to Team</label>
                      <select
                        value={selectedTeamId}
                        onChange={e => { setSelectedTeamId(e.target.value); setPurchaseError(''); }}
                        className="w-full bg-background border border-border text-sm rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                      >
                        <option value="">Select team…</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.players_bought}/{t.max_players} players)
                          </option>
                        ))}
                      </select>
                    </div>

                    {purchaseError && (
                      <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {purchaseError}
                      </div>
                    )}
                    {purchaseSuccess && (
                      <div className="flex items-center gap-2 text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {purchaseSuccess}
                      </div>
                    )}

                    <Button
                      onClick={handleAddUnsold}
                      disabled={purchasing || !selectedTeamId}
                      className="w-full bg-orange-500 hover:bg-orange-500/90 text-white font-bold h-10"
                    >
                      {purchasing ? (
                        <><Spinner className="mr-2 w-4 h-4" /> Adding…</>
                      ) : (
                        <><Tag className="w-4 h-4 mr-2" /> Add as Additional Player</>
                      )}
                    </Button>
                  </div>
                ) : (
                  /* ── Normal auction purchase flow ── */
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Buying Team</label>
                        <select
                          value={selectedTeamId}
                          onChange={e => { setSelectedTeamId(e.target.value); setPurchaseError(''); }}
                          className="w-full bg-background border border-border text-sm rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
                        >
                          <option value="">Select team…</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({formatCurrency(Math.max(0, t.remaining))} left)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Purchase Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={selectedPlayer.base_price ? `Min: ${formatCurrency(selectedPlayer.base_price)}` : 'Enter price…'}
                          value={purchasePrice}
                          onChange={e => { setPurchasePrice(e.target.value); setPurchaseError(''); }}
                          className="bg-background border-border"
                          min={selectedPlayer.base_price || 0}
                        />
                      </div>
                    </div>

                    {purchaseError && (
                      <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {purchaseError}
                      </div>
                    )}
                    {purchaseSuccess && (
                      <div className="flex items-center gap-2 text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded-md px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {purchaseSuccess}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handlePurchase}
                        disabled={purchasing || !selectedTeamId || !purchasePrice}
                        className="flex-1 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#1B3A8C] font-bold h-10"
                      >
                        {purchasing ? (
                          <><Spinner className="mr-2 w-4 h-4" /> Processing…</>
                        ) : (
                          <><Gavel className="w-4 h-4 mr-2" /> Confirm Purchase</>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleMarkUnsold(selectedPlayer)}
                        disabled={markingUnsold === selectedPlayer.id}
                        variant="outline"
                        className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 h-10 px-3"
                        title="Mark as Unsold"
                      >
                        {markingUnsold === selectedPlayer.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Tag className="w-4 h-4" />
                        }
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFD700]/10 flex items-center justify-center mb-3">
                <Gavel className="w-7 h-7 text-[#FFD700]/60" />
              </div>
              <p className="font-semibold text-muted-foreground">No player selected</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Pick a player from the pool on the left</p>
            </div>
          )}

          {/* Success flash */}
          {purchaseSuccess && !selectedPlayer && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {purchaseSuccess}
            </div>
          )}

          {/* ── Auction Rules Summary ────────────────────────────────── */}
          <AuctionRulesCard />

          {/* Team budget grid */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5" />
              Team Budgets
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {teams.map(team => {
                const boysPct = team.auction_budget > 0
                  ? Math.max(0, Math.min(100, (team.remaining / team.auction_budget) * 100))
                  : 0;
                const healthColor = getBudgetHealthColor(boysPct);
                const healthBg = getBudgetHealthBg(boysPct);
                const slotsLeft = team.max_players - team.players_bought;
                const teamColor = team.color_primary || '#FFD700';
                return (
                  <div
                    key={team.id}
                    className={cn(
                      'rounded-xl border p-3 transition-all cursor-pointer',
                      selectedTeamId === team.id
                        ? 'border-[#FFD700]/50 bg-[#FFD700]/5'
                        : 'border-border bg-card/60 hover:border-border/80 hover:bg-card'
                    )}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    {/* Team header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-black"
                        style={{ backgroundColor: teamColor, color: '#fff' }}>
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <span>{(team.short_name || team.name).slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="font-semibold text-xs truncate">{team.short_name || team.name}</span>
                      {selectedTeamId === team.id && (
                        <CheckCircle2 className="w-3 h-3 text-[#FFD700] ml-auto shrink-0" />
                      )}
                    </div>

                    {/* Budget bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                      <div className={cn('h-full rounded-full transition-all', healthBg)}
                        style={{ width: `${boysPct}%` }} />
                    </div>

                    {/* Budget breakdown */}
                    <div className="space-y-1.5 text-[10px]">
                      {/* Remaining */}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-semibold">Remaining</span>
                        <span className={cn('font-bold', healthColor)}>
                          {formatCurrency(Math.max(0, team.remaining))}
                        </span>
                      </div>
                      {/* Captain deduction */}
                      {team.captain_value > 0 && (
                        <div className="flex justify-between items-center pl-2 border-l-2 border-amber-400/30">
                          <span className="text-amber-400/70">Captain</span>
                          <span className="text-amber-400/90 font-medium">−{formatCurrency(team.captain_value)}</span>
                        </div>
                      )}
                      {/* Girls spent */}
                      {team.girls_spent > 0 && (
                        <div className="flex justify-between items-center pl-2 border-l-2 border-pink-400/30">
                          <span className="text-pink-400/70">👩 Girls spent</span>
                          <span className="text-pink-400/90 font-medium">−{formatCurrency(team.girls_spent)}</span>
                        </div>
                      )}
                      {/* Boys spent */}
                      {team.boys_spent > 0 && (
                        <div className="flex justify-between items-center pl-2 border-l-2 border-blue-400/30">
                          <span className="text-blue-400/70">👨 Boys spent</span>
                          <span className="text-blue-400/90 font-medium">−{formatCurrency(team.boys_spent)}</span>
                        </div>
                      )}
                      {/* Players / slots */}
                      <div className="flex justify-between pt-0.5 border-t border-border/40">
                        <span className="text-muted-foreground">Players</span>
                        <span className="font-bold">{team.players_bought}/{team.max_players}</span>
                      </div>
                      {slotsLeft > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg/slot</span>
                          <span className="font-medium">
                            {formatCurrency(Math.round(team.remaining / slotsLeft))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: AI Suggestions ─────────────────────────────────── */}
      <div className={[
        'flex flex-col border-l border-border bg-card/30 overflow-hidden',
        'w-full md:w-[30%] md:min-w-[240px]',
        mobileTab === 'ai' ? 'flex' : 'hidden md:flex',
      ].join(' ')}>
        <div className="p-4 border-b border-border shrink-0">
          <h2 className="font-bold text-sm flex items-center gap-2 text-[#FFD700]">
            <Sparkles className="w-4 h-4" />
            AI Auction Advisor
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get intelligent bidding recommendations
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Team selector for AI */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Advise for team</label>
            <select
              value={aiTeamId || selectedTeamId}
              onChange={e => setAiTeamId(e.target.value)}
              className="w-full bg-background border border-border text-sm rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD700]"
            >
              <option value="">Select team…</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {aiTargetTeam && (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: aiTargetTeam.color_primary || '#FFD700' }} />
                <span className="font-semibold">{aiTargetTeam.name}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Budget remaining:</span>
                <span className="font-medium text-green-300">{formatCurrency(Math.max(0, aiTargetTeam.remaining))}</span>
              </div>
              {aiTargetTeam.captain_value > 0 && (
                <div className="flex justify-between text-muted-foreground pl-2">
                  <span className="text-amber-400/70">Captain:</span>
                  <span className="text-amber-400">−{formatCurrency(aiTargetTeam.captain_value)}</span>
                </div>
              )}
              {aiTargetTeam.girls_spent > 0 && (
                <div className="flex justify-between text-muted-foreground pl-2">
                  <span className="text-pink-400/70">👩 Girls spent:</span>
                  <span className="text-pink-300">{formatCurrency(aiTargetTeam.girls_spent)}</span>
                </div>
              )}
              {aiTargetTeam.boys_spent > 0 && (
                <div className="flex justify-between text-muted-foreground pl-2">
                  <span className="text-blue-400/70">👨 Boys spent:</span>
                  <span className="text-blue-300">{formatCurrency(aiTargetTeam.boys_spent)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground border-t border-border/40 pt-1">
                <span>Slots left:</span>
                <span className="font-medium text-foreground">
                  {aiTargetTeam.max_players - aiTargetTeam.players_bought}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setUseAI(!useAI)}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${useAI ? 'bg-purple-600' : 'bg-muted'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useAI ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className={useAI ? 'text-purple-400' : 'text-muted-foreground'}>
                {useAI ? '✦ AI' : 'Local Engine'}
              </span>
            </label>
          </div>

          <Button
            onClick={handleGetAiSuggestion}
            disabled={aiLoading || (!aiTeamId && !selectedTeamId)}
            className="w-full bg-[#1B3A8C] hover:bg-[#1B3A8C]/80 text-white border border-[#1B3A8C]/60 gap-2"
          >
            {aiLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {useAI ? 'Get AI Suggestion' : 'Get Suggestion'}</>
            )}
          </Button>

          {aiError && (
            <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {aiError}
            </div>
          )}

          {/* AI Result Card */}
          {aiSuggestion && !aiLoading && (
            <div className="rounded-xl border border-[#FFD700]/30 bg-[#FFD700]/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFD700]" />
                <span className="text-xs font-bold text-[#FFD700] uppercase tracking-wider">AI Recommendation</span>
              </div>

              {/* Recommended player — handles both nested and flat response shapes */}
              {(() => {
                const name = aiSuggestion.recommendation?.player_name
                  || aiSuggestion.player_name
                  || aiSuggestion.recommended_player;
                return name ? (
                  <div className="bg-background/60 rounded-lg p-3 border border-border/60">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Recommended Player</p>
                    <p className="font-bold text-base text-foreground">{name}</p>
                    {aiSuggestion.recommendation?.priority && (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold',
                        aiSuggestion.recommendation.priority === 'high' ? 'bg-green-500/20 text-green-400' :
                        aiSuggestion.recommendation.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-muted text-muted-foreground'
                      )}>{aiSuggestion.recommendation.priority} priority</span>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Reason */}
              {(() => {
                const reason = aiSuggestion.recommendation?.reason || aiSuggestion.reason;
                return reason ? (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Reasoning</p>
                    <AIContent text={reason} />
                  </div>
                ) : null;
              })()}

              {/* Price range */}
              {(() => {
                const pr = aiSuggestion.recommendation?.price_range || aiSuggestion.price_range;
                if (!pr && !aiSuggestion.suggested_max_bid) return null;
                let display = '';
                if (pr && typeof pr === 'object') {
                  const min = pr.min ? formatCurrency(pr.min) : '';
                  const max = pr.max ? formatCurrency(pr.max) : '';
                  display = min && max ? `${min} – ${max}` : min || max;
                } else if (typeof pr === 'string') {
                  display = pr;
                } else if (aiSuggestion.suggested_max_bid) {
                  display = formatCurrency(aiSuggestion.suggested_max_bid);
                }
                return display ? (
                  <div className="flex items-center justify-between bg-background/60 rounded-lg p-2.5 border border-border/60">
                    <span className="text-xs text-muted-foreground">Suggested Bid Range</span>
                    <span className="text-sm font-bold text-[#FFD700]">{display}</span>
                  </div>
                ) : null;
              })()}

              {/* Team Balance */}
              {(() => {
                const tb = aiSuggestion.team_balance;
                const assessment = tb?.assessment || aiSuggestion.balance_assessment;
                if (!tb && !assessment) return null;
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Team Balance</p>
                    {assessment && <AIContent text={assessment} />}
                    {tb && (tb.batting_strength || tb.bowling_strength) && (
                      <div className="flex gap-2">
                        {tb.batting_strength && (
                          <span className="text-[10px] bg-secondary px-2 py-0.5 rounded">
                            Bat: <span className="text-foreground">{tb.batting_strength}</span>
                          </span>
                        )}
                        {tb.bowling_strength && (
                          <span className="text-[10px] bg-secondary px-2 py-0.5 rounded">
                            Bowl: <span className="text-foreground">{tb.bowling_strength}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {tb?.gaps && tb.gaps.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tb.gaps.map((g, i) => (
                          <span key={i} className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Budget advice / strategy */}
              {(aiSuggestion.budget_advice || aiSuggestion.strategy) && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Budget Advice</p>
                  <AIContent text={aiSuggestion.budget_advice || aiSuggestion.strategy || ''} />
                </div>
              )}

              {/* Risks */}
              {aiSuggestion.risks && aiSuggestion.risks.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Risks</p>
                  <ul className="space-y-0.5">
                    {aiSuggestion.risks.map((r, i) => (
                      <li key={i} className="text-xs text-amber-400/90 flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">•</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Alternative targets */}
              {(() => {
                const alts = aiSuggestion.alternative_targets || aiSuggestion.alternatives;
                if (!alts || alts.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Alternatives</p>
                    <div className="space-y-1">
                      {alts.map((alt, i) => {
                        const name = typeof alt === 'string' ? alt : alt.player_name || '';
                        const reason = typeof alt === 'object' ? alt.reason : '';
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[9px] shrink-0 mt-0.5">{i + 1}</span>
                            <span>{name}{reason ? ` — ${reason}` : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {aiSuggestion.warning && (
                <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 rounded-md p-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {aiSuggestion.warning}
                </div>
              )}

              {/* Quick-fill from AI suggestion */}
              {(() => {
                const pr = aiSuggestion.recommendation?.price_range;
                const bid = pr?.max || aiSuggestion.suggested_max_bid;
                return bid ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10"
                    onClick={() => {
                      setPurchasePrice(String(bid));
                      if (aiTeamId) setSelectedTeamId(aiTeamId);
                    }}
                  >
                    Use Max Suggested Price ({formatCurrency(bid)})
                  </Button>
                ) : null;
              })()}
            </div>
          )}

          {/* Recent purchases — captain/manager pre-assignments are intentionally excluded */}
          {auctionPurchases.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                Recent Purchases
              </p>
              <div className="space-y-1.5">
                {[...auctionPurchases].slice(-8).reverse().map((p, i) => {
                  const team = teams.find(t => t.id === p.team_id);
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-background/40 px-2.5 py-1.5 border border-border/40">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Team logo mini */}
                        <div className="w-5 h-5 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[9px] font-black border border-white/10"
                          style={{ backgroundColor: team?.color_primary || '#888' }}>
                          {team?.logo_url ? (
                            <img src={team.logo_url} alt={team.name}
                              className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <span className="text-white">{(team?.short_name || team?.name || '?').slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-muted-foreground">
                              {p.player_name || `Player #${i + 1}`}
                            </span>
                          </div>
                          {team && (
                            <span className="text-[10px] text-muted-foreground/60 truncate block">
                              {team.short_name || team.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-[#FFD700] ml-2 shrink-0">
                        {p.purchase_price === 0 ? '—' : formatCurrency(p.purchase_price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
