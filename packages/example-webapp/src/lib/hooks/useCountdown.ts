import { useState, useEffect } from 'react';
import { formatTimeRemaining } from '@capacity-exchange/midnight-core';

export function useCountdown(expiresAt: Date) {
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = formatTimeRemaining(expiresAt);
      setTimeRemaining(remaining);
      if (remaining === 'Expired') {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return { timeRemaining, isExpired: timeRemaining === 'Expired' };
}
