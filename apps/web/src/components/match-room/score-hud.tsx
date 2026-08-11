'use client';

import * as React from 'react';
import { AURA_METRIC_KEYS, MATCH_DURATION_SECONDS } from '@aurafarming/shared';

import { Progress } from '@/components/ui/progress';
import type { AuraMetricValues } from '@/lib/aura-features-extraction';
import { AURA_METRIC_LABELS } from '@/lib/aura-metric-labels';
import type { LiveScores } from '@/lib/match-room-reducer';

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl tabular-nums">{Math.round(value * 100)}</span>
      <Progress value={value} className="w-full" />
    </div>
  );
}

type ScoreHudProps = {
  scores: LiveScores | null;
  ownMetrics: AuraMetricValues | null;

  liveSince: number;
};

export function ScoreHud({ scores, ownMetrics, liveSince }: ScoreHudProps) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((now - liveSince) / 1000));

  const remainingSeconds = Math.max(0, MATCH_DURATION_SECONDS - elapsedSeconds);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1">
        <div className="text-center font-mono text-2xl tabular-nums">
          {formatElapsed(remainingSeconds)}
        </div>
        <span className="text-xs text-muted-foreground">tempo restante</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ScoreCard label="Você" value={scores?.self ?? 0} />
        <ScoreCard label="Adversário" value={scores?.opponent ?? 0} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Sua leitura ao vivo, métrica por métrica</p>
        {AURA_METRIC_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">
              {AURA_METRIC_LABELS[key]}
            </span>
            <Progress value={ownMetrics?.[key] ?? 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
