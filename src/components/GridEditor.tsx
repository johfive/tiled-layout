import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useLayoutStore } from '../stores/layoutStore'
import GridCell from './GridCell'

// Page dimensions in mm
const PAGE_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 }
}

// Scale factor: how many pixels per mm for display
const SCALE = 2.5

export default function GridEditor() {
  const {
    pages,
    currentPageIndex,
    pageSize,
    showFilenames,
    showGridLines,
    showPageNumbers,
    title,
    selectedCellId,
    selectCell,
    setCellContent,
    moveCell,
    zoom,
    setZoom,
    setPageGrid,
    restoreHiddenContent
  } = useLayoutStore()

  const canvasAreaRef = useRef<HTMLDivElement>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    cellIndex: number
  } | null>(null)

  const [draggedCellIndex, setDraggedCellIndex] = useState<number | null>(null)
  const [dragOverCellIndex, setDragOverCellIndex] = useState<number | null>(null)

  const currentPage = pages[currentPageIndex]

  // Get grid settings from current page
  const { rows, cols, gap, margin } = currentPage?.gridSettings || { rows: 2, cols: 2, gap: 5, margin: 10 }
  const hiddenCount = currentPage?.hiddenContent?.length || 0

  const dimensions = useMemo(() => {
    const size = PAGE_SIZES[pageSize]
    return {
      width: size.width * SCALE,
      height: size.height * SCALE,
      margin: margin * SCALE,
      gap: gap * SCALE
    }
  }, [pageSize, margin, gap])

  const gridStyle = useMemo(() => {
    const contentWidth = dimensions.width - (2 * dimensions.margin)
    const contentHeight = dimensions.height - (2 * dimensions.margin)

    return {
      left: dimensions.margin,
      top: dimensions.margin,
      width: contentWidth,
      height: contentHeight,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: dimensions.gap
    }
  }, [dimensions, rows, cols])

  const handleCellClick = useCallback((cellId: string) => {
    selectCell(cellId)
    setContextMenu(null)
  }, [selectCell])

  const handleCellContextMenu = useCallback((e: React.MouseEvent, cellIndex: number) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      cellIndex
    })
  }, [])

  const handleClearCell = useCallback(() => {
    if (contextMenu) {
      setCellContent(currentPageIndex, contextMenu.cellIndex, null)
      setContextMenu(null)
    }
  }, [contextMenu, currentPageIndex, setCellContent])

  const handleCellDrop = useCallback(async (cellIndex: number, files: FileList) => {
    if (files.length === 0) return

    const file = files[0]
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']

    if (supportedTypes.includes(file.type) || file.name.endsWith('.svg')) {
      const reader = new FileReader()
      const imageData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      setCellContent(currentPageIndex, cellIndex, {
        imageData,
        filename: file.name,
        originalPath: (file as any).path || file.name
      })
    }
  }, [currentPageIndex, setCellContent])

  const handleBackgroundClick = useCallback(() => {
    selectCell(null)
    setContextMenu(null)
  }, [selectCell])

  // Cell drag handlers
  const handleCellDragStart = useCallback((cellIndex: number) => {
    setDraggedCellIndex(cellIndex)
  }, [])

  const handleCellDragOver = useCallback((cellIndex: number) => {
    if (draggedCellIndex !== null && draggedCellIndex !== cellIndex) {
      setDragOverCellIndex(cellIndex)
    }
  }, [draggedCellIndex])

  const handleCellDragEnd = useCallback(() => {
    if (draggedCellIndex !== null && dragOverCellIndex !== null) {
      moveCell(currentPageIndex, draggedCellIndex, dragOverCellIndex)
    }
    setDraggedCellIndex(null)
    setDragOverCellIndex(null)
  }, [draggedCellIndex, dragOverCellIndex, currentPageIndex, moveCell])

  // Handle restoring hidden images by increasing grid
  const handleRestoreHidden = useCallback(() => {
    // Calculate minimum grid size needed to show all content
    const totalNeeded = currentPage.cells.filter(c => c.content).length + hiddenCount
    const currentCells = rows * cols

    if (totalNeeded > currentCells) {
      // Find a grid size that fits
      let newRows = rows
      let newCols = cols

      while (newRows * newCols < totalNeeded) {
        if (newCols <= newRows) {
          newCols++
        } else {
          newRows++
        }
      }

      setPageGrid(currentPageIndex, newRows, newCols)
    } else {
      // Just restore to empty cells
      restoreHiddenContent(currentPageIndex)
    }
  }, [currentPage, hiddenCount, rows, cols, currentPageIndex, setPageGrid, restoreHiddenContent])

  // Pinch zoom support
  useEffect(() => {
    const element = canvasAreaRef.current
    if (!element) return

    const handleWheel = (e: WheelEvent) => {
      // Check for pinch zoom (Ctrl+wheel on trackpad/mouse, or direct pinch)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(zoom + delta)
      }
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [zoom, setZoom])

  return (
    <div className="canvas-area" onClick={handleBackgroundClick} ref={canvasAreaRef}>
      <div
        className="page-canvas"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          transform: `scale(${zoom})`,
          transformOrigin: 'center center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden images warning banner */}
        {hiddenCount > 0 && (
          <div className="hidden-warning">
            <span>{hiddenCount} hidden image{hiddenCount > 1 ? 's' : ''} - grid too small</span>
            <button onClick={handleRestoreHidden}>Restore</button>
          </div>
        )}

        {/* Header with title */}
        {title && (
          <div className="page-header">{title}</div>
        )}

        {/* Footer with page number */}
        {showPageNumbers && (
          <div className="page-footer">
            {currentPageIndex + 1}/{pages.length}
          </div>
        )}

        <div className="grid-container" style={gridStyle}>
          {currentPage.cells.map((cell, index) => (
            <GridCell
              key={cell.id}
              cell={cell}
              cellIndex={index}
              isSelected={cell.id === selectedCellId}
              showFilename={showFilenames}
              showGridLines={showGridLines}
              isDragging={draggedCellIndex === index}
              isDragTarget={dragOverCellIndex === index}
              onClick={() => handleCellClick(cell.id)}
              onContextMenu={(e) => handleCellContextMenu(e, index)}
              onFileDrop={(files) => handleCellDrop(index, files)}
              onDragStart={() => handleCellDragStart(index)}
              onDragOver={() => handleCellDragOver(index)}
              onDragEnd={handleCellDragEnd}
            />
          ))}
        </div>
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="danger" onClick={handleClearCell}>
            Clear Cell
          </button>
        </div>
      )}
    </div>
  )
}
