import { create } from 'zustand'
import { LayoutState, LayoutActions, Page, Cell, PageSize, CellContent, Toast } from '../types'

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
  showGridLines: true,
  showPageNumbers: false,
  title: '',
  selectedCellId: null,
  darkMode: false,
  zoom: 1,
  toasts: [],

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

  setShowGridLines: (show: boolean) => set({ showGridLines: show }),

  setShowPageNumbers: (show: boolean) => set({ showPageNumbers: show }),

  setTitle: (title: string) => set({ title }),

  setDarkMode: (dark: boolean) => {
    set({ darkMode: dark })
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  setZoom: (zoom: number) => {
    const clampedZoom = Math.max(0.25, Math.min(3, zoom))
    set({ zoom: clampedZoom })
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
  },

  movePage: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const { pages, currentPageIndex } = get()
    const newPages = [...pages]
    const [movedPage] = newPages.splice(fromIndex, 1)
    newPages.splice(toIndex, 0, movedPage)

    // Update current page index if needed
    let newCurrentIndex = currentPageIndex
    if (currentPageIndex === fromIndex) {
      newCurrentIndex = toIndex
    } else if (fromIndex < currentPageIndex && toIndex >= currentPageIndex) {
      newCurrentIndex = currentPageIndex - 1
    } else if (fromIndex > currentPageIndex && toIndex <= currentPageIndex) {
      newCurrentIndex = currentPageIndex + 1
    }

    set({ pages: newPages, currentPageIndex: newCurrentIndex })
  },

  moveCell: (pageIndex: number, fromCellIndex: number, toCellIndex: number) => {
    if (fromCellIndex === toCellIndex) return
    const { pages } = get()
    const newPages = [...pages]
    const newCells = [...newPages[pageIndex].cells]

    // Swap the content between cells
    const fromContent = newCells[fromCellIndex].content
    const toContent = newCells[toCellIndex].content
    newCells[fromCellIndex] = { ...newCells[fromCellIndex], content: toContent }
    newCells[toCellIndex] = { ...newCells[toCellIndex], content: fromContent }

    newPages[pageIndex] = { ...newPages[pageIndex], cells: newCells }
    set({ pages: newPages })
  },

  loadLayoutData: (data: any) => {
    // Apply dark mode if specified
    if (data.darkMode !== undefined) {
      if (data.darkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    set({
      pageSize: data.pageSize || 'A4',
      pages: data.pages || [],
      rows: data.rows || 2,
      cols: data.cols || 2,
      gap: data.gap || 5,
      margin: data.margin || 10,
      showFilenames: data.showFilenames ?? true,
      showGridLines: data.showGridLines ?? true,
      showPageNumbers: data.showPageNumbers ?? false,
      title: data.title || '',
      darkMode: data.darkMode ?? false,
      zoom: data.zoom || 1,
      currentPageIndex: 0,
      selectedCellId: null
    })
  },

  showToast: (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const toast: Toast = {
      id: `toast-${Date.now()}`,
      message,
      type
    }
    set(state => ({ toasts: [...state.toasts, toast] }))
  },

  removeToast: (id: string) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  }
}))
