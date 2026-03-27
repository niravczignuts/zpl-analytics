'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'zpl_current_season_id';

interface SeasonContextType {
  currentSeasonId: string;
  setCurrentSeasonId: (id: string) => void;
  seasons: { id: string; name: string; year: number; status: string }[];
}

const SeasonContext = createContext<SeasonContextType>({
  currentSeasonId: 'season-2026',
  setCurrentSeasonId: () => {},
  seasons: [],
});

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [currentSeasonId, _setCurrentSeasonId] = useState('season-2026');
  const [seasons, setSeasons] = useState<{ id: string; name: string; year: number; status: string }[]>([]);

  const setCurrentSeasonId = (id: string) => {
    _setCurrentSeasonId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  };

  useEffect(() => {
    fetch('/api/seasons')
      .then(r => r.json())
      .then((data: { id: string; name: string; year: number; status: string }[]) => {
        if (!Array.isArray(data) || !data.length) return;
        setSeasons(data);
        // Restore from localStorage; fall back to newest season
        let saved: string | null = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
        const validSaved = saved && data.find(s => s.id === saved);
        _setCurrentSeasonId(validSaved ? saved! : data[0].id);
      })
      .catch(console.error);
  }, []);

  return (
    <SeasonContext.Provider value={{ currentSeasonId, setCurrentSeasonId, seasons }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  return useContext(SeasonContext);
}
