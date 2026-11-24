// A row's risk flags: what a reader should watch before farming it. Every flag follows from the
// snapshot's own figures for that protocol — its TVL, its seven-day move, its age and how many
// chains it runs on — never from its name, and never from anything outside the snapshot.

import type { SnapshotProtocol } from './model.ts';

/** A single-chain protocol's concentration, a sharp fall, a very young listing, and the rest. */
export interface RiskFlag {
  /** Short label, shown as the flag's heading in the detail view. */
  label: string;
  /** One sentence, in plain words, saying what the figure means for a farmer. */
  detail: string;
}

/** TVL under this is small enough that one farmer's position moves the pool. */
const SMALL_TVL_USD = 10_000_000;
/** A seven-day fall at least this steep is a sharp move, not noise. */
const SHARP_FALL_PCT = -15;
/** A listing younger than this has barely any history to judge it by. */
const YOUNG_DAYS = 90;
/** An age past this with no token is a long wait, not a fresh launch. */
const OLD_DAYS = 1_095;

/** The flags one protocol carries, strongest first, at most four. */
export function riskFlags(p: SnapshotProtocol, ageDays: number | null, growthPct: number): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (growthPct <= SHARP_FALL_PCT) {
    flags.push({
      label: 'TVL falling fast',
      detail: `TVL is down ${Math.abs(growthPct).toFixed(1)}% over seven days: the protocol is shrinking while the board ranks it, so check why before you deposit.`,
    });
  }
  if (p.chains.length === 1) {
    flags.push({
      label: 'Single-chain',
      detail: `Everything runs on ${p.chains[0] ?? 'one chain'}: one chain's outage or bridge halt strands the whole position.`,
    });
  }
  if (ageDays !== null && ageDays < YOUNG_DAYS) {
    flags.push({
      label: 'Very young',
      detail: `Listed ${ageDays} day${ageDays === 1 ? '' : 's'} ago: there is barely any history to judge the protocol, its team or its staying power.`,
    });
  }
  if (ageDays === null) {
    flags.push({
      label: 'Listing date unknown',
      detail: 'The snapshot carries no listing date, so the model scores this protocol at 365 days: its age, and its maturity multiplier, are a guess.',
    });
  }
  if (ageDays !== null && ageDays >= OLD_DAYS) {
    flags.push({
      label: 'Long wait, no token',
      detail: `Running ${Math.floor(ageDays / 365)} years with no token: a launch may never come, however large the TVL.`,
    });
  }
  if (p.tvl_usd < SMALL_TVL_USD) {
    flags.push({
      label: 'Small pool',
      detail: `TVL under $10M: a single large deposit or withdrawal moves the pool, and exits can be thin.`,
    });
  }
  if (p.change_7d === null) {
    flags.push({
      label: 'No seven-day change',
      detail: 'The snapshot reports no seven-day TVL change, so the model scores growth at 0%: the number is a placeholder, not a reading.',
    });
  }
  return flags.slice(0, 4);
}
