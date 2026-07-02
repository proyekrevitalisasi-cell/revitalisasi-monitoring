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
