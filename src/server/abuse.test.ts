import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAG_THRESHOLD, LIMITS, assessSuspicion, checkRateLimit, reportWeight, type SuspicionInput } from './abuse';

const now = new Date('2026-10-02T16:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const hilltop = { lat: 6.8688, lng: 7.4158 };

test('rate limit: 3 an hour, then says when the next one is allowed', () => {
  const ok = checkRateLimit({ userReports: [minsAgo(5), minsAgo(20)], ipReports: [], trust: 50, now });
  assert.equal(ok.ok, true);
  const blocked = checkRateLimit({ userReports: [minsAgo(5), minsAgo(20), minsAgo(50)], ipReports: [], trust: 50, now });
  assert.equal(blocked.ok, false);
  // Oldest in the window was 50 min ago, so 10 min to wait.
  assert.equal(!blocked.ok && blocked.retryAfterSec, 600);
});

test('rate limit: low trust gets one an hour; daily cap applies', () => {
  assert.equal(checkRateLimit({ userReports: [minsAgo(30)], ipReports: [], trust: 10, now }).ok, false);
  const day = Array.from({ length: LIMITS.perDay }, (_, i) => minsAgo(90 + i * 60));
  assert.equal(checkRateLimit({ userReports: day, ipReports: [], trust: 90, now }).ok, false);
});

test('rate limit: shared network cap', () => {
  const ip = Array.from({ length: LIMITS.ipPerHour }, (_, i) => minsAgo(i + 1));
  assert.equal(checkRateLimit({ userReports: [], ipReports: ip, trust: 50, now }).ok, false);
});

const base: SuspicionInput = {
  point: hilltop,
  device: { ...hilltop, accuracy: 20 },
  savedPlaces: [hilltop],
  accountAgeMinutes: 60 * 24 * 30,
  trust: 50,
  recent: [],
  areaSlug: 'hilltop',
  chosenArea: { distanceM: 0, radiusM: 450 },
  issue: 'no_power',
  recentLightBack: 0,
  now,
};

test('suspicion: an ordinary report is clean', () => {
  const s = assessSuspicion(base);
  assert.deepEqual(s.flags, []);
  assert.equal(s.flagged, false);
});

test('suspicion: reporting for a relative far away is noted but not flagged', () => {
  const s = assessSuspicion({ ...base, device: { lat: 6.83, lng: 7.37, accuracy: 15 } });
  assert.deepEqual(s.flags, ['device_far_from_pin']);
  assert.equal(s.flagged, false);
});

test('suspicion: hopping across town in minutes gets flagged', () => {
  const s = assessSuspicion({
    ...base,
    device: undefined,
    savedPlaces: [{ lat: 6.83, lng: 7.37 }],
    recent: [{ lat: 6.9, lng: 7.415, createdAt: minsAgo(3), areaSlug: 'obukpa' }],
  });
  assert.ok(s.flags.includes('impossible_travel'));
  assert.ok(s.flags.includes('far_from_saved_places'));
  assert.ok(s.score >= FLAG_THRESHOLD && s.flagged);
});

test('suspicion: implausible voltage and many areas', () => {
  const s = assessSuspicion({
    ...base,
    issue: 'low_voltage',
    voltage: 228,
    recent: [
      { lat: 6.851, lng: 7.3994, createdAt: minsAgo(300), areaSlug: 'ogige' },
      { lat: 6.8561, lng: 7.3927, createdAt: minsAgo(600), areaSlug: 'town' },
    ],
  });
  assert.ok(s.flags.includes('voltage_implausible'));
  assert.ok(s.flags.includes('many_areas'));
});

test('weight follows trust; flagged reports weigh nothing', () => {
  assert.equal(reportWeight(0, false), 0.5);
  assert.equal(reportWeight(100, false), 1.5);
  assert.equal(reportWeight(80, true), 0);
});
