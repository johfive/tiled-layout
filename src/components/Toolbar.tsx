import { useLayoutStore } from '../stores/layoutStore'
import { GridPreset, PageSize } from '../types'

const GRID_PRESETS: GridPreset[] = [
  { name: '1×1', rows: 1, cols: 1 },
  { name: '2×2', rows: 2, cols: 2 },
  { name: '3×3', rows: 3, cols: 3 },
  { name: '4×4', rows: 4, cols: 4 },
  { name: '2×3', rows: 2, cols: 3 },
  { name: '3×4', rows: 3, cols: 4 }
]

export default function Toolbar() {
  const {
    pageSize,
    setPageSize,
    rows,
    cols,
    setGrid,
    gap,
    setGap,
    margin,
    setMargin,
    showFilenames,
    setShowFilenames,
    pages
  } = useLayoutStore()

  const handleExport = async () => {
    const exportData = {
      pages: pages.map(page => ({
        cells: page.cells.map(cell => ({
          imageData: cell.content?.imageData || null,
          filename: cell.content?.filename || null
        }))
      })),
      pageSize,
      rows,
      cols,
      gap,
      margin,
      showFilenames
    }

    const result = await window.electronAPI.exportPDF(exportData)

    if (result.success) {
      alert(`PDF exported successfully to:\n${result.filePath}`)
    } else if (!result.canceled) {
      alert(`Export failed: ${result.error}`)
    }
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = GRID_PRESETS.find(p => p.name === e.target.value)
    if (preset) {
      setGrid(preset.rows, preset.cols)
    }
  }

  const currentPreset = GRID_PRESETS.find(p => p.rows === rows && p.cols === cols)

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <label>Page Size:</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as PageSize)}
        >
          <option value="A4">A4</option>
          <option value="A3">A3</option>
        </select>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <label>Grid:</label>
        <select
          value={currentPreset?.name || 'custom'}
          onChange={handlePresetChange}
        >
          {GRID_PRESETS.map(preset => (
            <option key={preset.name} value={preset.name}>{preset.name}</option>
          ))}
          {!currentPreset && <option value="custom">Custom</option>}
        </select>
      </div>

      <div className="toolbar-group">
        <label>Rows:</label>
        <input
          type="number"
          min={1}
          max={10}
          value={rows}
          onChange={(e) => setGrid(parseInt(e.target.value) || 1, cols)}
        />
      </div>

      <div className="toolbar-group">
        <label>Cols:</label>
        <input
          type="number"
          min={1}
          max={10}
          value={cols}
          onChange={(e) => setGrid(rows, parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <label>Gap:</label>
        <input
          type="number"
          min={0}
          max={20}
          value={gap}
          onChange={(e) => setGap(parseInt(e.target.value) || 0)}
        />
        <span style={{ fontSize: 11, color: '#666' }}>mm</span>
      </div>

      <div className="toolbar-group">
        <label>Margin:</label>
        <input
          type="number"
          min={5}
          max={30}
          value={margin}
          onChange={(e) => setMargin(parseInt(e.target.value) || 5)}
        />
        <span style={{ fontSize: 11, color: '#666' }}>mm</span>
      </div>

      <div className="toolbar-divider" />

      <label className="toolbar-checkbox">
        <input
          type="checkbox"
          checked={showFilenames}
          onChange={(e) => setShowFilenames(e.target.checked)}
        />
        Show filenames
      </label>

      <div style={{ flex: 1 }} />

      <button className="primary" onClick={handleExport}>
        Export PDF
      </button>
    </div>
  )
}
