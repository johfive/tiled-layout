import { useMemo, useState, useCallback } from 'react'
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
    rows,
    cols,
    gap,
    margin,
    showFilenames,
    selectedCellId,
    selectCell,
    setCellContent
  } = useLayoutStore()

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    cellIndex: number
  } | null>(null)

  const currentPage = pages[currentPageIndex]

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

  return (
    <div
      className="flex-1 flex items-center justify-center p-8 overflow-auto bg-base-200"
      onClick={handleBackgroundClick}
    >
      <div
        className="shadow-lg relative"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          backgroundColor: '#ffffff'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute grid"
          style={gridStyle}
        >
          {currentPage.cells.map((cell, index) => (
            <GridCell
              key={cell.id}
              cell={cell}
              cellIndex={index}
              isSelected={cell.id === selectedCellId}
              showFilename={showFilenames}
              onClick={() => handleCellClick(cell.id)}
              onContextMenu={(e) => handleCellContextMenu(e, index)}
              onDrop={(files) => handleCellDrop(index, files)}
            />
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="menu bg-base-100 shadow-xl rounded-box w-40 p-2 fixed z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <li>
            <button
              className="text-error"
              onClick={handleClearCell}
            >
              Clear Cell
            </button>
          </li>
        </div>
      )}
    </div>
  )
}
