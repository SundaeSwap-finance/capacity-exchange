import { useState, type FormEvent } from 'react';
import { NarrativeCard } from '../components/NarrativeCard';

const FORMSPREE_URL = 'https://formspree.io/f/xvzvqrrw';

interface DevAccessStepProps {
  onContinue: () => void;
}

export function DevAccessStep({ onContinue }: DevAccessStepProps) {
  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Build on the Capacity Exchange">
        <p>
          You&apos;ve seen how the Capacity Exchange removes DUST friction for end
          users. Imagine what that means for <strong className="text-ces-text">your</strong> app.
        </p>
        <p>
          We&apos;re opening early developer access. Tell us what you&apos;re building
          and we&apos;ll get you set up.
        </p>
      </NarrativeCard>

      <DevAccessForm />

      <button onClick={onContinue} className="ces-btn-ghost w-full">
        Skip to playground
      </button>
    </div>
  );
}

export function DevAccessForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('');
  const [project, setProject] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const message = `Hi! I'm building ${project} on Midnight, and I think the Capacity Exchange would be a great fit!`;

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, message }),
      });

      if (!res.ok) {
        throw new Error('Submission failed');
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`ces-card text-center ${compact ? 'py-4' : 'py-6'}`}>
        <div className="w-10 h-10 rounded-full bg-ces-accent/20 flex items-center justify-center mx-auto mb-2">
          <svg
            className="w-5 h-5 text-ces-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-ces-text font-display font-semibold">We&apos;ll be in touch!</p>
        <p className="mt-1 text-xs text-ces-text-muted">Keep an eye on your inbox.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="ces-card ces-section-stack p-4">
      {compact && (
        <p className="text-xs text-ces-text-muted uppercase tracking-wider font-medium">
          Early Developer Access //
        </p>
      )}

      <div className="ces-compact-stack">
        <label className="text-xs text-ces-text-muted" htmlFor="dev-access-email">
          Email
        </label>
        <input
          id="dev-access-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 bg-ces-surface-raised border border-ces-border text-ces-text text-sm placeholder:text-ces-text-muted/40 focus:outline-none focus:border-ces-accent transition-colors"
        />
      </div>

      <div className="ces-compact-stack">
        <label className="text-xs text-ces-text-muted" htmlFor="dev-access-project">
          What are you building?
        </label>
        <textarea
          id="dev-access-project"
          required
          value={project}
          onChange={(e) => setProject(e.target.value)}
          placeholder="A privacy-preserving loyalty program..."
          rows={compact ? 2 : 3}
          className="w-full px-3 py-2 bg-ces-surface-raised border border-ces-border text-ces-text text-sm placeholder:text-ces-text-muted/40 focus:outline-none focus:border-ces-accent transition-colors resize-none"
        />
      </div>

      <p className="text-[10px] text-ces-text-muted/60 leading-relaxed">
        We&apos;ll send: &ldquo;Hi! I&apos;m building <span className="text-ces-text">{project || '...'}</span> on Midnight, and I think the Capacity Exchange would be a great fit!&rdquo;
      </p>

      {error && (
        <p className="text-xs text-ces-danger">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="ces-btn-primary w-full"
      >
        {submitting ? 'Sending...' : 'Sign Up for Early Access'}
      </button>
    </form>
  );
}
