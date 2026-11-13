import { useEffect, useState } from 'react';

// Current time, refreshed every minute. Used for countdowns and for locking chats at their expiry.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
