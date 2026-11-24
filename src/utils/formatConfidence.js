export function formatConfidenceDecimal(confidence) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return '—';

  const roundedToHundredth = confidence.toFixed(2);
  // Avoid making a real value below 1 look like a perfect prediction.
  return roundedToHundredth === '1.00' && confidence !== 1
    ? String(confidence)
    : roundedToHundredth;
}

export function formatConfidencePercent(confidence) {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return '—';
  return `${Number((confidence * 100).toFixed(2))}%`;
}
