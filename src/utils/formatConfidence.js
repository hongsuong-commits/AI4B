export function formatConfidenceDecimal(confidence) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return '—';

  return confidence.toFixed(2);
}

export function formatConfidencePercent(confidence) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return '—';
  return `${Number((confidence * 100).toFixed(2))}%`;
}
