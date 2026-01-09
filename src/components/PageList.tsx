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
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Pages</h3>
        <button onClick={addPage} title="Add page">+</button>
      </div>
      <div className="page-list">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={`page-thumbnail ${index === currentPageIndex ? 'active' : ''}`}
            onClick={() => setCurrentPage(index)}
          >
            <div
              className="page-thumbnail-inner"
              style={{ aspectRatio: '210 / 297' }}
            >
              <div
                className="page-thumbnail-grid"
                style={{
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  padding: '4px'
                }}
              >
                {page.cells.map((cell, cellIndex) => (
                  <div
                    key={cellIndex}
                    className={`page-thumbnail-cell ${cell.content ? 'has-content' : ''}`}
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
        ))}
      </div>
    </div>
  )
}
