import test from "node:test";
import assert from "node:assert/strict";
import { calculateReadiness } from "../src/services/readinessScore.js";

const weights = { resume: 0.25, skills: 0.25, interview: 0.2, coding: 0.15, aptitude: 0.15 };

test("readiness re-scales weights for available evidence", () => {
  const result = calculateReadiness(
    { resume: 80, skills: 100, interview: null, coding: null, aptitude: null },
    weights,
    2,
  );
  assert.equal(result.score, 90);
  assert.equal(result.evidenceCount, 2);
  assert.equal(result.availableWeight, 0.5);
});

test("readiness remains incomplete below the evidence minimum", () => {
  const result = calculateReadiness(
    { resume: 80, skills: 100, interview: null, coding: null, aptitude: null },
    weights,
    3,
  );
  assert.equal(result.score, null);
});

test("zero-weight evidence does not create a divide-by-zero score", () => {
  const result = calculateReadiness({ resume: 100 }, { resume: 0 }, 1);
  assert.equal(result.score, null);
});
