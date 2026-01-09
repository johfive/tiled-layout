import { useState, useCallback } from 'react'
import { Cell } from '../types'

interface GridCellProps {
  cell: Cell
  cellIndex: number
  isSelected: boolean
  showFilename: boolean
  showGridLines: boolean
  isDragging: boolean
  isDragTarget: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onFileDrop: (files: FileList) => void
  onDragStart: () => void
  onDragOver: () => void
  onDragEnd: () => void
}

export default function GridCell({
  cell,
  isSelected,
  showFilename,
  showGridLines,
  isDragging,
  isDragTarget,
  onClick,
  onContextMenu,
  onFileDrop,
  onDragStart,
  onDragOver: onCellDragOver,
  onDragEnd
}: GridCellProps) {
  const [isFileDragOver, setIsFileDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsFileDragOver(true)
    } else {
      // Cell-to-cell drag
      onCellDragOver()
    }
  }, [onCellDragOver])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFileDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFileDragOver(false)

    if (e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files)
    } else {
      // Cell-to-cell drop handled by onDragEnd
      onDragEnd()
    }
  }, [onFileDrop, onDragEnd])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!cell.content) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cell.id)
    onDragStart()
  }, [cell.content, cell.id, onDragStart])

  const classNames = [
    'grid-cell',
    isSelected ? 'selected' : '',
    isFileDragOver ? 'drag-over' : '',
    !showGridLines ? 'no-grid-lines' : '',
    isDragging ? 'dragging' : '',
    isDragTarget ? 'drag-target' : ''
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      draggable={!!cell.content}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onContextMenu={onContextMenu}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
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
