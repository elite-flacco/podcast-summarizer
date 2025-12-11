export function formatDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDuration(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) {
    return 'Length unknown';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}
