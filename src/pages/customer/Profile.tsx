import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { BottomNav } from '../../components/BottomNav'
import { MapPicker } from '../../components/MapPicker'
import { Home, List, User, LogOut, Edit2, Check, X, Plus, Trash2, MapPin, Map, Phone, MessageCircle } from 'lucide-react'
import { LegalLinks } from '../../components/LegalLinks'

const NAV = [
  { to: '/customer', icon: Home, label: 'Home' },
  { to: '/customer/orders', icon: List, label: 'Orders' },
  { to: '/customer/profile', icon: User, label: 'Profile' },
]

interface SavedAddress { label: string; address: string; lat?: number; lng?: number }

export default function CustomerProfile() {
  const { session, signIn, signOut } = useAuth()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])

  // Name editing
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Add address form
  const [addingAddress, setAddingAddress] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newLat, setNewLat] = useState<number | null>(null)
  const [newLng, setNewLng] = useState<number | null>(null)
  const [showMapForNew, setShowMapForNew] = useState(false)

  // Edit address form
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editLat, setEditLat] = useState<number | null>(null)
  const [editLng, setEditLng] = useState<number | null>(null)
  const [showMapForEdit, setShowMapForEdit] = useState(false)

  useEffect(() => {
    if (!session?.id) return
    supabase.from('profiles').select('saved_addresses').eq('id', session.id).single()
      .then(({ data }) => setAddresses(data?.saved_addresses || []))
  }, [session?.id])

  async function saveName() {
    if (!draftName.trim()) return toast.error('Name cannot be empty')
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ name: draftName.trim() }).eq('id', session!.id)
    if (error) { toast.error(error.message); setSavingName(false); return }
    signIn({ ...session!, name: draftName.trim() })
    toast.success('Name updated ✓')
    setEditingName(false)
    setSavingName(false)
  }

  async function persistAddresses(updated: SavedAddress[]): Promise<boolean> {
    const { error } = await supabase.from('profiles').update({ saved_addresses: updated }).eq('id', session!.id)
    if (error) { toast.error(error.message); return false }
    setAddresses(updated)
    return true
  }

  async function addAddress() {
    if (!newLabel.trim()) return toast.error('Enter a label (e.g. Home, Work)')
    if (!newAddress.trim()) return toast.error('Enter the full address')
    const entry: SavedAddress = { label: newLabel.trim(), address: newAddress.trim() }
    if (newLat !== null) entry.lat = newLat
    if (newLng !== null) entry.lng = newLng
    if (await persistAddresses([...addresses, entry])) {
      toast.success('Address saved ✓')
      setAddingAddress(false)
      setNewLabel('')
      setNewAddress('')
      setNewLat(null)
      setNewLng(null)
    }
  }

  async function saveEdit(i: number) {
    if (!editLabel.trim()) return toast.error('Label cannot be empty')
    if (!editAddress.trim()) return toast.error('Address cannot be empty')
    const entry: SavedAddress = { label: editLabel.trim(), address: editAddress.trim() }
    if (editLat !== null) entry.lat = editLat
    if (editLng !== null) entry.lng = editLng
    const updated = addresses.map((a, idx) => idx === i ? entry : a)
    if (await persistAddresses(updated)) {
      toast.success('Address updated ✓')
      setEditingIndex(null)
    }
  }

  async function deleteAddress(i: number) {
    if (await persistAddresses(addresses.filter((_, idx) => idx !== i)))
      toast.success('Address removed')
  }

  return (
    <div className="page-content px-5 py-6">

      {/* MapPicker for new address */}
      {showMapForNew && (
        <MapPicker
          onConfirm={(lat, lng, address) => { setNewLat(lat); setNewLng(lng); setNewAddress(address); setShowMapForNew(false) }}
          onClose={() => setShowMapForNew(false)}
        />
      )}

      {/* MapPicker for edit address */}
      {showMapForEdit && (
        <MapPicker
          onConfirm={(lat, lng, address) => { setEditLat(lat); setEditLng(lng); setEditAddress(address); setShowMapForEdit(false) }}
          onClose={() => setShowMapForEdit(false)}
        />
      )}

      <h1 className="text-2xl font-black font-heading text-slate-50 mb-6">My Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-orange-500/20 border-2 border-orange-500/40 rounded-2xl flex items-center justify-center text-2xl font-black text-orange-400 shrink-0">
          {session?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-xl font-black text-slate-50">{session?.name}</p>
          <p className="text-slate-400 text-sm">+91 {session?.phone}</p>
        </div>
      </div>

      {/* Name */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Full Name</p>
          {!editingName && (
            <button onClick={() => { setDraftName(session?.name || ''); setEditingName(true) }}
              className="text-blue-400 flex items-center gap-1 text-xs">
              <Edit2 size={12} /> Edit
            </button>
          )}
        </div>
        {!editingName ? (
          <p className="text-slate-50 font-semibold mt-1">{session?.name}</p>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-slate-50 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={saveName} disabled={savingName}
                className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl disabled:opacity-50">
                <Check size={12} /> {savingName ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingName(false)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phone (read-only) */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Phone Number</p>
        <p className="text-slate-50 font-semibold">+91 {session?.phone}</p>
        <p className="text-slate-600 text-xs mt-0.5">Phone number cannot be changed</p>
      </div>

      {/* Saved Addresses */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-slate-50 font-semibold text-sm">Saved Addresses</p>
          {!addingAddress && (
            <button onClick={() => setAddingAddress(true)}
              className="text-blue-400 flex items-center gap-1 text-xs">
              <Plus size={12} /> Add New
            </button>
          )}
        </div>

        {addresses.length === 0 && !addingAddress && (
          <p className="text-slate-500 text-sm">No saved addresses yet — add one to speed up booking</p>
        )}

        <div className="flex flex-col gap-2">
          {addresses.map((addr, i) => (
            <div key={i}>
              {editingIndex === i ? (
                <div className="flex flex-col gap-2 bg-slate-900 rounded-xl p-3">
                  <input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    placeholder="Label (e.g. Home)"
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-50 text-sm outline-none focus:border-blue-500"
                  />
                  {/* Address field + map button */}
                  <div className="flex gap-2">
                    <input
                      value={editAddress}
                      onChange={e => setEditAddress(e.target.value)}
                      placeholder="Full address"
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-50 text-sm outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => setShowMapForEdit(true)}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shrink-0"
                    >
                      <Map size={13} /> Map
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(i)}
                      className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl">
                      <Check size={12} /> Save
                    </button>
                    <button onClick={() => { setEditingIndex(null); setShowMapForEdit(false) }}
                      className="flex items-center gap-1 px-4 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3 bg-slate-900 rounded-xl px-3 py-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin size={14} className="text-orange-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-orange-400 text-xs font-bold">{addr.label}</p>
                      <p className="text-slate-300 text-sm leading-snug mt-0.5">{addr.address}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0 mt-0.5">
                    <button onClick={() => { setEditingIndex(i); setEditLabel(addr.label); setEditAddress(addr.address); setEditLat(addr.lat ?? null); setEditLng(addr.lng ?? null) }}
                      className="text-blue-400">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => deleteAddress(i)} className="text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add address form */}
        {addingAddress && (
          <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-700">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Home, Work, Parents)"
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-slate-50 text-sm outline-none focus:border-blue-500"
            />
            {/* Address field + map button */}
            <div className="flex gap-2">
              <input
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                placeholder="Full address"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-slate-50 text-sm outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setShowMapForNew(true)}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shrink-0"
              >
                <Map size={13} /> Map
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={addAddress}
                className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-xl">
                <Check size={12} /> Save
              </button>
              <button onClick={() => { setAddingAddress(false); setNewLabel(''); setNewAddress('') }}
                className="flex items-center gap-1 px-4 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Support */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Support</p>
        <div className="flex gap-3">
          <a
            href="tel:+918985614758"
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl py-3 transition-colors"
          >
            <Phone size={16} /> Call Us
          </a>
          <a
            href="https://wa.me/918985614758"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl py-3 transition-colors"
          >
            <MessageCircle size={16} /> WhatsApp
          </a>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 rounded-xl py-3 text-red-400 font-semibold text-sm mb-4"
      >
        <LogOut size={16} /> Sign Out
      </button>

      <LegalLinks />

      <BottomNav items={NAV} />
    </div>
  )
}
