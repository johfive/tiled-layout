import { useLayoutStore } from '../stores/layoutStore'

export default function PageList() {
  const {
    pages,
    currentPageIndex,
    setCurrentPage,
    addPage,
    removePage,
    rows,
    cols
  } = useLayoutStore()

  return (
    <div className="w-44 bg-base-100 border-r border-base-300 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-base-300 flex justify-between items-center">
        <h3 className="text-sm font-semibold">Pages</h3>
        <button
          className="btn btn-primary btn-xs btn-square"
          onClick={addPage}
          title="Add page"
        >
          +
        </button>
      </div>

      {/* Page List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={`page-thumbnail ${index === currentPageIndex ? 'active' : ''}`}
            onClick={() => setCurrentPage(index)}
          >
            <div
              className="bg-white border border-base-200"
              style={{ aspectRatio: '210 / 297' }}
            >
              <div
                className="grid gap-px p-1 h-full"
                style={{
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${cols}, 1fr)`
                }}
              >
                {page.cells.map((cell, cellIndex) => (
                  <div
                    key={cellIndex}
                    className={`rounded-sm ${cell.content ? 'bg-primary opacity-60' : 'bg-base-200'}`}
                  />
                ))}
              </div>
            </div>

            {/* Page Number */}
            <span className="absolute -bottom-4 left-0 right-0 text-center text-xs text-base-content/60">
              {index + 1}
            </span>

            {/* Remove Button */}
            {pages.length > 1 && (
              <button
                className="btn btn-error btn-xs btn-circle absolute -top-2 -right-2 opacity-0 hover:opacity-100 transition-opacity"
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
        ))}
      </div>
    </div>
  )
}
