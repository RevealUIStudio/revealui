/**
 * Receipt "print" entrance: the pure-CSS stagger that types each ledger line
 * onto a `ReceiptCard` in sequence, then breathes the integrity seal once.
 *
 * CSS-only by design (no JS timeline, no IntersectionObserver): the browser
 * runs the keyframes natively from first paint, so the effect works
 * identically with or without hydration. `--rvui-duration-slow` and
 * `--rvui-ease` come from `@revealui/tokens`; `--rvui-print-i` is the only
 * value a consumer sets, via inline style, per row.
 */

/** Delay, in ms, before the first line begins printing. */
export const RECEIPT_PRINT_START_DELAY_MS = 400;

/** Gap, in ms, between successive line entrances. */
export const RECEIPT_PRINT_STEP_MS = 420;

/** Applied to each `AuditLine` row's wrapper. */
export const RECEIPT_PRINT_LINE_CLASS = 'rvui-receipt-print-line';

/** Applied to the integrity footer. */
export const RECEIPT_PRINT_SEAL_CLASS = 'rvui-receipt-print-seal';

export const RECEIPT_PRINT_KEYFRAMES = `
@keyframes rvui-receipt-print {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes rvui-receipt-seal-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: var(--rvui-shadow-glow, 0 0 32px oklch(0.58 0.150 240 / 0.42)); }
}

.${RECEIPT_PRINT_LINE_CLASS} {
  opacity: 0;
  animation: rvui-receipt-print var(--rvui-duration-slow, 350ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
  animation-delay: calc(${RECEIPT_PRINT_START_DELAY_MS}ms + var(--rvui-print-i, 0) * ${RECEIPT_PRINT_STEP_MS}ms);
}

.${RECEIPT_PRINT_SEAL_CLASS} {
  opacity: 0;
  animation:
    rvui-receipt-print var(--rvui-duration-slow, 350ms) var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1)) both,
    rvui-receipt-seal-pulse 350ms var(--rvui-ease, cubic-bezier(0.22, 1, 0.36, 1)) 1 both;
  animation-delay:
    calc(${RECEIPT_PRINT_START_DELAY_MS}ms + var(--rvui-print-i, 0) * ${RECEIPT_PRINT_STEP_MS}ms),
    calc(${RECEIPT_PRINT_START_DELAY_MS}ms + var(--rvui-print-i, 0) * ${RECEIPT_PRINT_STEP_MS}ms + var(--rvui-duration-slow, 350ms));
}

@media (prefers-reduced-motion: reduce) {
  .${RECEIPT_PRINT_LINE_CLASS},
  .${RECEIPT_PRINT_SEAL_CLASS} {
    animation: none;
    opacity: 1;
    transform: none;
    box-shadow: none;
  }
}
`;
