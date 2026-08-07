import { useEffect, useMemo, useRef, useState } from 'react'
import { Popup } from 'maplibre-gl'

const TIME_MAP = [
  { age: 4000, pct: 0, label: 'Archean' },
  { age: 2500, pct: 20, label: 'Proterozoic' },
  { age: 541, pct: 40, label: 'Paleozoic' },
  { age: 252, pct: 60, label: 'Mesozoic' },
  { age: 66, pct: 80, label: 'Cenozoic' },
  { age: 0, pct: 100, label: 'Present' },
]

function pctToAge(pct) {
  for (let i = 0; i < TIME_MAP.length - 1; i++) {
    const start = TIME_MAP[i]; const end = TIME_MAP[i + 1]
    if (pct >= start.pct && pct <= end.pct) {
      const segPct = (pct - start.pct) / (end.pct - start.pct)
      return start.age + segPct * (end.age - start.age)
    }
  }
  return 0
}

function ageToPct(age) {
  for (let i = 0; i < TIME_MAP.length - 1; i++) {
    const start = TIME_MAP[i]; const end = TIME_MAP[i + 1]
    if (age <= start.age && age >= end.age) {
      const segProg = (age - start.age) / (end.age - start.age)
      return start.pct + segProg * (end.pct - start.pct)
    }
  }
  return 100
}

export default function GeologicTimeSlider({ map, geojsonData, currentAge, setCurrentAge }) {
  const [activeDivisions, setActiveDivisions] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const popupRef = useRef(null)

  useEffect(() => {
    if (!map || !geojsonData) return
    const sourceId = 'schematic-geology'
    const fillId = 'schematic-fill'
    const lineId = 'schematic-line'

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: geojsonData })
      map.addLayer({
        id: fillId, type: 'fill', source: sourceId,
        layout: {
          'fill-sort-key': ['-', 4000, ['to-number', ['get', 'age_min_ma']]]
        },
        paint: { 
          'fill-color': '#8d4d1f', 
          'fill-opacity': ['case', ['==', ['get', 'age_uncertain'], true], 0.3, 0.7] 
        }
      })
      map.addLayer({
        id: lineId, type: 'line', source: sourceId,
        layout: {
          'line-sort-key': ['-', 4000, ['to-number', ['get', 'age_min_ma']]]
        },
        paint: {
          'line-color': '#4d2f16',
          'line-dasharray': ['case', ['==', ['get', 'age_uncertain'], true], ['literal', [4, 2]], ['literal', [1, 0]]]
        }
      })
    }

    const handleSchematicClick = (e) => {
      const p = e.features[0].properties
      new Popup().setLngLat(e.lngLat).setHTML(`
        <div class="geology-popup">
          <h3>${p.name}</h3>
          <p><strong>Age:</strong> ${p.age_min_ma} - ${p.age_max_ma} Ma</p>
          ${p.age_uncertain ? '<p style="color:red">Uncertain Age</p>' : ''}
        </div>
      `).addTo(map)
    }

    map.on('click', fillId, handleSchematicClick)
    return () => map.off('click', fillId, handleSchematicClick)
  }, [map, geojsonData])

  useEffect(() => {
    if (!map || !map.getLayer('schematic-fill')) return
    
    // At initial 4000 Ma state, show all schematic geology features
    // When slider is moved (< 4000 Ma), filter features by age_min_ma >= currentAge
    if (currentAge === 4000) {
      map.setFilter('schematic-fill', null)
      map.setFilter('schematic-line', null)
      if (geojsonData?.features) {
        setActiveDivisions([...new Set(geojsonData.features.map(f => f.properties.classical_division))])
      }
    } else {
      const filter = ['>=', ['to-number', ['get', 'age_min_ma']], currentAge]
      map.setFilter('schematic-fill', filter)
      map.setFilter('schematic-line', filter)

      if (geojsonData?.features) {
        const divisions = geojsonData.features
          .filter(f => f.properties.age_min_ma >= currentAge)
          .map(f => f.properties.classical_division)
        setActiveDivisions([...new Set(divisions)])
      }
    }
  }, [currentAge, map, geojsonData])

  // Play / Pause Animation Loop
  useEffect(() => {
    let timer = null
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentAge((prevAge) => {
          if (prevAge <= 0) {
            setIsPlaying(false)
            return 0
          }
          const curPct = ageToPct(prevAge)
          const nextPct = Math.min(100, curPct + 0.4)
          const nextAge = pctToAge(nextPct)
          if (nextPct >= 100) {
            setIsPlaying(false)
            return 0
          }
          return nextAge
        })
      }, 40)
    }
    return () => clearInterval(timer)
  }, [isPlaying, setCurrentAge])

  const togglePlay = () => {
    if (!isPlaying && currentAge <= 0) {
      setCurrentAge(4000)
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="time-slider-card">
      <div className="time-slider-head">
        <div className="time-slider-title-group">
          <button 
            type="button" 
            className="play-btn" 
            onClick={togglePlay}
            title={isPlaying ? "Pause timeline animation" : "Play geologic timeline"}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <div>
            <p className="time-slider-kicker">Geological Timeline</p>
            <strong>{Math.round(currentAge)} Ma</strong>
          </div>
        </div>
        <div className="time-slider-status">
          {activeDivisions.length > 0 ? activeDivisions.join(' • ') : 'No layers accumulated'}
        </div>
      </div>
      <div className="time-slider-shell">
        <input 
          type="range" min="0" max="100" step="0.1" 
          value={ageToPct(currentAge)} 
          onChange={e => {
            setIsPlaying(false)
            setCurrentAge(pctToAge(parseFloat(e.target.value)))
          }} 
          className="time-slider-input"
        />
        <div className="time-slider-track" />
        <div className="time-slider-fill" style={{ width: `${ageToPct(currentAge)}%` }} />
        <div className="time-slider-ticks">
          {TIME_MAP.map(pt => (
            <div key={pt.age} className="time-slider-tick" style={{ left: `${pt.pct}%` }}>
              <span className="time-slider-tick-line" />
              <span className="time-slider-tick-label">{pt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}