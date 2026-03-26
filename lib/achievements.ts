/**
 * ZPL Achievement System
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  xp: number;
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_nav:        { id:'first_nav',        title:'Explorer',           description:'Navigated to a new page',         icon:'🗺️',  color:'#1440C0', xp:10  },
  auction_view:     { id:'auction_view',      title:'Bidder Ready',       description:'Entered the auction room',        icon:'🔨',  color:'#FF4444', xp:20  },
  player_viewed:    { id:'player_viewed',     title:'Scout',              description:'Viewed a player profile',         icon:'👁️',  color:'#22C55E', xp:15  },
  match_created:    { id:'match_created',     title:'Match Maker',        description:'Scheduled a new match',           icon:'📅',  color:'#FFD700', xp:30  },
  scorecard_upload: { id:'scorecard_upload',  title:'Analyst',            description:'Uploaded a match scorecard',      icon:'📊',  color:'#A855F7', xp:50  },
  ai_consulted:     { id:'ai_consulted',      title:'AI Whisperer',       description:'Consulted the AI analyst',        icon:'🤖',  color:'#06B6D4', xp:25  },
  team_viewed:      { id:'team_viewed',       title:'Team Fan',           description:'Explored a team\'s roster',       icon:'🛡️',  color:'#1440C0', xp:15  },
  konami:           { id:'konami',            title:'⚡ CHEAT CODE!',     description:'You found the secret!',           icon:'🎮',  color:'#FFD700', xp:100 },
  match_deleted:    { id:'match_deleted',     title:'Clean Slate',        description:'Removed a match from records',    icon:'🗑️',  color:'#F97316', xp:10  },
  compare_used:     { id:'compare_used',      title:'Statistician',       description:'Compared teams head-to-head',     icon:'⚖️',  color:'#A855F7', xp:20  },
};

// Global event bus for achievements
type AchievementListener = (ach: Achievement) => void;
const listeners: AchievementListener[] = [];
const unlocked = new Set<string>();

export function onAchievement(fn: AchievementListener) {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}

export function unlockAchievement(id: string) {
  if (unlocked.has(id)) return;
  const ach = ACHIEVEMENTS[id];
  if (!ach) return;
  unlocked.add(id);
  // Persist to sessionStorage
  try {
    const prev = JSON.parse(sessionStorage.getItem('zpl_achievements') || '[]');
    sessionStorage.setItem('zpl_achievements', JSON.stringify([...prev, id]));
  } catch {}
  listeners.forEach(fn => fn(ach));
}

export function getTotalXP(): number {
  try {
    const ids = JSON.parse(sessionStorage.getItem('zpl_achievements') || '[]') as string[];
    return ids.reduce((sum, id) => sum + (ACHIEVEMENTS[id]?.xp || 0), 0);
  } catch { return 0; }
}

export function getUnlockedCount(): number {
  try {
    return JSON.parse(sessionStorage.getItem('zpl_achievements') || '[]').length;
  } catch { return 0; }
}
