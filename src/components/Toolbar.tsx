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
    darkMode,
    setDarkMode,
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
    <div className="navbar bg-base-100 border-b border-base-300 min-h-12 px-4 pl-20 gap-4 drag-region">
      {/* Page Size */}
      <div className="flex items-center gap-2 no-drag">
        <span className="text-xs text-base-content/60">Page:</span>
        <select
          className="select select-bordered select-sm w-20"
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as PageSize)}
        >
          <option value="A4">A4</option>
          <option value="A3">A3</option>
        </select>
      </div>

      <div className="divider divider-horizontal mx-0" />

      {/* Grid Preset */}
      <div className="flex items-center gap-2 no-drag">
        <span className="text-xs text-base-content/60">Grid:</span>
        <select
          className="select select-bordered select-sm w-24"
          value={currentPreset?.name || 'custom'}
          onChange={handlePresetChange}
        >
          {GRID_PRESETS.map(preset => (
            <option key={preset.name} value={preset.name}>{preset.name}</option>
          ))}
          {!currentPreset && <option value="custom">Custom</option>}
        </select>
      </div>

      {/* Rows */}
      <div className="flex items-center gap-1 no-drag">
        <span className="text-xs text-base-content/60">Rows:</span>
        <input
          type="number"
          className="input input-bordered input-sm w-16"
          min={1}
          max={10}
          value={rows}
          onChange={(e) => setGrid(parseInt(e.target.value) || 1, cols)}
        />
      </div>

      {/* Cols */}
      <div className="flex items-center gap-1 no-drag">
        <span className="text-xs text-base-content/60">Cols:</span>
        <input
          type="number"
          className="input input-bordered input-sm w-16"
          min={1}
          max={10}
          value={cols}
          onChange={(e) => setGrid(rows, parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="divider divider-horizontal mx-0" />

      {/* Gap */}
      <div className="flex items-center gap-1 no-drag">
        <span className="text-xs text-base-content/60">Gap:</span>
        <input
          type="number"
          className="input input-bordered input-sm w-16"
          min={0}
          max={20}
          value={gap}
          onChange={(e) => setGap(parseInt(e.target.value) || 0)}
        />
        <span className="text-xs text-base-content/40">mm</span>
      </div>

      {/* Margin */}
      <div className="flex items-center gap-1 no-drag">
        <span className="text-xs text-base-content/60">Margin:</span>
        <input
          type="number"
          className="input input-bordered input-sm w-16"
          min={5}
          max={30}
          value={margin}
          onChange={(e) => setMargin(parseInt(e.target.value) || 5)}
        />
        <span className="text-xs text-base-content/40">mm</span>
      </div>

      <div className="divider divider-horizontal mx-0" />

      {/* Show Filenames */}
      <label className="flex items-center gap-2 cursor-pointer no-drag">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary"
          checked={showFilenames}
          onChange={(e) => setShowFilenames(e.target.checked)}
        />
        <span className="text-xs">Show filenames</span>
      </label>

      <div className="flex-1" />

      {/* Dark Mode Toggle */}
      <label className="swap swap-rotate no-drag">
        <input
          type="checkbox"
          checked={darkMode}
          onChange={(e) => setDarkMode(e.target.checked)}
        />
        {/* Sun icon */}
        <svg className="swap-off fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
        </svg>
        {/* Moon icon */}
        <svg className="swap-on fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/>
        </svg>
      </label>

      {/* Export Button */}
      <button className="btn btn-primary btn-sm no-drag" onClick={handleExport}>
        Export PDF
      </button>
    </div>
  )
}
