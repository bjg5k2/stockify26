'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import RadioWheel from './RadioWheel'

function PlayIcon({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor"><path d="M3.5 2L12.5 7.5L3.5 13V2Z"/></svg>
}
function PauseIcon({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor"><rect x="2" y="2" width="4" height="11" rx="1"/><rect x="9" y="2" width="4" height="11" rx="1"/></svg>
}
function BackIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="16,3 6,9 16,15" fill="currentColor" stroke="none"/><line x1="3" y1="3" x2="3" y2="15"/></svg>
}
function ForwardIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="2,3 12,9 2,15" fill="currentColor" stroke="none"/><line x1="15" y1="3" x2="15" y2="15"/></svg>
}
function VolumeIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor" stroke="none"/><path d="M11 5.5c1.2 1.2 1.2 3.8 0 5"/></svg>
}
function MutedIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor" stroke="none"/><line x1="13" y1="5" x2="9" y2="11"/><line x1="9" y1="5" x2="13" y2="11"/></svg>
}
function RadioIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="14" height="9" rx="2"/><circle cx="5.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="9" x2="13" y2="9"/><line x1="9" y1="12" x2="11" y2="12"/><path d="M4 6L7 2" strokeLinecap="round"/><path d="M12 6L9 2" strokeLinecap="round"/></svg>
}

export function EQVisualizer({ size = 18, color = '#4ade80', bars = 4 }) {
  const durations = [0.7, 0.9, 0.6, 1.0, 0.8]
  const delays = [0, 0.15, 0.3, 0.05, 0.2]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: size, width: size * 0.8 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          flex: 1,
          height: '100%',
          background: color,
          borderRadius: '1px',
          transformOrigin: 'bottom',
          animation: `eqBounce ${durations[i % durations.length]}s ease-in-out infinite`,
          animationDelay: `${delays[i % delays.length]}s`,
        }} />
      ))}
    </div>
  )
}

export function LiveDot({ color = '#4ade80', size = 8 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: color, animation: 'pulseGlow 2s ease-in-out infinite', flexShrink: 0 }} />
}

export function AnimatedNumber({ value, duration = 800, decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)
  const raf = useRef(null)

  useEffect(() => {
    const start = prevValue.current
    const end = value || 0
    const startTime = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (end - start) * eased)
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick)
      } else {
        prevValue.current = end
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])

  return <>{display.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px' }) {
  return <div className="skeleton-shimmer" style={{ width, height, borderRadius }} />
}

export function useFlash(value) {
  const [flashClass, setFlashClass] = useState('')
  const prevValue = useRef(value)

  useEffect(() => {
    if (prevValue.current !== value && prevValue.current !== undefined) {
      if (value > prevValue.current) setFlashClass('flash-green')
      else if (value < prevValue.current) setFlashClass('flash-red')
      const timer = setTimeout(() => setFlashClass(''), 600)
      prevValue.current = value
      return () => clearTimeout(timer)
    }
    prevValue.current = value
  }, [value])

  return flashClass
}

