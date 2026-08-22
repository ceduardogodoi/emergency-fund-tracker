import { compareDates, type CalendarDate } from '@/domain/dates/calendar-date'
import { notFoundError } from '@/domain/errors/app-error'
import type { Goal, GoalChange, GoalChangeInput, GoalInput } from '@/domain/goal/types'
import type {
  DateRange,
  LedgerEntry,
  LedgerEntryInput,
  LedgerEntryPatch,
  MilestoneThreshold,
} from '@/domain/ledger/types'
import type { Clock } from '@/domain/ports/clock'
import type { IdGenerator } from '@/domain/ports/id-generator'
import type {
  GoalRepository,
  LedgerRepository,
  MilestoneRepository,
  ProfileRepository,
  Repositories,
  ReminderRepository,
} from '@/domain/ports/repositories'
import type { Profile, ProfileInput } from '@/domain/profile/types'
import type { ReminderSetting } from '@/domain/reminders/types'
import { err, ok, type Result } from '@/domain/result'

/**
 * Array-backed repositories for tests that are about a rule, not about SQL.
 *
 * Hand-written rather than mocked, deliberately: a fake that implements the interface
 * stops compiling when the interface changes, where a mock would keep returning whatever
 * it was told to and quietly test a contract that no longer exists.
 *
 * They are not a second implementation to keep in step with SQLite. Anything whose
 * correctness depends on storage — ordering, constraints, transactions — is tested
 * against the real engine through the sqlite harness instead.
 */

/** The single profile row, held in a field instead of a table. */
export class InMemoryProfileRepository implements ProfileRepository {
  private stored: Profile | null = null

  public constructor(private readonly clock: Clock) {}

  public async get(): Promise<Result<Profile | null>> {
    return ok(this.stored)
  }

  public async save(profile: ProfileInput): Promise<Result<Profile>> {
    const saved: Profile = {
      ...profile,
      createdAt: this.stored?.createdAt ?? this.clock.now(),
      updatedAt: this.clock.now(),
    }
    this.stored = saved
    return ok(saved)
  }
}

/** The single goal row and its append-only change log. */
export class InMemoryGoalRepository implements GoalRepository {
  private stored: Goal | null = null
  private readonly changes: GoalChange[] = []

  public constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async get(): Promise<Result<Goal | null>> {
    return ok(this.stored)
  }

  public async save(goal: GoalInput): Promise<Result<Goal>> {
    const saved: Goal = {
      ...goal,
      createdAt: this.stored?.createdAt ?? this.clock.now(),
      updatedAt: this.clock.now(),
    }
    this.stored = saved
    return ok(saved)
  }

  public async recordChange(change: GoalChangeInput): Promise<Result<void>> {
    this.changes.push({ ...change, id: this.ids.uuid(), changedAt: this.clock.now() })
    return ok(undefined)
  }

  public async listChanges(): Promise<Result<readonly GoalChange[]>> {
    return ok([...this.changes])
  }
}

/** The ledger, kept in insertion order and sorted on the way out. */
export class InMemoryLedgerRepository implements LedgerRepository {
  private readonly entries: LedgerEntry[] = []

  public constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  public async add(entry: LedgerEntryInput): Promise<Result<LedgerEntry>> {
    const created: LedgerEntry = {
      ...entry,
      id: this.ids.uuid(),
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    }
    this.entries.push(created)
    return ok(created)
  }

  public async update(id: string, patch: LedgerEntryPatch): Promise<Result<LedgerEntry>> {
    const index = this.entries.findIndex((entry) => entry.id === id)
    const existing = this.entries[index]
    if (existing === undefined) {
      return err(notFoundError('ledger-entry'))
    }
    const updated = this.applyPatch(existing, patch)
    this.entries[index] = updated
    return ok(updated)
  }

  public async remove(id: string): Promise<Result<void>> {
    const index = this.entries.findIndex((entry) => entry.id === id)
    if (index === -1) {
      return err(notFoundError('ledger-entry'))
    }
    this.entries.splice(index, 1)
    return ok(undefined)
  }

