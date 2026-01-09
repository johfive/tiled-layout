import { useState, useCallback } from 'react'
import { Cell } from '../types'

interface GridCellProps {
  cell: Cell
  cellIndex: number
  isSelected: boolean
  showFilename: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDrop: (files: FileList) => void
}

export default function GridCell({
  cell,
  isSelected,
  showFilename,
  onClick,
  onContextMenu,
  onDrop
}: GridCellProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (e.dataTransfer.files.length > 0) {
      onDrop(e.dataTransfer.files)
    }
  }, [onDrop])

  return (
    <div
      className={`grid-cell ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onContextMenu={onContextMenu}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {cell.content ? (
        <>
          <div className="cell-image-container">
            <img
              src={cell.content.imageData}
              alt={cell.content.filename}
              className="cell-image"
              draggable={false}
            />
          </div>
          {showFilename && (
            <div className="cell-filename" title={cell.content.filename}>
              {cell.content.filename}
            </div>
          )}
        </>
      ) : (
        <span className="cell-placeholder">Drop image</span>
      )}
    </div>
  )
}
