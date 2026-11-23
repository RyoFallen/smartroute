# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the KMP app one soft, light theme with restrained glass and Figtree. Restyle every screen in it. Build the new Home content (original task 3) and the Android route map on Results and Home (original task 6).

**Architecture:** A new `ui/theme/` package holds the tokens and `SmartRouteTheme`. `ui/components/` holds the reusable glass primitives (`GlassBackground`, `GlassCard`, `GlassPill`, `PrimaryButton`, `Modifier.pressScale`). Every screen is rebuilt from those. The route map evolves `RouteMap` into a state-holder API (`RouteMapState`). Its geometry is pure commonMain code; only the MapLibre drawing is Android-specific. City coordinates come from `GET /cities`, which gains `lat`/`lon`, cached app-wide by a `CityCatalog`.

**Tech Stack:** Kotlin 2.1.0, Compose Multiplatform 1.7.3, Material 3, `compose.materialIconsExtended`, Haze 1.5.4, MapLibre Android 11.5.2, kotlinx-datetime; backend Fastify + zod + Prisma for the `/cities` change.

**Spec:** `docs/superpowers/specs/2026-11-23-ui-redesign-design.md` (agreed look: `docs/design/mockups/2026-11-23-screens-glass.html`).

## Global Constraints

- Light theme only. Colours (spec, verbatim): primary `#007595`, on-primary `#ecfeff`, foreground `#0c0a09`, muted-foreground `#79716b`, muted `#f5f5f4`, secondary `#f4f4f5`, border `#e7e5e4`, destructive `#e7000b`. Accent ramp `#53eafd` `#00b8db` `#0092b8` `#007595` `#005f78`.
- Background `#fbfbfa` with three washes: cyan `#bdeef8` top-left, peach `#fbdccd` right, pale blue `#cfe9f3` bottom. Each fades to transparent at ~60–65% of the screen.
- Glass: white at 55–72% opacity, 1 px white highlight border, shadow `rgba(0,95,120,.07)`, no grey border.
- Figtree only. Headings weight 600, body 400, body line height ~1.5. No weight 700 anywhere.
- Radius 18 dp for cards and buttons, 16 dp for small cards, pill for chips and tabs. The selected state is a primary-tinted glow plus a faint primary border, never a hard 2 px outline.
- Primary button gradient `#0089ad → #007595 → #006a86` (diagonal), soft primary shadow.
- Motion 200–300 ms, ease-out: screen slide+fade, press scale-down, polyline draw-in.
- Icons: Rounded only (no emoji, including the walking indicator). Direction-sensitive icons come from `Icons.AutoMirrored.Rounded.*` (`ArrowBack`, `DirectionsWalk`); everything else from `Icons.Rounded.*`.
- Every new string goes into both `values/strings.xml` and `values-tr/strings.xml`. `StringResourceCompletenessTest` enforces this for `<string>`. Task 5 extends it to `<plurals>`, which it does not check today.
- Haze is pinned to **1.5.4**. It is the newest release built on CMP 1.7.3 / Kotlin 2.1.0; 1.6.x needs CMP 1.8. Real blur is used **only on the bottom navigation bar**, the one surface that scrolling content passes under. Cards use the translucent fallback that the spec allows: blurring a smooth static gradient looks the same as not blurring it.
- No flow may break: auth, onboarding gate, Explore → Results → save, Itinerary, trip delete.
- Never run `:composeApp:linkDebugFrameworkIos*` on Windows. iOS compile is Mobile CI's macOS job. Every `expect` change needs its iOS `actual` updated in the same task.
- Set `JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot` in every Gradle shell.
- Mobile gate per task: `./gradlew :composeApp:testDebugUnitTest :composeApp:assembleDebug ktlintCheck` green (run `ktlintFormat` first).
- Visual check per screen task: emulator `pixel8`, screenshot with `adb exec-out screencap -p > <scratchpad>/<name>.png`, then look at it.
- No Claude attribution in commits.

## Decisions taken by this plan (not in the spec)

- **The greeting has no name.** The app never collects one: sign-in is an email code, and `/users/me` has no name field. Home shows a time-of-day greeting ("Good morning / afternoon / evening") above "Where to next?". To show a name, the owner has to add a profile field first; that is out of scope here.
- **Map tiles: OpenFreeMap Positron** (`https://tiles.openfreemap.org/styles/positron`). Free, no key, light grey, fits the theme. Replaces `demotiles`. MapLibre's attribution control stays on.
- **Maps are static in cards.** Gestures are off; the camera fits the route. Each Results/Home screen shows at most one map. Itinerary gets no map: the spec's Itinerary layout has none and the budget is tight.
- **Flight count on Home = `cities.size - 1`.** Saved trips are open tours, so this matches the stored legs without changing `TripSummaryDto`.
- **"Recent" chips** show up to 3 most recent saved trips (excluding the upcoming one). Tapping a chip opens that trip.
- **Itinerary day pills are numbered across the whole trip** (Day 1…N), with the city name as a second line, because a trip spans several cities.

## Review Focus

