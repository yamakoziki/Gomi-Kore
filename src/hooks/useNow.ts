import { useEffect, useState } from "react";

/**
 * Returns the current time, refreshed on an interval so the UI naturally
 * crosses the today/tomorrow (8:00) and midnight boundaries even if the user
 * leaves the tab open without any other interaction.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
