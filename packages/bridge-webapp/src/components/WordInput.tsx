import { useCallback, type ChangeEvent, type KeyboardEvent, type ClipboardEvent } from 'react';

interface WordInputProps {
  index: number;
  word: string;
  isLast: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (index: number, value: string) => void;
  onPaste: (index: number, text: string) => boolean;
  onAdvance: (index: number) => void;
  onSubmit: () => void;
}

export function WordInput({ index, word, isLast, inputRef, onChange, onPaste, onAdvance, onSubmit }: WordInputProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange(index, e.target.value),
    [index, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (!e.shiftKey && !isLast) {
          onAdvance(index);
        }
      } else if (e.key === 'Tab') {
        if (!e.shiftKey && !isLast) {
          e.preventDefault();
          onAdvance(index);
        }
      } else if (e.key === 'Enter') {
        onSubmit();
      }
    },
    [index, isLast, onAdvance, onSubmit]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text');
      if (onPaste(index, text)) {
        e.preventDefault();
      }
    },
    [index, onPaste]
  );

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-dark-500 text-xs w-5 text-right shrink-0">{index + 1}.</span>
      <input
        ref={inputRef}
        type="text"
        value={word}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="w-full rounded border border-dark-600 bg-dark-900 px-2 py-1 text-xs text-dark-100 placeholder-dark-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder={`word ${index + 1}`}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  );
}
