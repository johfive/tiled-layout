import Cocoa
import QuickLookUI

class PreviewViewController: NSViewController, QLPreviewingController {

    override var nibName: NSNib.Name? { nil }

    override func loadView() {
        view = NSView()
    }

    func preparePreviewOfFile(
        at url: URL,
        completionHandler handler: @escaping (Error?) -> Void
    ) {
        do {
            let file = try TLPFileReader.read(url: url)

            let pageSize = file.layout.pageSize.sizeInPoints

            // Set preferred content size so QuickLook sizes the panel to fit the page
            // Use a reasonable max dimension for the preview panel
            let maxDim: CGFloat = 600
            let pageAspect = pageSize.width / pageSize.height
            let preferredWidth: CGFloat
            let preferredHeight: CGFloat
            if pageAspect > 1 {
                preferredWidth = maxDim
                preferredHeight = maxDim / pageAspect
            } else {
                preferredHeight = maxDim
                preferredWidth = maxDim * pageAspect
            }
            self.preferredContentSize = NSSize(width: preferredWidth, height: preferredHeight)

            // Render at 2x for retina quality
            let renderScale: CGFloat = 2.0
            let renderSize = CGSize(
                width: preferredWidth * renderScale,
                height: preferredHeight * renderScale
            )

            guard let cgImage = TLPRenderer.render(file: file, maxSize: renderSize) else {
                handler(TLPError.cannotOpenArchive)
                return
            }

            let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: preferredWidth, height: preferredHeight))

            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }

                let imageView = NSImageView()
                imageView.image = nsImage
                imageView.imageScaling = .scaleProportionallyDown
                imageView.imageAlignment = .alignCenter
                imageView.translatesAutoresizingMaskIntoConstraints = false

                self.view.addSubview(imageView)
                // Inset slightly so QuickLook panel chrome doesn't clip page edges
                let inset: CGFloat = 8
                NSLayoutConstraint.activate([
                    imageView.topAnchor.constraint(equalTo: self.view.topAnchor, constant: inset),
                    imageView.bottomAnchor.constraint(equalTo: self.view.bottomAnchor, constant: -inset),
                    imageView.leadingAnchor.constraint(equalTo: self.view.leadingAnchor, constant: inset),
                    imageView.trailingAnchor.constraint(equalTo: self.view.trailingAnchor, constant: -inset),
                ])

                handler(nil)
            }

        } catch {
            handler(error)
        }
    }
}
