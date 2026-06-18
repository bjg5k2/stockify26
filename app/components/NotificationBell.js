'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(null)
  const [mounted, setMounted] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.read).length)
    }
    fetchNotifications()
  }, [mounted])

  useEffect(() => {
    if (!open || !userId) return
    const markRead = async () => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
    markRead()
  }, [open])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!mounted || !userId) return null

  const notifIcon = (type) => {
    if (type === 'dividend') return '💰'
    if (type === 'market_summary') return '📊'
    if (type === 'price_alert') return '🔔'
    return '🔔'
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        style={{ position: 'relative', cursor: 'pointer', padding: '4px' }}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={open ? '#fff' : '#666'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Notifications">
          <path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
          <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
        </svg>
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '16px', height: '16px', borderRadius: '50%',
            background: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: '600', color: '#fff', pointerEvents: 'none',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '36px', right: 0,
          width: '320px', background: '#0f0f0f',
          border: '0.5px solid #1c1c1c', borderRadius: '12px',
          zIndex: 200, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #1c1c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: '13px', fontWeight: '500' }}>Notifications</span>
            <span style={{ color: '#555', fontSize: '11px' }}>{notifications.length} total</span>
          </div>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#444', fontSize: '13px' }}>No notifications yet.</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '12px 16px',
                  borderBottom: '0.5px solid #111',
                  background: n.read ? 'transparent' : 'rgba(74,222,128,0.04)',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid #4ade80',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px' }}>{notifIcon(n.type)}</span>
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: '500' }}>{n.title}</span>
                  </div>
                  {n.type === 'market_summary' ? (
                    <div style={{ paddingLeft: '22px' }}>
                      {n.body.split('\n').map((line, i) => (
                        <div key={i} style={{ color: '#666', fontSize: '11px', lineHeight: '1.8' }}>{line}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '11px', lineHeight: '1.5', paddingLeft: '22px' }}>{n.body}</div>
                  )}
                  <div style={{ color: '#444', fontSize: '10px', paddingLeft: '22px', marginTop: '4px' }}>
                    {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
