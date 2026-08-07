import React, { useState, useMemo } from 'react'

// Academic References List
const ACADEMIC_CITATIONS = [
  { author: 'M.S. Krishnan', title: 'Geology of India and Burma', publisher: 'Higginbothams / CBS Publishers' },
  { author: 'Ravindra Kumar', title: 'Fundamentals of Historical Geology and Stratigraphy of India', publisher: 'New Age International Publishers' },
  { author: 'Geological Survey of India (GSI)', title: 'Stratigraphic Chart of India & GSI Memoirs (Vol. 124, 125 & Sp. Pub. 84)', publisher: 'Ministry of Mines, Govt. of India' },
  { author: 'M. Ramakrishnan & R. Vaidyanadhan', title: 'Geology of India (Vol. 1 & 2)', publisher: 'Geological Society of India, Bangalore' },
  { author: 'Chorlton, L. B. (2007)', title: 'Generalized geology of the world: bedrock domains and major faults in GIS format (Open File 5529)', publisher: 'Geological Survey of Canada / Natural Resources Canada, doi:10.4095/223767' }
]

export default function StratigraphyPage({ 
  rawHierarchyData, 
  supergroupHierarchy, 
  indianCratons, 
  geologicEons,
  onNavigateToMap 
}) {
  const [selectedEonId, setSelectedEonId] = useState('archean') // Archean selected by default
  const [selectedCratonId, setSelectedCratonId] = useState('dharwar')
  const [selectedVariantName, setSelectedVariantName] = useState('Western Dharwar Craton (WDC)')
  const [searchQuery, setSearchQuery] = useState('')

  // Interactive Expand / Collapse State for Groups & Formations
  const [expandedGroups, setExpandedGroups] = useState({})
  const [expandedFormations, setExpandedFormations] = useState({})
  const [allExpanded, setAllExpanded] = useState(false)

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }

  const toggleFormation = (fmtKey) => {
    setExpandedFormations(prev => ({
      ...prev,
      [fmtKey]: !prev[fmtKey]
    }))
  }

  const toggleExpandAll = () => {
    const nextState = !allExpanded
    setAllExpanded(nextState)
    if (nextState) {
      // Expand all groups and formations
      const newGroups = {}
      const newFmts = {}
      Object.values(supergroupHierarchy).forEach(sg => {
        (sg.groups || []).forEach(grp => {
          newGroups[grp.name] = true;
          (grp.formations || []).forEach(fmt => {
            newFmts[fmt.name] = true
          })
        })
      })
      setExpandedGroups(newGroups)
      setExpandedFormations(newFmts)
    } else {
      setExpandedGroups({})
      setExpandedFormations({})
    }
  }

  // 1. Eons ordered chronologically with OLDEST AT THE BOTTOM:
  // Top: Phanerozoic (541 - 0 Ma)
  // Middle: Proterozoic (2500 - 541 Ma)
  // Bottom: Archean (3600 - 2500 Ma)
  const orderedEons = useMemo(() => {
    return [
      { id: 'phanerozoic', name: 'Phanerozoic Eon', ageRange: '541 Ma – Present', color: '#16a085', bgLight: '#e8f8f5', border: '#1abc9c' },
      { id: 'proterozoic', name: 'Proterozoic Eon', ageRange: '2500 – 541 Ma', color: '#d35400', bgLight: '#fbeee6', border: '#e67e22' },
      { id: 'archean', name: 'Archean Eon', ageRange: '3600 – 2500 Ma', color: '#8e44ad', bgLight: '#f4ecf7', border: '#9b59b6' },
    ]
  }, [])

  // 2. Cratons filtered by selected Eon (Ordered chronologically with OLDEST AT THE BOTTOM)
  const cratonsForEon = useMemo(() => {
    if (!selectedEonId) return indianCratons
    const list = indianCratons.filter(c => c.eonId === selectedEonId)
    return list.slice().reverse()
  }, [indianCratons, selectedEonId])

  // Current selected craton object
  const currentCraton = useMemo(() => {
    return indianCratons.find(c => c.id === selectedCratonId) || cratonsForEon[0] || indianCratons[0]
  }, [indianCratons, selectedCratonId, cratonsForEon])

  // Handle Eon click
  const handleEonSelect = (eonId) => {
    setSelectedEonId(eonId)
    const matchingCratons = indianCratons.filter(c => c.eonId === eonId).slice().reverse()
    if (matchingCratons.length > 0) {
      setSelectedCratonId(matchingCratons[0].id)
      if (matchingCratons[0].id === 'dharwar') {
        setSelectedVariantName('Western Dharwar Craton (WDC)')
      } else if (matchingCratons[0].id === 'bastar') {
        setSelectedVariantName('Kotri-Dongargarh Orogen')
      }
    }
  }

  // Handle Craton click
  const handleCratonSelect = (cratonId) => {
    setSelectedCratonId(cratonId)
    if (cratonId === 'dharwar') {
      setSelectedVariantName('Western Dharwar Craton (WDC)')
    } else if (cratonId === 'bastar') {
      setSelectedVariantName('Kotri-Dongargarh Orogen')
    }
  }

  // Helper to extract Ramakrishnan sequence for Dharwar / Bastar
  const cratonSequenceData = useMemo(() => {
    if (!rawHierarchyData?.archean_basement?.craton_sequences) return null
    if (selectedCratonId === 'dharwar') {
      return rawHierarchyData.archean_basement.craton_sequences.dharwar
    }
    if (selectedCratonId === 'bastar') {
      return rawHierarchyData.archean_basement.craton_sequences.bastar
    }
    return null
  }, [rawHierarchyData, selectedCratonId])

  // Variants list for Ramakrishnan sequences
  const sequenceVariants = useMemo(() => {
    if (!cratonSequenceData?.regional_variants) return []
    return cratonSequenceData.regional_variants
  }, [cratonSequenceData])

  // Current active variant sequence (OLDEST AT THE BOTTOM)
  const activeVariantObj = useMemo(() => {
    if (!sequenceVariants.length) return null
    return sequenceVariants.find(v => v.variant_name === selectedVariantName) || sequenceVariants[0]
  }, [sequenceVariants, selectedVariantName])

  // General Supergroups for current Craton
  const cratonSupergroups = useMemo(() => {
    if (!currentCraton) return []
    return currentCraton.supergroups
      .map(name => supergroupHierarchy[name])
      .filter(Boolean)
  }, [currentCraton, supergroupHierarchy])

  // Helper to find formations for sequence items
  const getNestedFormationsForSequenceUnit = (unitName) => {
    if (!unitName || !supergroupHierarchy) return []
    for (const sgKey of Object.keys(supergroupHierarchy)) {
      const sg = supergroupHierarchy[sgKey]
      if (sg.groups) {
        const match = sg.groups.find(g => g.name && g.name.toLowerCase().includes(unitName.toLowerCase()))
        if (match && match.formations) return match.formations
      }
    }
    return []
  }

  return (
    <div className="stratigraphy-workbench">
      {/* Top Header Banner */}
      <div className="workbench-header">
        <div className="workbench-title-group">
          <h2>Chronostratigraphic Hierarchy of India</h2>
          <p>Standard Geological Column & Stratigraphic Succession (Oldest units at the bottom)</p>
        </div>
        
        <div className="workbench-search">
          <span className="search-icon">⌕</span>
          <input 
            type="text" 
            placeholder="Search formation, group, or unit..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Grid: Left Eons Column -> Middle Cratons Column -> Right Stratigraphic Column */}
      <div className="workbench-grid">

        {/* 1. LEFT PANEL: 3 GEOLOGIC EONS (OLDEST AT THE BOTTOM) */}
        <div className="eons-column">
          <div className="column-title">
            <span>GEOLOGIC EONS</span>
            <small>Click to Expand</small>
          </div>
          
          <div className="eons-list-container">
            {orderedEons.map(eon => {
              const isSelected = selectedEonId === eon.id
              const count = indianCratons.filter(c => c.eonId === eon.id).length
              return (
                <button
                  key={eon.id}
                  type="button"
                  className={`eon-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    '--eon-color': eon.color,
                    '--eon-bg': eon.bgLight,
                    '--eon-border': eon.border,
                  }}
                  onClick={() => handleEonSelect(eon.id)}
                >
                  <div className="eon-card-header">
                    <span className="eon-badge">{eon.name}</span>
                    <span className="eon-count">{count} Regions</span>
                  </div>
                  <strong className="eon-name">{eon.name}</strong>
                  <span className="eon-age">{eon.ageRange}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. MIDDLE PANEL: CRATONS & BASINS OF SELECTED EON (OLDEST AT THE BOTTOM) */}
        <div className="cratons-column">
          <div className="column-title">
            <span>REGIONS & BASINS</span>
            <small>{orderedEons.find(e => e.id === selectedEonId)?.name || 'Selected Eon'}</small>
          </div>

          <div className="cratons-list-container">
            {cratonsForEon.map(craton => {
              const isSelected = selectedCratonId === craton.id
              return (
                <button
                  key={craton.id}
                  type="button"
                  className={`craton-item-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleCratonSelect(craton.id)}
                >
                  <div className="craton-item-head">
                    <span className="craton-bullet">◈</span>
                    <strong className="craton-title">{craton.name}</strong>
                  </div>
                  <p className="craton-region">{craton.region}</p>
                  <span className="craton-age">{craton.ageRange}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. RIGHT PANEL: CHRONOSTRATIGRAPHIC COLUMN (OLDEST AT THE BOTTOM) */}
        <div className="column-details-panel">
          <div className="column-title flex-between">
            <div>
              <span>STRATIGRAPHIC COLUMN: {currentCraton?.name}</span>
              <small>Click Groups to reveal Formations & Members</small>
            </div>
            <button 
              type="button"
              className="expand-all-btn"
              onClick={toggleExpandAll}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          {/* Regional Variants Selector Tabs (For Dharwar / Bastar) */}
          {sequenceVariants.length > 0 && (
            <div className="variant-tabs-bar">
              <span className="tabs-label">Regional Sequence Variant:</span>
              <div className="tabs-list">
                {sequenceVariants.map(v => (
                  <button
                    key={v.variant_name}
                    type="button"
                    className={`tab-btn ${selectedVariantName === v.variant_name ? 'active' : ''}`}
                    onClick={() => setSelectedVariantName(v.variant_name)}
                  >
                    {v.variant_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stratigraphic Column Content */}
          <div className="column-content-scroll">

            {/* Ramakrishnan Chronological Sequence View (OLDEST AT THE BOTTOM) */}
            {activeVariantObj && activeVariantObj.sequence_oldest_to_youngest ? (
              <div className="chrono-sequence-container">
                <div className="column-indicator top">▲ YOUNGEST (PRESENT)</div>
                
                {/* Render reversed array so youngest is at top, oldest is at bottom */}
                {activeVariantObj.sequence_oldest_to_youngest.slice().reverse().map((unit, idx) => {
                  const isUnconformity = unit.unit_type === 'boundary' || unit.name.toLowerCase().includes('unconformity')
                  if (isUnconformity) {
                    return (
                      <div key={idx} className="unconformity-divider">
                        <span className="wave-line">~~~~~~~~~~~~</span>
                        <strong className="unconformity-label">UNCONFORMITY BOUNDARY</strong>
                        <span className="wave-line">~~~~~~~~~~~~</span>
                      </div>
                    )
                  }

                  const nestedFmts = getNestedFormationsForSequenceUnit(unit.name)
                  const hasNestedFmts = nestedFmts.length > 0
                  const isGrpExpanded = expandedGroups[unit.name] || allExpanded

                  return (
                    <div key={idx} className={`chrono-unit-card ${unit.unit_type || ''}`}>
                      <div 
                        className={`unit-card-head ${hasNestedFmts ? 'clickable' : ''}`}
                        onClick={() => hasNestedFmts && toggleGroup(unit.name)}
                      >
                        <strong className="unit-name">{unit.name}</strong>
                        {hasNestedFmts && (
                          <span className="count-badge">
                            {isGrpExpanded ? '▼' : '▶'} ({nestedFmts.length})
                          </span>
                        )}
                      </div>
                      <div className="unit-card-meta">
                        <span><strong>Age:</strong> {unit.age || 'Not specified'}</span>
                        {unit.part_of && <span><strong>Part of:</strong> {unit.part_of}</span>}
                        {unit.note && <span><strong>Note:</strong> {unit.note}</span>}
                      </div>

                      {/* Expandable Formations & Members under Sequence Unit */}
                      {hasNestedFmts && isGrpExpanded && (
                        <div className="formations-list nested-indent">
                          {nestedFmts.slice().reverse().map((fmt, fmtIdx) => {
                            const hasMembers = fmt.members && fmt.members.length > 0
                            const isFmtExpanded = expandedFormations[fmt.name] || allExpanded
                            return (
                              <div key={fmtIdx} className="fmt-item">
                                <div 
                                  className={`fmt-head ${hasMembers ? 'clickable' : ''}`}
                                  onClick={() => hasMembers && toggleFormation(fmt.name)}
                                >
                                  <strong className="fmt-name">{fmt.name}</strong>
                                  {fmt.age && <span className="fmt-age">{fmt.age}</span>}
                                  {hasMembers && (
                                    <span className="count-badge member-badge">
                                      {isFmtExpanded ? '▼' : '▶'} ({fmt.members.length})
                                    </span>
                                  )}
                                </div>

                                {hasMembers && isFmtExpanded && (
                                  <div className="members-chips">
                                    {fmt.members.map((mem, memIdx) => (
                                      <span key={memIdx} className="member-chip">
                                        {typeof mem === 'string' ? mem : mem.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="unit-actions">
                        <button 
                          type="button" 
                          className="view-map-btn"
                          onClick={() => onNavigateToMap(currentCraton?.name, unit.name)}
                        >
                          ⌕ View on Map
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="column-indicator bottom">▼ OLDEST (BASEMENT)</div>
              </div>
            ) : (
              /* General Supergroups Hierarchy View (OLDEST AT THE BOTTOM) */
              <div className="general-supergroups-container">
                <div className="column-indicator top">▲ YOUNGEST (PRESENT)</div>

                {/* Render supergroups in chronological order with oldest at the bottom */}
                {cratonSupergroups.slice().reverse().map((sgObj, sgIdx) => (
                  <div key={sgIdx} className="supergroup-block-card">
                    <div className="sg-block-head">
                      <strong className="sg-title">{sgObj.title}</strong>
                      <span className="sg-age">{sgObj.info?.age || 'Precambrian'}</span>
                    </div>

                    {sgObj.info?.unconformably_overlies && (
                      <p className="sg-overlies">
                        <strong>Unconformably Overlies:</strong> {sgObj.info.unconformably_overlies}
                      </p>
                    )}

                    <div className="sg-source-tag">
                      <span>Source: {sgObj.source || 'GSI Memoirs & Standard Literature'}</span>
                    </div>

                    {/* Clickable Groups under Supergroup (Oldest at Bottom) */}
                    <div className="groups-list">
                      {(sgObj.groups || []).slice().reverse().map((grp, grpIdx) => {
                        const hasFormations = grp.formations && grp.formations.length > 0
                        const isGrpExpanded = expandedGroups[grp.name] || allExpanded

                        return (
                          <div key={grpIdx} className="group-sub-card">
                            <div 
                              className={`grp-head ${hasFormations ? 'clickable' : ''}`}
                              onClick={() => hasFormations && toggleGroup(grp.name)}
                            >
                              <strong className="grp-name">{grp.name}</strong>
                              {grp.age && <span className="grp-age">{grp.age}</span>}
                              {hasFormations && (
                                <span className="count-badge">
                                  {isGrpExpanded ? '▼' : '▶'} ({grp.formations.length})
                                </span>
                              )}
                            </div>

                            {/* Formations under Group (Revealed when Group is clicked) */}
                            {hasFormations && isGrpExpanded && (
                              <div className="formations-list">
                                {grp.formations.slice().reverse().map((fmt, fmtIdx) => {
                                  const hasMembers = fmt.members && fmt.members.length > 0
                                  const isFmtExpanded = expandedFormations[fmt.name] || allExpanded

                                  return (
                                    <div key={fmtIdx} className="fmt-item">
                                      <div 
                                        className={`fmt-head ${hasMembers ? 'clickable' : ''}`}
                                        onClick={() => hasMembers && toggleFormation(fmt.name)}
                                      >
                                        <strong className="fmt-name">{fmt.name}</strong>
                                        {fmt.age && <span className="fmt-age">{fmt.age}</span>}
                                        {hasMembers && (
                                          <span className="count-badge member-badge">
                                            {isFmtExpanded ? '▼' : '▶'} ({fmt.members.length})
                                          </span>
                                        )}
                                      </div>

                                      {/* Members under Formation (Revealed when Formation is clicked) */}
                                      {hasMembers && isFmtExpanded && (
                                        <div className="members-chips">
                                          {fmt.members.map((mem, memIdx) => (
                                            <span key={memIdx} className="member-chip">
                                              {typeof mem === 'string' ? mem : mem.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="sg-actions">
                      <button 
                        type="button" 
                        className="view-map-btn"
                        onClick={() => onNavigateToMap(currentCraton?.name, sgObj.title)}
                      >
                        ⌕ View Supergroup on Map
                      </button>
                    </div>
                  </div>
                ))}

                <div className="column-indicator bottom">▼ OLDEST (BASEMENT)</div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Bottom Right Corner Academic Citations Footer */}
      <footer className="stratigraphy-citations-footer">
        <div className="citations-header">
          <span className="citation-icon">📚</span>
          <strong>Author authoritative Academic & Geological References:</strong>
        </div>
        <div className="citations-list">
          {ACADEMIC_CITATIONS.map((cit, i) => (
            <div key={i} className="citation-item">
              <strong className="citation-author">{cit.author}:</strong>
              <span className="citation-title">"{cit.title}"</span>
              <small className="citation-publisher">({cit.publisher})</small>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )
}
