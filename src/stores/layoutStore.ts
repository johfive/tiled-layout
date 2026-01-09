import { create } from 'zustand'
import { LayoutState, LayoutActions, Page, Cell, PageSize, CellContent } from '../types'

const createCells = (rows: number, cols: number): Cell[] => {
  return Array.from({ length: rows * cols }, (_, i) => ({
    id: `cell-${Date.now()}-${i}`,
    content: null
  }))
}

const createPage = (rows: number, cols: number): Page => ({
  id: `page-${Date.now()}`,
  cells: createCells(rows, cols)
})

interface LayoutStore extends LayoutState, LayoutActions {}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  // State
  pageSize: 'A4',
  pages: [createPage(2, 2)],
  currentPageIndex: 0,
  rows: 2,
  cols: 2,
  gap: 5,
  margin: 10,
  showFilenames: true,
  selectedCellId: null,
  darkMode: false,

  // Actions
  setPageSize: (size: PageSize) => {
    const { rows, cols, pages } = get()
    // Collect all existing content
    const allContent: CellContent[] = []
    for (const page of pages) {
      for (const cell of page.cells) {
        if (cell.content) {
          allContent.push(cell.content)
        }
      }
    }

    // Create new pages and redistribute content
    const cellsPerPage = rows * cols
    const numPages = Math.max(1, Math.ceil(allContent.length / cellsPerPage))
    const newPages: Page[] = []

    for (let p = 0; p < numPages; p++) {
      const newPage = createPage(rows, cols)
      const newCells = [...newPage.cells]

      for (let c = 0; c < newCells.length; c++) {
        const contentIdx = p * cellsPerPage + c
        if (contentIdx < allContent.length) {
          newCells[c] = { ...newCells[c], content: allContent[contentIdx] }
        }
      }

      newPages.push({ ...newPage, cells: newCells })
    }

    set({
      pageSize: size,
      pages: newPages,
      currentPageIndex: 0,
      selectedCellId: null
    })
  },

  addPage: () => {
    const { rows, cols, pages } = get()
    set({
      pages: [...pages, createPage(rows, cols)],
      currentPageIndex: pages.length
    })
  },

  removePage: (index: number) => {
    const { pages, currentPageIndex } = get()
    if (pages.length <= 1) return

    const newPages = pages.filter((_, i) => i !== index)
    const newCurrentIndex = currentPageIndex >= newPages.length
      ? newPages.length - 1
      : currentPageIndex > index
        ? currentPageIndex - 1
        : currentPageIndex

    set({
      pages: newPages,
      currentPageIndex: newCurrentIndex,
      selectedCellId: null
    })
  },

  setCurrentPage: (index: number) => {
    set({ currentPageIndex: index, selectedCellId: null })
  },

  setGrid: (rows: number, cols: number) => {
    const { pages } = get()

    // Collect all existing content from all pages
    const allContent: CellContent[] = []
    for (const page of pages) {
      for (const cell of page.cells) {
        if (cell.content) {
          allContent.push(cell.content)
        }
      }
    }

    // Calculate how many pages we need
    const cellsPerPage = rows * cols
    const numPages = Math.max(1, Math.ceil(allContent.length / cellsPerPage))

    // Create new pages and redistribute content
    const newPages: Page[] = []
    for (let p = 0; p < numPages; p++) {
      const newPage = createPage(rows, cols)
      const newCells = [...newPage.cells]

      for (let c = 0; c < newCells.length; c++) {
        const contentIdx = p * cellsPerPage + c
        if (contentIdx < allContent.length) {
          newCells[c] = { ...newCells[c], content: allContent[contentIdx] }
        }
      }

      newPages.push({ ...newPage, cells: newCells })
    }

    set({
      rows,
      cols,
      pages: newPages,
      selectedCellId: null
    })
  },

  setGap: (gap: number) => set({ gap }),

  setMargin: (margin: number) => set({ margin }),

  setShowFilenames: (show: boolean) => set({ showFilenames: show }),

  setDarkMode: (dark: boolean) => {
    set({ darkMode: dark })
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  },

  setCellContent: (pageIndex: number, cellIndex: number, content: CellContent | null) => {
    const { pages } = get()
    const newPages = [...pages]
    const newCells = [...newPages[pageIndex].cells]
    newCells[cellIndex] = { ...newCells[cellIndex], content }
    newPages[pageIndex] = { ...newPages[pageIndex], cells: newCells }
    set({ pages: newPages })
  },

  selectCell: (cellId: string | null) => set({ selectedCellId: cellId }),

  clearSelectedCell: () => {
    const { selectedCellId, pages, currentPageIndex } = get()
    if (!selectedCellId) return

    const currentPage = pages[currentPageIndex]
    const cellIndex = currentPage.cells.findIndex(c => c.id === selectedCellId)
    if (cellIndex === -1) return

    const newPages = [...pages]
    const newCells = [...newPages[currentPageIndex].cells]
    newCells[cellIndex] = { ...newCells[cellIndex], content: null }
    newPages[currentPageIndex] = { ...newPages[currentPageIndex], cells: newCells }
    set({ pages: newPages })
  },

  addFilesToCells: (files) => {
    const { pages, rows, cols } = get()
    let newPages = [...pages]
    let currentPageIdx = pages.length - 1
    let fileIdx = 0

    // Find first empty cell starting from first page
    for (let p = 0; p < newPages.length && fileIdx < files.length; p++) {
      const page = newPages[p]
      for (let c = 0; c < page.cells.length && fileIdx < files.length; c++) {
        if (!page.cells[c].content) {
          const newCells = [...page.cells]
          newCells[c] = {
            ...newCells[c],
            content: {
              imageData: files[fileIdx].imageData,
              filename: files[fileIdx].filename,
              originalPath: files[fileIdx].originalPath
            }
          }
          newPages[p] = { ...page, cells: newCells }
          fileIdx++
        }
      }
    }

    // Create new pages for remaining files
    while (fileIdx < files.length) {
      const newPage = createPage(rows, cols)
      const newCells = [...newPage.cells]

      for (let c = 0; c < newCells.length && fileIdx < files.length; c++) {
        newCells[c] = {
          ...newCells[c],
          content: {
            imageData: files[fileIdx].imageData,
            filename: files[fileIdx].filename,
            originalPath: files[fileIdx].originalPath
          }
        }
        fileIdx++
      }

      newPages.push({ ...newPage, cells: newCells })
      currentPageIdx = newPages.length - 1
    }

    set({ pages: newPages, currentPageIndex: currentPageIdx })
  },

  swapCells: (fromPageIndex, fromCellIndex, toPageIndex, toCellIndex) => {
    const { pages } = get()
    const newPages = [...pages]

    const fromContent = newPages[fromPageIndex].cells[fromCellIndex].content
    const toContent = newPages[toPageIndex].cells[toCellIndex].content

    const newFromCells = [...newPages[fromPageIndex].cells]
    const newToCells = fromPageIndex === toPageIndex ? newFromCells : [...newPages[toPageIndex].cells]

    newFromCells[fromCellIndex] = { ...newFromCells[fromCellIndex], content: toContent }
    newToCells[toCellIndex] = { ...newToCells[toCellIndex], content: fromContent }

    newPages[fromPageIndex] = { ...newPages[fromPageIndex], cells: newFromCells }
    if (fromPageIndex !== toPageIndex) {
      newPages[toPageIndex] = { ...newPages[toPageIndex], cells: newToCells }
    }

    set({ pages: newPages })
  }
}))
