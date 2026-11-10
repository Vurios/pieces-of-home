/**
 * Real loading progress for the loader. Each piece of work gets a weight;
 * the total is the weighted share of work done. Nothing is faked: a task
 * moves only when its work does.
 */
export interface ProgressTask {
  /** 0 to 1. Values never go backward. */
  set(fraction: number): void;
  done(): void;
  readonly finished: boolean;
}

export class BootProgress {
  private tasks: { weight: number; value: number; onDone?: () => void }[] = [];

  constructor(private report: (value: number) => void) {}

  task(weight: number, onDone?: () => void): ProgressTask {
    const entry: { weight: number; value: number; onDone?: () => void } = { weight, value: 0 };
    if (onDone) entry.onDone = onDone;
    this.tasks.push(entry);
    const self = this;
    return {
      set(fraction: number) {
        const next = Math.max(entry.value, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
        if (next === entry.value) return;
        const wasDone = entry.value >= 1;
        entry.value = next;
        self.report(self.value);
        if (!wasDone && next >= 1) entry.onDone?.();
      },
      done() {
        this.set(1);
      },
      get finished() {
        return entry.value >= 1;
      },
    };
  }

  get value(): number {
    const total = this.tasks.reduce((sum, t) => sum + t.weight, 0);
    if (total === 0) return 0;
    return this.tasks.reduce((sum, t) => sum + t.weight * t.value, 0) / total;
  }

  get complete(): boolean {
    return this.tasks.length > 0 && this.tasks.every((t) => t.value >= 1);
  }
}
