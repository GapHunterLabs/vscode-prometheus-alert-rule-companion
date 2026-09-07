import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAlertRules, findViolations } from '../alertRules';

const GOOD_RULE = `groups:
  - name: example
    rules:
      - alert: HighRequestLatency
        expr: job:request_latency_seconds:mean5m{job="myjob"} > 0.5
        for: 10m
        labels:
          severity: page
        annotations:
          summary: High request latency
          description: 95th percentile latency is above 0.5s
`;

test('parseAlertRules reads a well-formed rule', () => {
  const rules = parseAlertRules(GOOD_RULE);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].name, 'HighRequestLatency');
  assert.equal(rules[0].hasExpr, true);
  assert.equal(rules[0].hasFor, true);
  assert.equal(rules[0].hasAnnotations, true);
});

test('parseAlertRules reads multiple rules in the same group', () => {
  const text = [GOOD_RULE.trimEnd(), '      - alert: DiskFull', '        expr: disk_free < 0.1', '        for: 5m'].join('\n');
  const rules = parseAlertRules(text);
  assert.equal(rules.length, 2);
  assert.equal(rules[1].name, 'DiskFull');
  assert.equal(rules[1].hasAnnotations, false);
});

test('parseAlertRules detects a missing for:', () => {
  const text = ['groups:', '  - name: g', '    rules:', '      - alert: NoFor', '        expr: up == 0'].join('\n');
  const rules = parseAlertRules(text);
  assert.equal(rules[0].hasFor, false);
});

test('parseAlertRules treats for: 0s as not really set (fires instantly)', () => {
  const text = ['      - alert: X', '        expr: up == 0', '        for: 0s'].join('\n');
  const rules = parseAlertRules(text);
  assert.equal(rules[0].hasFor, false);
});

test('parseAlertRules detects an empty expr:', () => {
  const text = ['      - alert: X', '        expr:', '        for: 5m'].join('\n');
  const rules = parseAlertRules(text);
  assert.equal(rules[0].hasExpr, false);
});

test('parseAlertRules detects missing annotations entirely', () => {
  const text = ['      - alert: X', '        expr: up == 0', '        for: 5m', '        labels:', '          severity: page'].join('\n');
  const rules = parseAlertRules(text);
  assert.equal(rules[0].hasAnnotations, false);
});

test('parseAlertRules stops attributing fields once dedented past the rule', () => {
  const text = [
    '      - alert: A',
    '        expr: up == 0',
    '      - alert: B',
    '        expr: down == 0',
    '        for: 5m',
  ].join('\n');
  const rules = parseAlertRules(text);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].hasFor, false); // "for: 5m" belongs to B, not A
  assert.equal(rules[1].hasFor, true);
});

test('findViolations flags a duplicate alert name', () => {
  const text = ['      - alert: Dup', '        expr: a', '        for: 1m', '        annotations:', '          summary: x', '      - alert: Dup', '        expr: b', '        for: 1m', '        annotations:', '          summary: y'].join('\n');
  const rules = parseAlertRules(text);
  const violations = findViolations(rules);
  assert.ok(violations.some((v) => v.kind === 'DUPLICATE_ALERT_NAME'));
});

test('findViolations reports all 3 problems for a bare-bones rule', () => {
  const text = ['      - alert: Bare'].join('\n');
  const rules = parseAlertRules(text);
  const violations = findViolations(rules);
  const kinds = violations.map((v) => v.kind).sort();
  assert.deepEqual(kinds, ['EMPTY_EXPR', 'MISSING_ANNOTATIONS', 'MISSING_FOR']);
});

test('findViolations reports nothing for a fully well-formed rule', () => {
  const rules = parseAlertRules(GOOD_RULE);
  assert.deepEqual(findViolations(rules), []);
});
