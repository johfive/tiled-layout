import QuickLookThumbnailing

class ThumbnailProvider: QLThumbnailProvider {

    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
    ) {
        let fileURL = request.fileURL
        let maxSize = request.maximumSize
        let scale = request.scale

        do {
            let file = try TLPFileReader.read(url: fileURL)

            // Calculate the context size based on page aspect ratio
            let pageSize = file.layout.pageSize.sizeInPoints
            let aspect = pageSize.width / pageSize.height
            let contextWidth: CGFloat
            let contextHeight: CGFloat

            if aspect > 1 {
                contextWidth = maxSize.width
                contextHeight = maxSize.width / aspect
            } else {
                contextHeight = maxSize.height
                contextWidth = maxSize.height * aspect
            }

            let contextSize = CGSize(width: contextWidth, height: contextHeight)

            let renderSize = CGSize(
                width: contextWidth * scale,
                height: contextHeight * scale
            )

            guard let image = TLPRenderer.render(file: file, maxSize: renderSize) else {
                handler(nil, TLPError.cannotOpenArchive)
                return
            }

            let reply = QLThumbnailReply(contextSize: contextSize, drawing: { ctx -> Bool in
                let drawRect = CGRect(origin: .zero, size: contextSize)
                // Flip the context since our rendered image is top-down
                // but CGContext.draw expects bottom-up coordinates
                ctx.saveGState()
                ctx.translateBy(x: 0, y: contextSize.height)
                ctx.scaleBy(x: 1, y: -1)
                ctx.draw(image, in: drawRect)
                ctx.restoreGState()
                return true
            })

            handler(reply, nil)

        } catch {
            handler(nil, error)
        }
    }
}