1. **`/cities` fails, or a trip city has no coordinates.** The screen must still render everything except the map. Pinned in Task 3 (`routePoints skips cities without coordinates`, `catalog failure yields empty map and retries next call`), Task 5 (Results renders with an empty catalog) and Task 6 (Home renders with an empty catalog).
2. **A trip starting today, or one already finished.** Today shows "Today", not "0 days to go". A past trip is never "upcoming" and falls into Recent. Pinned in Task 6.
3. **Changing the preset on Results after selecting a route, or while a save is in flight.** The selection resets, the request re-runs with the new preset, and a press during a save is ignored, so a trip is never saved twice. Pinned in Task 5.
4. **A one-city or zero-coordinate route reaches the map.** Bounds of one point must not crash or zoom to the whole world; zero points hide the map. Pinned in Task 3 (`boundsOf single point`, `RouteMapState.isEmpty`).
5. **An 8-city route and long Turkish city names on narrow cards.** Route text stays on one line with an ellipsis and never pushes the price off the card. Pinned as emulator checks in Tasks 5 and 6 (8-city fixture trip, language TR).

---

### Task 1: Theme tokens, Figtree, `SmartRouteTheme`

**Files:**

- Create: `mobile/composeApp/src/commonMain/composeResources/font/figtree_regular.ttf`, `figtree_medium.ttf`, `figtree_semibold.ttf`
- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/theme/Colors.kt`, `Type.kt`, `Shapes.kt`, `Theme.kt`, `Contrast.kt`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/App.kt` (replace `MaterialTheme {` with `SmartRouteTheme {`)
- Modify: `mobile/gradle/libs.versions.toml`, `mobile/composeApp/build.gradle.kts` (add `implementation(compose.materialIconsExtended)` to commonMain)
- Test: `mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/ui/theme/ThemeTokensTest.kt`

**Interfaces:**

- Produces: `object SrColors { val Primary; OnPrimary; Foreground; MutedForeground; Muted; Secondary; Border; Destructive; Background /*#fbfbfa*/; WashCyan; WashPeach; WashBlue; GlassShadow /*0x12005F78*/; Ramp: List<Color> }`
- Produces: `const val GLASS_ALPHA = 0.72f`, `const val GLASS_ALPHA_SUBTLE = 0.55f`
- Produces: `fun contrastRatio(a: Color, b: Color): Double` (WCAG 2.x relative luminance) and `fun Color.over(background: Color): Color` (alpha composite, result opaque)
- Produces: `object SrShapes { val Card = RoundedCornerShape(18.dp); val SmallCard = RoundedCornerShape(16.dp); val Pill = RoundedCornerShape(50) }`
- Produces: `@Composable fun SmartRouteTheme(content: @Composable () -> Unit)`: a `lightColorScheme` mapped from `SrColors` (primary, onPrimary, background=Background, surface=White, onSurface=Foreground, onSurfaceVariant=MutedForeground, surfaceVariant=Muted, secondaryContainer=Secondary, outline=Border, outlineVariant=Border, error=Destructive). Typography uses the Figtree family on every style: `headline*`/`title*` at `FontWeight.SemiBold`, `body*`/`label*` at `Normal`/`Medium`, body line height = 1.5 × font size, `bodyLarge` 17 sp, `bodyMedium` 15 sp. Shapes: `small=16.dp`, `medium=18.dp`, `large=18.dp`.

- [ ] **Step 1: Generate the static Figtree instances.** Download the OFL variable font `https://github.com/google/fonts/raw/main/ofl/figtree/Figtree%5Bwght%5D.ttf` into a new empty scratchpad dir. In a venv with `fonttools`, run `fonttools varLib.instancer Figtree[wght].ttf wght=400 -o figtree_regular.ttf` (and the same with 500 → `figtree_medium.ttf`, 600 → `figtree_semibold.ttf`). Copy the three files into `composeResources/font/`. Also copy the font's `OFL.txt` to `mobile/composeApp/src/commonMain/composeResources/font/OFL.txt`. Static files avoid depending on CMP 1.7's variable-font API. The variable file is checked to cover `şŞğĞıİçÇöÖüÜ→€·–`.

- [ ] **Step 2: Write the failing test** `ThemeTokensTest`:

```kotlin
@Test fun `palette matches the agreed preset`() {
    assertEquals(Color(0xFF007595), SrColors.Primary)
    assertEquals(Color(0xFF79716B), SrColors.MutedForeground)
    assertEquals(Color(0xFFFBFBFA), SrColors.Background)
}
@Test fun `contrast ratio of black on white is 21`() =
    assertEquals(21.0, contrastRatio(Color.Black, Color.White), 0.01)
@Test fun `body text on glass meets AA over every wash`() {
    listOf(SrColors.Background, SrColors.WashCyan, SrColors.WashPeach, SrColors.WashBlue).forEach { bg ->
        val glass = Color.White.copy(alpha = GLASS_ALPHA).over(bg)
        assertTrue(contrastRatio(SrColors.Foreground, glass) >= 4.5)
    }
}
@Test fun `muted text on glass meets AA on the base and 3 to 1 on the strongest wash`() {
    assertTrue(contrastRatio(SrColors.MutedForeground, Color.White.copy(alpha = GLASS_ALPHA).over(SrColors.Background)) >= 4.5)
    assertTrue(contrastRatio(SrColors.MutedForeground, Color.White.copy(alpha = GLASS_ALPHA).over(SrColors.WashPeach)) >= 3.0)
}
```

