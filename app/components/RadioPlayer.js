'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATIONS } from '../lib/radioStations'
import RadioWheel from './RadioWheel'
import { EQVisualizer } from './FX'

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function PlayIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor">
      <path d="M3.5 2L12.5 7.5L3.5 13V2Z"/>
    </svg>
  )
}

function PauseIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor">
      <rect x="2" y="2" width="4" height="11" rx="1"/>
      <rect x="9" y="2" width="4" height="11" rx="1"/>
    </svg>
  )
}

function BackIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="16,3 6,9 16,15" fill="currentColor" stroke="none"/>
      <line x1="3" y1="3" x2="3" y2="15"/>
    </svg>
  )
}

function ForwardIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="2,3 12,9 2,15" fill="currentColor" stroke="none"/>
      <line x1="15" y1="3" x2="15" y2="15"/>
    </svg>
  )
}

function VolumeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor" stroke="none"/>
      <path d="M11 5.5c1.2 1.2 1.2 3.8 0 5"/>
    </svg>
  )
}

function MutedIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor" stroke="none"/>
      <line x1="13" y1="5" x2="9" y2="11"/>
      <line x1="9" y1="5" x2="13" y2="11"/>
    </svg>
  )
}

function RadioIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="14" height="9" rx="2"/>
      <circle cx="5.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
      <line x1="9" y1="9" x2="13" y2="9"/>
      <line x1="9" y1="12" x2="11" y2="12"/>
      <path d="M4 6L7 2" strokeLinecap="round"/>
      <path d="M12 6L9 2" strokeLinecap="round"/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function RadioPlayer() {
  const [mounted, setMounted] = useState(false)
  const [currentStationId, setCurrentStationId] = useState('main')
  const [tracks, setTracks] = useState([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [volume, setVolume] = useState(0.25)
  const [muted, setMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hovering, setHovering] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => setMounted(true), [])

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
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, currentTrackIndex, tracks])

  const handleTrackEnd = () => {
    if (tracks.length === 0) return
    setCurrentTrackIndex(prev => (prev + 1) % tracks.length)
  }

  const togglePlay = () => {
    if (tracks.length === 0) return
    setIsPlaying(prev => !prev)
  }

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
      <style>{`
        @keyframes vinylSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        onEnded={handleTrackEnd}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
        loop={tracks.length === 1}
        preload="auto"
      />

      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          position: 'fixed',
          bottom: '58px',
          right: '24px',
          zIndex: 101,
          width: '220px',
          background: '#0f0f0f',
          border: '0.5px solid #1c1c1c',
          borderRadius: '14px',
          padding: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Always visible: vinyl + track info + progress */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>

          {/* Spinning vinyl */}
          <div style={{
            width: '48px',
            height: '48px',
            flexShrink: 0,
            background: '#111',
            border: '2px solid #1c1c1c',
            borderRadius: '50%',
            position: 'relative',
            animationName: 'vinylSpin',
            animationDuration: '4s',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationPlayState: isPlaying ? 'running' : 'paused',
          }}>
            <div style={{ position: 'absolute', inset: '5px', borderRadius: '50%', border: '0.5px solid #222' }} />
            <div style={{ position: 'absolute', inset: '12px', borderRadius: '50%', border: '0.5px solid #222' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0f2a18', border: '2px solid #4ade80' }} />
            </div>
          </div>

          {/* Track info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!hasTracks ? (
              <div style={{ color: '#444', fontSize: '12px' }}>No tracks</div>
            ) : (
              <>
                <div style={{ color: '#fff', fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentTrack?.title || 'Unknown track'}
                </div>
                <div style={{ color: '#4ade80', fontSize: '11px', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>● Stockify Radio</span>
                  {isPlaying && <EQVisualizer size={10} color="#4ade80" bars={3} />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress bar — always visible */}
        <div style={{ height: '3px', background: '#1a1a1a', borderRadius: '4px', marginBottom: hovering ? '10px' : 0 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#4ade80', borderRadius: '4px', transition: 'width 0.25s linear' }} />
        </div>

        {/* Controls — fade in on hover */}
        <div style={{
          maxHeight: hovering ? '80px' : '0',
          opacity: hovering ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.2s ease, opacity 0.15s ease',
        }}>
          {/* Volume row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px', color: '#555', paddingTop: '2px' }}>
            <VolumeIcon size={13} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              style={{
                width: '110px',
                height: '3px',
                cursor: 'pointer',
                accentColor: '#4ade80',
                appearance: 'none',
                WebkitAppearance: 'none',
                background: `linear-gradient(to right, #4ade80 ${volume * 100}%, #2a2a2a ${volume * 100}%)`,
                borderRadius: '2px',
                outline: 'none',
                border: 'none',
              }}
            />
          </div>

          {/* Playback controls: mute | back | play/pause | forward | radio */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

            <button onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: muted ? '#444' : '#888', display: 'flex', alignItems: 'center' }}>
              {muted ? <MutedIcon size={15} /> : <VolumeIcon size={15} />}
            </button>

            <button onClick={handleBack} disabled={!hasTracks} title="Previous"
              style={{ background: 'none', border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed', padding: '4px', color: hasTracks ? '#888' : '#333', display: 'flex', alignItems: 'center' }}>
              <BackIcon size={16} />
            </button>

            <button onClick={togglePlay} disabled={!hasTracks} title={isPlaying ? 'Pause' : 'Play'}
              style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: hasTracks ? '#4ade80' : '#1a1a1a',
                border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hasTracks ? '#000' : '#444', padding: 0, flexShrink: 0,
              }}>
              {isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>

            <button onClick={handleForward} disabled={!hasTracks} title="Next"
              style={{ background: 'none', border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed', padding: '4px', color: hasTracks ? '#888' : '#333', display: 'flex', alignItems: 'center' }}>
              <ForwardIcon size={16} />
            </button>

            <button onClick={() => setWheelOpen(true)} title="Change station"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#555', display: 'flex', alignItems: 'center' }}>
              <RadioIcon size={15} />
            </button>
          </div>
        </div>
      </div>

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
