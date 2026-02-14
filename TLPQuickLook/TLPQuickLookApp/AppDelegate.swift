import Cocoa

/// Minimal host application for the QuickLook extensions.
/// Runs as LSUIElement (no dock icon). Exists only to:
/// 1. Register the com.tiledlayout.tlp UTType with the system
/// 2. Contain the Thumbnail and Preview app extensions
@main
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Nothing to do — the app just needs to exist and be launched once
        // to register its UTType declaration and extensions with macOS.
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
}