(The muted/peach pair measures ~4.46:1 at 72%. That is why muted text is used only for secondary meta lines and never for body copy. The spec's AA condition is stated against the lightest background point, which the first assertion pins.)

- [ ] **Step 3: Run it.** Run `./gradlew :composeApp:testDebugUnitTest --tests "*ThemeTokensTest*"`. Expected: compile FAIL, `SrColors` unresolved.

- [ ] **Step 4: Implement** `Colors.kt`, `Contrast.kt`, `Shapes.kt`, `Type.kt` (`FontFamily(Font(Res.font.figtree_regular, FontWeight.Normal), Font(Res.font.figtree_medium, FontWeight.Medium), Font(Res.font.figtree_semibold, FontWeight.SemiBold))`; the composable `figtree()` builds it, because resource fonts are composable), and `Theme.kt`. In `App.kt`, swap `MaterialTheme {` for `SmartRouteTheme {`.

- [ ] **Step 5: Run the mobile gate.** Expected: green. Then install (`./gradlew :composeApp:installDebug`) and take a screenshot of the sign-in screen. Expected: teal primary, Figtree text, no purple.

- [ ] **Step 6: Commit** `feat(mobile): add the SmartRoute theme — preset colours, Figtree, shapes`.

---

### Task 2: Glass primitives, bottom bar with Haze, screen transitions

**Files:**

- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/components/GlassBackground.kt`, `GlassCard.kt`, `GlassPill.kt`, `PrimaryButton.kt`, `PressScale.kt`
- Modify: `mobile/gradle/libs.versions.toml` (`haze = "1.5.4"`, library `haze = { module = "dev.chrisbanes.haze:haze", version.ref = "haze" }`), `mobile/composeApp/build.gradle.kts` (commonMain `implementation(libs.haze)`)
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/navigation/MainTabsScaffold.kt`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/App.kt` (wrap the whole app in `GlassBackground`)

**Interfaces:**

- Consumes: Task 1 `SrColors`, `SrShapes`, `GLASS_ALPHA`, `GLASS_ALPHA_SUBTLE`.
- Produces:
  - `@Composable fun GlassBackground(modifier: Modifier = Modifier, content: @Composable () -> Unit)`: fills `SrColors.Background` and draws three `Brush.radialGradient` washes (cyan centred at top-left, peach at the right edge ~35% down, blue at the bottom centre), each from its colour to transparent at radius ≈ 0.62 × the larger screen dimension.
  - `@Composable fun GlassCard(modifier: Modifier = Modifier, shape: Shape = SrShapes.Card, selected: Boolean = false, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit)`: white at `GLASS_ALPHA`, 1 dp border of white at 0.9, shadow tinted `SrColors.GlassShadow` (elevation ~12 dp, `spotColor`/`ambientColor` = GlassShadow). When `selected`: border primary at 0.35 plus a primary-tinted shadow (`rgba(0,117,149,.35)`-ish spot colour), never a 2 dp outline. When clickable: `pressScale`.
  - `@Composable fun GlassPill(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, leadingIcon: ImageVector? = null)`: `SrShapes.Pill`, unselected = white at `GLASS_ALPHA_SUBTLE` with the white border; selected = primary fill, on-primary text.
  - `@Composable fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, leadingIcon: ImageVector? = null)`: height 52 dp, `SrShapes.Card`, `Brush.linearGradient(0xFF0089AD, 0xFF007595, 0xFF006A86)` from top-left to bottom-right, primary-tinted shadow, `titleMedium` on-primary text, `pressScale`. Disabled = `SrColors.Muted` fill, muted-foreground text, no shadow.
  - `fun Modifier.pressScale(interactionSource: MutableInteractionSource): Modifier`: animates scale to `0.97f` while pressed, `tween(200, easing = FastOutSlowInEasing)`.
  - `const val MOTION_MS = 250`, shared by every transition below.

- [ ] **Step 1: Add the Haze and icons dependencies and build.** Run `./gradlew :composeApp:assembleDebug`. Expected: green. This proves Haze 1.5.4 resolves against CMP 1.7.3 before any code depends on it.

- [ ] **Step 2: Implement the five component files** per the Interfaces block.

- [ ] **Step 3: Restyle `MainTabsScaffold`.**
  - `Scaffold(containerColor = Color.Transparent)`.
  - `val hazeState = remember { HazeState() }`. The NavHost gets `Modifier.hazeSource(hazeState)`. The bottom bar is a custom `Row` (not `NavigationBar`) with `Modifier.hazeEffect(hazeState, HazeStyle(backgroundColor = SrColors.Background, tints = listOf(HazeTint(Color.White.copy(alpha = 0.6f))), blurRadius = 20.dp))`, a top white highlight border and the glass shadow.
  - Items use `Icons.Rounded.Home`, `Icons.Rounded.Luggage`, `Icons.Rounded.Explore`, `Icons.Rounded.Person`. The selected item is primary with a soft primary pill behind the icon.
  - Every `composable<…>` in the NavHost gets `enterTransition = { slideInHorizontally(tween(MOTION_MS, easing = EaseOut)) { it / 8 } + fadeIn(tween(MOTION_MS)) }`, `exitTransition = { fadeOut(tween(MOTION_MS)) }`, and mirrored pop transitions. Set them once via the `NavHost` parameters.
  - Keep the existing tab navigation semantics (`popUpTo` start + `saveState`/`restoreState`) unchanged.

- [ ] **Step 4: Run the mobile gate** (existing tests prove no ViewModel broke). Expected: green.

- [ ] **Step 5: Emulator check.** Screenshot Home and My Trips. Expected: washes visible but faint, the bottom bar frosted, list content visibly blurred under the bar when scrolled (My Trips with ≥ 5 trips), slide+fade on tab change.

- [ ] **Step 6: Commit** `feat(mobile): glass primitives, frosted bottom bar and screen transitions`.

---

### Task 3: City coordinates, `CityCatalog`, map geometry and `RouteMapState`

**Files:**

- Modify: `packages/shared/src/cities.ts` (`CitySummary` + `lat: z.number()`, `lon: z.number()`), `apps/backend/src/services/cities/index.ts` (select `lat`, `lon`)
- Test: `apps/backend/tests/routes/cities.route.test.ts`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/data/api/CitySummaryDto.kt` (+ `val lat: Double? = null`, `val lon: Double? = null`; nullable so an older backend still decodes)
- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/data/CityCatalog.kt`
- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/map/RouteGeometry.kt`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.kt`, `src/androidMain/.../ui/map/RouteMap.android.kt` (signature only in this task), `src/iosMain/.../ui/map/RouteMap.ios.kt`, `ui/home/HomeScreen.kt` (call site)
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/AppGraph.kt` (`val cityCatalog by lazy { CityCatalog(apiClient) }`)
- Test: `mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/data/CityCatalogTest.kt`, `src/commonTest/.../ui/map/RouteGeometryTest.kt`

