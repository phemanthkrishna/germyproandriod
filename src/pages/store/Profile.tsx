import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useStoreAuth } from '../../context/StoreAuthContext'
import { StoreBottomNav } from '../../components/StoreBottomNav'
import { Copy, LogOut, MessageCircle } from 'lucide-react'
import { LegalLinks } from '../../components/LegalLinks'

export default function StoreProfile() {
  const { store, signOut } = useStoreAuth()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)

  function copyStoreId() {
    if (!store) return
    navigator.clipboard.writeText(store.store_id).then(() => toast.success('Store ID copied!'))
  }

  function handleLogout() {
    if (!showConfirm) { setShowConfirm(true); return }
    signOut()
    navigate('/')
  }

  if (!store) return null

  return (
    <div className="page-content px-4 py-6">
      <h1 className="text-2xl font-black font-heading text-slate-50 mb-5">My Store</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl">
            {store.name[0]}
          </div>
          <div>
            <p className="font-black text-slate-50 text-lg">{store.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">{store.store_type}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold">{store.commission_pct}% commission</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm border-t border-slate-800 pt-4">
          <div className="flex justify-between">
            <span className="text-slate-500">Phone</span>
            <span className="text-slate-300">{store.contact}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Store ID</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-50 tracking-widest">{store.store_id}</span>
              <button onClick={copyStoreId} className="text-blue-400 p-1"><Copy size={14} /></button>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className="text-green-400 font-semibold bg-green-500/10 px-2 py-0.5 rounded-full text-xs">Active</span>
          </div>
        </div>
      </div>

      <a
        href={`https://wa.me/919999999999?text=Hi, my Store ID is ${store.store_id}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full bg-green-600/20 border border-green-600/30 rounded-2xl py-3.5 text-green-400 font-semibold text-sm mb-4"
      >
        <MessageCircle size={16} /> Contact GetMyPro on WhatsApp
      </a>

      {showConfirm ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 text-sm font-semibold mb-3">Are you sure? You will need your Store ID to log in again.</p>
          <div className="flex gap-2">
            <button onClick={handleLogout} className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm">Log Out</button>
            <button onClick={() => setShowConfirm(false)} className="flex-1 bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full bg-slate-800 border border-slate-700 rounded-2xl py-3.5 text-red-400 font-semibold text-sm"
        >
          <LogOut size={16} /> Log Out
        </button>
      )}

      <LegalLinks />

      <StoreBottomNav />
    </div>
  )
}
