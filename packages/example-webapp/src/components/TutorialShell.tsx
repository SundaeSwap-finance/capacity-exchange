import type { ReactNode } from 'react';
import { DemoRail } from './DemoRail';
import { StepIndicator } from './StepIndicator';
import { UnicornBackdrop } from './UnicornBackdrop';
import type { TutorialStep } from '../hooks/useTutorialState';
import type { DebugLogEntry, DemoRailContent } from './DemoRail';

interface TutorialShellProps {
  currentStep: TutorialStep;
  completedSteps: Set<TutorialStep>;
  walletConnected: boolean;
  walletConnecting: boolean;
  onWalletConnect: () => void;
  onStepClick?: (step: TutorialStep) => void;
  modeLabel?: string;
  sidebarContent: DemoRailContent;
  debugEntries: DebugLogEntry[];
  children: ReactNode;
}

const STEP_CODES = ['WALLET [01] //', 'SPONSOR [02] //', 'REGISTER [03] //', 'PLAYGROUND [04] //'] as const;
const RIGHT_RAIL_WIDTH = '280px';

export function TutorialShell({
  currentStep,
  completedSteps,
  walletConnected,
  walletConnecting,
  onWalletConnect,
  onStepClick,
  modeLabel = 'Demo',
  sidebarContent,
  debugEntries,
  children,
}: TutorialShellProps) {
  const stepCode = STEP_CODES[currentStep];

  return (
    <div className="h-screen overflow-hidden bg-ces-void text-ces-text">
      <div className="relative flex h-screen flex-col overflow-hidden">
        <header className="relative z-20 flex min-h-[46px] border-b border-ces-border">
          <div className="flex min-w-0 flex-1 items-center gap-5 px-4 sm:px-6 lg:px-8">
            <div className="flex h-[46px] w-[46px] items-center justify-center border-r border-ces-border bg-ces-accent text-black">
              <span className="font-display text-base leading-none tracking-[-0.08em]">CE</span>
            </div>
            <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onStepClick={onStepClick} />
          </div>

          <div className="hidden shrink-0 items-stretch xl:flex">
            <div className="flex shrink-0 items-center whitespace-nowrap border-l border-ces-border px-6 font-mono text-[10px] uppercase tracking-[0.32em] text-ces-text">
              {`Preview // ${modeLabel}`}
            </div>

            <button
              type="button"
              onClick={onWalletConnect}
              disabled={walletConnected || walletConnecting}
              className={`flex items-center justify-center border-l border-ces-border px-6 font-mono text-[9px] uppercase tracking-[0.32em] transition-colors ${
                walletConnected
                  ? 'bg-ces-accent text-black'
                  : walletConnecting
                    ? 'bg-ces-surface-solid text-ces-accent'
                    : 'bg-ces-accent text-black hover:brightness-95'
              }`}
              style={{ width: RIGHT_RAIL_WIDTH, flex: `0 0 ${RIGHT_RAIL_WIDTH}` }}
            >
              {walletConnected ? 'Wallet Ready' : walletConnecting ? 'Connecting' : 'Connect Wallet'}
            </button>
          </div>
        </header>

        <div
          className="relative flex min-h-0 flex-1 overflow-hidden xl:grid"
          style={{ gridTemplateColumns: `minmax(0,1fr) ${RIGHT_RAIL_WIDTH}` }}
        >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <main className="ces-main-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-[var(--ces-space-shell-y)] sm:px-6 sm:py-[calc(var(--ces-space-shell-y)+0.25rem)] xl:px-8 xl:py-[var(--ces-space-shell-y-lg)]">
              <UnicornBackdrop />

              <div className="relative z-10 w-full max-w-[480px] max-h-full overflow-auto">
                <div className="ces-step-transition-scope relative">
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-ces-text-muted">
                    {stepCode}
                  </p>
                  {children}
                </div>
              </div>
            </main>
          </div>

          <aside
            className="relative z-10 hidden border-t border-ces-border bg-black xl:flex xl:min-h-0 xl:border-l xl:border-t-0"
            style={{ width: RIGHT_RAIL_WIDTH, flex: `0 0 ${RIGHT_RAIL_WIDTH}` }}
          >
            <div className="flex w-full flex-col xl:min-h-0 xl:flex-1">
              <div className="flex min-h-[46px] items-center justify-end border-b border-ces-border px-2 xl:hidden">
                <button
                  type="button"
                  onClick={onWalletConnect}
                  disabled={walletConnected || walletConnecting}
                  className={`min-w-[160px] border px-4 py-2 text-center font-mono text-[9px] uppercase tracking-[0.3em] transition-colors ${
                    walletConnected
                      ? 'border-black bg-ces-accent text-black'
                      : walletConnecting
                        ? 'border-ces-accent/55 bg-ces-surface-solid text-ces-accent'
                        : 'border-black bg-ces-accent text-black hover:brightness-95'
                  }`}
                >
                  {walletConnected ? 'Wallet Ready' : walletConnecting ? 'Connecting' : 'Connect Wallet'}
                </button>
              </div>

              <div className="flex flex-1 flex-col">
                <DemoRail content={sidebarContent} entries={debugEntries} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