**Interfaces:**

- Produces (commonMain, `ui/map`):
  - `data class MapPoint(val lat: Double, val lon: Double)`
  - `data class MapBounds(val south: Double, val west: Double, val north: Double, val east: Double)`
  - `data class RouteMapState(val points: List<MapPoint>, val animate: Boolean = true) { val isEmpty: Boolean get() = points.isEmpty() }`
  - `fun boundsOf(points: List<MapPoint>, minSpanDegrees: Double = 0.2): MapBounds?`: null for an empty list. A single point, or any span under `minSpanDegrees`, is padded symmetrically to `minSpanDegrees` so the camera never zooms to street level or the whole world.
  - `fun polylinePrefix(points: List<MapPoint>, fraction: Float): List<MapPoint>`: the polyline cut at `fraction` of its total length (straight-line interpolation in lat/lon). `fraction <= 0` → the first point only, `>= 1` → all points.
  - `fun routePoints(order: List<String>, coordinates: Map<String, MapPoint>): List<MapPoint>`: maps codes in order and skips codes that have no coordinate.
  - `@Composable expect fun RouteMap(state: RouteMapState, modifier: Modifier = Modifier)`: replaces the positional spike signature.
- Produces (`data`): `class CityCatalog(private val api: ApiClient) { suspend fun coordinates(): Map<String, MapPoint> }`. It calls `api.getCities()` once and caches a successful result. On failure it returns `emptyMap()` and does **not** cache, so the next call retries. Cities with null `lat`/`lon` are left out.

- [ ] **Step 1: Backend failing test.** In `cities.route.test.ts`, assert that every `/cities` item has numeric `lat` and `lon`, and that IST is within `lat 40.9..41.1, lon 28.9..29.1`. Run `pnpm --filter @smartroute/backend test -- tests/routes/cities.route.test.ts` (Postgres up, `DATABASE_URL` set). Expected: FAIL.

- [ ] **Step 2: Backend implementation.** Add the fields to the shared schema and the select. Rebuild shared (`pnpm --filter @smartroute/shared build`). Re-run. Expected: PASS. Then run `pnpm typecheck && pnpm lint && pnpm format:check`.

- [ ] **Step 3: Mobile failing tests.** `RouteGeometryTest`:

```kotlin
@Test fun `boundsOf empty is null`() = assertNull(boundsOf(emptyList()))
@Test fun `boundsOf single point is padded to the minimum span`() {
    val b = boundsOf(listOf(MapPoint(41.0, 29.0)))!!
    assertEquals(0.2, b.north - b.south, 1e-9); assertEquals(0.2, b.east - b.west, 1e-9)
}
@Test fun `boundsOf spans all points`() =
    assertEquals(MapBounds(41.9, 2.1, 52.5, 13.4), boundsOf(listOf(MapPoint(52.5, 13.4), MapPoint(41.9, 12.5), MapPoint(48.8, 2.1))))
@Test fun `polylinePrefix at half of a two-segment equal-length line ends at the middle vertex`() =
    assertEquals(listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0)),
        polylinePrefix(listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0), MapPoint(0.0, 2.0)), 0.5f))
@Test fun `polylinePrefix interpolates inside a segment`() =
    assertEquals(MapPoint(0.0, 0.25), polylinePrefix(listOf(MapPoint(0.0, 0.0), MapPoint(0.0, 1.0)), 0.25f).last())
@Test fun `polylinePrefix clamps`() { /* fraction -1 → first point only; 2 → all points */ }
@Test fun `routePoints skips cities without coordinates`() =
    assertEquals(listOf(MapPoint(52.5, 13.4)), routePoints(listOf("BER", "XXX"), mapOf("BER" to MapPoint(52.5, 13.4))))
@Test fun `RouteMapState isEmpty`() = assertTrue(RouteMapState(emptyList()).isEmpty)
```

`CityCatalogTest` (MockEngine, same style as `TripDetailViewModelTest`):

- `caches coordinates after one successful call`: two `coordinates()` calls give one HTTP request, and IST maps to its point.
- `catalog failure yields empty map and retries next call`: the first response is 500 → `emptyMap()`; the second is 200 → populated; 2 requests in total.
- `skips cities without coordinates`: an item without `lat`/`lon` is absent.

