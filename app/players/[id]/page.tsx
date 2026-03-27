'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJSON } from '@/lib/fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRoleBadgeColor, getRoleIcon, formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Plus } from 'lucide-react';
import { AIContent } from '@/components/ui/AIContent';
import { Textarea } from '@/components/ui/textarea';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
} from 'recharts';

interface PlayerDetail {
  id: string; first_name: string; last_name: string;
  gender: string; player_role: string; batting_hand: string; bowling_style: string;
  photo_url: string | null;
  base_price: number | null;
  stats: Record<string, { batting?: any; bowling?: any; fielding?: any; mvp?: any }>;
  remarks: { id: string; remark_type: string; remark: string; created_at: string }[];
  owner_data: {
    batting_stars: number | null; bowling_stars: number | null; fielding_stars: number | null;
    owner_note: string; grade: string | null; should_buy: boolean | null; overall_rating: number | null;
  } | null;
}

interface Season { id: string; name: string; year: number; }

export default function PlayerProfilePage() {
  const { id } = useParams() as { id: string };
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [remarkType, setRemarkType] = useState('general');
  const [addingRemark, setAddingRemark] = useState(false);
  const [showRemarkForm, setShowRemarkForm] = useState(false);
  const [matchHistory, setMatchHistory] = useState<{ batting: any[]; bowling: any[] }>({ batting: [], bowling: [] });
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [ownerData, setOwnerData] = useState<{ batting_stars: number | null; bowling_stars: number | null; fielding_stars: number | null; owner_note: string; grade: string | null; should_buy: boolean | null; overall_rating: number | null }>({ batting_stars: null, bowling_stars: null, fielding_stars: null, owner_note: '', grade: null, should_buy: null, overall_rating: null });
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerSaved, setOwnerSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchJSON<PlayerDetail>(`/api/players/${id}`),
      fetchJSON<any>('/api/seasons'),
      fetchJSON<any>(`/api/players/${id}/match-history`).catch(() => ({ batting: [], bowling: [] })),
    ]).then(([playerData, seasonsData, historyData]) => {
      if (playerData) {
        setPlayer(playerData);
        // Populate ownerData from API response (includes grade/should_buy/overall_rating)
        if (playerData.owner_data) {
          const od = playerData.owner_data;
          setOwnerData({
            batting_stars: od.batting_stars ?? null,
            bowling_stars: od.bowling_stars ?? null,
            fielding_stars: od.fielding_stars ?? null,
            owner_note: od.owner_note || '',
            grade: od.grade ?? null,
            should_buy: od.should_buy ?? null,
            overall_rating: od.overall_rating ?? null,
          });
        }
      }
      // Sort newest first so tabs default to most recent season
      const sorted = (Array.isArray(seasonsData) ? seasonsData : (seasonsData as any)?.seasons ?? [])
        .sort((a: Season, b: Season) => b.year - a.year);
      setSeasons(sorted);
      setMatchHistory({ batting: (historyData as any)?.batting || [], bowling: (historyData as any)?.bowling || [] });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleSaveOwnerData = async (updated?: typeof ownerData) => {
    const payload = updated ?? ownerData;
    setOwnerSaving(true);
    try {
      await fetch(`/api/player-owner-data/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setOwnerSaved(true);
      setTimeout(() => setOwnerSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setOwnerSaving(false); }
  };

  const handleOwnerStarClick = (key: 'batting_stars' | 'bowling_stars' | 'fielding_stars', star: number) => {
    const newVal = ownerData[key] === star ? null : star;
    const updated = { ...ownerData, [key]: newVal };
    // Recompute live rating from all 3 stars
    const stars = [
      key === 'batting_stars' ? newVal : updated.batting_stars,
      key === 'bowling_stars' ? newVal : updated.bowling_stars,
      key === 'fielding_stars' ? newVal : updated.fielding_stars,
    ].filter(v => v != null) as number[];
    if (stars.length > 0) updated.overall_rating = Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10;
    setOwnerData(updated);
    handleSaveOwnerData(updated);
  };

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/player-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: id }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      setAiAnalysis(data?.analysis || '');
    } finally { setAiLoading(false); }
  };

  const handleAddRemark = async () => {
    if (!newRemark.trim()) return;
    setAddingRemark(true);
    await fetch('/api/players/' + id + '/remarks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark: newRemark, remark_type: remarkType }),
    });
    setNewRemark(''); setShowRemarkForm(false);
    const fresh = await fetchJSON<any>(`/api/players/${id}`);
    if (fresh) setPlayer(fresh);
    setAddingRemark(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-[#FFD700]/30 border-t-[#FFD700] rounded-full animate-spin" />
    </div>
  );

  if (!player || (player as any).error) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Player not found</p>
    </div>
  );

  // Build radar data from best available season
  const bestStats = Object.values(player.stats || {})[0] || {};
  const radarData = [
    { subject: 'Batting', value: Math.min(100, (bestStats.batting?.total_runs || 0) / 3) },
    { subject: 'Bowling', value: Math.min(100, (bestStats.bowling?.total_wickets || 0) * 8) },
    { subject: 'Fielding', value: Math.min(100, (bestStats.fielding?.total_dismissal || 0) * 7) },
    { subject: 'Economy', value: bestStats.bowling?.economy ? Math.max(0, 100 - (bestStats.bowling.economy - 5) * 15) : 0 },
    { subject: 'Strike Rate', value: Math.min(100, (bestStats.batting?.strike_rate || 0) / 2.5) },
    { subject: 'MVP', value: Math.min(100, (bestStats.mvp?.total_score || 0) * 2.5) },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-full bg-[#1B3A8C] flex items-center justify-center text-4xl shrink-0 border-2 border-[#FFD700]/30 overflow-hidden">
          {player.photo_url ? (
            <img src={player.photo_url} alt={`${player.first_name} ${player.last_name}`}
              className="w-full h-full object-cover" />
          ) : (
            <span>{player.gender === 'Female' ? '👩' : '👨'}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-black font-display">{player.first_name} {player.last_name}</h1>
            {player.gender === 'Female' && <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">Female</Badge>}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {player.player_role && (
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white', getRoleBadgeColor(player.player_role))}>
                {getRoleIcon(player.player_role)} {player.player_role}
              </span>
            )}
            {player.batting_hand && <span>🏏 Bats: {player.batting_hand}</span>}
            {player.bowling_style && <span>⚡ Bowls: {player.bowling_style}</span>}
            {player.base_price != null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[#FFD700]/10 text-[#FFD700] font-semibold border border-[#FFD700]/20">
                Base: {formatCurrency(player.base_price)}
              </span>
            )}
          </div>
        </div>
        <Button onClick={handleAIAnalysis} disabled={aiLoading}
          className="bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 hover:bg-[#FFD700]/25">
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
          AI Analysis
        </Button>
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <Card className="bg-[#FFD700]/5 border-[#FFD700]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#FFD700] flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AIContent text={aiAnalysis} className="text-sm" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Radar name={player.first_name} dataKey="value" stroke="#FFD700" fill="#FFD700" fillOpacity={0.2} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div className="bg-card border border-border rounded px-2 py-1 text-xs">
                    <p className="text-[#FFD700]">{payload[0].payload.subject}: {Number(payload[0].value || 0).toFixed(0)}</p>
                  </div>
                ) : null} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Season Stats */}
        <div className="lg:col-span-2">
          {Object.keys(player.stats || {}).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 bg-card border border-border rounded-lg text-center p-6">
              <p className="text-muted-foreground text-sm font-medium">No past performance data</p>
              <p className="text-muted-foreground/60 text-xs mt-1">No stats found for 2024 or 2025 seasons</p>
            </div>
          ) : (
          <Tabs defaultValue={Object.keys(player.stats || {})[0] || seasons[0]?.id || ''}>
            <TabsList className="bg-card border border-border mb-4">
              {seasons.filter(s => player.stats?.[s.id]).map(s => (
                <TabsTrigger key={s.id} value={s.id} className="data-[state=active]:bg-[#FFD700] data-[state=active]:text-black">
                  {s.name} {s.year}
                </TabsTrigger>
              ))}
            </TabsList>

            {seasons.map(s => {
              const ss = player.stats?.[s.id];
              if (!ss) return null;
              return (
                <TabsContent key={s.id} value={s.id} className="space-y-3">
                  {/* MVP Score */}
                  {ss.mvp && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'MVP Total', value: ss.mvp.total_score?.toFixed(2), color: 'text-[#FFD700]' },
                        { label: 'Batting', value: ss.mvp.batting_score?.toFixed(2), color: 'text-blue-400' },
                        { label: 'Bowling', value: ss.mvp.bowling_score?.toFixed(2), color: 'text-red-400' },
                        { label: 'Fielding', value: ss.mvp.fielding_score?.toFixed(2), color: 'text-green-400' },
                      ].map(stat => (
                        <Card key={stat.label} className="bg-secondary border-border">
                          <CardContent className="p-3 text-center">
                            <p className={cn('text-xl font-black', stat.color)}>{stat.value || '—'}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Batting */}
                  {ss.batting && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">🏏 Batting</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                          {[
                            { l: 'Mat', v: ss.batting.total_match },
                            { l: 'Runs', v: ss.batting.total_runs },
                            { l: 'HS', v: ss.batting.highest_run },
                            { l: 'Avg', v: ss.batting.average?.toFixed(1) },
                            { l: 'SR', v: ss.batting.strike_rate?.toFixed(1) },
                            { l: 'Inn', v: ss.batting.innings },
                            { l: 'NO', v: ss.batting.not_out },
                            { l: '4s', v: ss.batting.fours },
                            { l: '6s', v: ss.batting.sixes },
                            { l: '50s', v: ss.batting.fifties },
                          ].map(s => (
                            <div key={s.l} className="bg-secondary rounded p-2">
                              <p className="font-bold text-sm">{s.v ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">{s.l}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Bowling */}
                  {ss.bowling && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">⚡ Bowling</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                          {[
                            { l: 'Mat', v: ss.bowling.total_match },
                            { l: 'Wkts', v: ss.bowling.total_wickets },
                            { l: 'Overs', v: ss.bowling.overs },
                            { l: 'Eco', v: ss.bowling.economy?.toFixed(2) },
                            { l: 'SR', v: ss.bowling.sr?.toFixed(1) },
                            { l: 'Avg', v: ss.bowling.avg?.toFixed(1) },
                            { l: 'BBI', v: ss.bowling.highest_wicket },
                            { l: 'Runs', v: ss.bowling.runs },
                            { l: 'Dots', v: ss.bowling.dot_balls },
                            { l: 'Maidens', v: ss.bowling.maidens },
                          ].map(s => (
                            <div key={s.l} className="bg-secondary rounded p-2">
                              <p className="font-bold text-sm">{s.v ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">{s.l}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Fielding */}
                  {ss.fielding && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">🤸 Fielding</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                          {[
                            { l: 'Total', v: ss.fielding.total_dismissal },
                            { l: 'Catches', v: ss.fielding.catches },
                            { l: 'CB', v: ss.fielding.caught_behind },
                            { l: 'Stumpings', v: ss.fielding.stumpings },
                            { l: 'Run Outs', v: ss.fielding.run_outs },
                          ].map(s => (
                            <div key={s.l} className="bg-secondary rounded p-2">
                              <p className="font-bold text-sm">{s.v ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">{s.l}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
          )}
        </div>
      </div>

      {/* Match History */}
      {(matchHistory.batting.length > 0 || matchHistory.bowling.length > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              🏏 Recent Match Performances
            </CardTitle>
            <button
              onClick={() => setShowMatchHistory(!showMatchHistory)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showMatchHistory ? 'Hide ▲' : 'Show ▼'}
            </button>
          </CardHeader>
          {showMatchHistory && (
            <CardContent className="space-y-4">
              {/* Batting history */}
              {matchHistory.batting.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Batting</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Match</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">R</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">B</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">4s</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">6s</th>
                          <th className="text-right py-1.5 pl-2 text-muted-foreground font-medium">SR</th>
                          <th className="text-left py-1.5 pl-2 text-muted-foreground font-medium">How Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchHistory.batting.map((b: any, i: number) => {
                          const matchLabel = b.match_type === 'league' && b.match_number
                            ? `M${b.match_number}` : (b.match_type || 'Match');
                          const vs = b.team_a_name && b.team_b_name
                            ? `${b.team_a_name} vs ${b.team_b_name}`
                            : matchLabel;
                          return (
                            <tr key={i} className="border-b border-border/20 hover:bg-white/5">
                              <td className="py-1.5 pr-3">
                                <div className="font-medium text-foreground/90">{vs}</div>
                                {b.match_date && (
                                  <div className="text-muted-foreground text-[10px]">
                                    {new Date(b.match_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </div>
                                )}
                              </td>
                              <td className="text-right py-1.5 px-2 font-bold text-foreground">{b.runs_scored}</td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">{b.balls_faced}</td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">{b.fours}</td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">{b.sixes}</td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">
                                {b.strike_rate ? Number(b.strike_rate).toFixed(1) : '-'}
                              </td>
                              <td className="text-left py-1.5 pl-2 text-muted-foreground">
                                {b.dismissal_type || 'not out'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bowling history */}
              {matchHistory.bowling.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Bowling</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Match</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">O</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">M</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">R</th>
                          <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">W</th>
                          <th className="text-right py-1.5 pl-2 text-muted-foreground font-medium">Eco</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchHistory.bowling.map((b: any, i: number) => {
                          const matchLabel = b.match_type === 'league' && b.match_number
                            ? `M${b.match_number}` : (b.match_type || 'Match');
                          const vs = b.team_a_name && b.team_b_name
                            ? `${b.team_a_name} vs ${b.team_b_name}`
                            : matchLabel;
                          return (
                            <tr key={i} className="border-b border-border/20 hover:bg-white/5">
                              <td className="py-1.5 pr-3">
                                <div className="font-medium text-foreground/90">{vs}</div>
                                {b.match_date && (
                                  <div className="text-muted-foreground text-[10px]">
                                    {new Date(b.match_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </div>
                                )}
                              </td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">{b.overs}</td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">{b.maidens}</td>
                              <td className="text-right py-1.5 px-2 text-muted-foreground">{b.runs_given}</td>
                              <td className="text-right py-1.5 px-2 font-bold text-foreground">{b.wickets}</td>
                              <td className="text-right py-1.5 pl-2 text-muted-foreground">
                                {b.economy ? Number(b.economy).toFixed(2) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Scouting (imported from registration) */}
      {(ownerData.overall_rating != null || ownerData.grade || ownerData.should_buy != null || ownerData.owner_note) && (
        <Card className="bg-[#1B3A8C]/10 border-[#1B3A8C]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">🔍 Scouting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              {ownerData.overall_rating != null && (
                <div className="flex items-center gap-1.5 bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-lg px-3 py-2">
                  <span className="text-[#FFD700] text-lg font-black">{ownerData.overall_rating}</span>
                  <span className="text-[#FFD700]/70 text-xs">/ 5</span>
                  <span className="text-[10px] text-muted-foreground ml-1">Rating</span>
                </div>
              )}
              {ownerData.grade && (
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                  <span className="text-blue-300 text-lg font-black">{ownerData.grade}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">Grade</span>
                </div>
              )}
              {ownerData.should_buy === true && (
                <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <span className="text-green-400 font-semibold text-sm">✓ Buy</span>
                </div>
              )}
              {ownerData.should_buy === false && (
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-red-400 font-semibold text-sm">✗ Skip</span>
                </div>
              )}
            </div>
            {ownerData.owner_note && (
              <p className="text-xs text-muted-foreground mt-3 bg-secondary rounded p-2 italic">"{ownerData.owner_note}"</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Your Assessment */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { key: 'batting_stars' as const, icon: '🏏', label: 'Batting' },
            { key: 'bowling_stars' as const, icon: '🎳', label: 'Bowling' },
            { key: 'fielding_stars' as const, icon: '🤸', label: 'Fielding' },
          ]).map(({ key, icon, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{icon} {label}</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleOwnerStarClick(key, s)}
                    className="text-[20px] leading-none text-[#FFD700] transition-transform active:scale-125 select-none hover:scale-110"
                  >
                    {(ownerData[key] ?? 0) >= s ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground ml-1">
                {ownerData[key] != null ? `${ownerData[key]}/5` : '–'}
              </span>
            </div>
          ))}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] text-muted-foreground">📝 My Note</label>
            <div className="flex gap-1.5">
              <textarea
                value={ownerData.owner_note}
                onChange={e => setOwnerData(prev => ({ ...prev, owner_note: e.target.value.slice(0, 300) }))}
                onBlur={() => handleSaveOwnerData()}
                placeholder='e.g. "max 50L", "must have", "avoid if price > 40L"…'
                rows={2}
                className="flex-1 text-xs bg-background/60 border border-border/60 rounded-md px-2.5 py-1.5 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#FFD700]/50 placeholder:text-muted-foreground/40"
              />
              <button
                onClick={() => handleSaveOwnerData()}
                disabled={ownerSaving}
                className="self-end text-[10px] px-2 py-1 rounded bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50 shrink-0"
              >
                {ownerSaved ? '✓' : ownerSaving ? '…' : 'Save'}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/40 text-right">{ownerData.owner_note.length}/300</p>
          </div>
        </CardContent>
      </Card>

      {/* Remarks */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Scouting Notes</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowRemarkForm(!showRemarkForm)}
            className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 text-xs">
            <Plus className="w-3 h-3 mr-1" /> Add Note
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {showRemarkForm && (
            <div className="bg-secondary rounded-lg p-3 space-y-2 mb-3">
              <select value={remarkType} onChange={e => setRemarkType(e.target.value)}
                className="bg-card border border-border rounded px-2 py-1 text-sm w-full focus:outline-none">
                {['general','strength','weakness','form','injury'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <Textarea value={newRemark} onChange={e => setNewRemark(e.target.value)}
                placeholder="Add your observation..." className="bg-card border-border text-sm min-h-[60px]" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddRemark} disabled={addingRemark}
                  className="bg-[#FFD700] text-black hover:bg-[#FFD700]/90 text-xs">
                  {addingRemark ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRemarkForm(false)}
                  className="text-xs border-border">Cancel</Button>
              </div>
            </div>
          )}
          {(player.remarks || []).map(r => (
            <div key={r.id} className="flex gap-3 bg-secondary rounded-lg p-3">
              <Badge className={cn('text-xs shrink-0 h-fit',
                r.remark_type === 'strength' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                r.remark_type === 'weakness' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                r.remark_type === 'injury' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                'bg-blue-500/20 text-blue-400 border-blue-500/30')}>
                {r.remark_type}
              </Badge>
              <div className="flex-1">
                <p className="text-sm">{r.remark}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {(player.remarks || []).length === 0 && !showRemarkForm && (
            <p className="text-muted-foreground text-sm text-center py-4">No notes yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
