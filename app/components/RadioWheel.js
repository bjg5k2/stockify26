'use client'
import { STATIONS } from '../lib/radioStations'

export default function RadioWheel({ currentStationId, onSelect, onClose }) {
  const N = STATIONS.length
  const SIZE = 280
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R_OUTER = 110
  const R_INNER = 38
  const GAP = N > 1 ? 3 : 0

  const toRad = deg => (deg * Math.PI) / 180

  const sectorPath = (i) => {
    const span = 360 / N
    const start = toRad(i * span - 90 + GAP / 2)
    const end = toRad(i * span + span - 90 - GAP / 2)
    const large = span - GAP > 180 ? 1 : 0
    const ox1 = CX + R_OUTER * Math.cos(start), oy1 = CY + R_OUTER * Math.sin(start)
    const ox2 = CX + R_OUTER * Math.cos(end),   oy2 = CY + R_OUTER * Math.sin(end)
    const ix1 = CX + R_INNER * Math.cos(start), iy1 = CY + R_INNER * Math.sin(start)
    const ix2 = CX + R_INNER * Math.cos(end),   iy2 = CY + R_INNER * Math.sin(end)
    return `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${ix1} ${iy1} Z`
  }

  const labelCenter = (i) => {
    const span = 360 / N
    const mid = toRad(i * span - 90 + span / 2)
    const r = (R_OUTER + R_INNER) / 2
    return { x: CX + r * Math.cos(mid), y: CY + r * Math.sin(mid) }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
    >
      <div onClick={e => e.stopPropagation()}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {N === 1 ? (
            <>
              <circle
                cx={CX} cy={CY} r={R_OUTER}
                fill={STATIONS[0].color + '1a'}
                stroke={currentStationId === STATIONS[0].id ? STATIONS[0].color : '#333'}
                strokeWidth={currentStationId === STATIONS[0].id ? 2 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(STATIONS[0].id)}
              />
              <text x={CX} y={CY - 12} textAnchor="middle" dominantBaseline="middle" fontSize="40" style={{ pointerEvents: 'none' }}>
                {STATIONS[0].icon}
              </text>
              <text x={CX} y={CY + 30} textAnchor="middle" dominantBaseline="middle"
                fill={currentStationId === STATIONS[0].id ? STATIONS[0].color : '#888'}
                fontSize="13" fontWeight="500" style={{ pointerEvents: 'none' }}>
                {STATIONS[0].name}
              </text>
            </>
          ) : (
            <>
              {STATIONS.map((station, i) => {
                const active = station.id === currentStationId
                const lp = labelCenter(i)
                return (
                  <g key={station.id} onClick={() => onSelect(station.id)} style={{ cursor: 'pointer' }}>
                    <path
                      d={sectorPath(i)}
                      fill={active ? station.color + '2a' : '#141414'}
                      stroke={active ? station.color : '#2a2a2a'}
                      strokeWidth={active ? 2 : 0.5}
                    />
                    <text x={lp.x} y={lp.y - 10} textAnchor="middle" dominantBaseline="middle" fontSize="22" style={{ pointerEvents: 'none' }}>
                      {station.icon}
                    </text>
                    <text x={lp.x} y={lp.y + 14} textAnchor="middle" dominantBaseline="middle"
                      fill={active ? station.color : '#888'}
                      fontSize="10" fontWeight="500" style={{ pointerEvents: 'none' }}>
                      {station.name}
                    </text>
                  </g>
                )
              })}
              <circle cx={CX} cy={CY} r={R_INNER - 2} fill="#0a0a0a" stroke="#1c1c1c" strokeWidth={1} />
              <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fill="#444" fontSize="10"
                style={{ letterSpacing: '1px', pointerEvents: 'none' }}>
                RADIO
              </text>
            </>
          )}
        </svg>
        <div style={{ textAlign: 'center', marginTop: '14px', color: '#444', fontSize: '11px', letterSpacing: '0.5px' }}>
          SELECT STATION · CLICK OUTSIDE TO CLOSE
        </div>
      </div>
    </div>
  )
}
