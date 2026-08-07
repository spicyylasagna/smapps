import { useEffect, useMemo, useRef, useState } from 'react'
import { Map, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import GeologicTimeSlider from './GeologicTimeSlider.jsx'
import StratigraphyPage from './StratigraphyPage.jsx'

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
// Geologic Eons of Earth history
const GEOLOGIC_EONS = [
  { id: 'archean', name: 'Archean Eon', ageRange: '3600 - 2500 Ma', defaultAge: 4000 },
  { id: 'proterozoic', name: 'Proterozoic Eon', ageRange: '2500 - 541 Ma', defaultAge: 2500 },
  { id: 'phanerozoic', name: 'Phanerozoic Eon', ageRange: '541 Ma - Present', defaultAge: 541 },
]

// Indian Cratons & Basins with Eon and Supergroup Associations
const INDIAN_CRATONS = [
  // Archean Eon
  {
    id: 'dharwar',
    name: 'Dharwar Craton',
    region: 'Karnataka, Goa, Western AP',
    eonId: 'archean',
    ageRange: 'c. 3600–2500 Ma',
    supergroups: ['Dharwar Supergroup', 'Archean Basement'],
  },
  {
    id: 'bastar',
    name: 'Bastar Craton',
    region: 'Chhattisgarh, Odisha, MP',
    eonId: 'archean',
    ageRange: 'c. 3600–2500 Ma',
    supergroups: ['Archean Basement'],
  },
  {
    id: 'singhbhum',
    name: 'Singhbhum Craton',
    region: 'Jharkhand, Northern Odisha',
    eonId: 'archean',
    ageRange: 'c. 3500–2500 Ma',
    supergroups: ['Archean Basement'],
  },
  {
    id: 'bundelkhand',
    name: 'Bundelkhand Craton',
    region: 'Madhya Pradesh, Southern UP',
    eonId: 'archean',
    ageRange: 'c. 3300–2500 Ma',
    supergroups: ['Archean Basement'],
  },
  {
    id: 'aravalli',
    name: 'Aravalli Craton / Belt',
    region: 'Rajasthan, Northern Gujarat',
    eonId: 'archean',
    ageRange: 'c. 3300–2500 Ma',
    supergroups: ['Archean Basement'],
  },

  // Proterozoic Eon
  {
    id: 'cuddapah_basin',
    name: 'Cuddapah Basin',
    region: 'Andhra Pradesh, Telangana',
    eonId: 'proterozoic',
    ageRange: 'c. 1900–500 Ma',
    supergroups: ['Cuddapah Supergroup', 'Kurnool Supergroup'],
  },
  {
    id: 'vindhyan_basin',
    name: 'Vindhyan Basin',
    region: 'MP, UP, Rajasthan',
    eonId: 'proterozoic',
    ageRange: 'c. 1700–650 Ma',
    supergroups: ['Vindhyan Supergroup', 'Mahakoshal Supergroup'],
  },
  {
    id: 'aravalli_delhi_belt',
    name: 'Aravalli-Delhi Proterozoic Belt',
    region: 'Rajasthan, Haryana',
    eonId: 'proterozoic',
    ageRange: 'c. 2200–1000 Ma',
    supergroups: ['Aravalli Supergroup', 'Delhi Supergroup'],
  },
  {
    id: 'kaladgi_bhima_basin',
    name: 'Kaladgi-Bhima Basin',
    region: 'Northern Karnataka',
    eonId: 'proterozoic',
    ageRange: 'c. 1800–1000 Ma',
    supergroups: ['Kaladgi Supergroup', 'Bhima Supergroup'],
  },
  {
    id: 'chhattisgarh_basin',
    name: 'Chhattisgarh Basin',
    region: 'Chhattisgarh, Odisha',
    eonId: 'proterozoic',
    ageRange: 'c. 1500–1000 Ma',
    supergroups: ['Chhattisgarh Supergroup'],
  },

  // Phanerozoic Eon (Only Phanerozoic sequences)
  {
    id: 'spiti_basin',
    name: 'Spiti Basin (Tethyan Himalaya)',
    region: 'Himachal Pradesh',
    eonId: 'phanerozoic',
    ageRange: 'c. 541–252 Ma',
    supergroups: ['Paleozoic of Spiti'],
  },
  {
    id: 'kashmir_basin',
    name: 'Kashmir Basin (Tethyan Himalaya)',
    region: 'Jammu & Kashmir',
    eonId: 'phanerozoic',
    ageRange: 'c. 541–252 Ma',
    supergroups: ['Paleozoic of Kashmir'],
  },
  {
    id: 'gondwana_basins',
    name: 'Gondwana Basins (Peninsular India)',
    region: 'Damodar, Mahanadi, Godavari',
    eonId: 'phanerozoic',
    ageRange: 'c. 300–100 Ma',
    supergroups: ['Gondwana Supergroup'],
  },
  {
    id: 'deccan_traps',
    name: 'Deccan Traps / Volcanic Province',
    region: 'Maharashtra, MP, Gujarat',
    eonId: 'phanerozoic',
    ageRange: 'c. 66 Ma',
    supergroups: ['Deccan Traps'],
  },
]

export default function App() {
  const container = useRef(null)
  const mapRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  // VIEW TAB NAVIGATION STATE ('map' | 'stratigraphy')
  const [activeTab, setActiveTab] = useState('map')

  // SHARED STATE FOR LAYERS (Slider starts at 4000 Ma; first map layer appears at 3600 Ma)
  const [currentAge, setCurrentAge] = useState(4000)
  const [showChronostrat, setShowChronostrat] = useState(true)
  const [showLithostrat, setShowLithostrat] = useState(true)
  const [macrostratIgnoreAge, setMacrostratIgnoreAge] = useState(false)

  // EON & CRATON FILTER STATE
  const [selectedEon, setSelectedEon] = useState('')
  const [selectedCraton, setSelectedCraton] = useState('')

  // SIDEBAR & SEARCH STATE
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [panelOpen, setPanelOpen] = useState(true)

  // HIERARCHY STATE
  const [rawHierarchyData, setRawHierarchyData] = useState(null)
  const [supergroupHierarchy, setSupergroupHierarchy] = useState({})
  const [selectedSupergroup, setSelectedSupergroup] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')
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
        layout: {
          'fill-sort-key': ['-', 4000, ['to-number', ['coalesce', ['get', 'best_age_bottom'], ['get', 'best_b_age'], ['get', 'b_age'], 0]]]
        },
        paint: { 'fill-color': ['coalesce', ['get', 'color'], '#b99463'], 'fill-opacity': 0.72 },
      })
      
      // Load India Mask (Add BEFORE geology-units so geology units are always drawn on top!)
      fetch(INDIA_BOUNDARY).then(res => res.json()).then(collection => {
        if (!map.getSource('india-mask')) {
          const geometry = collection.features?.[0]?.geometry
          const outerRing = [[35, -15], [125, -15], [125, 55], [35, 55], [35, -15]]
          const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
          const indiaHoles = polygons.map(p => p[0].slice().reverse())
          const mask = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [outerRing, ...indiaHoles] } }
          map.addSource('india-mask', { type: 'geojson', data: mask })
          if (map.getLayer('geology-units')) {
            map.addLayer({ id: 'india-mask', type: 'fill', source: 'india-mask', paint: { 'fill-color': '#e8e3d8', 'fill-opacity': 0.8 } }, 'geology-units')
          } else {
            map.addLayer({ id: 'india-mask', type: 'fill', source: 'india-mask', paint: { 'fill-color': '#e8e3d8', 'fill-opacity': 0.8 } })
          }
        }
      }).catch(err => console.warn('India boundary mask load error:', err))

      map.addLayer({
        id: 'geology-units', type: 'fill', source: 'macrostrat', 'source-layer': 'units',
        layout: {
          'fill-sort-key': ['-', 4000, ['to-number', ['coalesce', ['get', 'best_age_bottom'], ['get', 'best_b_age'], ['get', 'b_age'], 0]]]
        },
        paint: { 'fill-color': ['coalesce', ['get', 'color'], '#b99463'], 'fill-opacity': 0.72 },
      })
      map.addLayer({
        id: 'geology-outline', type: 'line', source: 'macrostrat', 'source-layer': 'units',
        layout: {
          'line-sort-key': ['-', 4000, ['to-number', ['coalesce', ['get', 'best_age_bottom'], ['get', 'best_b_age'], ['get', 'b_age'], 0]]]
        },
        paint: { 'line-color': '#554a3d', 'line-width': 0.45, 'line-opacity': 0.65 },
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
    fetch('/india_lithostratigraphy_schematic.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setSchematicGeojson(data))
      .catch(err => console.error('Error loading schematic GeoJSON:', err))

    fetch('/india_lithological_divisions.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setLithoHierarchy(data))
      .catch(err => console.error('Error loading lithological divisions JSON:', err))

    fetch('/data/gsi_stratigraphic_hierarchy_india_v2.json')
      .then(r => r.ok ? r.json() : null)
      .then(raw => {
        if (!raw) return
        setRawHierarchyData(raw)
        const out = {}
        if (raw.archean_basement) {
          out['Archean Basement'] = {
            title: raw.archean_basement.name,
            info: raw.archean_basement,
            craton_sequences: raw.archean_basement.craton_sequences,
            components: raw.archean_basement.components,
            groups: []
          }
        }
        raw.supergroups?.forEach(sg => {
          out[sg.name] = {
            title: sg.name,
            info: sg,
            source: sg.source,
            regional_variants: sg.regional_variants || null,
            groups: sg.groups || []
          }
        })
        setSupergroupHierarchy(out)
      })
      .catch(err => console.error('Error loading stratigraphic hierarchy JSON:', err))
  }, [])

  // Cascading Craton Options based on Eon
  const cratonOptions = useMemo(() => {
    if (!selectedEon) return INDIAN_CRATONS
    return INDIAN_CRATONS.filter(c => c.eonId === selectedEon)
  }, [selectedEon])

  // Cascading Supergroup Options based on selected Craton & selected Eon
  const supergroupOptions = useMemo(() => {
    const allKeys = Object.keys(supergroupHierarchy)
    if (selectedCraton) {
      const cratonObj = INDIAN_CRATONS.find(c => c.id === selectedCraton)
      if (cratonObj) return allKeys.filter(key => cratonObj.supergroups.includes(key))
    }
    if (selectedEon) {
      const eonCratons = INDIAN_CRATONS.filter(c => c.eonId === selectedEon)
      const allowedSupergroups = new Set(eonCratons.flatMap(c => c.supergroups))
      return allKeys.filter(key => allowedSupergroups.has(key))
    }
    return allKeys
  }, [supergroupHierarchy, selectedEon, selectedCraton])

  const currentSupergroupObj = useMemo(() => supergroupHierarchy[selectedSupergroup], [selectedSupergroup, supergroupHierarchy])

  const variantOptions = useMemo(() => {
    if (!currentSupergroupObj) return []
    if (currentSupergroupObj.regional_variants) {
      return currentSupergroupObj.regional_variants.map(v => v.variant_name)
    }
    return []
  }, [currentSupergroupObj])

  // Automatically select the first regional variant when supergroup changes
  useEffect(() => {
    if (variantOptions.length > 0 && !variantOptions.includes(selectedVariant)) {
      setSelectedVariant(variantOptions[0])
    }
  }, [variantOptions, selectedVariant])

  const groupOptions = useMemo(() => {
    if (!currentSupergroupObj) return []
    if (currentSupergroupObj.regional_variants) {
      const variant = currentSupergroupObj.regional_variants.find(v => v.variant_name === selectedVariant) || currentSupergroupObj.regional_variants[0]
      return variant?.groups?.map(g => g.name) || []
    }
    return currentSupergroupObj.groups?.map(g => g.name) || []
  }, [currentSupergroupObj, selectedVariant])

  const formationOptions = useMemo(() => {
    if (!currentSupergroupObj) return []
    let groupsList = []
    if (currentSupergroupObj.regional_variants) {
      const variant = currentSupergroupObj.regional_variants.find(v => v.variant_name === selectedVariant) || currentSupergroupObj.regional_variants[0]
      groupsList = variant?.groups || []
    } else {
      groupsList = currentSupergroupObj.groups || []
    }
    const g = groupsList.find(x => x.name === selectedGroup)
    return g?.formations ? g.formations.map(f => f.name) : []
  }, [currentSupergroupObj, selectedVariant, selectedGroup])

  const memberOptions = useMemo(() => {
    if (!currentSupergroupObj || !selectedFormation) return []
    let groupsList = []
    if (currentSupergroupObj.regional_variants) {
      const variant = currentSupergroupObj.regional_variants.find(v => v.variant_name === selectedVariant) || currentSupergroupObj.regional_variants[0]
      groupsList = variant?.groups || []
    } else {
      groupsList = currentSupergroupObj.groups || []
    }
    const g = groupsList.find(x => x.name === selectedGroup)
    const f = g?.formations?.find(x => x.name === selectedFormation)
    if (!f?.members) return []
    return f.members.map(m => (typeof m === 'string' ? m : m.name))
  }, [currentSupergroupObj, selectedVariant, selectedGroup, selectedFormation])

  // Selected Division Objects for Division Breakdown up to Members
  const selectedVariantObj = useMemo(() => {
    if (!currentSupergroupObj?.regional_variants) return null
    return currentSupergroupObj.regional_variants.find(v => v.variant_name === selectedVariant) || null
  }, [currentSupergroupObj, selectedVariant])

  const selectedGroupObj = useMemo(() => {
    if (!currentSupergroupObj) return null
    let groupsList = currentSupergroupObj.regional_variants
      ? (selectedVariantObj?.groups || [])
      : (currentSupergroupObj.groups || [])
    return groupsList.find(g => g.name === selectedGroup) || null
  }, [currentSupergroupObj, selectedVariantObj, selectedGroup])

  const selectedFormationObj = useMemo(() => {
    if (!selectedGroupObj?.formations) return null
    return selectedGroupObj.formations.find(f => f.name === selectedFormation) || null
  }, [selectedGroupObj, selectedFormation])

  const selectedMemberObj = useMemo(() => {
    if (!selectedFormationObj?.members) return null
    const m = selectedFormationObj.members.find(mem => (typeof mem === 'string' ? mem : mem.name) === selectedMember)
    if (!m) return null
    return typeof m === 'string' ? { name: m } : m
  }, [selectedFormationObj, selectedMember])

  // Active Source Calculation for Verified Academic Citations
  const activeSource = useMemo(() => {
    if (selected?.source) return selected.source
    if (selectedSupergroup) {
      const sgObj = supergroupHierarchy[selectedSupergroup]
      if (sgObj?.source) return sgObj.source
      if (sgObj?.info?.source) return sgObj.info.source
      if (selectedSupergroup === 'Archean Basement' && rawHierarchyData?.archean_basement?.craton_sequences) {
        const activeTarget = (selectedFormation || selectedGroup || selectedVariant || '').toLowerCase()
        if (activeTarget.includes('bastar') || activeTarget.includes('kotri') || activeTarget.includes('sukma') || activeTarget.includes('bengpal')) {
          return rawHierarchyData.archean_basement.craton_sequences.bastar?.source
        }
        return rawHierarchyData.archean_basement.craton_sequences.dharwar?.source
      }
    }
    return null
  }, [selected, selectedSupergroup, selectedVariant, selectedGroup, selectedFormation, supergroupHierarchy, rawHierarchyData])

  // 4. Multi-Layer Filter Engine
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    const map = mapRef.current;

    // 1. Handle Layer Visibility
    const chronostratVis = showChronostrat ? 'visible' : 'none';
    if (map.getLayer('geology-units')) map.setLayoutProperty('geology-units', 'visibility', chronostratVis);
    if (map.getLayer('geology-outline')) map.setLayoutProperty('geology-outline', 'visibility', chronostratVis);

    const lithostratVis = showLithostrat ? 'visible' : 'none';
    if (map.getLayer('schematic-fill')) map.setLayoutProperty('schematic-fill', 'visibility', lithostratVis);
    if (map.getLayer('schematic-line')) map.setLayoutProperty('schematic-line', 'visibility', lithostratVis);

    // 2. Build the Filter Array
    let filters = ['all'];

    if (showChronostrat && !macrostratIgnoreAge && currentAge < 4000) {
      const raw_b_age = ['to-number', ['coalesce', ['get', 'best_age_bottom'], ['get', 'best_b_age'], ['get', 'b_age'], ['get', 'b_int_age'], 0]];
      const b_age = ['min', raw_b_age, 3600];
      filters.push(['>=', b_age, currentAge]);
    }

    // 3. Search Query Logic
    if (search.trim()) {
      const q = search.toLowerCase();
      const has = (key) => ['>=', ['index-of', q, ['downcase', ['to-string', ['coalesce', ['get', key], '']]]], 0];
      filters.push(['any', has('name'), has('strat_name'), has('lith'), has('descrip'), has('comments'), has('b_int'), has('t_int')]);
    }

    // 4. Apply to Map Layers
    const finalFilter = filters.length > 1 ? filters : null;

    if (map.getLayer('geology-units')) {
      map.setFilter('geology-units', finalFilter);
    }
    if (map.getLayer('geology-outline')) {
      map.setFilter('geology-outline', finalFilter);
    }
  }, [currentAge, showChronostrat, showLithostrat, macrostratIgnoreAge, search, isReady]);

  // 5. Hierarchy Selection Highlight & Dimming Engine
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    const map = mapRef.current;
    const activeTarget = selectedMember || selectedFormation || selectedGroup || selectedVariant || selectedSupergroup;

    if (!activeTarget) {
      // Reset Opacities & Colors to Default
      if (map.getLayer('geology-units')) {
        map.setPaintProperty('geology-units', 'fill-opacity', 0.72);
      }
      if (map.getLayer('geology-outline')) {
        map.setPaintProperty('geology-outline', 'line-width', 0.45);
        map.setPaintProperty('geology-outline', 'line-color', '#554a3d');
        map.setPaintProperty('geology-outline', 'line-opacity', 0.65);
      }
      if (map.getLayer('schematic-fill')) {
        map.setPaintProperty('schematic-fill', 'fill-opacity', ['case', ['==', ['get', 'age_uncertain'], true], 0.3, 0.7]);
      }
      if (map.getLayer('schematic-line')) {
        map.setPaintProperty('schematic-line', 'line-width', 1.0);
        map.setPaintProperty('schematic-line', 'line-color', '#4d2f16');
      }
      return;
    }

    // Extract core keyword e.g. "Dharwar Supergroup" -> "dharwar"
    let kw = activeTarget.replace(/ (Supergroup|Group|Formation|Member|Complex)$/i, '').toLowerCase().trim();
    if (activeTarget === 'Archean Basement' || kw === 'archean') {
      kw = 'archean';
    }

    // Move age slider so target supergroup formation polygon is visible
    let targetAge = null;
    if (schematicGeojson?.features) {
      const targetFeature = schematicGeojson.features.find(f => {
        const name = (f.properties.name || '').toLowerCase();
        const div = (f.properties.classical_division || '').toLowerCase();
        return name.includes(kw) || div.includes(kw);
      });
      if (targetFeature?.properties?.age_min_ma) {
        targetAge = targetFeature.properties.age_min_ma;
      }
    }
    if (!targetAge) {
      const SUPERGROUP_AGES = {
        'archean': 3600,
        'dharwar': 3000,
        'aravalli': 2200,
        'mahakoshal': 2000,
        'cuddapah': 1900,
        'kaladgi': 1800,
        'delhi': 1700,
        'vindhyan': 1700,
        'chhattisgarh': 1500,
        'bhima': 1000,
        'kurnool': 900,
      };
      targetAge = SUPERGROUP_AGES[kw];
    }

    if (targetAge && currentAge > targetAge) {
      setCurrentAge(targetAge);
    }

    // MapLibre expression matching keyword in features
    const hasKw = (key) => ['>=', ['index-of', kw, ['downcase', ['to-string', ['coalesce', ['get', key], '']]]], 0];
    const unitMatch = ['any', hasKw('name'), hasKw('strat_name'), hasKw('comments'), hasKw('descrip')];
    const schematicMatch = ['any', hasKw('name'), hasKw('classical_division')];

    // Highlight matching features & Dim non-matching features
    if (map.getLayer('geology-units')) {
      map.setPaintProperty('geology-units', 'fill-opacity', ['case', unitMatch, 0.95, 0.12]);
    }
    if (map.getLayer('geology-outline')) {
      map.setPaintProperty('geology-outline', 'line-width', ['case', unitMatch, 2.0, 0.2]);
      map.setPaintProperty('geology-outline', 'line-color', ['case', unitMatch, '#d35400', '#554a3d']);
      map.setPaintProperty('geology-outline', 'line-opacity', ['case', unitMatch, 1.0, 0.15]);
    }
    if (map.getLayer('schematic-fill')) {
      map.setPaintProperty('schematic-fill', 'fill-opacity', ['case', schematicMatch, 0.95, 0.12]);
    }
    if (map.getLayer('schematic-line')) {
      map.setPaintProperty('schematic-line', 'line-width', ['case', schematicMatch, 2.8, 0.4]);
      map.setPaintProperty('schematic-line', 'line-color', ['case', schematicMatch, '#e65100', '#4d2f16']);
    }

    // Zoom map to fit the selected Supergroup / feature geometry
    if (schematicGeojson?.features) {
      const targetFeature = schematicGeojson.features.find(f => {
        const name = (f.properties.name || '').toLowerCase();
        const div = (f.properties.classical_division || '').toLowerCase();
        return name.includes(kw) || div.includes(kw);
      });
      if (targetFeature && targetFeature.geometry) {
        const rawCoords = targetFeature.geometry.coordinates;
        const coords = targetFeature.geometry.type === 'MultiPolygon'
          ? rawCoords.flat(2)
          : rawCoords.flat(1);
        let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
        coords.forEach(([lng, lat]) => {
          if (typeof lng === 'number' && typeof lat === 'number') {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        });
        if (minLng < maxLng && minLat < maxLat) {
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 90, maxZoom: 7, duration: 1000 });
        }
      }
    }
  }, [selectedSupergroup, selectedVariant, selectedGroup, selectedFormation, selectedMember, isReady, schematicGeojson, currentAge, setCurrentAge]);

  const reset = () => {
    setSearch(''); setCurrentAge(4000); setSelected(null); setSelectedEon(''); setSelectedCraton(''); setSelectedSupergroup(''); setSelectedVariant(''); setSelectedGroup(''); setSelectedFormation(''); setSelectedMember('');
    mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 52 })
  }

  const handleNavigateToMap = (cratonName, unitName) => {
    setActiveTab('map');
    if (unitName) {
      const matchedKey = Object.keys(supergroupHierarchy).find(k =>
        k.toLowerCase().includes(unitName.toLowerCase()) || unitName.toLowerCase().includes(k.toLowerCase())
      );
      if (matchedKey) {
        setSelectedSupergroup(matchedKey);
      }
    }
  }

  return (
    <div className="atlas">
      <div ref={container} className="map" />

      <header className="topbar">
        <div className="brand"><span className="brand-mark">◈</span><span>India Geological Atlas</span><small>beta</small></div>

        <div className="topbar-nav">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            🗺️ Map View
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'stratigraphy' ? 'active' : ''}`}
            onClick={() => setActiveTab('stratigraphy')}
          >
            📜 Stratigraphy
          </button>
        </div>

        <div className="topbar-actions"><button onClick={reset}>Reset map</button></div>
      </header>

      {/* STRATIGRAPHY WORKBENCH PAGE */}
      {activeTab === 'stratigraphy' && (
        <StratigraphyPage
          rawHierarchyData={rawHierarchyData}
          supergroupHierarchy={supergroupHierarchy}
          indianCratons={INDIAN_CRATONS}
          geologicEons={GEOLOGIC_EONS}
          onNavigateToMap={handleNavigateToMap}
        />
      )}

      {/* MAP VIEW CONTROLS & INSPECTOR */}
      {activeTab === 'map' && (
        <>
          <aside className="search-card">
            <p className="card-kicker">Controls & Layers</p>

            <div className="layer-toggle-group">
              <label className="toggle-item">
                <input type="checkbox" checked={showChronostrat} onChange={e => setShowChronostrat(e.target.checked)} />
                <span>Show Chronstratigraphic Divisions</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" checked={showLithostrat} onChange={e => setShowLithostrat(e.target.checked)} />
                <span>Show Lithostratigraphic Divisions</span>
              </label>
              <label className={`toggle-item ${(!showChronostrat && !showLithostrat) ? 'disabled' : ''}`}>
                <input type="checkbox" disabled={!showChronostrat && !showLithostrat} checked={macrostratIgnoreAge} onChange={e => setMacrostratIgnoreAge(e.target.checked)} />
                <span>Ignore Age (Show Full Map)</span>
              </label>
            </div>

            <label className="search-box">
              <span>⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Macrostrat units..." />
            </label>

            {/* 1. Geologic Eons Dropdown */}
            <div className="mode-row">
              <label><span>Geologic Eon</span>
                <select value={selectedEon} onChange={e => {
                  const eonId = e.target.value;
                  setSelectedEon(eonId);
                  setSelectedCraton('');
                  setSelectedSupergroup('');
                  setSelectedVariant('');
                  setSelectedGroup('');
                  setSelectedFormation('');
                  setSelectedMember('');
                  const eonObj = GEOLOGIC_EONS.find(x => x.id === eonId);
                  if (eonObj) setCurrentAge(eonObj.defaultAge);
                }}>
                  <option value="">All Eons (Show Full Timeline)</option>
                  {GEOLOGIC_EONS.map(eon => (
                    <option key={eon.id} value={eon.id}>{eon.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 2. Indian Cratons Dropdown (Cascades from selected Eon) */}
            <div className="mode-row">
              <label><span>Indian Craton / Basin</span>
                <select value={selectedCraton} onChange={e => {
                  const cratonId = e.target.value;
                  setSelectedCraton(cratonId);
                  setSelectedSupergroup('');
                  setSelectedVariant('');
                  setSelectedGroup('');
                  setSelectedFormation('');
                  setSelectedMember('');
                }}>
                  <option value="">Select Craton / Region...</option>
                  {cratonOptions.map(craton => (
                    <option key={craton.id} value={craton.id}>{craton.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 3. Supergroup / Reference Hierarchy Dropdown (Cascades from selected Craton) */}
            <div className="mode-row">
              <label><span>Supergroup / Basement</span>
                <select value={selectedSupergroup} onChange={e => { setSelectedSupergroup(e.target.value); setSelectedVariant(''); setSelectedGroup(''); setSelectedFormation(''); setSelectedMember(''); }}>
                  <option value="">Select Supergroup...</option>
                  {supergroupOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
            </div>

            {/* Regional Variants Selector Tabs (Preserves parallel regional sequence structure without merging) */}
            {variantOptions.length > 0 && (
              <div className="variant-select-row">
                <span className="variant-label">Regional Sequence Variant:</span>
                <div className="variant-pill-group">
                  {variantOptions.map(vName => (
                    <button
                      key={vName}
                      type="button"
                      className={`variant-pill ${selectedVariant === vName ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedVariant(vName);
                        setSelectedGroup('');
                        setSelectedFormation('');
                        setSelectedMember('');
                      }}
                    >
                      {vName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="dropdown-row">
              <label><span>Group / Unit</span>
                <select disabled={!selectedSupergroup} value={selectedGroup} onChange={e => { setSelectedGroup(e.target.value); setSelectedFormation(''); setSelectedMember(''); }}>
                  <option value="">Select Group...</option>
                  {groupOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <label><span>Formation</span>
                <select disabled={!selectedGroup || formationOptions.length === 0} value={selectedFormation} onChange={e => { setSelectedFormation(e.target.value); setSelectedMember(''); }}>
                  <option value="">Select Formation...</option>
                  {formationOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
            </div>

            {/* Member Level Dropdown */}
            {memberOptions.length > 0 && (
              <div className="mode-row" style={{ marginTop: '8px' }}>
                <label><span>Member</span>
                  <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                    <option value="">Select Member...</option>
                    {memberOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
              </div>
            )}

            <button
              type="button"
              className="clear-selections-btn"
              disabled={!selectedEon && !selectedCraton && !selectedSupergroup && !selectedGroup && !selectedFormation && !selectedMember}
              onClick={() => {
                setSelectedEon('');
                setSelectedCraton('');
                setSelectedSupergroup('');
                setSelectedVariant('');
                setSelectedGroup('');
                setSelectedFormation('');
                setSelectedMember('');
                setSelected(null);
                mapRef.current?.fitBounds(INDIA_BOUNDS, { padding: 52 });
              }}
            >
              Clear selections
            </button>
          </aside>

          <aside className={`inspector ${panelOpen ? 'open' : ''}`}>
            <button className="inspector-toggle" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? '›' : '‹'}</button>
            <div className="inspector-content">
              <p className="card-kicker">Unit Details</p>
              {selected ? (
                <div className="details-view">
                  <h2>{selected.strat_name || selected.name || 'Unnamed Unit'}</h2>
                  <dl>
                    <div>
                      <dt>Age</dt>
                      <dd>
                        {age(selected.best_age_bottom ?? selected.best_b_age ?? selected.b_age)} – {age(selected.best_age_top ?? selected.best_t_age ?? selected.t_age)}
                      </dd>
                    </div>
                    <div><dt>Interval</dt><dd>{value(selected.b_int || selected.t_int || selected.age)}</dd></div>
                    <div><dt>Lithology</dt><dd>{value(selected.lith)}</dd></div>
                    <div><dt>Description</dt><dd>{value(selected.descrip)}</dd></div>
                  </dl>

                  {/* Source Verification Badge */}
                  {activeSource ? (
                    <div className="source-badge verified">
                      <span className="badge-icon">✓</span>
                      <div className="badge-text">
                        <strong>Verified Academic Reference</strong>
                        <p>{activeSource}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="source-badge literature">
                      <span className="badge-icon">📖</span>
                      <div className="badge-text">
                        <strong>Source</strong>
                        <p>
                          Chorlton, L. B. (2007). <em>Generalized geology of the world: bedrock domains and major faults in GIS format: a small-scale world geology map with an extended geological attribute database</em>. Geological Survey of Canada, Open File, 5529, 48. Natural Resources Canada. <a href="https://doi.org/10.4095/223767" target="_blank" rel="noreferrer" style={{ color: '#be5b35', wordBreak: 'break-all' }}>doi:10.4095/223767</a>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h2>{selectedMember || selectedFormation || selectedGroup || selectedVariant || selectedSupergroup || 'Select a unit'}</h2>
                  <p>{selectedSupergroup ? 'Division hierarchy selection up to members:' : 'Click the map to see details from the Macrostrat database or select from hierarchy controls.'}</p>

                  {/* Detailed Breakdown Up To Members Displaying Age and Source for Each Division */}
                  {currentSupergroupObj && (
                    <div className="hierarchy-breakdown">
                      <div className="breakdown-card">
                        <div className="breakdown-level">
                          <span className="level-badge supergroup">SUPERGROUP</span>
                          <strong className="level-title">{currentSupergroupObj.title}</strong>
                          <div className="level-details">
                            <p><strong>Age:</strong> {currentSupergroupObj.info?.age || 'Not specified'}</p>
                            <p><strong>Source:</strong> {currentSupergroupObj.source || 'General Literature / GSI Memoir'}</p>
                          </div>
                        </div>

                        {selectedVariantObj && (
                          <div className="breakdown-level variant">
                            <span className="level-badge variant">REGIONAL VARIANT</span>
                            <strong className="level-title">{selectedVariantObj.variant_name}</strong>
                            <div className="level-details">
                              <p><strong>Age:</strong> {selectedVariantObj.age || currentSupergroupObj.info?.age || 'Not specified'}</p>
                              <p><strong>Source:</strong> {selectedVariantObj.source || currentSupergroupObj.source || 'General Literature'}</p>
                            </div>
                          </div>
                        )}

                        {selectedGroupObj && (
                          <div className="breakdown-level group">
                            <span className="level-badge group">GROUP / UNIT</span>
                            <strong className="level-title">{selectedGroupObj.name}</strong>
                            <div className="level-details">
                              <p><strong>Age:</strong> {selectedGroupObj.age || selectedVariantObj?.age || currentSupergroupObj.info?.age || 'Not specified'}</p>
                              <p><strong>Source:</strong> {selectedGroupObj.source || selectedVariantObj?.source || currentSupergroupObj.source || 'General Literature'}</p>
                            </div>
                          </div>
                        )}

                        {selectedFormationObj && (
                          <div className="breakdown-level formation">
                            <span className="level-badge formation">FORMATION</span>
                            <strong className="level-title">{selectedFormationObj.name}</strong>
                            <div className="level-details">
                              <p><strong>Age:</strong> {selectedFormationObj.age || selectedGroupObj?.age || selectedVariantObj?.age || currentSupergroupObj.info?.age || 'Not specified'}</p>
                              <p><strong>Source:</strong> {selectedFormationObj.source || selectedGroupObj?.source || selectedVariantObj?.source || currentSupergroupObj.source || 'General Literature'}</p>
                            </div>
                          </div>
                        )}

                        {selectedMemberObj && (
                          <div className="breakdown-level member">
                            <span className="level-badge member">MEMBER</span>
                            <strong className="level-title">{selectedMemberObj.name || selectedMemberObj}</strong>
                            <div className="level-details">
                              <p><strong>Age:</strong> {selectedMemberObj.age || selectedFormationObj?.age || selectedGroupObj?.age || selectedVariantObj?.age || currentSupergroupObj.info?.age || 'Not specified'}</p>
                              <p><strong>Source:</strong> {selectedMemberObj.source || selectedFormationObj?.source || selectedGroupObj?.source || selectedVariantObj?.source || currentSupergroupObj.source || 'General Literature'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSource ? (
                    <div className="source-badge verified" style={{ marginTop: '16px' }}>
                      <span className="badge-icon">✓</span>
                      <div className="badge-text">
                        <strong>Verified Academic Reference</strong>
                        <p>{activeSource}</p>
                      </div>
                    </div>
                  ) : selectedSupergroup ? (
                    <div className="source-badge literature" style={{ marginTop: '16px' }}>
                      <span className="badge-icon">📖</span>
                      <div className="badge-text">
                        <strong>Source</strong>
                        <p>
                          Chorlton, L. B. (2007). <em>Generalized geology of the world: bedrock domains and major faults in GIS format: a small-scale world geology map with an extended geological attribute database</em>. Geological Survey of Canada, Open File, 5529, 48. Natural Resources Canada. <a href="https://doi.org/10.4095/223767" target="_blank" rel="noreferrer" style={{ color: '#be5b35', wordBreak: 'break-all' }}>doi:10.4095/223767</a>
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
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
        </>
      )}
    </div>
  )
}