# Indian Stratigraphy Map (Vite + React)

Interactive educational map for Indian stratigraphy tailored for geology students.

This project is a Vite + React app using MapLibre GL for interactive maps and overlays Macrostrat's geologic vector tiles as the primary geological data layer.

Quick start

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

Macrostrat integration

- The app adds Macrostrat's `carto` vector tiles as an overlay source:
	`https://tileserver.development.svc.macrostrat.org/carto/{z}/{x}/{y}.mvt`.
- The vector source contains `units` (filled geologic units) and `lines` (geologic linework) source layers. The app renders these as overlay layers and uses the tile `color` property when available.
- On click, the inspector shows Macrostrat feature properties (name, strat_name, lith, descrip, best_t_age, best_b_age, t_int_name, b_int_name, source_id) when present.

Notes, limitations, and licensing

- Search and age filtering are applied client-side using MapLibre filters. Search works against feature properties present in the vector tiles currently loaded by the map — features outside loaded tiles may not be matched until tiles are fetched.
- The Macrostrat overlay is treated as an educational geologic overlay. Macrostrat data is community-curated; coverage and detail vary regionally. The app does not claim Macrostrat to be authoritative for every part of India.
- Geologic map data: Macrostrat (CC BY 4.0). See https://macrostrat.org for attribution and original sources per feature.

Files changed

- `src/App.jsx`: Replaced demo polygons with Macrostrat vector-tile overlay, added filters, inspector mapping, and UI tweaks.
- `src/App.css`: Adjusted layout and responsive breakpoints to keep a split view on desktop.
- `vite.config.js`: Excluded `maplibre-gl` from dependency optimization to prevent worker issues.
- `README.md`: This updated documentation.

Build verification

To produce a production build and verify there are no build errors, run:

```bash
npm run build
```

If the build succeeds, the project is ready to deploy or preview with `npm run preview`.

