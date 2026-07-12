import CoreLocation
import MapLibre
import UIKit

/// Mirrors RouteMap.android.kt: demotiles style, camera on Istanbul.
enum MapViewFactory {
    private static let demoStyleURL = URL(string: "https://demotiles.maplibre.org/style.json")!
    private static let istanbul = CLLocationCoordinate2D(latitude: 41.0082, longitude: 28.9784)

    static func makeRouteMapView() -> UIView {
        let mapView = MLNMapView(frame: .zero, styleURL: demoStyleURL)
        mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        mapView.setCenter(istanbul, zoomLevel: 9, animated: false)
        return mapView
    }
}
