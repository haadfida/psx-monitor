// Loads the seeded AI snapshot (public/data/ai-snapshot.json) once per page.
// Used directly in demo mode and as the fallback whenever a live call fails.

let snapshotPromise = null;

export function loadSnapshot() {
  if (!snapshotPromise) {
    snapshotPromise = fetch("/data/ai-snapshot.json")
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return snapshotPromise;
}

/** "19 Mar 2026" style label for a snapshot's generatedAt. */
export function formatSnapshotDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