export function MarketFooter() {
  const [mounted, setMounted] = useState(false)
  const [utcTime, setUtcTime] = useState('')
  const [countdown, setCountdown] = useState('')
  const [currentStationId, setCurrentStationId] = useState('main')
  const [tracks, setTracks] = useState([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [volume, setVolume] = useState(0.25)
  const [muted, setMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      setUtcTime(`${h}:${m}:${s} UTC`)

      const etFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      })
      const parts = etFormatter.formatToParts(now)
      const eh = parseInt(parts.find(p => p.type === 'hour').value)
      const em = parseInt(parts.find(p => p.type === 'minute').value)
      const es = parseInt(parts.find(p => p.type === 'second').value)
      const secondsNow = eh * 3600 + em * 60 + es
      const targetSeconds = 9 * 3600
      let diff = targetSeconds - secondsNow
      if (diff <= 0) diff += 24 * 3600
      const ch = String(Math.floor(diff / 3600)).padStart(2, '0')
      const cm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0')
      const cs = String(diff % 60).padStart(2, '0')
      setCountdown(`${ch}:${cm}:${cs}`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = 0.125
    audio.muted = true
  }, [])

  useEffect(() => {
    const loadTracks = async () => {
      const { data } = await supabase
        .from('radio_tracks')
        .select('*')
        .eq('station', currentStationId)
        .order('track_order', { ascending: true })
      const resolved = (data || []).map(track => ({
        ...track,
        url: `/api/radio/stream?path=${encodeURIComponent(track.file_path)}`,
      }))
      setTracks(resolved)
      setCurrentTrackIndex(0)
    }
    loadTracks()
  }, [currentStationId])

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    if (isPlaying && audioRef.current && audioSrc) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }, [currentTrackIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || tracks.length === 0) return
    if (isPlaying) audio.play().catch(() => setIsPlaying(false))
    else audio.pause()
  }, [isPlaying, currentTrackIndex, tracks])

  const handleTrackEnd = () => {
    if (tracks.length === 0) return
    setCurrentTrackIndex(prev => (prev + 1) % tracks.length)
  }
  const togglePlay = () => { if (tracks.length === 0) return; setIsPlaying(prev => !prev) }
  const toggleMute = () => {
    const audio = audioRef.current
    const next = !muted
    setMuted(next)
    if (audio) audio.muted = next
  }
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (audioRef.current) audioRef.current.volume = val * 0.5
  }
  const handleBack = () => {
    if (!hasTracks) return
    setCurrentTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length)
  }
  const handleForward = () => {
    if (!hasTracks) return
    setCurrentTrackIndex(prev => (prev + 1) % tracks.length)
  }
  const handleSelectStation = (stationId) => {
    setCurrentStationId(stationId)
    setWheelOpen(false)
    setIsPlaying(true)
  }

  const currentTrack = tracks[currentTrackIndex]
  const audioSrc = currentTrack?.url || ''
  const hasTracks = tracks.length > 0
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!mounted) return null

  return (
    <>
      <style>{`@keyframes vinylSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        onEnded={handleTrackEnd}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
        loop={tracks.length === 1}
        preload="auto"
      />

      <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#0a0a0a', borderTop: '0.5px solid #1a1a1a', flexShrink: 0 }}>
        {/* Track progress line at very top of footer */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${progress}%`, height: '2px', background: '#4ade80', transition: 'width 0.25s linear' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 32px', gap: '16px' }}>

          {/* Left: vinyl + playback + track info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', background: '#111',
              border: '1.5px solid #1c1c1c', position: 'relative', flexShrink: 0,
              animationName: 'vinylSpin', animationDuration: '4s', animationTimingFunction: 'linear',
              animationIterationCount: 'infinite', animationPlayState: isPlaying ? 'running' : 'paused',
            }}>
              <div style={{ position: 'absolute', inset: '4px', borderRadius: '50%', border: '0.5px solid #222' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#0f2a18', border: '1.5px solid #4ade80' }} />
              </div>
            </div>

            <button onClick={handleBack} disabled={!hasTracks}
              style={{ background: 'none', border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed', padding: '4px', color: hasTracks ? '#888' : '#333', display: 'flex', alignItems: 'center' }}>
              <BackIcon size={14} />
            </button>

            <button onClick={togglePlay} disabled={!hasTracks}
              style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: hasTracks ? '#4ade80' : '#1a1a1a',
                border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hasTracks ? '#000' : '#444', padding: 0, flexShrink: 0,
              }}>
              {isPlaying ? <PauseIcon size={11} /> : <PlayIcon size={11} />}
            </button>

            <button onClick={handleForward} disabled={!hasTracks}
              style={{ background: 'none', border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed', padding: '4px', color: hasTracks ? '#888' : '#333', display: 'flex', alignItems: 'center' }}>
              <ForwardIcon size={14} />
            </button>

            <div style={{ marginLeft: '4px', minWidth: 0, overflow: 'hidden' }}>
              {hasTracks ? (
                <>
                  <div style={{ color: '#ccc', fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentTrack?.title || 'Unknown'}
                  </div>
                  <div style={{ color: '#4ade80', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                    <span>Stockify Radio</span>
                    {isPlaying && <EQVisualizer size={8} color="#4ade80" bars={3} />}
                  </div>
                </>
              ) : (
                <div style={{ color: '#444', fontSize: '11px' }}>No tracks</div>
              )}
            </div>
          </div>

          {/* Center: clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#666', flexShrink: 0 }}>
            <span>{utcTime}</span>
            <span style={{ color: '#333' }}>·</span>
            <span>Next market update in <span style={{ color: '#4ade80', fontWeight: '600' }}>{countdown}</span></span>
          </div>

          {/* Right: mute + volume + station picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
            <button onClick={toggleMute}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: muted ? '#444' : '#666', display: 'flex', alignItems: 'center' }}>
              {muted ? <MutedIcon size={14} /> : <VolumeIcon size={14} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange}
              style={{
                width: '80px', height: '3px', cursor: 'pointer', accentColor: '#4ade80',
                appearance: 'none', WebkitAppearance: 'none',
                background: `linear-gradient(to right, #4ade80 ${volume * 100}%, #2a2a2a ${volume * 100}%)`,
                borderRadius: '2px', outline: 'none', border: 'none',
              }}
            />
            <button onClick={() => setWheelOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#555', display: 'flex', alignItems: 'center' }}>
              <RadioIcon size={14} />
            </button>
          </div>
        </div>
      </footer>

      {wheelOpen && (
        <RadioWheel
          currentStationId={currentStationId}
          onSelect={handleSelectStation}
          onClose={() => setWheelOpen(false)}
        />
      )}
    </>
  )
}
