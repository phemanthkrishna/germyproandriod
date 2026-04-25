import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { BottomNav } from '../../components/BottomNav'
import { useWorkerProgress, MILESTONES } from '../../hooks/useWorkerProgress'
import type { MilestoneRecord } from '../../hooks/useWorkerProgress'
import { Briefcase, DollarSign, User, History, Trophy, CheckCircle2, Lock } from 'lucide-react'

const NAV = [
  { to: '/worker',          icon: Briefcase,  label: 'Jobs'     },
  { to: '/worker/progress', icon: Trophy,     label: 'Progress', activeColor: '#F47820' },
  { to: '/worker/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/worker/history',  icon: History,    label: 'History'  },
  { to: '/worker/profile',  icon: User,       label: 'Profile'  },
]

interface BadgeModal {
  milestone: (typeof MILESTONES)[number]
  earnedAt?: string
}

export default function WorkerProgress() {
  const { session } = useAuth()
  const workerId = session?.id ?? ''

  const {
    completedJobs,
    qualifiedJobs,
    currentBadge,
    nextMilestone,
    progressToNext,
    earnedBonuses,
    pendingBonuses,
    milestoneStatuses,
    completedMilestonesData,
    progressPaused,
    resumeJobsNeeded,
  } = useWorkerProgress(workerId)

  const [animated, setAnimated] = useState(false)
  const [badgeModal, setBadgeModal] = useState<BadgeModal | null>(null)
  const [claimStatus, setClaimStatus] = useState<Record<number, 'pending' | 'paid'>>({})
  const [claimingJob, setClaimingJob] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!workerId) return
    supabase
      .from('bonus_claims')
      .select('milestone_job, status')
      .eq('worker_id', workerId)
      .then(({ data }) => {
        const map: Record<number, 'pending' | 'paid'> = {}
        ;(data || []).forEach((c: { milestone_job: number; status: string }) => {
          map[c.milestone_job] = c.status as 'pending' | 'paid'
        })
        setClaimStatus(map)
      })
  }, [workerId])

  async function collectBonus(m: typeof MILESTONES[number]) {
    if (claimStatus[m.job]) return
    setClaimingJob(m.job)
    const { error } = await supabase.from('bonus_claims').insert({
      worker_id: workerId,
      worker_name: session?.name ?? '',
      milestone_job: m.job,
      milestone_badge: m.badge,
      milestone_icon: m.icon,
      amount: m.bonus,
    })
    setClaimingJob(null)
    if (error && !error.message.includes('unique')) {
      toast.error('Could not submit claim, please try again')
      return
    }
    setClaimStatus(prev => ({ ...prev, [m.job]: 'pending' }))
    toast.success('Bonus will be credited to your account in 24 hours')
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="page-content px-4 py-6">

      {/* ── HERO CARD ─────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1A5FB8 0%, #F47820 100%)',
          borderRadius: 20,
          padding: '20px 20px 18px',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          {/* Left — job count */}
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>
              Your Progress
            </p>
            <p style={{ fontSize: 48, fontFamily: 'Nunito, sans-serif', fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 2 }}>
              {qualifiedJobs}
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>qualified jobs (4+ ★)</p>
          </div>

          {/* Right — current badge */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 6 }}>
              {currentBadge?.icon ?? '🔧'}
            </div>
            <p style={{ fontSize: 16, fontFamily: 'Nunito, sans-serif', fontWeight: 800, color: '#fff' }}>
              {currentBadge?.badge ?? 'No Badge Yet'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Current Badge</p>
          </div>
        </div>

        {/* Progress bar to next */}
        {nextMilestone ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                Next: {nextMilestone.badge} at Job {nextMilestone.job}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                {nextMilestone.job - qualifiedJobs} more jobs
              </p>
            </div>
            <div style={{ height: 8, borderRadius: 20, background: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 20,
                  background: '#fff',
                  width: animated ? `${progressToNext}%` : '0%',
                  transition: 'width 1s ease',
                  minWidth: progressToNext > 0 ? 8 : 0,
                }}
              />
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)', fontWeight: 700, textAlign: 'center', paddingTop: 4 }}>
            🎉 All milestones completed — you're a Local Legend!
          </p>
        )}
      </div>

      {/* ── PROGRESS PAUSED WARNING ─────────────────────────────── */}
      {progressPaused && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
          <p style={{ color: '#EF4444', fontWeight: 800, fontSize: 14, marginBottom: 4 }}>⚠️ Progress Paused</p>
          <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
            You received 3 low ratings in a row. Get <strong style={{ color: '#F59E0B' }}>{resumeJobsNeeded} more 5-star job{resumeJobsNeeded > 1 ? 's' : ''}</strong> to resume your progress.
          </p>
        </div>
      )}

      {/* ── SECTION HEADING ───────────────────────────────────────── */}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>
        Your Journey
      </p>

      {/* ── MILESTONE TIMELINE ────────────────────────────────────── */}
      <div>
        {MILESTONES.map((m, i) => {
          const status      = milestoneStatuses[i]
          const isCompleted = status === 'completed'
          const isActive    = status === 'active'
          const isLocked    = status === 'locked'
          const isLast      = i === MILESTONES.length - 1

          const isOfficial  = 'isOfficialPartner' in m && m.isOfficialPartner
          const cardBg      = isOfficial && isCompleted ? '#FFF7ED'
                            : isOfficial && isActive    ? '#FFF3E6'
                            : isCompleted               ? '#F0FDF4'
                            : isActive                  ? '#FFF7ED'
                            : '#FAFAFA'
          const borderColor = isOfficial ? '#F47820'
                            : isCompleted ? '#10B981'
                            : isActive    ? '#F47820'
                            : '#E5E7EB'
          const lineColor   = isCompleted ? '#10B981' : isActive ? '#F47820' : '#E5E7EB'
          const isDashed    = isLocked

          // Inner mini progress bar for active milestone
          const prevJob   = i > 0 ? MILESTONES[i - 1].job : 0
          const activePct = isActive
            ? Math.round(((completedJobs - prevJob) / (m.job - prevJob)) * 100)
            : 0

          const earnedRecord: MilestoneRecord | undefined = completedMilestonesData.find(
            (r) => r.job === m.job
          )

          return (
            <div
              key={m.job}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}
            >
              {/* Left column: icon circle + connector line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
                {/* Icon circle */}
                <div
                  role={isCompleted ? 'button' : undefined}
                  onClick={() => isCompleted && setBadgeModal({ milestone: m, earnedAt: earnedRecord?.earnedAt })}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: isLocked ? '#F3F4F6' : `${m.color}22`,
                    border: `2px solid ${isLocked ? '#E5E7EB' : m.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    cursor: isCompleted ? 'pointer' : 'default',
                    filter: isLocked ? 'grayscale(1) opacity(0.5)' : 'none',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {m.icon}
                  {/* Pulsing ring on active */}
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: -5,
                        borderRadius: '50%',
                        border: '2px solid #F47820',
                        animation: 'dot-pulse 2s ease-in-out infinite',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>

                {/* Connector line to next card */}
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 20,
                      marginTop: 3,
                      marginBottom: 3,
                      background: isDashed
                        ? 'repeating-linear-gradient(to bottom, #E5E7EB 0, #E5E7EB 5px, transparent 5px, transparent 10px)'
                        : lineColor,
                    }}
                  />
                )}
              </div>

              {/* Milestone card */}
              <div
                role={isCompleted ? 'button' : undefined}
                onClick={() => isCompleted && setBadgeModal({ milestone: m, earnedAt: earnedRecord?.earnedAt })}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: '12px 12px 12px 14px',
                  background: cardBg,
                  borderLeft: `4px solid ${borderColor}`,
                  marginBottom: isLast ? 24 : 16,
                  cursor: isCompleted ? 'pointer' : 'default',
                  boxShadow: isActive ? '0 0 0 2px #F47820' : 'none',
                  position: 'relative',
                  opacity: isLocked ? 0.65 : 1,
                }}
              >
                {/* Pulsing dot top-right for active */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#F47820',
                      animation: 'dot-pulse 2s ease-in-out infinite',
                    }}
                  />
                )}

                {/* GMP Official Partner banner */}
                {'isOfficialPartner' in m && m.isOfficialPartner && !isLocked && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'linear-gradient(90deg, #F47820, #F59E0B)',
                    borderRadius: 999, padding: '2px 10px', marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 11 }}>🏆</span>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>
                      GMP Official Partner
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badge name */}
                    <p
                      style={{
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: isLocked ? 700 : 800,
                        fontSize: 15,
                        color: isLocked ? '#9CA3AF' : '#0F172A',
                        marginBottom: 3,
                      }}
                    >
                      {m.badge}
                    </p>

                    {isCompleted && (
                      <>
                        <p style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>
                          Job {m.job} — Completed!
                        </p>
                        {/* GMP Official Partner special completed state */}
                        {'isOfficialPartner' in m && m.isOfficialPartner ? (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF7ED', color: '#F47820', border: '1px solid #F47820', borderRadius: 999, padding: '2px 8px' }}>
                                🎽 Uniform Issued
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#3B82F6', border: '1px solid #3B82F6', borderRadius: 999, padding: '2px 8px' }}>
                                🪪 ID Card Issued
                              </span>
                            </div>
                            {m.bonus > 0 && (
                              claimStatus[m.job] === 'paid' ? (
                                <p style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>✓ {fmt(m.bonus)} Bonus Credited</p>
                              ) : claimStatus[m.job] === 'pending' ? (
                                <p style={{ fontSize: 11, color: '#F59E0B' }}>⏳ {fmt(m.bonus)} credit pending (24 hrs)</p>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); collectBonus(m) }}
                                  disabled={claimingJob === m.job}
                                  style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: '#F47820', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: claimingJob === m.job ? 'default' : 'pointer', opacity: claimingJob === m.job ? 0.6 : 1 }}
                                >
                                  {claimingJob === m.job ? 'Requesting…' : `Collect ₹${m.bonus} Bonus`}
                                </button>
                              )
                            )}
                          </div>
                        ) : (
                          <>
                            {m.bonus > 0 && <p style={{ fontSize: 11, color: '#10B981', marginTop: 1 }}>{fmt(m.bonus)} bonus earned</p>}
                            {m.bonus > 0 && (
                              claimStatus[m.job] === 'paid' ? (
                                <p style={{ fontSize: 11, color: '#10B981', fontWeight: 700, marginTop: 5 }}>✓ Bonus Credited</p>
                              ) : claimStatus[m.job] === 'pending' ? (
                                <p style={{ fontSize: 11, color: '#F59E0B', marginTop: 5 }}>⏳ Credit pending (24 hrs)</p>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); collectBonus(m) }}
                                  disabled={claimingJob === m.job}
                                  style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#fff', background: '#10B981', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: claimingJob === m.job ? 'default' : 'pointer', opacity: claimingJob === m.job ? 0.6 : 1 }}
                                >
                                  {claimingJob === m.job ? 'Requesting…' : 'Collect Bonus'}
                                </button>
                              )
                            )}
                          </>
                        )}
                      </>
                    )}

                    {isActive && (
                      <>
                        <p style={{ fontSize: 12, color: '#F47820', fontWeight: 600 }}>
                          Job {m.job} — {m.job - completedJobs} more job{m.job - completedJobs !== 1 ? 's' : ''} to go!
                        </p>
                        {'isOfficialPartner' in m && m.isOfficialPartner ? (
                          <div style={{ marginTop: 4 }}>
                            <p style={{ fontSize: 11, color: '#F47820', fontWeight: 700 }}>
                              🎽 Unlock your GMP Uniform &amp; ID Card!
                            </p>
                            {m.bonus > 0 && <p style={{ fontSize: 11, color: '#F47820', marginTop: 1 }}>+ {fmt(m.bonus)} cash bonus</p>}
                          </div>
                        ) : (
                          m.bonus > 0 && (
                            <p style={{ fontSize: 11, color: '#F47820', fontWeight: 700, marginTop: 1 }}>
                              {fmt(m.bonus)} bonus waiting!
                            </p>
                          )
                        )}
                      </>
                    )}

                    {isLocked && (
                      <>
                        <p style={{ fontSize: 12, color: '#9CA3AF' }}>Job {m.job}</p>
                        {'isOfficialPartner' in m && m.isOfficialPartner ? (
                          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>🎽 Uniform + 🪪 ID Card{m.bonus > 0 ? ` + ${fmt(m.bonus)}` : ''}</p>
                        ) : (
                          m.bonus > 0 && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{fmt(m.bonus)} bonus</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right status */}
                  {isCompleted && (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#10B981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={16} color="#fff" />
                    </div>
                  )}
                  {isLocked && (
                    <Lock size={18} color="#D1D5DB" style={{ flexShrink: 0 }} />
                  )}
                </div>

                {/* Inner progress bar for active */}
                {isActive && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 6, borderRadius: 20, background: '#E5E7EB', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 20,
                          background: 'linear-gradient(90deg, #F47820 0%, #F59E0B 100%)',
                          width: animated ? `${activePct}%` : '0%',
                          transition: 'width 1.2s ease',
                          minWidth: activePct > 0 ? 6 : 0,
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, textAlign: 'right' }}>
                      {completedJobs - prevJob} / {m.job - prevJob} jobs
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── BONUS SUMMARY ─────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: 16,
          background: '#F8FAFC',
          border: '1px solid #E5E7EB',
          padding: '16px',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Bonuses Earned
            </p>
            <p style={{ fontSize: 22, fontFamily: 'Nunito, sans-serif', fontWeight: 900, color: '#10B981' }}>
              {fmt(earnedBonuses)}
            </p>
          </div>
          <div style={{ width: 1, background: '#E5E7EB' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Bonuses Waiting
            </p>
            <p style={{ fontSize: 22, fontFamily: 'Nunito, sans-serif', fontWeight: 900, color: '#F47820' }}>
              {fmt(pendingBonuses)}
            </p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.5 }}>
          Complete all 50 jobs to earn {fmt(800)} in bonuses + GMP Uniform &amp; ID Card — on top of your regular job income
        </p>
      </div>

      {/* ── BADGE DETAIL MODAL ────────────────────────────────────── */}
      {badgeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            padding: '0 24px',
          }}
          onClick={() => setBadgeModal(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '28px 20px 24px',
              width: '100%',
              maxWidth: 320,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 56, marginBottom: 8 }}>{badgeModal.milestone.icon}</div>
            <p
              style={{
                fontSize: 20,
                fontFamily: 'Nunito, sans-serif',
                fontWeight: 900,
                color: badgeModal.milestone.color,
                marginBottom: 4,
              }}
            >
              {badgeModal.milestone.badge}
            </p>
            {badgeModal.earnedAt && (
              <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 10 }}>
                Earned on{' '}
                {new Date(badgeModal.earnedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
            {'isOfficialPartner' in badgeModal.milestone && badgeModal.milestone.isOfficialPartner ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: '#FFF7ED', color: '#F47820', border: '1px solid #F47820', borderRadius: 999, padding: '4px 12px' }}>
                    🎽 Official Uniform
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, background: '#EFF6FF', color: '#3B82F6', border: '1px solid #3B82F6', borderRadius: 999, padding: '4px 12px' }}>
                    🪪 GMP ID Card
                  </span>
                </div>
                {badgeModal.milestone.bonus > 0 && (
                  <div style={{ display: 'inline-block', background: '#DCFCE7', color: '#16A34A', fontWeight: 700, fontSize: 14, borderRadius: 999, padding: '6px 18px' }}>
                    + {fmt(badgeModal.milestone.bonus)} cash bonus
                  </div>
                )}
              </div>
            ) : badgeModal.milestone.bonus > 0 ? (
              <div
                style={{
                  display: 'inline-block',
                  background: '#DCFCE7',
                  color: '#16A34A',
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: 999,
                  padding: '6px 18px',
                  marginBottom: 12,
                }}
              >
                {fmt(badgeModal.milestone.bonus)} earned
              </div>
            ) : null}
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              {badgeModal.milestone.desc}
            </p>
            <button
              onClick={() => setBadgeModal(null)}
              style={{
                color: '#9CA3AF',
                fontSize: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav items={NAV} />
    </div>
  )
}