- [ ] **Step 4: Run them.** Run `./gradlew :composeApp:testDebugUnitTest --tests "*RouteGeometryTest*" --tests "*CityCatalogTest*"`. Expected: compile FAIL.

- [ ] **Step 5: Implement** `RouteGeometry.kt`, `CityCatalog.kt`, the new `expect` signature, and the AppGraph entry. Android `actual`: take `state` but keep the spike body for now (Task 4 replaces it). iOS `actual`: take `state` and keep the bridge or placeholder, restyled to `SrColors.Muted` with muted-foreground text. `HomeScreen` passes `RouteMapState(emptyList())` until Task 6.

- [ ] **Step 6: Run the mobile gate.** Expected: green.

- [ ] **Step 7: Commit** `feat: city coordinates on /cities, CityCatalog and route-map geometry`.

---

### Task 4: Android `RouteMap`: Positron tiles, polyline, markers, fit, draw-in

**Files:**

- Modify: `mobile/composeApp/src/androidMain/kotlin/com/smartroute/traveler/ui/map/RouteMap.android.kt`

**Interfaces:**

- Consumes: Task 3 `RouteMapState`, `boundsOf`, `polylinePrefix`, `MapPoint`; Task 1 `SrColors`.
- Produces: the same `actual fun RouteMap(state: RouteMapState, modifier: Modifier)`.

- [ ] **Step 1: Implement.**
  - Style URL `https://tiles.openfreemap.org/styles/positron`.
  - Once the style loads, add a `GeoJsonSource("route")`, a `LineLayer("route-line", "route")` (`lineColor` primary, `lineWidth 3.5f`, `lineCap ROUND`, `lineJoin ROUND`), a `GeoJsonSource("stops")` and a `CircleLayer("stops-dot", "stops")` (radius 5, white fill, primary stroke 2.5).
  - `uiSettings.setAllGesturesEnabled(false)`; attribution stays enabled.
  - Camera: `CameraUpdateFactory.newLatLngBounds(LatLngBounds.from(north, east, south, west), paddingPx)` with 28 dp converted to px, from `boundsOf(state.points)`.
  - Draw-in: in a `LaunchedEffect(state.points)` run `Animatable(0f).animateTo(1f, tween(300, easing = EaseOut))`. On each value, set the route source to a `LineString` of `polylinePrefix(points, value)`. With `state.animate == false`, set the full line once.
  - Recreate nothing on recomposition: keep the `MapView` in `remember`, and update the sources when `state` changes.
  - When `state.isEmpty`, render nothing (callers hide the map, but stay safe).
  - Keep the existing lifecycle forwarding and `onDestroy`.

- [ ] **Step 2: Mobile gate.** Expected: green.

- [ ] **Step 3: Emulator check.** Temporarily give Home a hard-coded `RouteMapState(listOf(BER, FCO, CDG points))`, look at the screenshot, then revert. Expected: light grey Positron map, teal line drawing in, white dots with teal rings, the route filling the frame with padding, no gesture response. Then check the single-point case: one city at a sane city-level zoom.

- [ ] **Step 4: Commit** `feat(mobile): draw the route on a Positron MapLibre map (Android)`.

---

### Task 5: Results redesign: preset pills, glowing Recommended card with map, compact alternatives

**Files:**

- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/explore/ResultsViewModel.kt`, `ResultsScreen.kt`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/navigation/MainTabsScaffold.kt` (pass `AppGraph.cityCatalog`, wire `onPresetSelected`)
- Modify: `values/strings.xml`, `values-tr/strings.xml`
- Test: `mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/ui/explore/ResultsViewModelTest.kt`
- Modify (test): `mobile/composeApp/src/androidUnitTest/kotlin/com/smartroute/traveler/i18n/StringResourceCompletenessTest.kt`

**Interfaces:**

- Consumes: Task 2 components; Task 3 `CityCatalog`, `routePoints`, `RouteMapState`, `RouteMap`.
- Produces:
  - `ResultsViewModel(api: ApiClient, request: OptimizeRequestDto, cityCatalog: CityCatalog)`. The request becomes internal state.
  - `ResultsUiState.Loaded` gains `val preset: OptimizePreset` and `val coordinates: Map<String, MapPoint> = emptyMap()`.
  - `fun selectPreset(preset: OptimizePreset)`: no-op when equal to the current preset or while `saving`. Otherwise it re-runs `/optimize` with `request.copy(preset = preset)` and resets the selection to null.
  - `load()` also fills `coordinates` from `cityCatalog.coordinates()`. A catalog failure leaves the map empty and never fails the load.
- Strings (EN / TR): `results_save` text changes to "Save this trip" / "Bu geziyi kaydet". Add `results_flights` plural: "%d flight"/"%d flights" (TR "%d uçuş"). Preset pill labels reuse `explore_preset_*`.

- [ ] **Step 1: Failing tests** in `ResultsViewModelTest` (pass a `CityCatalog` built on the same MockEngine; route `/cities` in the handlers):
  - `selecting a preset re-runs optimize with it and clears the selection`: load, `selectOption(0)`, `selectPreset(OptimizePreset.BUDGET)` → the second `/optimize` body decodes with `preset == BUDGET`; `Loaded.selectedIndex == null`, `Loaded.preset == BUDGET`.
  - `selecting the current preset does nothing`: still 1 optimize request.
  - `a preset change during a save is ignored`: make `/trips` suspend on a `CompletableDeferred`; `save()` then `selectPreset(TIME)` → still 1 optimize request; complete the deferred → `savedTripId` set.
  - `coordinates come from the catalog and a catalog failure still loads routes`: `/cities` 500 → `Loaded` with options and empty `coordinates`.
  - In `StringResourceCompletenessTest`, add a plurals check alongside the existing string check: the same `<plurals name="…">` key set in both files, and each EN plural has an `other` item. Add `results_flights` to EN only first, to watch it fail.

