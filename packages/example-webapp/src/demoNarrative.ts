import type { TutorialStep } from './hooks/useTutorialState';

export interface DemoNarrativeContent {
  eyebrow: string;
  title: string;
  description: string;
}

export function getDemoRailContent(step: TutorialStep): DemoNarrativeContent {
  if (step === 0) {
    return {
      eyebrow: 'Why DUST Matters',
      title: 'Show The Real Friction',
      description:
        'Midnight transactions require DUST. This demo makes that dependency visible before showing how Capacity Exchange can abstract it away for end users.',
    };
  }

  if (step === 1) {
    return {
      eyebrow: 'Sponsored Onboarding',
      title: 'The App Covers DUST',
      description:
        'This flow shows the app-sponsored path: the user receives tokens without first sourcing DUST, while the underlying work stays visible in the log.',
    };
  }

  if (step === 2) {
    return {
      eyebrow: 'User-Paid Path',
      title: 'Tokens Cover The DUST Requirement',
      description:
        'This flow shows the fallback when the app does not sponsor the action directly. Capacity Exchange prices the DUST requirement and lets the user satisfy it with tokens.',
    };
  }

  return {
    eyebrow: 'Compare Both Modes',
    title: 'Replay The System',
    description:
      'The playground lets you rerun both transaction models while keeping the underlying Midnight and Cardano activity visible.',
  };
}
