import { useState, useCallback, useMemo } from 'react'
import { useLayoutStore } from '../stores/layoutStore'

const PAGE_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 }
}

export default function PageList() {
  const {
    pages,
    currentPageIndex,
    setCurrentPage,
    addPage,
    removePage,
    movePage,
    pageSize
  } = useLayoutStore()

  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null)
  const [dragOverPageIndex, setDragOverPageIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    setDraggedPageIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedPageIndex !== null && draggedPageIndex !== index) {
      setDragOverPageIndex(index)
    }
  }, [draggedPageIndex])

  const handleDragLeave = useCallback(() => {
    setDragOverPageIndex(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (draggedPageIndex !== null && draggedPageIndex !== toIndex) {
      movePage(draggedPageIndex, toIndex)
    }
    setDraggedPageIndex(null)
    setDragOverPageIndex(null)
  }, [draggedPageIndex, movePage])

  const handleDragEnd = useCallback(() => {
    setDraggedPageIndex(null)
    setDragOverPageIndex(null)
  }, [])

  // Calculate page aspect ratio
  const pageAspect = useMemo(() => {
    const size = PAGE_SIZES[pageSize]
    return size.width / size.height
  }, [pageSize])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Pages</h3>
        <button onClick={addPage} title="Add page">+</button>
      </div>
      <div className="page-list">
        {pages.map((page, index) => {
          // Get this page's grid settings
          const { rows, cols, gap, margin } = page.gridSettings
          const hasHiddenContent = page.hiddenContent && page.hiddenContent.length > 0

          // Calculate cell aspect ratio for this specific page
          const size = PAGE_SIZES[pageSize]
          const contentWidth = size.width - (2 * margin)
          const contentHeight = size.height - (2 * margin)
          const cellWidth = (contentWidth - (gap * (cols - 1))) / cols
          const cellHeight = (contentHeight - (gap * (rows - 1))) / rows
          const cellAspect = cellWidth / cellHeight

          return (
            <div
              key={page.id}
              className={`page-thumbnail ${index === currentPageIndex ? 'active' : ''} ${draggedPageIndex === index ? 'dragging' : ''} ${dragOverPageIndex === index ? 'drag-over' : ''} ${hasHiddenContent ? 'has-hidden' : ''}`}
              draggable
              onClick={() => setCurrentPage(index)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="page-thumbnail-inner"
                style={{ aspectRatio: String(pageAspect) }}
              >
                {hasHiddenContent && (
                  <div className="thumbnail-warning-dot" title={`${page.hiddenContent.length} hidden`} />
                )}
                <div
                  className="page-thumbnail-grid"
                  style={{
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    padding: '4px',
                    gap: '2px'
                  }}
                >
                  {page.cells.map((cell, cellIndex) => (
                    <div
                      key={cellIndex}
                      className={`page-thumbnail-cell ${cell.content ? 'has-content' : ''}`}
                      style={{ aspectRatio: String(cellAspect) }}
                    />
                  ))}
                </div>
              </div>
              <span className="page-number">{index + 1}</span>
              {pages.length > 1 && (
                <button
                  className="page-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePage(index)
                  }}
                  title="Remove page"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
