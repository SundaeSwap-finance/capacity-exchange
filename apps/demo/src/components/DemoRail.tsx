export interface DemoRailContent {
  eyebrow: string;
  title: string;
  description: string;
}

export interface DebugLogEntry {
  id: number;
  timestamp: string;
  source: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

interface DemoRailProps {
  content: DemoRailContent;
  entries: DebugLogEntry[];
}

function levelLabel(level: DebugLogEntry['level']) {
  if (level === 'success') {
    return 'OK';
  }
  if (level === 'warn') {
    return 'WARN';
  }
  if (level === 'error') {
    return 'ERR';
  }
  return 'INFO';
}

export function DemoRail({ content, entries }: DemoRailProps) {
  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="border-b border-ces-border px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-ces-text">{content.eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl uppercase leading-[0.88] text-ces-text">{content.title}</h2>
        <p className="mt-3 text-xs leading-relaxed text-ces-text">{content.description}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[48px,34px,minmax(0,1fr)] gap-2 font-mono text-[9px] leading-[1.5]"
            >
              <span
                className={`${
                  entry.level === 'success'
                    ? 'text-ces-accent/80'
                    : entry.level === 'warn'
                      ? 'text-ces-gold'
                      : entry.level === 'error'
                        ? 'text-ces-danger'
                        : 'text-ces-text-muted'
                }`}
              >
                {entry.timestamp}
              </span>
              <span
                className={`uppercase tracking-[0.16em] ${
                  entry.level === 'success'
                    ? 'text-ces-accent'
                    : entry.level === 'warn'
                      ? 'text-ces-gold'
                      : entry.level === 'error'
                        ? 'text-ces-danger'
                        : 'text-ces-text-muted'
                }`}
              >
                {entry.source}
              </span>
              <span className="text-ces-text/88">
                [{levelLabel(entry.level)}] {entry.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
