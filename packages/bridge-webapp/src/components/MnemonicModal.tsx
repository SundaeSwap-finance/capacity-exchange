// TODO(SUNDAE-2355): Extract Modal backdrop/container into shared frontend package
import { useCallback, useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useMnemonicInput } from '../hooks/useMnemonicInput';
import { WordInput } from './WordInput';

interface MnemonicModalProps {
  onSubmit: (mnemonic: string) => void;
  onClose: () => void;
}

export function MnemonicModal({ onSubmit, onClose }: MnemonicModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { words, wordCount, inputRefs, setWord, pasteWords, pasteFromClipboard, filledCount, allFilled, mnemonic } =
    useMnemonicInput();

  useClickOutside(dialogRef, onClose, true);

  const handleSubmit = useCallback(() => {
    if (allFilled) {
      onSubmit(mnemonic);
    }
  }, [allFilled, mnemonic, onSubmit]);

  const setInputRef = useCallback(
    (i: number) => (el: HTMLInputElement | null) => {
      inputRefs.current[i] = el;
    },
    [inputRefs]
  );

  const handleAdvance = useCallback(
    (idx: number) => {
      inputRefs.current[idx + 1]?.focus();
    },
    [inputRefs]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-100">Enter Mnemonic Phrase</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-dark-200 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {words.map((word, i) => (
            <WordInput
              key={i}
              index={i}
              word={word}
              isLast={i === wordCount - 1}
              inputRef={setInputRef(i)}
              onChange={setWord}
              onPaste={pasteWords}
              onAdvance={handleAdvance}
              onSubmit={handleSubmit}
            />
          ))}
        </div>

        <p className="text-dark-500 text-xs mb-3">Pasting a mnemonic will clear your clipboard for security.</p>

        <div className="flex items-center justify-between">
          <button type="button" onClick={pasteFromClipboard} className="btn-sm text-xs">
            Paste from clipboard &amp; clear
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-sm">
              Cancel
            </button>
            <button type="button" disabled={!allFilled} onClick={handleSubmit} className="btn">
              Connect ({filledCount}/{wordCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
