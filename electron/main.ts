import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb } from 'pdf-lib'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
})

ipcMain.handle('export-pdf', async (_event, data: {
  pages: Array<{
    cells: Array<{
      imageData: string | null
      filename: string | null
    }>
  }>
  pageSize: 'A4' | 'A3'
  rows: number
  cols: number
  gap: number
  margin: number
  showFilenames: boolean
}) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: 'layout.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    const pdfDoc = await PDFDocument.create()

    // Page dimensions in points (1 inch = 72 points, 1 mm = 2.834645669 points)
    const mmToPoints = 2.834645669
    const pageSizes = {
      A4: { width: 210 * mmToPoints, height: 297 * mmToPoints },
      A3: { width: 297 * mmToPoints, height: 420 * mmToPoints }
    }

    const pageSize = pageSizes[data.pageSize]
    const margin = data.margin * mmToPoints
    const gap = data.gap * mmToPoints

    const contentWidth = pageSize.width - (2 * margin)
    const contentHeight = pageSize.height - (2 * margin)

    const cellWidth = (contentWidth - (gap * (data.cols - 1))) / data.cols
    const cellHeight = (contentHeight - (gap * (data.rows - 1))) / data.rows

    // Reserve space for filename if showing
    const filenameHeight = data.showFilenames ? 12 : 0
    const imageHeight = cellHeight - filenameHeight

    for (const pageData of data.pages) {
      const page = pdfDoc.addPage([pageSize.width, pageSize.height])

      for (let i = 0; i < pageData.cells.length; i++) {
        const cell = pageData.cells[i]
        if (!cell.imageData) continue

        const row = Math.floor(i / data.cols)
        const col = i % data.cols

        const x = margin + (col * (cellWidth + gap))
        const y = pageSize.height - margin - (row * (cellHeight + gap)) - cellHeight

        try {
          // Decode base64 image
          const imageBytes = Buffer.from(cell.imageData.split(',')[1], 'base64')
          const mimeType = cell.imageData.split(';')[0].split(':')[1]

          let image
          if (mimeType === 'image/png') {
            image = await pdfDoc.embedPng(imageBytes)
          } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            image = await pdfDoc.embedJpg(imageBytes)
          } else {
            // For SVG and other formats, skip (would need rasterization)
            continue
          }

          // Calculate fit dimensions
          const imgAspect = image.width / image.height
          const cellAspect = cellWidth / imageHeight

          let drawWidth, drawHeight
          if (imgAspect > cellAspect) {
            drawWidth = cellWidth
            drawHeight = cellWidth / imgAspect
          } else {
            drawHeight = imageHeight
            drawWidth = imageHeight * imgAspect
          }

          const drawX = x + (cellWidth - drawWidth) / 2
          const drawY = y + filenameHeight + (imageHeight - drawHeight) / 2

          page.drawImage(image, {
            x: drawX,
            y: drawY,
            width: drawWidth,
            height: drawHeight
          })

          // Draw filename if enabled
          if (data.showFilenames && cell.filename) {
            const font = await pdfDoc.embedFont('Helvetica' as any)
            const fontSize = 8
            const textWidth = font.widthOfTextAtSize(cell.filename, fontSize)
            const maxWidth = cellWidth - 4

            let displayName = cell.filename
            if (textWidth > maxWidth) {
              // Truncate with ellipsis
              while (font.widthOfTextAtSize(displayName + '...', fontSize) > maxWidth && displayName.length > 0) {
                displayName = displayName.slice(0, -1)
              }
              displayName += '...'
            }

            const finalTextWidth = font.widthOfTextAtSize(displayName, fontSize)
            page.drawText(displayName, {
              x: x + (cellWidth - finalTextWidth) / 2,
              y: y + 2,
              size: fontSize,
              font,
              color: rgb(0.3, 0.3, 0.3)
            })
          }
        } catch (imgError) {
          console.error('Error embedding image:', imgError)
        }
      }
    }

    const pdfBytes = await pdfDoc.save()
    fs.writeFileSync(filePath, pdfBytes)

    return { success: true, filePath }
  } catch (error) {
    console.error('Error exporting PDF:', error)
    return { success: false, error: String(error) }
  }
})
