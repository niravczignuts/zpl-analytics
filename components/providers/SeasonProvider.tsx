'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  const [currentSeasonId, setCurrentSeasonId] = useState('season-2026');
  const [seasons, setSeasons] = useState<{ id: string; name: string; year: number; status: string }[]>([]);

  useEffect(() => {
    fetch('/api/seasons')
      .then(r => r.json())
      .then((data: { id: string; name: string; year: number; status: string }[]) => {
        if (!Array.isArray(data) || !data.length) return;
        setSeasons(data);
        // Seasons are returned ORDER BY year DESC — always default to the latest
        setCurrentSeasonId(data[0].id);
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
