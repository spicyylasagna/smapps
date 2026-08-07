import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import GeologicTimeSlider from './GeologicTimeSlider.jsx'

const INDIA_BOUNDS = [[67.7, 6.4], [97.5, 37.8]]
const INDIA_CONTEXT_BOUNDS = [[35, -15], [125, 55]]
const MACROSTRAT_TILES = 'https://tileserver.development.svc.macrostrat.org/carto/{z}/{x}/{y}.mvt'
const INDIA_BOUNDARY = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/IND/ADM0/geoBoundaries-IND-ADM0.geojson'

const BASE_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.8, 'raster-brightness-max': 0.98 } }],
}

// Utility formatting functions
function age(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toLocaleString()} Ma` : 'Not supplied'
}

function value(v, fallback = 'Not supplied') {
  return v === undefined || v === null || v === '' ? fallback : String(v)
}

export default function App() {
  const container = useRef(null)
  const mapRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  
  // SHARED STATE FOR LAYERS
  const [currentAge, setCurrentAge] = useState(0)
  const [showMacrostrat, setShowMacrostrat] = useState(true)
  const [macrostratIgnoreAge, setMacrostratIgnoreAge] = useState(false)

  // SIDEBAR & SEARCH STATE
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [panelOpen, setPanelOpen] = useState(true)
  
  // HIERARCHY STATE
  const [supergroupHierarchy, setSupergroupHierarchy] = useState({})
  const [selectedSupergroup, setSelectedSupergroup] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedFormation, setSelectedFormation] = useState('')
  const [selectedMember, setSelectedMember] = useState('')
  const [divisionMode, setDivisionMode] = useState('stratigraphic')
  const [lithoHierarchy, setLithoHierarchy] = useState(null)
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedSubdivision, setSelectedSubdivision] = useState('')
  const [selectedComponent, setSelectedComponent] = useState('')
  const [schematicGeojson, setSchematicGeojson] = useState(null)

  // 1. Initialize Map
  useEffect(() => {
    const map = new Map({
      container: container.current,
      style: BASE_STYLE,
      bounds: INDIA_BOUNDS,
      fitBoundsOptions: { padding: 52, maxZoom: 5.4 },
      maxBounds: INDIA_CONTEXT_BOUNDS,
      minZoom: 3.2,
      renderWorldCopies: false,
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      map.addSource('macrostrat', { type: 'vector', tiles: [MACROSTRAT_TILES], minzoom: 0, maxzoom: 14 })
      map.addLayer({
        id: 'geology-units', type: 'fill', source: 'macrostrat', 'source-layer': 'units',
        paint: { 'fill-color': ['coalesce', ['get', 'color'], '#b99463'], 'fill-opacity': 0.72 },
      })
      map.addLayer({
        id: 'geology-outline', type: 'line', source: 'macrostrat', 'source-layer': 'units',
        paint: { 'line-color': '#554a3d', 'line-width': 0.45, 'line-opacity': 0.65 },
      })

      // Load India Mask
      fetch(INDIA_BOUNDARY).then(res => res.json()).then(collection => {
        if (!map.getSource('india-mask')) {
          const geometry = collection.features?.[0]?.geometry
          const outerRing = [[35, -15], [125, -15], [125, 55], [35, 55], [35, -15]]
          const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
          const indiaHoles = polygons.map(p => p[0].slice().reverse())
          const mask = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [outerRing, ...indiaHoles] } }
          map.addSource('india-mask', { type: 'geojson', data: mask })
          map.addLayer({ id: 'india-mask', type: 'fill', source: 'india-mask', paint: { 'fill-color': '#e8e3d8', 'fill-opacity': 0.94 } })
        }
      })

      map.on('click', 'geology-units', (e) => setSelected(e.features?.[0]?.properties ?? null))
      map.on('mouseenter', 'geology-units', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'geology-units', () => { map.getCanvas().style.cursor = '' })
      setIsReady(true)
    })
    return () => map.remove()
  }, [])

  // 2. Load Metadata JSONs
  useEffect(() => {
    fetch('/india_lithostratigraphy_schematic.geojson').then(r => r.json()).then(setSchematicGeojson)
    fetch('/india_lithological_divisions.json').then(r => r.json()).then(setLithoHierarchy)
    fetch('/data/gsi_stratigraphic_hierarchy_india_v2.json').then(r => r.json()).then(raw => {
        const out = {}
        if (raw.archean_basement) out['Archean Basement'] = { title: raw.archean_basement.name, info: raw.archean_basement, groups: [] }
        raw.supergroups?.forEach(sg => {
          out[sg.name] = { 
            title: sg.name, info: sg, 
            groups: sg.groups?.map(g => ({ name: g.name, formations: g.formations || [] })) 
          }
        })
        setSupergroupHierarchy(out)
      })
  }, [])

  // 3. Dropdown Logic
  const supergroupOptions = useMemo(() => Object.keys(supergroupHierarchy), [supergroupHierarchy])
  const groupOptions = useMemo(() => supergroupHierarchy[selectedSupergroup]?.groups?.map(g => g.name) || [], [selectedSupergroup, supergroupHierarchy])
  const formationOptions = useMemo(() => {
    const sg = supergroupHierarchy[selectedSupergroup]
    const g = sg?.groups.find(x => x.name === selectedGroup)
    return g ? g.formations.map(f => f.name) : []
  }, [selectedSupergroup, selectedGroup, supergroupHierarchy])

// 4. FIXED Multi-Layer Filter Engine
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    const map = mapRef.current;

    // 1. Handle Layer Visibility
    const visibility = showMacrostrat ? 'visible' : 'none';
    if (map.getLayer('geology-units')) map.setLayoutProperty('geology-units', 'visibility', visibility);
    if (map.getLayer('geology-outline')) map.setLayoutProperty('geology-outline', 'visibility', visibility);

    // 2. Build the Filter Array
    let filters = ['all'];
    
    if (showMacrostrat && !macrostratIgnoreAge) {
      // Macrostrat Age Logic: 
      // Unit's oldest point (b_age) must be >= currentAge 
      // AND its youngest point (t_age) must be <= currentAge
      const b_age = ['to-number', ['coalesce', ['get', 'best_b_age'], ['get', 'b_age'], 4000]];
      const t_age = ['to-number', ['coalesce', ['get', 'best_t_age'], ['get', 't_age'], 0]];

      filters.push(['>=', b_age, currentAge]);
      filters.push(['<=', t_age, currentAge]);
    }

    // 3. Search Query Logic
    if (search.trim()) {
      const q = search.toLowerCase();
      const has = (key) => ['>=', ['index-of', q, ['downcase', ['to-string', ['coalesce', ['get', key], '']]]], 0];
      filters.push(['any', has('name'), has('strat_name'), has('lith'), has('descrip')]);
    }

    // 4. Apply to Map Layers
    const finalFilter = filters.length > 1 ? filters : null;
    
    if (map.getLayer('geology-units')) {
      map.setFilter('geology-units', finalFilter);
    }
    if (map.getLayer('geology-outline')) {
      map.setFilter('geology-outline', finalFilter);
    }
  }, [currentAge, showMacrostrat, macrostratIgnoreAge, search, isReady]);

  const reset = () => {
    setSearch(''); setCurrentAge(0); setSelected(null); setSelectedSupergroup('')
    mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 52 })
  }

  return (
    <div className="atlas">
      <div ref={container} className="map" />

      <header className="topbar">
        <div className="brand"><span className="brand-mark">◈</span><span>India Geological Atlas</span><small>beta</small></div>
        <div className="topbar-actions"><button onClick={reset}>Reset map</button></div>
      </header>

      <aside className="search-card">
        <p className="card-kicker">Controls & Layers</p>
        
        <div className="layer-toggle-group">
          <label className="toggle-item">
            <input type="checkbox" checked={showMacrostrat} onChange={e => setShowMacrostrat(e.target.checked)} />
            <span>Show Macrostrat Layer</span>
          </label>
          <label className={`toggle-item ${!showMacrostrat ? 'disabled' : ''}`}>
            <input type="checkbox" disabled={!showMacrostrat} checked={macrostratIgnoreAge} onChange={e => setMacrostratIgnoreAge(e.target.checked)} />
            <span>Ignore Age (Show Full Map)</span>
          </label>
        </div>

        <label className="search-box">
          <span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Macrostrat units..." />
        </label>

        <div className="mode-row">
          <label><span>Reference Hierarchy</span>
            <select value={selectedSupergroup} onChange={e => { setSelectedSupergroup(e.target.value); setSelectedGroup('') }}>
              <option value="">Select Supergroup...</option>
              {supergroupOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
        </div>

        <div className="dropdown-row">
          <label><span>Group</span>
            <select disabled={!selectedSupergroup} value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
              <option value="">Select Group...</option>
              {groupOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label><span>Formation</span>
            <select disabled={!selectedGroup} value={selectedFormation} onChange={e => setSelectedFormation(e.target.value)}>
              <option value="">Select Formation...</option>
              {formationOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
        </div>
      </aside>

      <aside className={`inspector ${panelOpen ? 'open' : ''}`}>
        <button className="inspector-toggle" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? '›' : '‹'}</button>
        <div className="inspector-content">
          <p className="card-kicker">Unit Details</p>
          {selected ? (
            <div className="details-view">
              <h2>{selected.strat_name || selected.name || 'Unnamed Unit'}</h2>
              <dl>
                <div><dt>Age</dt><dd>{age(selected.best_b_age)} – {age(selected.best_t_age)}</dd></div>
                <div><dt>Lithology</dt><dd>{value(selected.lith)}</dd></div>
                <div><dt>Description</dt><dd>{value(selected.descrip)}</dd></div>
              </dl>
            </div>
          ) : (
            <div><h2>Select a unit</h2><p>Click the map to see details from the Macrostrat database.</p></div>
          )}
        </div>
      </aside>

      {schematicGeojson && (
        <GeologicTimeSlider 
          map={mapRef.current} 
          geojsonData={schematicGeojson} 
          currentAge={currentAge} 
          setCurrentAge={setCurrentAge} 
        />
      )}
    </div>
  )
}