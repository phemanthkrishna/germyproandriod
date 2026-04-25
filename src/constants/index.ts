export const SERVICES = [
  { id: 1,  emoji: '🔧', name: 'Plumbing',          desc: 'Leaks, pipes & taps',    live: true  },
  { id: 2,  emoji: '⚡', name: 'Electrician',        desc: 'Wiring & switches',       live: true  },
  { id: 3,  emoji: '🪚', name: 'Carpentry',          desc: 'Furniture & doors',       live: false },
  { id: 4,  emoji: '❄️', name: 'AC Service',         desc: 'Fixed-price service packages', live: false },
  { id: 9,  emoji: '🔩', name: 'AC Repair',          desc: 'Diagnosis & repair',      live: false },
  { id: 5,  emoji: '🧹', name: 'Deep Clean',         desc: 'Home & sofa cleaning',    live: false },
  { id: 6,  emoji: '🖌️', name: 'Painting',          desc: 'Interior & exterior',     live: false },
  { id: 7,  emoji: '🚿', name: 'Bathroom',           desc: 'Tiles & fixtures',        live: false },
  { id: 8,  emoji: '🔐', name: 'Locksmith',          desc: 'Locks & keys',            live: false },
]

// Services that use the fixed-package flow instead of the normal quote flow
export const PACKAGE_SERVICES = ['AC Service']

export const VISITING_CHARGE = 100
export const PLATFORM_FEE = 25
export const BOOKING_FEE = VISITING_CHARGE + PLATFORM_FEE  // ₹125
export const TRANSACTION_FEE_RATE = 0.025

// AC Service package payment split
// At booking: ₹25 platform fee + ₹100 advance + 2.5% processing fee
// After service: package price − ₹100 advance (minus any package discount)
export const AC_PLATFORM_FEE = 25
export const AC_ADVANCE = 100
export const AC_BOOKING_BASE = AC_PLATFORM_FEE + AC_ADVANCE  // ₹125 charged at booking

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  booked:             { label: 'Booking Placed',      color: '#8B5CF6', bg: '#8B5CF620' },
  worker_visiting:    { label: 'Worker Visiting',     color: '#F59E0B', bg: '#F59E0B20' },
  inspecting:         { label: 'Inspecting',          color: '#8B5CF6', bg: '#8B5CF620' },
  quote_sent:         { label: 'Quote Ready',         color: '#3B82F6', bg: '#3B82F620' },
  in_progress:        { label: 'In Progress',         color: '#F97316', bg: '#F9731620' },
  material_collected: { label: 'Materials Collected', color: '#F97316', bg: '#F9731620' },
  done_uploaded:      { label: 'Verify Completion',   color: '#10B981', bg: '#10B98120' },
  completed:          { label: 'Completed ✓',         color: '#10B981', bg: '#10B98120' },
  cancelled:          { label: 'Cancelled',           color: '#EF4444', bg: '#EF444420' },
}

export const JOURNEY_STEPS = [
  { status: 'booked',             icon: '💳', label: 'Booking Placed' },
  { status: 'worker_visiting',    icon: '🚗', label: 'Worker Visiting' },
  { status: 'inspecting',         icon: '🔍', label: 'Inspection' },
  { status: 'quote_sent',         icon: '📋', label: 'Quote Received' },
  { status: 'in_progress',        icon: '🔧', label: 'Work In Progress' },
  { status: 'material_collected', icon: '🏪', label: 'Materials Ready' },
  { status: 'done_uploaded',      icon: '📸', label: 'Verify Completion' },
  { status: 'completed',          icon: '🎉', label: 'Job Complete' },
]

const STATUS_ORDER = ['booked', 'worker_visiting', 'inspecting', 'quote_sent', 'in_progress', 'material_collected', 'done_uploaded', 'completed']

export function getStepIndex(status: string): number {
  return STATUS_ORDER.indexOf(status)
}

