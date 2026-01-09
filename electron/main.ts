import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb } from 'pdf-lib'
import archiver from 'archiver'

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
      preload: path.join(__dirname, '../electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
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
  showPageNumbers: boolean
  title: string
}) => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export PDF',
    defaultPath: 'layout.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    console.log('PDF Export - Pages:', data.pages.length)
    console.log('PDF Export - First page cells:', data.pages[0]?.cells?.length)
    console.log('PDF Export - Has images:', data.pages[0]?.cells?.some(c => c.imageData))

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

    const totalPages = data.pages.length

    for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex++) {
      const pageData = data.pages[pageIndex]
      const page = pdfDoc.addPage([pageSize.width, pageSize.height])

      // Draw title at top if enabled
      if (data.title) {
        const font = await pdfDoc.embedFont('Helvetica' as any)
        const fontSize = 10
        const textWidth = font.widthOfTextAtSize(data.title, fontSize)
        page.drawText(data.title, {
          x: (pageSize.width - textWidth) / 2,
          y: pageSize.height - 20,
          size: fontSize,
          font,
          color: rgb(0.4, 0.4, 0.4)
        })
      }

      // Draw page number at bottom if enabled
      if (data.showPageNumbers) {
        const font = await pdfDoc.embedFont('Courier' as any)
        const fontSize = 10
        const pageNumText = `${pageIndex + 1}/${totalPages}`
        const textWidth = font.widthOfTextAtSize(pageNumText, fontSize)
        page.drawText(pageNumText, {
          x: (pageSize.width - textWidth) / 2,
          y: 20,
          size: fontSize,
          font,
          color: rgb(0.4, 0.4, 0.4)
        })
      }

      for (let i = 0; i < pageData.cells.length; i++) {
        const cell = pageData.cells[i]
        if (!cell.imageData) {
          console.log(`Cell ${i} has no imageData`)
          continue
        }
        console.log(`Processing cell ${i} with image`)

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

// Save layout as JSON
ipcMain.handle('save-layout', async (_event, data: any) => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Layout',
    defaultPath: 'layout.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return { success: true, filePath }
  } catch (error) {
    console.error('Error saving layout:', error)
    return { success: false, error: String(error) }
  }
})

// Load layout from JSON
ipcMain.handle('load-layout', async () => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Layout',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  try {
    const content = fs.readFileSync(filePaths[0], 'utf-8')
    const data = JSON.parse(content)
    return { success: true, data }
  } catch (error) {
    console.error('Error loading layout:', error)
    return { success: false, error: String(error) }
  }
})

// Package/Collect - export as folder with images
ipcMain.handle('package-layout', async (_event, data: {
  pages: Array<{
    cells: Array<{
      imageData: string | null
      filename: string | null
    }>
  }>
  asZip: boolean
}) => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const dialogOptions: Electron.SaveDialogOptions = data.asZip
    ? {
        title: 'Save Package',
        defaultPath: 'layout-package.zip',
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
      }
    : {
        title: 'Save Package Folder',
        defaultPath: 'layout-package',
        properties: ['createDirectory'] as any
      }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, dialogOptions)

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    // Collect unique images
    const images: Array<{ filename: string; data: string }> = []
    const seenFilenames = new Set<string>()

    for (const page of data.pages) {
      for (const cell of page.cells) {
        if (cell.imageData && cell.filename && !seenFilenames.has(cell.filename)) {
          images.push({ filename: cell.filename, data: cell.imageData })
          seenFilenames.add(cell.filename)
        }
      }
    }

    if (data.asZip) {
      // Create ZIP file
      const output = fs.createWriteStream(filePath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      return new Promise((resolve) => {
        output.on('close', () => {
          resolve({ success: true, filePath, fileCount: images.length })
        })

        archive.on('error', (err) => {
          resolve({ success: false, error: String(err) })
        })

        archive.pipe(output)

        // Add images to archive
        for (const img of images) {
          const base64Data = img.data.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          archive.append(buffer, { name: img.filename })
        }

        // Add layout JSON
        const layoutData = {
          pages: data.pages.map(p => ({
            cells: p.cells.map(c => ({
              filename: c.filename
            }))
          }))
        }
        archive.append(JSON.stringify(layoutData, null, 2), { name: 'layout.json' })

        archive.finalize()
      })
    } else {
      // Create folder with files
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true })
      }

      // Save images
      for (const img of images) {
        const base64Data = img.data.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        fs.writeFileSync(path.join(filePath, img.filename), buffer)
      }

      // Save layout JSON (with just filenames, not image data)
      const layoutData = {
        pages: data.pages.map(p => ({
          cells: p.cells.map(c => ({
            filename: c.filename
          }))
        }))
      }
      fs.writeFileSync(path.join(filePath, 'layout.json'), JSON.stringify(layoutData, null, 2))

      return { success: true, filePath, fileCount: images.length }
    }
  } catch (error) {
    console.error('Error packaging layout:', error)
    return { success: false, error: String(error) }
  }
})
