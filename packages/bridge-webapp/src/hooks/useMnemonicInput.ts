import { useState, useRef, useEffect, useCallback } from 'react';

const WORD_COUNT = 24;
const CACHE_KEY = 'cached-mnemonic';

function loadCachedWords(): string[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = cached.split(' ');
      if (parsed.length === WORD_COUNT && parsed.every((w) => w.length > 0)) {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return Array(WORD_COUNT).fill('');
}

export function useMnemonicInput() {
  const [words, setWords] = useState<string[]>(loadCachedWords);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const setWord = useCallback((index: number, value: string) => {
    setWords((prev) => {
      const next = [...prev];
      next[index] = value.toLowerCase().trim();
      return next;
    });
  }, []);

  const pasteWords = useCallback((startIndex: number, text: string) => {
    const parsed = text.trim().split(/\s+/);
    if (parsed.length <= 1) {
      return false;
    }
    setWords((prev) => {
      const next = [...prev];
      for (let j = 0; j < Math.min(parsed.length, WORD_COUNT - startIndex); j++) {
        next[startIndex + j] = parsed[j].toLowerCase();
      }
      return next;
    });
    navigator.clipboard?.writeText('').catch(() => {});
    return true;
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = text.trim().split(/\s+/);
      if (parsed.length > 0) {
        setWords((prev) => {
          const next = [...prev];
          for (let i = 0; i < Math.min(parsed.length, WORD_COUNT); i++) {
            next[i] = parsed[i].toLowerCase();
          }
          return next;
        });
        await navigator.clipboard.writeText('');
      }
    } catch {
      // Clipboard access denied — user can type manually
    }
  }, []);

  const filledCount = words.filter((w) => w.length > 0).length;
  const allFilled = filledCount === WORD_COUNT;
  const mnemonic = words.join(' ');

  useEffect(() => {
    try {
      if (allFilled) {
        localStorage.setItem(CACHE_KEY, mnemonic);
      }
    } catch {
      // localStorage unavailable
    }
  }, [allFilled, mnemonic]);

  return {
    words,
    wordCount: WORD_COUNT,
    inputRefs,
    setWord,
    pasteWords,
    pasteFromClipboard,
    filledCount,
    allFilled,
    mnemonic,
  };
}
