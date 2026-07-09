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

export function cpmStartToDate(earliestStart: number, projectStart: Date, holidays: Date[]): Date {
  return addWorkingDays(projectStart, earliestStart, holidays)
}

export function cpmFinishToDate(earliestStart: number, earliestFinish: number, projectStart: Date, holidays: Date[]): Date {
  // The "-1" converts a working-day count to a 0-indexed offset, valid only
  // when at least 1 day was consumed (duration >= 1, so earliestFinish >
  // earliestStart). For a zero-duration milestone, earliestFinish equals
  // earliestStart, and the plain "-1" would land one working day BEFORE the
  // start date. Clamping to earliestStart makes a milestone's finish date
  // equal its start date instead.
  return addWorkingDays(projectStart, Math.max(earliestFinish - 1, earliestStart), holidays)
}

function backwardPass(
  order: string[],
  nodeMap: Map<string, CpmNode>,
  successorsOf: Map<string, CpmDependency[]>,
  projectFinish: number
): void {
  const reverseOrder = [...order].reverse()
  for (const id of reverseOrder) {
    const node = nodeMap.get(id)!
    const succs = successorsOf.get(id) ?? []

    if (succs.length === 0) {
      node.latestFinish = projectFinish
      node.latestStart = node.latestFinish - node.duration
      continue
    }

    let lf = Infinity
    for (const dep of succs) {
      const succNode = nodeMap.get(dep.successorId)!
      if (dep.type === 'FS') {
        lf = Math.min(lf, succNode.latestStart - dep.lagDays)
      } else if (dep.type === 'SS') {
        lf = Math.min(lf, succNode.latestStart - dep.lagDays + node.duration)
      } else if (dep.type === 'FF') {
        lf = Math.min(lf, succNode.latestFinish - dep.lagDays)
      } else if (dep.type === 'SF') {
        lf = Math.min(lf, succNode.latestFinish - dep.lagDays + node.duration)
      }
    }
    node.latestFinish = lf
    node.latestStart = node.latestFinish - node.duration
  }
}

function buildCriticalPath(
  order: string[],
  nodeMap: Map<string, CpmNode>,
  dependencies: CpmDependency[]
): string[] {
  const criticalIds = new Set(order.filter((id) => nodeMap.get(id)!.isCritical))
  if (criticalIds.size === 0) return []

  const criticalEdges = new Map<string, string[]>()
  for (const id of Array.from(criticalIds)) criticalEdges.set(id, [])
  for (const dep of dependencies) {
    if (criticalIds.has(dep.predecessorId) && criticalIds.has(dep.successorId)) {
      criticalEdges.get(dep.predecessorId)!.push(dep.successorId)
    }
  }

  const hasIncoming = new Set<string>()
  for (const targets of Array.from(criticalEdges.values())) {
    for (const t of targets) hasIncoming.add(t)
  }
  const startCandidates = order.filter((id) => criticalIds.has(id) && !hasIncoming.has(id))
  const start = startCandidates[0]
  if (!start) return Array.from(criticalIds)

  const path: string[] = [start]
  let current = start
  const visited = new Set([start])
  while (true) {
    const nexts = (criticalEdges.get(current) ?? []).filter((n) => !visited.has(n))
    if (nexts.length === 0) break
    const next = nexts[0]
    path.push(next)
    visited.add(next)
    current = next
  }
  return path
}

/**
 * Run CPM for a full set of activities and dependencies in one location.
 * Pure — no DB access. See lib/cpm-runner.ts for the DB-aware wrapper.
 */
export function runCpm(
  activities: CpmActivity[],
  dependencies: CpmDependency[],
  projectStart: Date,
  holidays: Date[]
): CpmResult {
  const activityIds = activities.map((a) => a.id)
  const { hasCycle, cycleIds } = detectCycle(activityIds, dependencies)
  if (hasCycle) {
    return { nodes: new Map(), criticalPath: [], hasCycle: true, cycleIds }
  }

  const nodeMap = buildNodeMap(activities)
  const order = topologicalSort(activityIds, dependencies)
  const { predecessorsOf, successorsOf } = buildAdjacencyMaps(activityIds, dependencies)

  forwardPass(order, nodeMap, predecessorsOf, projectStart, holidays)

  let projectFinish = 0
  for (const node of Array.from(nodeMap.values())) {
    projectFinish = Math.max(projectFinish, node.earliestFinish)
  }

  backwardPass(order, nodeMap, successorsOf, projectFinish)

  for (const node of Array.from(nodeMap.values())) {
    node.totalFloat = node.latestStart - node.earliestStart
    node.isCritical = node.totalFloat === 0
  }

  const criticalPath = buildCriticalPath(order, nodeMap, dependencies)

  return { nodes: nodeMap, criticalPath, hasCycle: false, cycleIds: [] }
}
