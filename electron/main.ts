import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
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
      preload: path.join(__dirname, 'preload.cjs'),
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
    gridSettings: {
      rows: number
      cols: number
      gap: number
      margin: number
    }
  }>
  pageSize: 'A4' | 'A3'
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

    // Page dimensions in points (1 inch = 72 points, 1 mm = 2.834645669 points)
    const mmToPoints = 2.834645669
    const pageSizes = {
      A4: { width: 210 * mmToPoints, height: 297 * mmToPoints },
      A3: { width: 297 * mmToPoints, height: 420 * mmToPoints }
    }

    const pageSize = pageSizes[data.pageSize]
    const totalPages = data.pages.length

    return new Promise((resolve) => {
      const doc = new PDFDocument({
        size: [pageSize.width, pageSize.height],
        margin: 0,
        autoFirstPage: false
      })

      const writeStream = fs.createWriteStream(filePath)
      doc.pipe(writeStream)

      // Set up SFMono font - try to find it, fall back to Courier
      const sfMonoPaths = [
        '/System/Applications/Utilities/Terminal.app/Contents/Resources/Fonts/SF-Mono-Regular.otf',
        '/Applications/Utilities/Terminal.app/Contents/Resources/Fonts/SF-Mono-Regular.otf',
        '/System/Library/Fonts/SFMono-Regular.otf',
        '/System/Library/Fonts/SFMono/SFMono-Regular.otf'
      ]

      let fontPath: string | null = null
      for (const p of sfMonoPaths) {
        if (fs.existsSync(p)) {
          fontPath = p
          break
        }
      }

      for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex++) {
        const pageData = data.pages[pageIndex]
        doc.addPage({ size: [pageSize.width, pageSize.height], margin: 0 })

        // Get this page's grid settings
        const { rows, cols, gap, margin } = pageData.gridSettings
        const marginPts = margin * mmToPoints
        const gapPts = gap * mmToPoints

        const contentWidth = pageSize.width - (2 * marginPts)
        const contentHeight = pageSize.height - (2 * marginPts)

        const cellWidth = (contentWidth - (gapPts * (cols - 1))) / cols
        const cellHeight = (contentHeight - (gapPts * (rows - 1))) / rows

        // Reserve space for filename if showing
        const filenameHeight = data.showFilenames ? 12 : 0
        const imageAreaHeight = cellHeight - filenameHeight

        // Set font for this page
        if (fontPath) {
          doc.font(fontPath)
        } else {
          doc.font('Courier')
        }

        // Draw title at top if enabled
        if (data.title) {
          doc.fontSize(10)
             .fillColor('#666666')
             .text(data.title, 0, 15, {
               width: pageSize.width,
               align: 'center'
             })
        }

        // Draw page number at bottom if enabled
        if (data.showPageNumbers) {
          doc.fontSize(10)
             .fillColor('#666666')
             .text(`${pageIndex + 1}/${totalPages}`, 0, pageSize.height - 25, {
               width: pageSize.width,
               align: 'center'
             })
        }

        for (let i = 0; i < pageData.cells.length; i++) {
          const cell = pageData.cells[i]
          if (!cell.imageData) continue

          const row = Math.floor(i / cols)
          const col = i % cols

          const cellX = marginPts + (col * (cellWidth + gapPts))
          const cellY = marginPts + (row * (cellHeight + gapPts))

          try {
            const mimeType = cell.imageData.split(';')[0].split(':')[1]
            const base64Data = cell.imageData.split(',')[1]

            if (mimeType === 'image/svg+xml') {
              // Decode SVG and embed as vector
              const svgString = Buffer.from(base64Data, 'base64').toString('utf-8')

              // Parse SVG to get dimensions
              const widthMatch = svgString.match(/width="([^"]+)"/)
              const heightMatch = svgString.match(/height="([^"]+)"/)
              const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)

              let svgWidth = 100, svgHeight = 100
              if (viewBoxMatch) {
                const [, , w, h] = viewBoxMatch[1].split(/\s+/).map(Number)
                svgWidth = w || 100
                svgHeight = h || 100
              } else {
                if (widthMatch) svgWidth = parseFloat(widthMatch[1]) || 100
                if (heightMatch) svgHeight = parseFloat(heightMatch[1]) || 100
              }

              // Calculate fit dimensions
              const imgAspect = svgWidth / svgHeight
              const cellAspect = cellWidth / imageAreaHeight

              let drawWidth, drawHeight
              if (imgAspect > cellAspect) {
                drawWidth = cellWidth
                drawHeight = cellWidth / imgAspect
              } else {
                drawHeight = imageAreaHeight
                drawWidth = imageAreaHeight * imgAspect
              }

              const drawX = cellX + (cellWidth - drawWidth) / 2
              const drawY = cellY + (imageAreaHeight - drawHeight) / 2

              // Draw SVG as vector
              doc.save()
              SVGtoPDF(doc, svgString, drawX, drawY, {
                width: drawWidth,
                height: drawHeight,
                preserveAspectRatio: 'xMidYMid meet'
              })
              doc.restore()
            } else if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
              // Embed raster image
              const imageBuffer = Buffer.from(base64Data, 'base64')

              // Get image dimensions by parsing the buffer
              const img = doc.openImage(imageBuffer)
              const imgAspect = img.width / img.height
              const cellAspect = cellWidth / imageAreaHeight

              let drawWidth, drawHeight
              if (imgAspect > cellAspect) {
                drawWidth = cellWidth
                drawHeight = cellWidth / imgAspect
              } else {
                drawHeight = imageAreaHeight
                drawWidth = imageAreaHeight * imgAspect
              }

              const drawX = cellX + (cellWidth - drawWidth) / 2
              const drawY = cellY + (imageAreaHeight - drawHeight) / 2

              doc.image(imageBuffer, drawX, drawY, {
                width: drawWidth,
                height: drawHeight
              })
            }

            // Draw filename if enabled
            if (data.showFilenames && cell.filename) {
              // Reset to SFMono (SVGtoPDF may have changed the font)
              if (fontPath) {
                doc.font(fontPath)
              } else {
                doc.font('Courier')
              }
              doc.fontSize(8)
                 .fillColor('#4d4d4d')

              const textY = cellY + imageAreaHeight + 2
              doc.text(cell.filename, cellX, textY, {
                width: cellWidth,
                align: 'center',
                ellipsis: true,
                height: filenameHeight,
                lineBreak: false
              })
            }
          } catch (imgError) {
            console.error('Error embedding image:', imgError)
          }
        }
      }

      doc.end()

      writeStream.on('finish', () => {
        resolve({ success: true, filePath })
      })

      writeStream.on('error', (err) => {
        resolve({ success: false, error: String(err) })
      })
    })
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
