import { addWorkingDays, workingDaysBetween } from '@/lib/calendar'

export type DepType = 'FS' | 'SS' | 'FF' | 'SF'

export interface CpmActivity {
  id: string
  duration: number
  dateLocked: boolean
  // Required (non-null) when dateLocked is true; ignored otherwise. Not in
  // the PRD's own CpmActivity snippet, but required to implement "use
  // existing date for locked activities" (PRD §8.3 step 3).
  lockedStartDate: Date | null
}

export interface CpmDependency {
  predecessorId: string
  successorId: string
  type: DepType
  lagDays: number
}

export interface CpmNode extends CpmActivity {
  earliestStart: number
  earliestFinish: number
  latestStart: number
  latestFinish: number
  totalFloat: number
  isCritical: boolean
}

export interface CpmResult {
  nodes: Map<string, CpmNode>
  criticalPath: string[]
  hasCycle: boolean
  cycleIds: string[]
}

export function detectCycle(
  activityIds: string[],
  dependencies: CpmDependency[]
): { hasCycle: boolean; cycleIds: string[] } {
  const adjacency = new Map<string, string[]>()
  for (const id of activityIds) adjacency.set(id, [])
  for (const dep of dependencies) {
    adjacency.get(dep.predecessorId)?.push(dep.successorId)
  }

  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const id of activityIds) color.set(id, WHITE)
  const stack: string[] = []
  let cycleIds: string[] = []
  let hasCycle = false

  function dfs(node: string) {
    if (hasCycle) return
    color.set(node, GRAY)
    stack.push(node)
    for (const next of adjacency.get(node) ?? []) {
      if (hasCycle) return
      const c = color.get(next)
      if (c === GRAY) {
        const idx = stack.indexOf(next)
        cycleIds = stack.slice(idx)
        hasCycle = true
        return
      }
      if (c === WHITE) dfs(next)
    }
    stack.pop()
    color.set(node, BLACK)
  }

  for (const id of activityIds) {
    if (hasCycle) break
    if (color.get(id) === WHITE) dfs(id)
  }

  return { hasCycle, cycleIds }
}

function topologicalSort(activityIds: string[], dependencies: CpmDependency[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  for (const id of activityIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }
  for (const dep of dependencies) {
    adjacency.get(dep.predecessorId)?.push(dep.successorId)
    inDegree.set(dep.successorId, (inDegree.get(dep.successorId) ?? 0) + 1)
  }

  const queue: string[] = activityIds.filter((id) => inDegree.get(id) === 0)
  const order: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    order.push(node)
    for (const next of adjacency.get(node) ?? []) {
      const newDegree = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, newDegree)
      if (newDegree === 0) queue.push(next)
    }
  }
  return order
}

function forwardPass(
  order: string[],
  nodeMap: Map<string, CpmNode>,
  predecessorsOf: Map<string, CpmDependency[]>,
  projectStart: Date,
  holidays: Date[]
): void {
  for (const id of order) {
    const node = nodeMap.get(id)!

    if (node.dateLocked && node.lockedStartDate) {
      node.earliestStart = workingDaysBetween(projectStart, node.lockedStartDate, holidays)
      node.earliestFinish = node.earliestStart + node.duration
      continue
    }

    const preds = predecessorsOf.get(id) ?? []
    let es = 0
    for (const dep of preds) {
      const predNode = nodeMap.get(dep.predecessorId)!
      // Every dependency type is translated into an ES lower bound for
      // `node`, then combined with a single max() — equivalent to PRD's
      // per-type running ES/EF accumulators, but also correct when a
      // successor has predecessors of mixed types (a case the PRD's
      // pseudocode doesn't spell out explicitly).
      if (dep.type === 'FS') {
        es = Math.max(es, predNode.earliestFinish + dep.lagDays)
      } else if (dep.type === 'SS') {
        es = Math.max(es, predNode.earliestStart + dep.lagDays)
      } else if (dep.type === 'FF') {
        es = Math.max(es, predNode.earliestFinish + dep.lagDays - node.duration)
      } else if (dep.type === 'SF') {
        es = Math.max(es, predNode.earliestStart + dep.lagDays - node.duration)
      }
    }
    node.earliestStart = es
    node.earliestFinish = es + node.duration
  }
}

function buildNodeMap(activities: CpmActivity[]): Map<string, CpmNode> {
  const nodeMap = new Map<string, CpmNode>()
  for (const activity of activities) {
    nodeMap.set(activity.id, {
      ...activity,
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: 0,
      latestFinish: 0,
      totalFloat: 0,
      isCritical: false,
    })
  }
  return nodeMap
}

function buildAdjacencyMaps(
  activityIds: string[],
  dependencies: CpmDependency[]
): { predecessorsOf: Map<string, CpmDependency[]>; successorsOf: Map<string, CpmDependency[]> } {
  const predecessorsOf = new Map<string, CpmDependency[]>()
  const successorsOf = new Map<string, CpmDependency[]>()
  for (const id of activityIds) {
    predecessorsOf.set(id, [])
    successorsOf.set(id, [])
  }
  for (const dep of dependencies) {
    predecessorsOf.get(dep.successorId)?.push(dep)
    successorsOf.get(dep.predecessorId)?.push(dep)
  }
  return { predecessorsOf, successorsOf }
}

// Exported only for Task 3's own tests. Task 5 replaces call sites with the
// full `runCpm`; this export is removed at the end of Task 5.
export function runForwardPassForTest(
  activities: CpmActivity[],
  dependencies: CpmDependency[]
): Map<string, CpmNode> {
  const activityIds = activities.map((a) => a.id)
  const nodeMap = buildNodeMap(activities)
  const order = topologicalSort(activityIds, dependencies)
  const { predecessorsOf } = buildAdjacencyMaps(activityIds, dependencies)
  forwardPass(order, nodeMap, predecessorsOf, new Date('2026-01-01'), [])
  return nodeMap
}

export function cpmStartToDate(earliestStart: number, projectStart: Date, holidays: Date[]): Date {
  return addWorkingDays(projectStart, earliestStart, holidays)
}

export function cpmFinishToDate(earliestFinish: number, projectStart: Date, holidays: Date[]): Date {
  return addWorkingDays(projectStart, earliestFinish - 1, holidays)
}

// Temporary test-only exports, same lifecycle as runForwardPassForTest —
// removed in Task 5 once runCpm supersedes them.
export const buildNodeMapForTest = buildNodeMap
export const topologicalSortForTest = topologicalSort
export const buildAdjacencyMapsForTest = buildAdjacencyMaps
export const forwardPassForTest = forwardPass