- [ ] **Step 2: Run them.** Run `./gradlew :composeApp:testDebugUnitTest --tests "*ResultsViewModelTest*"`. Expected: compile FAIL.

- [ ] **Step 3: Implement the ViewModel changes.**

- [ ] **Step 4: Rebuild `ResultsScreen`** on the glass components.
  - A row of 4 `GlassPill`s (Budget/Time/Comfort/Balanced) bound to `selectPreset`.
  - The Recommended option (label `RECOMMENDED`, otherwise the first) as a large `GlassCard(selected = isSelected)` showing: the label, the price (`headlineSmall`, primary), the city order (one line, ellipsis), "N flights · Hh MMm", and a 140 dp `RouteMap` when `routePoints(...)` is non-empty.
  - The other options as compact `GlassCard(shape = SrShapes.SmallCard)` rows: label · price on one line, order underneath.
  - `PrimaryButton` "Save this trip" pinned at the bottom (enabled only with a selection; shows "Saving…" while saving). The save error in destructive colour.
  - Loading and error states use the restyled components.
  - Selection still works by tapping any card.

- [ ] **Step 5: Mobile gate.** Expected: green.

- [ ] **Step 6: Emulator check** (backend running with `FLIGHT_PROVIDER=recorded`, dates in 28 Nov–22 Dec). Check: Explore → Results with BER/FCO/CDG; then an 8-city search with the app in TR (Review Focus 5); switch presets; save. Expected: glow on the selection, map in the Recommended card, EUR prices, one-line route text with ellipsis, the save landing on the trip detail.

- [ ] **Step 7: Commit** `feat(mobile): redesign route results with preset pills and a route map`.

---

### Task 6: Home: greeting, plan button, upcoming trip card with map, recent chips

**Files:**

- Create: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/home/HomeContent.kt`, `HomeViewModel.kt`
- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/home/HomeScreen.kt`, `ui/navigation/MainTabsScaffold.kt`
- Modify: `values/strings.xml`, `values-tr/strings.xml`
- Test: `mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/ui/home/HomeContentTest.kt`, `HomeViewModelTest.kt`

**Interfaces:**

- Consumes: Task 2 components; Task 3 `CityCatalog`, `routePoints`, `RouteMap`; `ApiClient.getTrips()`; `TripSummary` (has `startDate`, `endDate`, `cities`, `totalPriceCents`, `currency`).
- Produces:
  - `enum class Greeting { MORNING, AFTERNOON, EVENING }` and `fun greetingFor(hour: Int): Greeting` (5–11 morning, 12–17 afternoon, otherwise evening).
  - `data class UpcomingTrip(val trip: TripSummary, val daysUntil: Int, val flightCount: Int)`
  - `data class HomeContent(val upcoming: UpcomingTrip?, val recent: List<TripSummary>)`
  - `fun homeContent(trips: List<TripSummary>, today: LocalDate): HomeContent`. Upcoming = the trip with the smallest `startDate` (date part of the ISO string) that is `>= today`; `daysUntil = today.daysUntil(start)`. Recent = all others, most recent `startDate` first, at most 3.
  - `sealed interface HomeUiState { Loading; LoadFailed; data class Loaded(val content: HomeContent, val coordinates: Map<String, MapPoint>) }`
  - `class HomeViewModel(api: ApiClient, cityCatalog: CityCatalog, today: () -> LocalDate = { Clock.System.todayIn(TimeZone.currentSystemDefault()) })` with `fun load()`.
  - `@Composable fun HomeScreen(state: HomeUiState, onPlanRoute: () -> Unit, onTripClick: (String) -> Unit, onRetry: () -> Unit)`
- Strings (EN / TR): `home_greeting_morning` "Good morning" / "Günaydın"; `home_greeting_afternoon` "Good afternoon" / "İyi günler"; `home_greeting_evening` "Good evening" / "İyi akşamlar"; `home_headline` "Where to next?" / "Sırada neresi var?"; `home_plan_route` "Plan a new route" / "Yeni rota planla"; `home_upcoming` "Upcoming trip" / "Yaklaşan gezi"; `home_days_to_go` plural "%d day to go"/"%d days to go" (TR "%d gün kaldı"); `home_today` "Today" / "Bugün"; `home_recent` "Recent" / "Son geziler"; `home_empty` "No trips yet. Plan your first route and it shows up here." / "Henüz gezin yok. İlk rotanı planla, burada görünsün."; reuse `results_flights`.

