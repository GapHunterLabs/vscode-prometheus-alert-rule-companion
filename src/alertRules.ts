/**
 * Pure logic -- no `vscode` dependency. New niche (not a port from
 * the Kotlin catalog). Evidence: `pint` (Cloudflare) documents 37
 * real checks for Prometheus alert rules and is CLI-only (no editor
 * integration mentioned in its own docs); the one VS Code extension
 * with real PromQL language-server intelligence "isn't published on
 * the Extensions Marketplace yet" (confirmed by a separate search) --
 * published alternatives are syntax-highlighting only.
 *
 * v0.1 scope, honestly noted: a text-only structural subset of pint's
 * 37 checks (duplicate alert names, missing `for:`, missing
 * summary/description annotations, empty `expr:`) -- not full PromQL
 * parsing (pint's `promql/*` semantic checks like
 * "promql/impossible"/"promql/fragile" need a real PromQL grammar,
 * out of scope here). Hand-rolled indentation-aware line scanner for
 * the known Prometheus rule-group YAML shape, not a general YAML
 * parser -- same "small stable syntax, no library" technique used
 * elsewhere in this workstream.
 */

export interface AlertRule {
  name: string;
  line: number; // 1-based, the `- alert:` line
  hasExpr: boolean;
  hasFor: boolean;
  hasAnnotations: boolean;
}

const ALERT_LINE = /^(\s*)-\s*alert:\s*(.+?)\s*$/;
const EXPR_LINE = /^\s*expr:\s*(.*)$/;
const FOR_LINE = /^\s*for:\s*(.*)$/;
const ANNOTATIONS_LINE = /^\s*annotations:\s*(.*)$/;
const ANNOTATION_ENTRY = /^\s*(summary|description)\s*:/;

export function parseAlertRules(text: string): AlertRule[] {
  const rules: AlertRule[] = [];
  let current: AlertRule | null = null;
  let currentIndent = 0;
  let inAnnotations = false;
  let annotationsIndent = 0;

  text.split('\n').forEach((line, index) => {
    const alertMatch = ALERT_LINE.exec(line);
    if (alertMatch) {
      current = { name: alertMatch[2], line: index + 1, hasExpr: false, hasFor: false, hasAnnotations: false };
      currentIndent = alertMatch[1].length;
      inAnnotations = false;
      rules.push(current);
      return;
    }
    if (!current || line.trim() === '') return;

    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent <= currentIndent) {
      current = null; // dedented out of this rule's scope (new list item or exiting the list)
      return;
    }

    if (inAnnotations) {
      if (lineIndent <= annotationsIndent) {
        inAnnotations = false;
      } else if (ANNOTATION_ENTRY.test(line)) {
        current.hasAnnotations = true;
      }
    }

    const exprMatch = EXPR_LINE.exec(line);
    if (exprMatch) {
      current.hasExpr = exprMatch[1].trim() !== '';
      return;
    }
    const forMatch = FOR_LINE.exec(line);
    if (forMatch) {
      const value = forMatch[1].trim();
      current.hasFor = value !== '' && value !== '0s' && value !== '0m';
      return;
    }
    const annotationsMatch = ANNOTATIONS_LINE.exec(line);
    if (annotationsMatch) {
      inAnnotations = true;
      annotationsIndent = lineIndent;
      if (annotationsMatch[1].trim() !== '') current.hasAnnotations = true;
    }
  });

  return rules;
}

export interface Violation {
  kind: 'DUPLICATE_ALERT_NAME' | 'MISSING_FOR' | 'MISSING_ANNOTATIONS' | 'EMPTY_EXPR';
  line: number;
  message: string;
}

export function findViolations(rules: AlertRule[]): Violation[] {
  const violations: Violation[] = [];
  const seenNames = new Map<string, number>();

  for (const rule of rules) {
    const firstLine = seenNames.get(rule.name);
    if (firstLine !== undefined) {
      violations.push({
        kind: 'DUPLICATE_ALERT_NAME',
        line: rule.line,
        message: `Alert name "${rule.name}" is already used on line ${firstLine}.`,
      });
    } else {
      seenNames.set(rule.name, rule.line);
    }

    if (!rule.hasExpr) {
      violations.push({ kind: 'EMPTY_EXPR', line: rule.line, message: `Alert "${rule.name}" has no (or an empty) expr: -- this rule can never fire.` });
    }
    if (!rule.hasFor) {
      violations.push({
        kind: 'MISSING_FOR',
        line: rule.line,
        message: `Alert "${rule.name}" has no for: duration -- it can fire on a single scrape blip instead of a sustained condition.`,
      });
    }
    if (!rule.hasAnnotations) {
      violations.push({
        kind: 'MISSING_ANNOTATIONS',
        line: rule.line,
        message: `Alert "${rule.name}" has no summary/description annotation -- whoever gets paged has no context.`,
      });
    }
  }

  return violations;
}
