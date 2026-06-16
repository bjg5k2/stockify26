'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import RadioWheel from './RadioWheel'
import { EQVisualizer } from './FX'

function PlayIcon({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor"><path d="M3.5 2L12.5 7.5L3.5 13V2Z"/></svg>
}
function PauseIcon({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 15 15" fill="currentColor"><rect x="2" y="2" width="4" height="11" rx="1"/><rect x="9" y="2" width="4" height="11" rx="1"/></svg>
}
function BackIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="16,3 6,9 16,15" fill="currentColor" stroke="none"/><line x1="3" y1="3" x2="3" y2="15"/></svg>
}
function ForwardIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="2,3 12,9 2,15" fill="currentColor" stroke="none"/><line x1="15" y1="3" x2="15" y2="15"/></svg>
}
function VolumeIcon({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor" stroke="none"/><path d="M11 5.5c1.2 1.2 1.2 3.8 0 5"/></svg>
}
function MutedIcon({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6H1v4h2l4 3V3L3 6z" fill="currentColor" stroke="none"/><line x1="13" y1="5" x2="9" y2="11"/><line x1="9" y1="5" x2="13" y2="11"/></svg>
}
function RadioIcon({ size = 13 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="14" height="9" rx="2"/><circle cx="5.5" cy="10.5" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="9" x2="13" y2="9"/><line x1="9" y1="12" x2="11" y2="12"/><path d="M4 6L7 2" strokeLinecap="round"/><path d="M12 6L9 2" strokeLinecap="round"/></svg>
}

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

      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          position: 'fixed',
          bottom: '70px',
          right: '24px',
          zIndex: 101,
          width: '210px',
          background: '#0d0d0d',
          border: '0.5px solid #1e1e1e',
          borderRadius: '18px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.75)',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Branding strip */}
        <div style={{
          padding: '9px 13px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '0.5px solid #181818',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: isPlaying ? '#4ade80' : '#333',
              boxShadow: isPlaying ? '0 0 6px #4ade80' : 'none',
              transition: 'background 0.3s, box-shadow 0.3s',
              flexShrink: 0,
            }} />
            <span style={{ color: '#444', fontSize: '9px', letterSpacing: '2px', fontWeight: '700' }}>STOCKIFY RADIO</span>
          </div>
          <button
            onClick={() => setWheelOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#444', display: 'flex', alignItems: 'center', lineHeight: 1 }}
          >
            <RadioIcon size={13} />
          </button>
        </div>

        {/* Main: vinyl + track info */}
        <div style={{ padding: '13px 13px 10px', display: 'flex', gap: '11px', alignItems: 'center' }}>
          {/* Spinning vinyl */}
          <div style={{
            width: '46px', height: '46px', borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #1a1a1a, #0a0a0a)',
            border: '2px solid #1c1c1c',
            position: 'relative',
            flexShrink: 0,
            animationName: 'vinylSpin',
            animationDuration: '4s',
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationPlayState: isPlaying ? 'running' : 'paused',
          }}>
            <div style={{ position: 'absolute', inset: '5px', borderRadius: '50%', border: '0.5px solid #222' }} />
            <div style={{ position: 'absolute', inset: '11px', borderRadius: '50%', border: '0.5px solid #222' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#0a1f10', border: '2px solid #4ade80' }} />
            </div>
          </div>

          {/* Track info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {hasTracks ? (
              <>
                <div style={{
                  color: '#e0e0e0', fontSize: '12px', fontWeight: '500',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginBottom: '4px',
                }}>
                  {currentTrack?.title || 'Unknown'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4ade80', fontSize: '10px' }}>
                  <span>Stockify Radio</span>
                  {isPlaying && <EQVisualizer size={9} color="#4ade80" bars={3} />}
                </div>
              </>
            ) : (
              <div style={{ color: '#444', fontSize: '11px' }}>No tracks</div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0 13px', marginBottom: hovering ? '12px' : '10px' }}>
          <div style={{ height: '2px', background: '#1c1c1c', borderRadius: '2px' }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: '#4ade80', borderRadius: '2px',
              transition: 'width 0.25s linear',
            }} />
          </div>
        </div>

        {/* Controls — expand on hover */}
        <div style={{
          maxHeight: hovering ? '72px' : '0',
          opacity: hovering ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.22s ease, opacity 0.15s ease',
        }}>
          {/* Volume row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '7px', padding: '0 13px', marginBottom: '10px', color: '#555',
          }}>
            <VolumeIcon size={12} />
            <input
              type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange}
              style={{
                width: '100px', height: '3px', cursor: 'pointer', accentColor: '#4ade80',
                appearance: 'none', WebkitAppearance: 'none',
                background: `linear-gradient(to right, #4ade80 ${volume * 100}%, #222 ${volume * 100}%)`,
                borderRadius: '2px', outline: 'none', border: 'none',
              }}
            />
          </div>

          {/* Button row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 13px 13px',
          }}>
            <button onClick={toggleMute}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: muted ? '#383838' : '#666', display: 'flex', alignItems: 'center' }}>
              {muted ? <MutedIcon size={13} /> : <VolumeIcon size={13} />}
            </button>
            <button onClick={handleBack} disabled={!hasTracks}
              style={{ background: 'none', border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed', padding: '4px', color: hasTracks ? '#777' : '#2a2a2a', display: 'flex', alignItems: 'center' }}>
              <BackIcon size={14} />
            </button>
            <button onClick={togglePlay} disabled={!hasTracks}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: hasTracks ? '#4ade80' : '#181818',
                border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hasTracks ? '#000' : '#333', padding: 0, flexShrink: 0,
              }}>
              {isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
            </button>
            <button onClick={handleForward} disabled={!hasTracks}
              style={{ background: 'none', border: 'none', cursor: hasTracks ? 'pointer' : 'not-allowed', padding: '4px', color: hasTracks ? '#777' : '#2a2a2a', display: 'flex', alignItems: 'center' }}>
              <ForwardIcon size={14} />
            </button>
            <button onClick={() => setWheelOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#444', display: 'flex', alignItems: 'center' }}>
              <RadioIcon size={13} />
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