- [ ] **Step 1: Failing tests.** `HomeContentTest` (today = 2026-12-01):
  - `upcoming is the nearest trip starting today or later`: trips starting 11-20, 12-05, 12-03 → upcoming 12-03 with `daysUntil == 2`.
  - `a trip starting today is upcoming with zero days`: `daysUntil == 0`.
  - `past trips are never upcoming and fill recent newest first, at most three`: 4 past trips → `upcoming == null`, recent = the 3 newest.
  - `flight count is cities minus one`: 3 cities → 2.
  - `greetingFor boundaries`: 4→EVENING, 5→MORNING, 11→MORNING, 12→AFTERNOON, 17→AFTERNOON, 18→EVENING.

  `HomeViewModelTest` (MockEngine, fixed `today`):
  - `loads trips and coordinates`.
  - `Home renders with an empty catalog`: `/cities` 500 → `Loaded` with `coordinates` empty.
  - `trips failure is LoadFailed and retry recovers`.

- [ ] **Step 2: Run them.** Run `./gradlew :composeApp:testDebugUnitTest --tests "*HomeContentTest*" --tests "*HomeViewModelTest*"`. Expected: compile FAIL.

- [ ] **Step 3: Implement** `HomeContent.kt` and `HomeViewModel.kt`.

- [ ] **Step 4: Build `HomeScreen`.**
  - Greeting (`bodyLarge`, muted), headline (`headlineMedium`, SemiBold).
  - `PrimaryButton` "Plan a new route" with `Icons.Rounded.Add`. It navigates to `ExploreRoute` with the same tab-switch options as the bottom bar.
  - Upcoming `GlassCard(onClick = open trip)`: route text (one line, ellipsis), formatted dates, "N flights", a badge (`GlassPill`-styled, primary-tinted) reading "N days to go" or "Today", a 120 dp `RouteMap` when points exist, total price in the trip's currency.
  - "Recent" heading plus up to 3 `GlassPill`s (trip name); tapping one opens that trip.
  - Empty state (no trips): the button plus the `home_empty` line.
  - Loading spinner and retry state.

  In `MainTabsScaffold`, the `HomeRoute` composable creates `HomeViewModel(AppGraph.apiClient, AppGraph.cityCatalog)` and calls `load()` in a `LaunchedEffect(Unit)`, so it reloads after returning. A trip tap navigates to `TripDetailRoute(id)` inside the My Trips graph (switch tab, then push).

- [ ] **Step 5: Mobile gate.** Expected: green.

- [ ] **Step 6: Emulator check.**
  - With a saved upcoming trip: card, badge, map, price.
  - With an 8-city upcoming trip in TR: one-line route, nothing pushed off the card.
  - With a trip whose start date is today: the badge reads "Today".
  - Fresh account: empty state.
  - Tap the card: the trip detail opens and back returns to Home.

- [ ] **Step 7: Commit** `feat(mobile): make Home useful — upcoming trip with route map, recent trips`.

---

### Task 7: Itinerary redesign: day pills, timeline, glass visit cards

**Files:**

- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/trips/ItineraryViewModel.kt`, `ItineraryScreen.kt`
- Modify: `values/strings.xml`, `values-tr/strings.xml`
- Test: `mobile/composeApp/src/commonTest/kotlin/com/smartroute/traveler/ui/trips/ItineraryViewModelTest.kt`

**Interfaces:**

- Consumes: Task 2 components; `ItineraryCityDto` / `ItineraryDayDto` / `VisitSlotDto` (unchanged).
- Produces:
  - `data class DayTab(val number: Int, val cityName: String?, val iata: String, val day: ItineraryDayDto?)`. `day == null` marks a city without a guide (`available == false`).
  - `fun dayTabs(cities: List<ItineraryCityDto>): List<DayTab>` (the existing `Loaded` holds `cities`): one tab per day across all cities in visiting order, numbered from 1. An unavailable city contributes exactly one tab with `day = null`.
  - The `Loaded` state gains `val tabs: List<DayTab>` and `val selectedTab: Int = 0`. `fun selectTab(index: Int)` ignores out-of-range indices.
- Strings: `itinerary_day` "Day %d" / "%d. gün"; `itinerary_walk` "%d min walk" / "%d dk yürüyüş" (replacing the current walking text if one exists; keep both files in sync).

- [ ] **Step 1: Failing tests.**
  - `dayTabs numbers days across cities`: city A with 2 days, B with 1 → numbers 1, 2, 3 with cities A, A, B.
  - `an unavailable city gets one tab without a day`.
  - `empty days keep their tab`: an `empty = true` day appears with its `reason`.
  - `selectTab changes the selection and ignores out of range`.

- [ ] **Step 2: Run them.** Run `./gradlew :composeApp:testDebugUnitTest --tests "*ItineraryViewModelTest*"`. Expected: compile FAIL.

- [ ] **Step 3: Implement** `dayTabs` and the state changes.

- [ ] **Step 4: Rebuild `ItineraryScreen`.**
  - A horizontally scrolling row of `GlassPill`s ("Day N" + city name in `labelSmall`).
  - The selected day below it as a timeline: a left column with start times (`formatIsoTime(startsAt)`, `labelLarge`, muted), a thin primary-tinted vertical line, and each visit as a `GlassCard(shape = SrShapes.SmallCard)` with name (`titleSmall`) and "category · duration" (muted).
  - Between visits, `Icons.AutoMirrored.Rounded.DirectionsWalk` + "N min walk" in muted text whenever `walkMinutesFromPrevious != null`.
  - Badges as small pills: assumed hours = muted fill + `Icons.Rounded.Info`, muted text (not error colour); closed that day = destructive-tinted text on a light destructive fill.
  - An empty day shows the existing localised reason inside a `GlassCard`. A no-guide tab shows the existing no-guide notice.
  - The pill row animates its selection with `animateColorAsState(tween(MOTION_MS))`.

- [ ] **Step 5: Mobile gate.** Expected: green.

- [ ] **Step 6: Emulator check** on a saved recorded-fares trip (e.g. BER→FCO→CDG). Expected: pills, timeline, walking rows with the Rounded icon, at least one assumed-hours badge visible, switching days works.

- [ ] **Step 7: Commit** `feat(mobile): redesign the itinerary as day pills and a glass timeline`.

---

### Task 8: Restyle auth, onboarding and Explore

**Files:**

- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/auth/SignInScreen.kt`, `ui/onboarding/OnboardingScreen.kt`, `ui/explore/TripConfigScreen.kt`, `ui/components/RetryErrorState.kt`, `ui/components/SubScreenHeader.kt`, `App.kt` (`MissingConfigScreen`, onboarding-gate loading/error)

