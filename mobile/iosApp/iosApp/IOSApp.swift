import ComposeApp
import SwiftUI

@main
struct IOSApp: App {
    init() {
        // MapLibre is an SPM dependency of this wrapper, not of the Kotlin framework;
        // hand the shared UI a factory before any Compose content is created.
        MapViewBridge.shared.createMapView = { MapViewFactory.makeRouteMapView() }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .ignoresSafeArea()
        }
    }
}
