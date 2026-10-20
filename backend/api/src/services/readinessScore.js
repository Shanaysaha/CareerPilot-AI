export function calculateReadiness(parts, weights, requiredEvidence) {
  // Re-scale weights over available evidence and hide scores until enough evidence exists.
  const evidenceCount = Object.values(parts).filter((score) => score !== null).length;
  const availableWeight = Object.entries(parts).reduce(
    (total, [key, score]) => total + (score === null ? 0 : Number(weights[key] || 0)),
    0,
  );
  const weightedTotal = Object.entries(parts).reduce(
    (total, [key, score]) => total + (score === null ? 0 : score * Number(weights[key] || 0)),
    0,
  );
  return {
    score: evidenceCount >= requiredEvidence && availableWeight > 0
      ? Math.round(weightedTotal / availableWeight)
      : null,
    evidenceCount,
    availableWeight,
  };
}
