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
    showGridLines,
    setShowGridLines,
    showPageNumbers,
    setShowPageNumbers,
    title,
    setTitle,
    darkMode,
    setDarkMode,
    zoom,
    setZoom,
    pages,
    loadLayoutData,
    showToast
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
      showFilenames,
      showPageNumbers,
      title
    }

    const result = await window.electronAPI.exportPDF(exportData)

    if (result.success) {
      showToast(`PDF exported to ${result.filePath}`)
    } else if (!result.canceled) {
      showToast(`Export failed: ${result.error}`, 'error')
    }
  }

  const handleSaveLayout = async () => {
    const layoutData = {
      pages: pages.map(page => ({
        id: page.id,
        cells: page.cells.map(cell => ({
          id: cell.id,
          content: cell.content
        }))
      })),
      pageSize,
      rows,
      cols,
      gap,
      margin,
      showFilenames,
      showGridLines,
      showPageNumbers,
      title,
      darkMode,
      zoom
    }

    const result = await window.electronAPI.saveLayout(layoutData)

    if (result.success) {
      showToast(`Layout saved to ${result.filePath}`)
    } else if (!result.canceled) {
      showToast(`Save failed: ${result.error}`, 'error')
    }
  }

  const handleLoadLayout = async () => {
    const result = await window.electronAPI.loadLayout()

    if (result.success && result.data) {
      loadLayoutData(result.data)
      showToast('Layout loaded')
    } else if (!result.canceled && result.error) {
      showToast(`Load failed: ${result.error}`, 'error')
    }
  }

  const handlePackage = async (asZip: boolean) => {
    const packageData = {
      pages: pages.map(page => ({
        cells: page.cells.map(cell => ({
          imageData: cell.content?.imageData || null,
          filename: cell.content?.filename || null
        }))
      })),
      asZip
    }

    const result = await window.electronAPI.packageLayout(packageData)

    if (result.success) {
      showToast(`Package saved (${result.fileCount} files)`)
    } else if (!result.canceled) {
      showToast(`Package failed: ${result.error}`, 'error')
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
    <div className="toolbar-wrapper">
      <div className="toolbar">
        <div className="toolbar-group">
          <label>Page:</label>
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
          <label>R:</label>
          <input
            type="number"
            min={1}
            max={10}
            value={rows}
            onChange={(e) => setGrid(parseInt(e.target.value) || 1, cols)}
          />
        </div>

        <div className="toolbar-group">
          <label>C:</label>
          <input
            type="number"
            min={1}
            max={10}
            value={cols}
            onChange={(e) => setGrid(rows, parseInt(e.target.value) || 1)}
          />
        </div>

        <div className="toolbar-group">
          <label>Gap:</label>
          <input
            type="number"
            min={0}
            max={20}
            value={gap}
            onChange={(e) => setGap(parseInt(e.target.value) || 0)}
          />
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
        </div>

        <div className="toolbar-divider" />

        <label className="toolbar-checkbox">
          <input
            type="checkbox"
            checked={showGridLines}
            onChange={(e) => setShowGridLines(e.target.checked)}
          />
          Grid
        </label>

        <label className="toolbar-checkbox">
          <input
            type="checkbox"
            checked={showFilenames}
            onChange={(e) => setShowFilenames(e.target.checked)}
          />
          Names
        </label>

        <label className="toolbar-checkbox">
          <input
            type="checkbox"
            checked={showPageNumbers}
            onChange={(e) => setShowPageNumbers(e.target.checked)}
          />
          Page #
        </label>

        <div className="toolbar-divider" />

        <label className="toolbar-checkbox">
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
          />
          Dark
        </label>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <label>Title:</label>
          <input
            type="text"
            className="title-input"
            placeholder="Header/footer text..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ flex: 1 }} />

        <div className="toolbar-group zoom-controls">
          <button onClick={() => setZoom(zoom - 0.25)} title="Zoom out">−</button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(zoom + 0.25)} title="Zoom in">+</button>
          <button onClick={() => setZoom(1)} title="Reset zoom">⌘0</button>
        </div>

        <div className="toolbar-divider" />

        <button onClick={handleSaveLayout} title="Save layout (JSON)">
          Save
        </button>
        <button onClick={handleLoadLayout} title="Load layout (JSON)">
          Load
        </button>
        <button onClick={() => handlePackage(true)} title="Package as ZIP">
          Package
        </button>

        <div className="toolbar-divider" />

        <button className="export-btn" onClick={handleExport}>
          Export PDF
        </button>
      </div>
    </div>
  )
}