  public async getById(id: string): Promise<Result<LedgerEntry | null>> {
    return ok(this.entries.find((entry) => entry.id === id) ?? null)
  }

  public async list(range?: DateRange): Promise<Result<readonly LedgerEntry[]>> {
    const matching =
      range === undefined ? [...this.entries] : this.entries.filter((e) => inRange(e, range))
    return ok(matching.sort(byDateThenCreation))
  }

  public async listFutureDated(today: CalendarDate): Promise<Result<readonly LedgerEntry[]>> {
    const future = this.entries.filter((entry) => compareDates(entry.date, today) > 0)
    return ok(future.sort(byDateThenCreation))
  }

  /**
   * Merges an edit, distinguishing "not supplied" from "set to null".
   *
   * `note` and `withdrawalReason` are both nullable, so `??` would silently treat clearing
   * a note as leaving it alone — the one bug this method exists to not have.
   */
  private applyPatch(existing: LedgerEntry, patch: LedgerEntryPatch): LedgerEntry {
    return {
      ...existing,
      amount: patch.amount === undefined ? existing.amount : patch.amount,
      date: patch.date === undefined ? existing.date : patch.date,
      note: patch.note === undefined ? existing.note : patch.note,
      withdrawalReason:
        patch.withdrawalReason === undefined ? existing.withdrawalReason : patch.withdrawalReason,
      updatedAt: this.clock.now(),
    }
  }
}

/** The reminder schedule, disabled until the user turns it on (FR-034). */
export class InMemoryReminderRepository implements ReminderRepository {
  private stored: ReminderSetting = {
    enabled: false,
    frequency: 'monthly',
    dayOfMonth: 1,
    dayOfWeek: null,
    timeOfDay: '09:00',
  }

  public async get(): Promise<Result<ReminderSetting>> {
    return ok(this.stored)
  }

  public async save(setting: ReminderSetting): Promise<Result<ReminderSetting>> {
    this.stored = setting
    return ok(setting)
  }
}

/** Which milestones have been announced, so each fires once per crossing (FR-024). */
export class InMemoryMilestoneRepository implements MilestoneRepository {
  private readonly acknowledged = new Set<MilestoneThreshold>()

  public async listAcknowledged(): Promise<Result<readonly MilestoneThreshold[]>> {
    return ok([...this.acknowledged].sort((left, right) => left - right))
  }

  public async acknowledge(threshold: MilestoneThreshold): Promise<Result<void>> {
    this.acknowledged.add(threshold)
    return ok(undefined)
  }

  public async clearAbove(percent: number): Promise<Result<void>> {
    for (const threshold of this.acknowledged) {
      if (threshold > percent) {
        this.acknowledged.delete(threshold)
      }
    }
    return ok(undefined)
  }
}

/**
 * Builds the full set, sharing one clock and one id source across all of them.
 *
 * Sharing matters: a test that writes a goal change and a ledger entry expects their ids
 * to come from the same sequence, the way they do when the composition root wires the
 * real thing.
 */
export function createInMemoryRepositories(clock: Clock, ids: IdGenerator): Repositories {
  return {
    profile: new InMemoryProfileRepository(clock),
    goal: new InMemoryGoalRepository(clock, ids),
    ledger: new InMemoryLedgerRepository(clock, ids),
    reminders: new InMemoryReminderRepository(),
    milestones: new InMemoryMilestoneRepository(),
  }
}

/** True when the entry falls inside the range, both bounds inclusive. */
function inRange(entry: LedgerEntry, range: DateRange): boolean {
  return compareDates(entry.date, range.from) >= 0 && compareDates(entry.date, range.to) <= 0
}

/**
 * The ledger's canonical order: by date, then by creation so a single day's entries keep
 * the order they were added in.
 */
function byDateThenCreation(left: LedgerEntry, right: LedgerEntry): number {
  const byDate = compareDates(left.date, right.date)
  return byDate === 0 ? left.createdAt.localeCompare(right.createdAt) : byDate
}
