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
          <div className="flex-1 flex items-center justify-center w-full overflow-hidden p-1">
            <img
              src={cell.content.imageData}
              alt={cell.content.filename}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>
          {showFilename && (
            <div
              className="text-xs text-base-content/60 text-center px-1 pb-1 truncate w-full"
              title={cell.content.filename}
            >
              {cell.content.filename}
            </div>
          )}
        </>
      ) : (
        <span className="text-xs text-base-content/30">Drop image</span>
      )}
    </div>
  )
}
