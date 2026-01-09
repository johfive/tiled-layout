export type PageSize = 'A4' | 'A3'

export interface CellContent {
  imageData: string
  filename: string
  originalPath: string
}

export interface Cell {
  id: string
  content: CellContent | null
}

export interface Page {
  id: string
  cells: Cell[]
}

export interface GridPreset {
  name: string
  rows: number
  cols: number
}

export interface LayoutState {
  pageSize: PageSize
  pages: Page[]
  currentPageIndex: number
  rows: number
  cols: number
  gap: number
  margin: number
  showFilenames: boolean
  selectedCellId: string | null
  darkMode: boolean
}

export interface LayoutActions {
  setPageSize: (size: PageSize) => void
  addPage: () => void
  removePage: (index: number) => void
  setCurrentPage: (index: number) => void
  setGrid: (rows: number, cols: number) => void
  setGap: (gap: number) => void
  setMargin: (margin: number) => void
  setShowFilenames: (show: boolean) => void
  setDarkMode: (dark: boolean) => void
  setCellContent: (pageIndex: number, cellIndex: number, content: CellContent | null) => void
  selectCell: (cellId: string | null) => void
  clearSelectedCell: () => void
  addFilesToCells: (files: { imageData: string; filename: string; originalPath: string }[]) => void
  swapCells: (fromPageIndex: number, fromCellIndex: number, toPageIndex: number, toCellIndex: number) => void
}

declare global {
  interface Window {
    electronAPI: {
      readFile: (filePath: string) => Promise<string | null>
      exportPDF: (data: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
    }
  }
}
