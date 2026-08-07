import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import GeologicTimeSlider from './GeologicTimeSlider.jsx'

const INDIA_BOUNDS = [[67.7, 6.4], [97.5, 37.8]]
const INDIA_CONTEXT_BOUNDS = [[35, -15], [125, 55]]
const MACROSTRAT_TILES = 'https://tileserver.development.svc.macrostrat.org/carto/{z}/{x}/{y}.mvt'
const LITHOLOGY_DATA = '/data/dharwar-lithology.geojson'
const SUPERGROUP_OPTIONS = [
  'Archean Basement (Peninsular Gneissic Complex)',
  'Dharwar Supergroup',
  'Aravalli Supergroup',
  'Mahakoshal Supergroup',
  'Cuddapah Supergroup',
  'Delhi Supergroup',
  'Kaladgi Supergroup',
  'Chhattisgarh Supergroup',
  'Vindhyan Supergroup',
  'Bhima Supergroup',
  'Kurnool Supergroup',
]
// 2,000+ vertex country outline (geoBoundaries Open / CC0), replacing the former coarse polygon.
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

function age(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toLocaleString()} Ma` : 'Not supplied'
}

function value(value, fallback = 'Not supplied') {
  return value === undefined || value === null || value === '' ? fallback : String(value)
}

function unitFilter(search, young, old) {
  const filters = [
    ['<=', ['to-number', ['coalesce', ['get', 'best_t_age'], 0]], old],
    ['>=', ['to-number', ['coalesce', ['get', 'best_b_age'], 3600]], young],
  ]
  const query = search.trim().toLowerCase()
  if (query) {
    const contains = (field) => ['>=', ['index-of', query, ['downcase', ['to-string', ['coalesce', ['get', field], '']]]], 0]
    filters.push(['any', contains('name'), contains('strat_name'), contains('lith'), contains('descrip')])
  }
  return ['all', ...filters]
}

export default function App() {
  const container = useRef(null)
  const mapRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [search, setSearch] = useState('')
  const [young, setYoung] = useState(0)
  const [old, setOld] = useState(3600)
  const [selected, setSelected] = useState(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [showDharwar, setShowDharwar] = useState(false)
  const [dharwarGeoJSON, setDharwarGeoJSON] = useState(null)
  const [supergroupHierarchy, setSupergroupHierarchy] = useState({})
  const [gsiRaw, setGsiRaw] = useState(null)
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

  const filter = useMemo(() => unitFilter(search, young, old), [search, young, old])

  useEffect(() => {
    const map = new Map({
      container: container.current,
      style: BASE_STYLE,
      bounds: INDIA_BOUNDS,
      fitBoundsOptions: { padding: 52, maxZoom: 5.4 },
      // Keep India as the focus, but leave enough surrounding space for zooming out.
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
      map.addLayer({
        id: 'geology-lines', type: 'line', source: 'macrostrat', 'source-layer': 'lines',
        paint: { 'line-color': '#25221d', 'line-width': 1.1, 'line-opacity': 0.8 },
      })
      map.addSource('dharwar', { type: 'geojson', data: LITHOLOGY_DATA })
      map.addLayer({
        id: 'dharwar-units', type: 'fill', source: 'dharwar', layout: { visibility: showDharwar ? 'visible' : 'none' },
        paint: { 'fill-color': ['coalesce', ['get', 'color'], '#b9753f'], 'fill-opacity': 0.36 },
      })
      map.addLayer({
        id: 'dharwar-outline', type: 'line', source: 'dharwar', layout: { visibility: showDharwar ? 'visible' : 'none' },
        paint: { 'line-color': '#8b5a2b', 'line-width': 0.5, 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'dharwar-lines', type: 'line', source: 'dharwar', layout: { visibility: showDharwar ? 'visible' : 'none' },
        paint: { 'line-color': '#5b422d', 'line-width': 1.0, 'line-opacity': 0.7 },
      })
      // Cover the regional dataset outside the Indian national outline.
      // This keeps the source data available underneath while presenting an India-only atlas.
      fetch(INDIA_BOUNDARY)
        .then((response) => response.json())
        .then((collection) => {
          if (!map.getStyle() || map.getSource('india-mask')) return
          const geometry = collection.features?.[0]?.geometry
          if (!['Polygon', 'MultiPolygon'].includes(geometry?.type)) return
          const outerRing = [[35, -15], [125, -15], [125, 55], [35, 55], [35, -15]]
          const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
          const indiaHoles = polygons.map((polygon) => polygon[0].slice().reverse())
          const mask = {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [outerRing, ...indiaHoles] },
          }
          map.addSource('india-mask', { type: 'geojson', data: mask })
          map.addSource('india-boundary', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry },
          })
          map.addLayer({
            id: 'india-mask', type: 'fill', source: 'india-mask',
            paint: { 'fill-color': '#e8e3d8', 'fill-opacity': 0.94 },
          })
          map.addLayer({
            id: 'india-border', type: 'line', source: 'india-boundary',
            paint: { 'line-color': '#6b6258', 'line-width': 1.1, 'line-opacity': 0.9 },
          })
        })
        .catch((error) => console.error('Unable to load the India boundary mask.', error))
      map.on('mouseenter', 'geology-units', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'geology-units', () => { map.getCanvas().style.cursor = '' })
      map.on('click', 'geology-units', (event) => setSelected(event.features?.[0]?.properties ?? null))
      map.on('mouseenter', 'dharwar-units', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'dharwar-units', () => { map.getCanvas().style.cursor = '' })
      map.on('click', 'dharwar-units', (event) => setSelected(event.features?.[0]?.properties ?? null))
      map.on('click', (event) => {
        if (!map.queryRenderedFeatures(event.point, { layers: ['geology-units', 'dharwar-units'] }).length) setSelected(null)
      })
      setIsReady(true)
    })
    return () => map.remove()
  }, [])

  useEffect(() => {
    fetch(LITHOLOGY_DATA)
      .then((response) => response.json())
      .then((data) => setDharwarGeoJSON(data))
      .catch((error) => console.error('Unable to load Dharwar GeoJSON for dropdowns.', error))
  }, [])

  useEffect(() => {
    fetch('/india_lithostratigraphy_schematic.geojson')
      .then((response) => response.json())
      .then((data) => setSchematicGeojson(data))
      .catch((error) => console.error('Unable to load the schematic geology GeoJSON.', error))
  }, [])

  useEffect(() => {
    // load lithological divisions JSON if present in workspace root
    fetch('/india_lithological_divisions.json')
      .then((r) => r.json())
      .then((raw) => setLithoHierarchy(raw))
      .catch(() => {
        // not fatal; optional file
      })
  }, [])

  useEffect(() => {
    // load the authoritative GSI hierarchy JSON (provided by user)
    fetch('/data/gsi_stratigraphic_hierarchy_india_v2.json')
      .then((r) => r.json())
      .then((raw) => {
        setGsiRaw(raw)
        const out = {}
        // include archean basement as a named supergroup entry
        if (raw.archean_basement?.name) {
          out['Archean Basement (Peninsular Gneissic Complex)'] = {
            title: raw.archean_basement.name,
            info: raw.archean_basement,
            groups: [],
          }
        }
        for (const sg of (raw.supergroups || [])) {
          out[sg.name] = {
            title: sg.name,
            info: sg,
            groups: (sg.groups || []).map((g) => ({ name: g.name, formations: (g.formations || []).map((f) => ({ name: f.name, members: f.members || [], note: f.note || null })) })),
          }
        }
        setSupergroupHierarchy(out)
      })
      .catch((err) => console.error('Unable to load GSI hierarchy JSON.', err))
  }, [])

  const supergroupOptions = useMemo(() => {
    const fromGsi = Object.keys(supergroupHierarchy).filter(Boolean)
    return fromGsi.length ? fromGsi : SUPERGROUP_OPTIONS
  }, [supergroupHierarchy])

  const divisionOptions = useMemo(() => {
    if (!lithoHierarchy || !Array.isArray(lithoHierarchy.divisions)) return []
    return lithoHierarchy.divisions.map((d) => d.name)
  }, [lithoHierarchy])

  const subdivisionOptions = useMemo(() => {
    if (!selectedDivision || !lithoHierarchy) return []
    const div = lithoHierarchy.divisions.find((d) => d.name === selectedDivision)
    if (!div) return []
    return (div.subdivisions || []).map((s) => s.name)
  }, [lithoHierarchy, selectedDivision])

  const componentOptions = useMemo(() => {
    if (!selectedDivision || !selectedSubdivision || !lithoHierarchy) return []
    const div = lithoHierarchy.divisions.find((d) => d.name === selectedDivision)
    const sub = div?.subdivisions?.find((s) => s.name === selectedSubdivision)
    if (!sub) return []
    // components may be an array under subdivision as `components`
    if (Array.isArray(sub.components)) return sub.components
    return []
  }, [lithoHierarchy, selectedDivision, selectedSubdivision])

  const groupOptions = useMemo(() => {
    if (selectedSupergroup && supergroupHierarchy[selectedSupergroup]?.groups?.length) {
      return supergroupHierarchy[selectedSupergroup].groups.map((g) => g.name)
    }
    if (!dharwarGeoJSON || !selectedSupergroup) return []
    return [...new Set(dharwarGeoJSON.features
      .filter((feat) => feat.properties?.supergroup === selectedSupergroup)
      .map((feat) => feat.properties?.group_name)
      .filter(Boolean))].sort()
  }, [dharwarGeoJSON, selectedSupergroup, supergroupHierarchy])

  const formationOptions = useMemo(() => {
    const bySuper = supergroupHierarchy[selectedSupergroup]
    if (bySuper && bySuper.groups?.length) {
      const groupObj = bySuper.groups.find((g) => g.name === selectedGroup)
      if (groupObj) return (groupObj.formations || []).map((f) => f.name)
      // if no selectedGroup, aggregate all formations
      return bySuper.groups.flatMap((g) => (g.formations || []).map((f) => f.name)).filter(Boolean)
    }
    if (!dharwarGeoJSON || !selectedSupergroup) return []
    return [...new Set(dharwarGeoJSON.features
      .filter((feat) => feat.properties?.supergroup === selectedSupergroup
        && (!selectedGroup || feat.properties?.group_name === selectedGroup))
      .map((feat) => feat.properties?.formation)
      .filter(Boolean))].sort()
  }, [dharwarGeoJSON, selectedSupergroup, selectedGroup, supergroupHierarchy])

  const memberOptions = useMemo(() => {
    const bySuper = supergroupHierarchy[selectedSupergroup]
    if (bySuper && bySuper.groups?.length) {
      const groupObj = bySuper.groups.find((g) => g.name === selectedGroup)
      if (groupObj) {
        // find formation and return members
        const formObj = (groupObj.formations || []).find((f) => f.name === selectedFormation)
        if (formObj) return formObj.members || []
        // otherwise aggregate members across formations
        return groupObj.formations.flatMap((f) => (f.members || [])).filter(Boolean)
      }
      return []
    }
    if (!dharwarGeoJSON || !selectedSupergroup || !selectedGroup) return []
    return [...new Set(dharwarGeoJSON.features
      .filter((feat) => feat.properties?.supergroup === selectedSupergroup
        && feat.properties?.group_name === selectedGroup
        && (!selectedFormation || feat.properties?.formation === selectedFormation))
      .map((feat) => feat.properties?.member)
      .filter(Boolean))].sort()
  }, [dharwarGeoJSON, selectedSupergroup, selectedGroup, selectedFormation, supergroupHierarchy])

  // derive selected hierarchy details for inspector
  const selectedHierarchyDetails = useMemo(() => {
    // stratigraphic hierarchy details
    if (divisionMode === 'stratigraphic') {
      if (!selectedSupergroup) return null
      const sg = supergroupHierarchy[selectedSupergroup]
      if (!sg) return null
      // priority: member -> formation -> group -> supergroup -> archean basement
      const topInfo = sg.info || {}
      if (selectedMember && selectedFormation && selectedGroup) {
        const g = sg.groups?.find((x) => x.name === selectedGroup)
        const f = g?.formations?.find((x) => x.name === selectedFormation)
        if (f && f.members?.includes(selectedMember)) return { rank: 'member', title: selectedMember, parent: { supergroup: selectedSupergroup, group: selectedGroup, formation: selectedFormation }, info: { note: f.note || null, topInfo } }
      }
      if (selectedFormation && selectedGroup) {
        const g = sg.groups?.find((x) => x.name === selectedGroup)
        const f = g?.formations?.find((x) => x.name === selectedFormation)
        if (f) return { rank: 'formation', title: f.name, parent: { supergroup: selectedSupergroup, group: selectedGroup }, info: { members: f.members || [], note: f.note || null, topInfo } }
      }
      if (selectedGroup) {
        const g = sg.groups?.find((x) => x.name === selectedGroup)
        if (g) return { rank: 'group', title: g.name, parent: { supergroup: selectedSupergroup }, info: { formations: g.formations || [], note: g.note || null, topInfo } }
      }
      return { rank: 'supergroup', title: sg.title || selectedSupergroup, parent: null, info: { ...topInfo } }
    }

    // lithological hierarchy details
    if (divisionMode === 'lithological') {
      if (!lithoHierarchy || !selectedDivision) return null
      const div = lithoHierarchy.divisions.find((d) => d.name === selectedDivision)
      if (!div) return null
      if (selectedSubdivision) {
        const sub = div.subdivisions.find((s) => s.name === selectedSubdivision)
        if (!sub) return { rank: 'division', title: div.name, parent: null, info: { ...div } }
        if (selectedComponent) {
          return { rank: 'component', title: selectedComponent, parent: { division: div.name, subdivision: sub.name }, info: { ...sub } }
        }
        return { rank: 'subdivision', title: sub.name, parent: { division: div.name }, info: { ...sub } }
      }
      return { rank: 'division', title: div.name, parent: null, info: { ...div } }
    }
    return null
  }, [supergroupHierarchy, selectedSupergroup, selectedGroup, selectedFormation, selectedMember, divisionMode, lithoHierarchy, selectedDivision, selectedSubdivision, selectedComponent])

  const dharwarFilter = useMemo(() => {
    const base = unitFilter(search, young, old)
    const filterConditions = []
    if (selectedSupergroup) filterConditions.push(['==', ['coalesce', ['get', 'supergroup'], ''], selectedSupergroup])
    if (selectedGroup) filterConditions.push(['==', ['coalesce', ['get', 'group_name'], ''], selectedGroup])
    if (divisionMode === 'lithological') {
      // when in lithological mode, prefer subdivision->related_supergroup or lith match
      if (selectedSubdivision && lithoHierarchy) {
        const div = lithoHierarchy.divisions.find((d) => d.name === selectedDivision)
        const sub = div?.subdivisions?.find((s) => s.name === selectedSubdivision)
        if (sub?.related_supergroup) {
          filterConditions.push(['==', ['coalesce', ['get', 'supergroup'], ''], sub.related_supergroup])
        } else if (sub?.lithology) {
          filterConditions.push(['==', ['coalesce', ['get', 'lith'], ''], sub.lithology])
        }
      } else if (selectedComponent && lithoHierarchy) {
        // if a component was selected, try to filter by lith string if it matches a lith value
        const div = lithoHierarchy.divisions.find((d) => d.name === selectedDivision)
        const sub = div?.subdivisions?.find((s) => s.name === selectedSubdivision)
        // components are free text; prefer lith match if component equals a lith
        if (selectedComponent) filterConditions.push(['==', ['coalesce', ['get', 'lith'], ''], selectedComponent])
      }
    } else {
      if (selectedFormation) filterConditions.push(['==', ['coalesce', ['get', 'formation'], ''], selectedFormation])
    }
    if (selectedMember) filterConditions.push(['==', ['coalesce', ['get', 'member'], ''], selectedMember])
    return filterConditions.length ? ['all', ...base.slice(1), ...filterConditions] : base
  }, [search, young, old, selectedSupergroup, selectedGroup, selectedFormation, selectedMember, divisionMode, lithoHierarchy, selectedDivision, selectedSubdivision, selectedComponent])

  useEffect(() => {
    const map = mapRef.current
    if (!isReady || !map?.getLayer('geology-units')) return
    map.setFilter('geology-units', filter)
    map.setFilter('geology-outline', filter)
    if (map.getLayer('dharwar-units')) {
      map.setFilter('dharwar-units', dharwarFilter)
      map.setFilter('dharwar-outline', dharwarFilter)
    }
  }, [filter, dharwarFilter, isReady])

  useEffect(() => {
    const map = mapRef.current
    if (!isReady) return
    if (map.getLayer('dharwar-units')) {
      map.setLayoutProperty('dharwar-units', 'visibility', showDharwar ? 'visible' : 'none')
      map.setLayoutProperty('dharwar-outline', 'visibility', showDharwar ? 'visible' : 'none')
      map.setLayoutProperty('dharwar-lines', 'visibility', showDharwar ? 'visible' : 'none')
    }
  }, [showDharwar, isReady])

  const reset = () => {
    setSearch('')
    setYoung(0)
    setOld(3600)
    setSelected(null)
    mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 52, maxZoom: 5.4 })
  }

  return <div className="atlas">
    <div ref={container} className="map" aria-label="Interactive geological map of India" />

    <header className="topbar">
      <div className="brand"><span className="brand-mark">◈</span><span>India Geological Atlas</span><small>beta</small></div>
      <div className="topbar-actions"><button onClick={reset}>Reset map</button><a href="https://macrostrat.org" target="_blank" rel="noreferrer">Data sources ↗</a></div>
    </header>

    <aside className="search-card">
      <p className="card-kicker">Explore Indian geology</p>
      <h1>Map of geological units</h1>
      <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search formation, unit or lithology" aria-label="Search geological units" /></label>
      <div className="mode-row">
        <label>
          <span>Division</span>
          <select value={divisionMode} onChange={(event) => {
            const v = event.target.value
            setDivisionMode(v)
            // reset stratigraphic selections when switching modes
            setSelectedSupergroup('')
            setSelectedGroup('')
            setSelectedFormation('')
            setSelectedMember('')
          }}>
            <option value="stratigraphic">Lithostratigraphic Classification</option>
            <option value="lithological">Chronostratigraphic Classification</option>
          </select>
        </label>
      </div>
      {divisionMode === 'stratigraphic' ? (
        <>
          <div className="dropdown-row">
            <label>
              <span>Supergroup</span>
              <select value={selectedSupergroup} onChange={(event) => {
                setSelectedSupergroup(event.target.value)
                setSelectedGroup('')
                setSelectedFormation('')
                setSelectedMember('')
              }}>
                <option value="">Select supergroup</option>
                {supergroupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label>
              <span>Group</span>
              <select disabled={!selectedSupergroup} value={selectedGroup} onChange={(event) => {
                setSelectedGroup(event.target.value)
                setSelectedFormation('')
                setSelectedMember('')
              }}>
                <option value="">{selectedSupergroup ? 'Select group' : 'Choose supergroup first'}</option>
                {selectedSupergroup && groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
          </div>
          <div className="dropdown-row">
            <label>
              <span>Formation</span>
              <select disabled={!selectedGroup} value={selectedFormation} onChange={(event) => {
                setSelectedFormation(event.target.value)
                setSelectedMember('')
              }}>
                <option value="">{selectedGroup ? 'Select formation' : 'Choose group first'}</option>
                {selectedGroup && formationOptions.map((formation) => <option key={formation} value={formation}>{formation}</option>)}
              </select>
            </label>
            <label>
              <span>Member</span>
              <select disabled={!selectedFormation} value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)}>
                <option value="">{selectedFormation ? 'Select member' : 'Choose formation first'}</option>
                {selectedFormation && memberOptions.map((member) => <option key={member} value={member}>{member}</option>)}
              </select>
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="dropdown-row">
            <label>
              <span>Division</span>
              <select value={selectedDivision} onChange={(event) => {
                setSelectedDivision(event.target.value)
                setSelectedSubdivision('')
                setSelectedComponent('')
              }}>
                <option value="">Select division</option>
                {divisionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>
              <span>Subdivision</span>
              <select disabled={!selectedDivision} value={selectedSubdivision} onChange={(event) => {
                setSelectedSubdivision(event.target.value)
                setSelectedComponent('')
              }}>
                <option value="">{selectedDivision ? 'Select subdivision' : 'Choose division first'}</option>
                {selectedDivision && subdivisionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="dropdown-row">
            <label>
              <span>Component</span>
              <select disabled={!selectedSubdivision} value={selectedComponent} onChange={(event) => setSelectedComponent(event.target.value)}>
                <option value="">{selectedSubdivision ? 'Select component' : 'Choose subdivision first'}</option>
                {selectedSubdivision && componentOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              <span />
              <select disabled>
                <option>—</option>
              </select>
            </label>
          </div>
        </>
      )}
      <div className="age-control">
        <div className="control-heading"><strong>Age range</strong><span>{young.toLocaleString()}–{old.toLocaleString()} Ma</span></div>
        <label><span>Older limit</span><input type="range" min="0" max="3600" value={old} onChange={(event) => setOld(Math.max(young, Number(event.target.value)))} /></label>
        <label><span>Younger limit</span><input type="range" min="0" max="3600" value={young} onChange={(event) => setYoung(Math.min(old, Number(event.target.value)))} /></label>
      </div>
      <p className="coverage-note">This view uses the Dharwar lithology dataset from NGDR/GSI. The base raster tiles remain a reference layer.</p>
    </aside>

    <aside className={`inspector ${panelOpen ? 'open' : ''}`}>
      <button className="inspector-toggle" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen}>{panelOpen ? '›' : '‹'}</button>
      <div className="inspector-content">
        <p className="card-kicker">Unit details</p>
        {selectedHierarchyDetails ? (
          <Details hierarchyItem={selectedHierarchyDetails} />
        ) : selected ? (
          <Details unit={selected} />
        ) : (
          <>
            <h2>Select a geological unit</h2>
            <p>Click a coloured polygon to inspect its name, mapped age, lithology, and source identifier.</p>
            <div className="legend"><span className="legend-swatch" /> Geological map unit <span className="legend-line" /> Structure or contact</div>
          </>
        )}
      </div>
    </aside>

    {schematicGeojson && <GeologicTimeSlider map={mapRef.current} geojsonData={schematicGeojson} />}

    <footer className="attribution">Geologic data: NGDR/GSI  dataset · Boundary reference: <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer">geoBoundaries</a> (2014, CC0) · Detail and coverage vary by source map</footer>
  </div>
}

function Details({ unit, hierarchyItem }) {
  if (hierarchyItem) {
    const { rank, title, parent, info } = hierarchyItem
    // lithological division rendering
    if (rank === 'division' || rank === 'subdivision' || rank === 'component') {
      return <>
        <h2>{title}</h2>
        <dl>
          <div><dt>Rank</dt><dd>{rank}</dd></div>
          {info?.age && <div><dt>Age</dt><dd>{info.age}</dd></div>}
          {(info?.lithology_character || info?.lithology) && <div><dt>Lithology</dt><dd>{info.lithology_character || info.lithology}</dd></div>}
          {info?.description && <div><dt>Description</dt><dd>{info.description}</dd></div>}
          {info?.region && <div><dt>Region</dt><dd>{info.region}</dd></div>}
          {info?.related_supergroup && <div><dt>Related supergroup</dt><dd>{info.related_supergroup}</dd></div>}
          {rank === 'division' && info?.subdivisions && info.subdivisions.length > 0 && <div><dt>Subdivisions</dt><dd>{info.subdivisions.map((s) => s.name).join(', ')}</dd></div>}
          {rank === 'subdivision' && info?.components && info.components.length > 0 && <div><dt>Components</dt><dd>{info.components.join(', ')}</dd></div>}
        </dl>
      </>
    }
    // default stratigraphic rendering
    return <>
      <h2>{title}</h2>
      <dl>
        <div><dt>Rank</dt><dd>{rank}</dd></div>
        {info?.topInfo?.age && <div><dt>Age</dt><dd>{info.topInfo.age}</dd></div>}
        {info?.topInfo?.region && <div><dt>Region</dt><dd>{info.topInfo.region}</dd></div>}
        {info?.topInfo?.unconformably_overlies && <div><dt>Overlies</dt><dd>{info.topInfo.unconformably_overlies}</dd></div>}
        {parent?.supergroup && <div><dt>Supergroup</dt><dd>{parent.supergroup}</dd></div>}
        {parent?.group && <div><dt>Group</dt><dd>{parent.group}</dd></div>}
        {parent?.formation && <div><dt>Formation</dt><dd>{parent.formation}</dd></div>}
        {info?.note && <div><dt>Note</dt><dd>{info.note}</dd></div>}
        {info?.members && info.members.length > 0 && <div><dt>Members</dt><dd>{info.members.join(', ')}</dd></div>}
        {info?.formations && info.formations.length > 0 && <div><dt>Formations</dt><dd>{info.formations.map((f) => f.name).join(', ')}</dd></div>}
        {info?.raw && <div><dt>Raw</dt><dd>{JSON.stringify(info.raw).slice(0, 200)}...</dd></div>}
      </dl>
    </>
  }
  if (!unit) return null
  const title = value(unit.strat_name, value(unit.name, 'Unnamed unit'))
  return <>
    <h2>{title}</h2>
    {unit.name && unit.name !== unit.strat_name && <p className="alternate-name">{unit.name}</p>}
    <dl>
      <div><dt>Age</dt><dd>{age(unit.best_b_age)} – {age(unit.best_t_age)}</dd></div>
      <div><dt>Time intervals</dt><dd>{value(unit.b_int_name)} – {value(unit.t_int_name)}</dd></div>
      <div><dt>Lithology</dt><dd>{value(unit.lith)}</dd></div>
      <div><dt>Description</dt><dd>{value(unit.descrip)}</dd></div>
      <div><dt>Source</dt><dd>{unit.source_id ? `NGDR/GSI source ${unit.source_id}` : 'Not supplied'}</dd></div>
    </dl>
  </>
}
