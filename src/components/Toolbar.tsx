import { useState, useRef, useEffect } from 'react'
import { useLayoutStore } from '../stores/layoutStore'
import { handlePackage, handleExport } from '../actions/fileActions'
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
    pages,
    currentPageIndex,
    setPageGrid,
    setPageGap,
    setPageMargin,
    showFilenames,
    setShowFilenames,
    showGridLines,
    setShowGridLines,
    showPageNumbers,
    setShowPageNumbers,
    title,
    setTitle
  } = useLayoutStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Get current page's grid settings
  const currentPage = pages[currentPageIndex]
  const { rows, cols, gap, margin } = currentPage?.gridSettings || { rows: 2, cols: 2, gap: 5, margin: 10 }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = GRID_PRESETS.find(p => p.name === e.target.value)
    if (preset) {
      setPageGrid(currentPageIndex, preset.rows, preset.cols)
    }
  }

  const currentPreset = GRID_PRESETS.find(p => p.rows === rows && p.cols === cols)

  // Close flyout on click outside
  useEffect(() => {
    if (!settingsOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        flyoutRef.current && !flyoutRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [settingsOpen])

  return (
    <div className="toolbar-wrapper">
      <div className="toolbar">
        <button
          ref={buttonRef}
          className={`settings-toggle ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          Settings {settingsOpen ? '▴' : '▾'}
        </button>

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

        <button onClick={handlePackage} title="Package as ZIP (⇧⌘P)">
          Package <span className="shortcut-hint">⇧⌘P</span>
        </button>

        <button className="export-btn" onClick={handleExport} title="Export PDF (⇧⌘E)">
          Export PDF <span className="shortcut-hint">⇧⌘E</span>
        </button>
      </div>

      {settingsOpen && (
        <div className="settings-flyout" ref={flyoutRef}>
          <div className="flyout-row">
            <label>Page size:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </div>

          <div className="flyout-divider" />

          <div className="flyout-row">
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

            <label>R:</label>
            <input
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setPageGrid(currentPageIndex, parseInt(e.target.value) || 1, cols)}
            />

            <label>C:</label>
            <input
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => setPageGrid(currentPageIndex, rows, parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="flyout-row">
            <label>Gap:</label>
            <input
              type="number"
              min={0}
              max={20}
              value={gap}
              onChange={(e) => setPageGap(currentPageIndex, parseInt(e.target.value) || 0)}
            />

            <label>Margin:</label>
            <input
              type="number"
              min={5}
              max={30}
              value={margin}
              onChange={(e) => setPageMargin(currentPageIndex, parseInt(e.target.value) || 5)}
            />
          </div>

          <div className="flyout-divider" />

          <div className="flyout-row">
            <label className="flyout-checkbox">
              <input
                type="checkbox"
                checked={showGridLines}
                onChange={(e) => setShowGridLines(e.target.checked)}
              />
              Grid lines
            </label>

            <label className="flyout-checkbox">
              <input
                type="checkbox"
                checked={showFilenames}
                onChange={(e) => setShowFilenames(e.target.checked)}
              />
              Filenames
            </label>

            <label className="flyout-checkbox">
              <input
                type="checkbox"
                checked={showPageNumbers}
                onChange={(e) => setShowPageNumbers(e.target.checked)}
              />
              Page numbers
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
