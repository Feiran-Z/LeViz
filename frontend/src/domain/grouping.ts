import type { Student } from './types';

export type GroupingMode = 'random' | 'constraints';

export interface GroupingOptions {
  groupCount: number;
  mode: GroupingMode;
  /** Seed makes generation reproducible; defaults to a random seed. */
  seed?: number;
}

export interface Group {
  id: string;
  name: string;
  studentIds: string[];
}

export type ViolationType = 'not-with' | 'together-with' | 'empty-group';

export interface GroupingViolation {
  type: ViolationType;
  message: string;
  studentIds: string[];
}

export interface GroupingResult {
  groups: Group[];
  violations: GroupingViolation[];
  satisfiedConstraints: number;
  totalConstraints: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function makeGroups(count: number): Group[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Group ${index + 1}`,
    studentIds: [],
  }));
}

function normalizedGroupCount(options: GroupingOptions): number {
  if (!Number.isFinite(options.groupCount)) return 1;
  return Math.max(1, Math.floor(options.groupCount));
}

function buildConstraintIndex(students: Student[]): {
  byId: Map<string, Student>;
  cannotShare: Map<string, Set<string>>;
  together: Map<string, Set<string>>;
} {
  const byId = new Map(students.map((student) => [student.id, student]));
  const cannotShare = new Map<string, Set<string>>();
  const together = new Map<string, Set<string>>();
  for (const student of students) {
    cannotShare.set(student.id, new Set());
    together.set(student.id, new Set());
  }
  for (const student of students) {
    for (const otherId of student.notWith) {
      if (!byId.has(otherId) || otherId === student.id) continue;
      cannotShare.get(student.id)?.add(otherId);
      cannotShare.get(otherId)?.add(student.id);
    }
    for (const otherId of student.togetherWith) {
      if (!byId.has(otherId) || otherId === student.id) continue;
      together.get(student.id)?.add(otherId);
      together.get(otherId)?.add(student.id);
    }
  }
  return { byId, cannotShare, together };
}

/** Union-find over togetherWith edges produces indivisible clusters. */
function buildClusters(
  students: Student[],
  together: Map<string, Set<string>>,
  random: () => number,
): string[][] {
  const parent = new Map<string, string>();
  for (const student of students) parent.set(student.id, student.id);

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) {
      const next = parent.get(root);
      if (!next) break;
      root = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  for (const [studentId, partners] of together) {
    for (const partnerId of partners) union(studentId, partnerId);
  }

  const buckets = new Map<string, string[]>();
  for (const student of students) {
    const root = find(student.id);
    const bucket = buckets.get(root) ?? [];
    bucket.push(student.id);
    buckets.set(root, bucket);
  }

  const clusters = [...buckets.values()];
  // Largest clusters first; shuffle within equal size for variety.
  return shuffle(clusters, random).sort((a, b) => b.length - a.length);
}

function groupHasConflict(group: Group, clusterIds: string[], cannotShare: Map<string, Set<string>>): boolean {
  for (const id of clusterIds) {
    const blocked = cannotShare.get(id);
    if (!blocked) continue;
    for (const member of group.studentIds) {
      if (blocked.has(member)) return true;
    }
  }
  return false;
}

function leastFull(groups: Group[], eligible: Group[]): Group | undefined {
  const pool = eligible.length > 0 ? eligible : groups;
  return [...pool].sort((a, b) => a.studentIds.length - b.studentIds.length)[0];
}

function generateConstraintGroups(students: Student[], groupCount: number, random: () => number): Group[] {
  const { cannotShare, together } = buildConstraintIndex(students);
  const groups = makeGroups(groupCount);
  const clusters = buildClusters(students, together, random);

  for (const cluster of clusters) {
    const compatible = groups.filter((group) => !groupHasConflict(group, cluster, cannotShare));
    const target = leastFull(groups, compatible);
    if (target) target.studentIds.push(...cluster);
  }

  // Local repair: swap singletons out of conflicting groups when the swap is clean.
  const groupOf = new Map<string, Group>();
  for (const group of groups) for (const id of group.studentIds) groupOf.set(id, group);

  const hasPartners = (id: string): boolean => (together.get(id)?.size ?? 0) > 0;
  const fits = (id: string, target: Group, swapOutId: string | null): boolean => {
    if (hasPartners(id)) return false;
    const blocked = cannotShare.get(id);
    if (blocked) {
      for (const member of target.studentIds) {
        if (member !== swapOutId && blocked.has(member)) return false;
      }
    }
    // The swapped-out student must also fit the source group.
    return true;
  };

  for (let pass = 0; pass < 4; pass += 1) {
    let improved = false;
    for (const id of students.map((student) => student.id)) {
      if (hasPartners(id)) continue;
      const current = groupOf.get(id);
      if (!current) continue;
      const blocked = cannotShare.get(id);
      if (!blocked) continue;
      const inConflict = current.studentIds.some((member) => member !== id && blocked.has(member));
      if (!inConflict) continue;

      let swap: { target: Group; otherId: string } | null = null;
      for (const candidate of groups) {
        if (candidate === current) continue;
        for (const otherId of candidate.studentIds) {
          if (!hasPartners(otherId) && fits(id, candidate, otherId) && fits(otherId, current, id)) {
            swap = { target: candidate, otherId };
            break;
          }
        }
        if (swap) break;
      }

      if (swap) {
        swap.target.studentIds = swap.target.studentIds.filter((member) => member !== swap.otherId);
        swap.target.studentIds.push(id);
        current.studentIds = current.studentIds.filter((member) => member !== id);
        current.studentIds.push(swap.otherId);
        groupOf.set(id, swap.target);
        groupOf.set(swap.otherId, current);
        improved = true;
      }
    }
    if (!improved) break;
  }

  return groups;
}

/**
 * Default group count for the Groups panel. Prefer one group per large seat
 * area (tables, stations, teams); otherwise aim for roughly four per group.
 * Never one group per individual chair.
 */
export function suggestGroupCount(rosterSize: number, groupAreaCount: number): number {
  if (rosterSize <= 0) return 2;
  const fallback = Math.max(2, Math.ceil(rosterSize / 4));
  const base = groupAreaCount > 0 ? groupAreaCount : fallback;
  return Math.max(1, Math.min(base, rosterSize));
}

export function generateGroups(students: Student[], options: GroupingOptions): GroupingResult {
  const groupCount = normalizedGroupCount(options);
  const random = mulberry32(options.seed ?? Math.floor(Math.random() * 2 ** 32));

  let groups: Group[];
  if (options.mode === 'random') {
    groups = makeGroups(groupCount);
    const order = shuffle(students, random);
    order.forEach((student, index) => {
      groups[index % groupCount]?.studentIds.push(student.id);
    });
  } else {
    groups = generateConstraintGroups(students, groupCount, random);
  }

  const violations = validateAssignment(students, groups);
  const { satisfiedConstraints, totalConstraints } = constraintCounts(students, groups);
  return { groups, violations, satisfiedConstraints, totalConstraints };
}

function constraintCounts(students: Student[], groups: Group[]): {
  satisfiedConstraints: number;
  totalConstraints: number;
} {
  const groupOf = new Map<string, Group>();
  for (const group of groups) for (const id of group.studentIds) groupOf.set(id, group);
  const byId = new Map(students.map((student) => [student.id, student]));
  let total = 0;
  let satisfied = 0;
  const seen = new Set<string>();
  for (const student of students) {
    for (const otherId of student.notWith) {
      if (!byId.has(otherId) || otherId === student.id) continue;
      const key = ['not-with', ...[student.id, otherId].sort()].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      total += 1;
      if (groupOf.get(student.id)?.id !== groupOf.get(otherId)?.id) satisfied += 1;
    }
    for (const otherId of student.togetherWith) {
      if (!byId.has(otherId) || otherId === student.id) continue;
      const key = ['together-with', ...[student.id, otherId].sort()].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      total += 1;
      if (groupOf.get(student.id)?.id === groupOf.get(otherId)?.id) satisfied += 1;
    }
  }
  return { satisfiedConstraints: satisfied, totalConstraints: total };
}

export function validateAssignment(students: Student[], groups: Group[]): GroupingViolation[] {
  const byId = new Map(students.map((student) => [student.id, student]));
  const groupOf = new Map<string, Group>();
  for (const group of groups) for (const id of group.studentIds) groupOf.set(id, group);

  const violations: GroupingViolation[] = [];
  const seen = new Set<string>();
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  for (const student of students) {
    for (const otherId of student.notWith) {
      if (!byId.has(otherId) || otherId === student.id) continue;
      const key = ['not-with', ...[student.id, otherId].sort()].join(':');
      if (seen.has(key)) continue;
      const groupA = groupOf.get(student.id);
      const groupB = groupOf.get(otherId);
      if (groupA && groupB && groupA.id === groupB.id) {
        seen.add(key);
        violations.push({
          type: 'not-with',
          studentIds: [student.id, otherId],
          message: `${nameOf(student.id)} and ${nameOf(otherId)} should be apart but are both in ${groupA.name}.`,
        });
      }
    }
    for (const otherId of student.togetherWith) {
      if (!byId.has(otherId) || otherId === student.id) continue;
      const key = ['together-with', ...[student.id, otherId].sort()].join(':');
      if (seen.has(key)) continue;
      const groupA = groupOf.get(student.id);
      const groupB = groupOf.get(otherId);
      if ((groupA && groupB && groupA.id !== groupB.id) || (groupA && !groupB) || (!groupA && groupB)) {
        seen.add(key);
        violations.push({
          type: 'together-with',
          studentIds: [student.id, otherId],
          message: `${nameOf(student.id)} and ${nameOf(otherId)} should be together but are in different groups.`,
        });
      }
    }
  }

  for (const group of groups) {
    if (group.studentIds.length === 0) {
      violations.push({
        type: 'empty-group',
        studentIds: [],
        message: `${group.name} has no students.`,
      });
    }
  }

  return violations;
}
