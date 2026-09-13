import * as vscode from 'vscode';
import { parseAlertRules, findViolations } from './alertRules';
import { recordHit } from './reviewPrompt';

let diagnostics: vscode.DiagnosticCollection;

function isYamlFile(document: vscode.TextDocument): boolean {
  return document.uri.path.endsWith('.yml') || document.uri.path.endsWith('.yaml');
}

function refresh(context: vscode.ExtensionContext, document: vscode.TextDocument): void {
  if (!isYamlFile(document)) return;

  const rules = parseAlertRules(document.getText());
  if (rules.length === 0) {
    // Not a Prometheus alert-rule file (or no alerts in it) -- clear
    // any stale diagnostics rather than assume.
    diagnostics.delete(document.uri);
    return;
  }

  const violations = findViolations(rules);
  const result = violations.map((violation) => {
    const line = violation.line - 1;
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    const severity = violation.kind === 'EMPTY_EXPR' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
    const diagnostic = new vscode.Diagnostic(range, violation.message, severity);
    diagnostic.source = 'Prometheus Alert Rule Companion';
    diagnostic.code = violation.kind;
    recordHit(context, `${document.uri.toString()}:${line}`);
    return diagnostic;
  });
  diagnostics.set(document.uri, result);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('prometheusAlertRuleCompanion');
  context.subscriptions.push(diagnostics);

  vscode.workspace.textDocuments.forEach((doc) => refresh(context, doc));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => refresh(context, doc)),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(context, event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
