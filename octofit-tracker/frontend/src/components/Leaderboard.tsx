import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type LeaderboardEntry = { teamName: string; totalPoints: number; rank: number };

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getJson<{ leaderboard: LeaderboardEntry[] }>('/api/leaderboard')
      .then((payload) => {
        if (!active) return;
        setLeaderboard(payload.leaderboard ?? []);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('Unable to load leaderboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <CapabilityCard title="Leaderboard" description="Compare team point totals.">
        <p role="status">Loading leaderboard...</p>
      </CapabilityCard>
    );
  }

  if (error) {
    return (
      <CapabilityCard title="Leaderboard" description="Compare team point totals.">
        <div role="alert">Unable to load leaderboard.</div>
      </CapabilityCard>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <CapabilityCard title="Leaderboard" description="Compare team point totals.">
        <p>No leaderboard</p>
      </CapabilityCard>
    );
  }

  return (
    <CapabilityCard title="Leaderboard" description="Compare team point totals.">
      <ol className="mb-0 ps-3">
        {leaderboard.map((entry) => (
          <li key={entry.teamName}>
            {entry.teamName}: {entry.totalPoints} points (rank {entry.rank})
          </li>
        ))}
      </ol>
    </CapabilityCard>
  );
}