**Interfaces:**

- Consumes: Task 2 components. No ViewModel or signature changes. Every screen's public parameters stay identical, so `MainTabsScaffold` and `App` call sites do not change.

- [ ] **Step 1: Restyle.**
  - `SubScreenHeader`: transparent, `Icons.AutoMirrored.Rounded.ArrowBack` in a 40 dp glass circle, title `titleLarge` SemiBold, trailing actions slot unchanged. TripDetail's delete icon becomes `Icons.Rounded.Delete`.
  - `RetryErrorState`: a `GlassCard` with `Icons.Rounded.CloudOff`, the message, and a `PrimaryButton` retry.
  - Sign-in: centred `GlassCard` holding the app title, the email/code `OutlinedTextField`s (shape 16 dp, focused border primary, unfocused border `SrColors.Border`, container white at `GLASS_ALPHA`) and a `PrimaryButton`.
  - Onboarding swipe deck: the cards become `GlassCard`; the like/dislike/neutral controls become round glass buttons with Rounded icons; progress as primary text.
  - Explore: city chips → `GlassPill`; stay steppers in a `GlassCard` with Rounded add/remove `IconButton`s; preset → `GlassPill` row; direct-only `Switch` themed by the colour scheme; date field and `DatePicker` dialog themed; submit → `PrimaryButton`.

- [ ] **Step 2: Mobile gate.** Expected: green (existing ViewModel tests unchanged).

- [ ] **Step 3: Emulator check.** Sign out, sign in with an email code, then a fresh account through onboarding, then Explore filled to a search. Screenshot each. Expected: one visual language, no purple, no weight-700 text, every flow completes.

- [ ] **Step 4: Commit** `feat(mobile): restyle sign-in, onboarding and Explore in the glass theme`.

---

### Task 9: Restyle trips and profile

**Files:**

- Modify: `mobile/composeApp/src/commonMain/kotlin/com/smartroute/traveler/ui/trips/TripsListScreen.kt`, `TripDetailScreen.kt`, `DeleteTripDialog.kt`, `ui/profile/ProfileScreen.kt`, `InterestsScreen.kt`, `PreferencesScreen.kt`, `LanguageScreen.kt`, `DeleteAccountDialog.kt`

**Interfaces:**

- Consumes: Task 2 components. No ViewModel or signature changes.

- [ ] **Step 1: Restyle.**
  - Trips list: each trip a `GlassCard(onClick)` with the name, dates and price in the trip's currency, plus a primary-tinted `Icons.Rounded.ChevronRight`. Empty state matches Home's tone.
  - Trip detail: header with delete action; summary `GlassCard` (dates · travellers · cabin, total price large in primary); `PrimaryButton` "Plan trip"; flights as `GlassCard(shape = SmallCard)` rows with `Icons.Rounded.Flight`.
  - Profile hub: a `GlassCard` list of rows with Rounded icons; sign out as a quiet text button; delete account in destructive text.
  - Interests and Preferences: `GlassPill` toggles and segmented pills; save via `PrimaryButton`.
  - Language: glass radio rows.
  - Both dialogs: `AlertDialog(shape = SrShapes.Card, containerColor = Color.White)`. Confirm text stays destructive.

- [ ] **Step 2: Mobile gate.** Expected: green.

- [ ] **Step 3: Emulator check.** Trips list → detail → delete-dialog cancel; Profile → Interests → save; Preferences → save; Language → TR → every restyled screen still reads correctly in Turkish. Screenshot each.

- [ ] **Step 4: Commit** `feat(mobile): restyle trips and profile screens in the glass theme`.

---

### Task 10: Whole-app verification and docs

**Files:**

- Modify: `AGENTS.md` (Next list: mark tasks 3, 6 and the redesign done; record the Haze pin, the Positron tile source and the no-name greeting decision under Non-obvious config)
- Modify: `docs/superpowers/specs/2026-11-23-ui-redesign-design.md` (status line → implemented, with the date)

- [ ] **Step 1: Run the full gates.** Mobile: `./gradlew :composeApp:testDebugUnitTest :composeApp:assembleDebug ktlintCheck`. Backend/root: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (Postgres up). Expected: all green.

- [ ] **Step 2: Emulator tour.** Save a screenshot of every screen in the spec's list to the scratchpad (EN, plus Home/Results/Itinerary in TR). Check each against the anti-goals: no heavy blur, no low-contrast text on glass, no 700 weight, no broken flow.

- [ ] **Step 3: Update the docs, commit** `docs: record the UI redesign as shipped`. Push after the owner says so. Confirm Mobile CI is green, including the iOS framework link.
