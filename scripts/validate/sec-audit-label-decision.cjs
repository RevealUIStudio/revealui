"use strict";
// sec-audit-label-decision.cjs — decides whether a PR's `sec-review:approved`
// clearance label must be REVOKED because the security audit is failing.
//
// The server-side companion to the harness sec-review audit gate: the harness
// gate withholds the label at apply time for commands run through a session;
// this catches the out-of-band case (label applied from a terminal, or an audit
// that goes red AFTER the label was added). Together they make the approval
// sign-off mean "the audit passed".
//
// CONSERVATIVE BY DESIGN: revokes ONLY on a definitive audit FAILURE, never on
// pending / missing / cancelled — so it cannot false-revoke a legitimate label
// during the audit's in-flight window (and merge is already blocked by the
// required checks in those states anyway). Deterministic: check conclusions
// only, no model (keeps ADR 2026-07-10 condition 4 — additive-to-CI — intact).
//
// It ALSO revokes when a live guardrail-2 REQUEST-CHANGES verdict stands against
// the label with no later resolving APPROVE (the revealui#1910 miss: the label was
// applied over an outstanding REQUEST-CHANGES). This makes the label un-stickable
// while a REQUEST-CHANGES is live, mirroring the audit-fail revoke.
//
// Pure `decide()` / `checkState()` are unit-tested; the thin CLI reads a JSON
// { checkRuns, labels, killSwitch, reviews, comments, prAuthor } from stdin and
// prints "revoke <reason>" or "skip <reason>" for the workflow to act on. Zero
// deps, zero authored regex.

const { evaluateGuardrail2 } = require("./guardrail2-verdict.cjs");

const REQUIRED_AUDIT_CHECKS = [
  "Security Gate",
  "CodeQL",
  "Secret Scanning (Gitleaks)",
  "Dependency Review",
];
const CLEAR_LABEL = "sec-review:approved";
const OVERRIDE_LABEL = "sec-audit-override";

// Definitive failures only. CANCELLED / SKIPPED / null are NOT here — a
// cancelled run is usually a superseded duplicate (fleet rule), and treating it
// as a failure would false-revoke.
const FAILING = new Set([
  "FAILURE",
  "TIMED_OUT",
  "ACTION_REQUIRED",
  "STARTUP_FAILURE",
  "ERROR",
]);

// checkRuns: array of { name, conclusion, status } (GitHub check-run shape).
// Returns "missing" | "failing" | "ok" | "pending" for one required check name.
function checkState(checkRuns, name) {
  const entries = (checkRuns || []).filter((c) => c && c.name === name);
  if (entries.length === 0) return "missing";
  if (entries.some((c) => FAILING.has(c.conclusion))) return "failing";
  if (entries.some((c) => c.conclusion === "SUCCESS")) return "ok";
  return "pending";
}

// Returns { action: "revoke" | "skip", reason: string }.
function decide(input) {
  const checkRuns = (input && input.checkRuns) || [];
  const labels = ((input && input.labels) || []).map((l) =>
    typeof l === "string" ? l : (l && l.name) || ""
  );
  const killSwitch = Boolean(input && input.killSwitch);

  if (killSwitch) {
    return { action: "skip", reason: "kill switch set (SEC_AUDIT_GATE_DISABLED)" };
  }
  const labelSet = new Set(labels);
  if (!labelSet.has(CLEAR_LABEL)) {
    return { action: "skip", reason: "no clearance label present" };
  }
  if (labelSet.has(OVERRIDE_LABEL)) {
    return { action: "skip", reason: `per-PR override label '${OVERRIDE_LABEL}' present` };
  }

  // A live guardrail-2 REQUEST-CHANGES verdict makes the clearance label invalid,
  // just like a failing audit does. Revoke it (revealui#1910).
  const verdict = evaluateGuardrail2({
    reviews: (input && input.reviews) || [],
    comments: (input && input.comments) || [],
    authorLogin: (input && input.prAuthor) || "",
  });
  if (verdict.status === "hold") {
    return {
      action: "revoke",
      reason: `live guardrail-2 REQUEST-CHANGES verdict (reviewer ${verdict.reviewer || "unknown"}, ${verdict.timestamp || "unknown time"})`,
    };
  }

  const failing = REQUIRED_AUDIT_CHECKS.filter(
    (n) => checkState(checkRuns, n) === "failing"
  );
  if (failing.length > 0) {
    return { action: "revoke", reason: `security audit failing: ${failing.join(", ")}` };
  }
  return { action: "skip", reason: "audit not failing (green or in-flight)" };
}

module.exports = {
  decide,
  checkState,
  REQUIRED_AUDIT_CHECKS,
  CLEAR_LABEL,
  OVERRIDE_LABEL,
};

// CLI: node sec-audit-label-decision.cjs  <  {"checkRuns":[...],"labels":[...],"killSwitch":false,"reviews":[...],"comments":[...],"prAuthor":"..."}
if (require.main === module) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => {
    raw += d;
  });
  process.stdin.on("end", () => {
    let input;
    try {
      input = JSON.parse(raw || "{}");
    } catch {
      // Fail-safe for the ACTION: on unparseable input, do NOT revoke.
      process.stdout.write("skip could-not-parse-input\n");
      return;
    }
    const { action, reason } = decide(input);
    process.stdout.write(`${action} ${reason}\n`);
  });
}
