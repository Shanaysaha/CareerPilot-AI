import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// Load a page's API data and provide consistent loading, error, and refresh state.
export function useRemote(path, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api(path, options)); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refresh: load, setData };
}

// Format API timestamps in a friendly local date and time.
export function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Not available" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
