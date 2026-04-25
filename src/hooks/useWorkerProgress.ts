import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export const MILESTONES = [
  { job: 1,  bonus: 50,  badge: 'First Fix',    icon: '🔧', color: '#10B981', desc: 'First job done!' },
  { job: 5,  bonus: 100, badge: 'Live Wire',    icon: '⚡', color: '#3B82F6', desc: '5 jobs strong!' },
  { job: 10, bonus: 150, badge: 'Pro Worker',   icon: '🏅', color: '#F59E0B', desc: 'Double digits!' },
  { job: 20, bonus: 200, badge: 'Top Pro',      icon: '🌟', color: '#F47820', desc: 'Top of the platform!' },
  { job: 30, bonus: 300, badge: 'Elite',        icon: '🔥', color: '#EF4444', desc: 'Elite worker!' },
  { job: 40, bonus: 500, badge: 'Local Legend', icon: '👑', color: '#8B5CF6', desc: "Bobbili's best!" },
] as const

export type Milestone = typeof MILESTONES[number]
export type MilestoneRecord = { job: number; earnedAt: string }
export type MilestoneStatus = 'completed' | 'active' | 'locked'

export interface WorkerProgress {
  completedJobs: number
  qualifiedJobs: number           // jobs with rating >= 4 (counts toward milestones)
  currentBadge: Milestone | null
  nextMilestone: Milestone | null
  progressToNext: number          // 0–100 %
  earnedBonuses: number
  pendingBonuses: number
  milestoneStatuses: MilestoneStatus[]
  completedMilestonesData: MilestoneRecord[]
  justUnlocked: Milestone | null
  clearJustUnlocked: () => void
  progressPaused: boolean         // true if 3+ consecutive bad ratings
  consecutiveBadRatings: number
  resumeJobsNeeded: number        // 5-star jobs needed to resume (0 if not paused)
}

export function useWorkerProgress(workerId: string): WorkerProgress {
  const [completedJobs, setCompletedJobs] = useState(0)
  const [qualifiedJobs, setQualifiedJobs] = useState(0)
  const [consecutiveBadRatings, setConsecutiveBadRatings] = useState(0)
  const [resumeStars, setResumeStars] = useState(0) // 5-star jobs earned toward resume
  const [completedMilestonesData, setCompletedMilestonesData] = useState<MilestoneRecord[]>([])
  const [justUnlocked, setJustUnlocked] = useState<Milestone | null>(null)
  const initialisedRef = useRef(false)
  // Ref so the realtime callback always sees the latest completed milestones
  // without relying on localStorage (which can be cleared or differ across devices)
  const completedMilestonesRef = useRef<MilestoneRecord[]>([])

  useEffect(() => {
    if (!workerId) return

    loadData()

    const channel = supabase
      .channel(`worker-progress-${workerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          const n = payload.new as Record<string, unknown>
          const o = payload.old as Record<string, unknown>
          if (
            n.worker_id === workerId &&
            n.status === 'completed' &&
            o?.status !== 'completed'
          ) {
            const newCount = await fetchCount()
            const hit = MILESTONES.find((m) => m.job === newCount)
            if (hit) {
              // Use DB-backed ref instead of localStorage so this works across
              // devices and survives localStorage clears
              const alreadyEarned = completedMilestonesRef.current.some(m => m.job === hit.job)
              if (!alreadyEarned) {
                setJustUnlocked(hit)
                saveMilestone(hit)
              }
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId])

  async function loadData() {
    if (initialisedRef.current) return
    initialisedRef.current = true

    const [countRes, qualifiedRes, workerRes, recentRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .eq('status', 'completed'),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .eq('status', 'completed')
        .gte('rating', 4),
      supabase
        .from('workers')
        .select('completed_milestones, consecutive_bad_ratings, resume_stars')
        .eq('id', workerId)
        .single(),
      // Fetch last 3 rated orders to compute streak
      supabase
        .from('orders')
        .select('rating')
        .eq('worker_id', workerId)
        .eq('status', 'completed')
        .not('rating', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    const n = countRes.count ?? 0
    setCompletedJobs(n)
    setQualifiedJobs(qualifiedRes.count ?? 0)
    const records = (workerRes.data?.completed_milestones as MilestoneRecord[]) ?? []
    completedMilestonesRef.current = records
    setCompletedMilestonesData(records)
    setConsecutiveBadRatings(workerRes.data?.consecutive_bad_ratings ?? 0)
    setResumeStars(workerRes.data?.resume_stars ?? 0)
  }

  async function fetchCount(): Promise<number> {
    const [totalRes, qualRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .eq('status', 'completed'),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .eq('status', 'completed')
        .gte('rating', 4),
    ])
    const n = totalRes.count ?? 0
    const q = qualRes.count ?? 0
    setCompletedJobs(n)
    setQualifiedJobs(q)
    return q // milestones use qualified count
  }

  async function saveMilestone(milestone: Milestone) {
    const earnedAt = new Date().toISOString()
    const { data } = await supabase
      .from('workers')
      .select('completed_milestones')
      .eq('id', workerId)
      .single()
    const current = (data?.completed_milestones as MilestoneRecord[]) ?? []
    if (!current.find((m) => m.job === milestone.job)) {
      const updated = [...current, { job: milestone.job, earnedAt }]
      await supabase
        .from('workers')
        .update({ completed_milestones: updated })
        .eq('id', workerId)
      completedMilestonesRef.current = updated
      setCompletedMilestonesData(updated)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  // Progress paused if 3+ consecutive bad ratings — need 2 five-star jobs to resume
  const progressPaused = consecutiveBadRatings >= 3 && resumeStars < 2
  const resumeJobsNeeded = progressPaused ? Math.max(0, 2 - resumeStars) : 0

  // Milestones count only qualified (4+ rated) jobs
  const effectiveJobs = qualifiedJobs
  const completedList = MILESTONES.filter((m) => m.job <= effectiveJobs)
  const currentBadge = completedList[completedList.length - 1] ?? null
  const nextMilestone = (MILESTONES.find((m) => m.job > effectiveJobs) ?? null) as Milestone | null

  let progressToNext = 100
  if (nextMilestone) {
    const prevJob = currentBadge?.job ?? 0
    progressToNext = progressPaused ? 0 : Math.round(
      ((effectiveJobs - prevJob) / (nextMilestone.job - prevJob)) * 100
    )
  }

  const earnedBonuses = completedList.reduce((s, m) => s + m.bonus, 0)
  const pendingBonuses = MILESTONES.filter((m) => m.job > effectiveJobs).reduce(
    (s, m) => s + m.bonus,
    0
  )

  const milestoneStatuses: MilestoneStatus[] = MILESTONES.map((m) => {
    if (m.job <= effectiveJobs) return 'completed'
    if (m === nextMilestone)    return 'active'
    return 'locked'
  })

  function clearJustUnlocked() {
    setJustUnlocked(null)
  }

  return {
    completedJobs,
    qualifiedJobs,
    currentBadge,
    nextMilestone,
    progressToNext,
    earnedBonuses,
    pendingBonuses,
    milestoneStatuses,
    completedMilestonesData,
    justUnlocked,
    clearJustUnlocked,
    progressPaused,
    consecutiveBadRatings,
    resumeJobsNeeded,
  }
}
