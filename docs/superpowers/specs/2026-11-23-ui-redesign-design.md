# UI redesign: soft light theme with restrained glass

Status: agreed with the owner on 2026-11-23. Not started.

## Intent

The KMP app works, but it looks plain. It defines no theme, so every screen runs on Material 3's
default purple. Some screens are still placeholders: the Home tab is the Phase 1 map spike, showing
Istanbul with nothing on it. The thesis is defended with this app on screen, so how it looks is
part of how the work is judged.

What the owner asked for, in their words: **smooth, user-friendly, light; soft, not stiff or
clunky.** Glassmorphism is welcome on a light theme, but restrained.

## Goals

- One Compose theme (colours, shapes, typography) that every screen draws from.
- Every screen restyled in the same visual language. Three screens get new layouts, shown in the
  mockups below: Home, route Results and Itinerary.
- Motion that makes the app feel smooth rather than instant and abrupt.

## Non-goals

- Dark theme. Light only; the preset's dark values exist, so it can come later.
- New features. The redesign changes how existing things look and move. The new Home content and
  the route map are the exception; they are their own tasks on the same list (see below).
- iOS-specific polish. Windows cannot build iOS, so verification is on the Android emulator. iOS
  must still compile in Mobile CI.

## Anti-goals (a failure even if it works)

- Heavy, busy glass: blur everywhere, strong gradients, low-contrast text on glass.
- Stiff typography: 700-weight headings, mixed font families.
- A redesign that breaks a flow that works today: auth, onboarding gate, Explore → Results → save,
  Itinerary.

## Decided by the owner

- **Colours: shadcn preset `bfr7b0rSq`** (style `base-mira`, base colour `stone`). Light values,
  converted from oklch:
  - primary `#007595`, on-primary `#ecfeff`
  - foreground `#0c0a09`, muted-foreground `#79716b`
  - muted `#f5f5f4`, secondary `#f4f4f5`, border `#e7e5e4`
  - destructive `#e7000b`
  - chart/accent ramp: `#53eafd` `#00b8db` `#0092b8` `#007595` `#005f78`
- **Glass, restrained.** The background is near-white `#fbfbfa` with three very soft colour washes:
  cyan `#bdeef8` top-left, peach `#fbdccd` right, pale blue `#cfe9f3` bottom. These fade to
  transparent at about 60–65% of the screen. Cards, chips, day tabs and the bottom navigation bar
  are frosted glass over that background:
  - white at roughly 55–72% opacity, background blur
  - a 1 px white highlight border
  - a soft tinted shadow, `rgba(0,95,120,.07)`, with no grey border
- **Font: Figtree**, bundled as a font resource. Headings 600, body 400; body slightly larger, line
  height about 1.5. One family for everything.

## Builder's calls (presented to the owner, not objected to)

- **Corner radius 18 dp** for cards and buttons, 16 dp for small cards, pill shapes for chips and
  tabs. The selected state is a soft primary glow (tinted shadow plus a faint primary border),
  never a hard 2 px outline.
- **Primary button:** a subtle diagonal gradient `#0089ad → #007595 → #006a86` with a soft primary
  shadow.
- **Motion:**
  - screen transitions slide and fade
  - cards and buttons scale down slightly when pressed
  - the route polyline draws itself in
  - all of it short, about 200–300 ms, with ease-out
- **Icons:** Material Symbols **Rounded** (`compose.materialIconsExtended`, `Icons.Rounded.*`).
- **Glass implementation:** the [Haze](https://github.com/chrisbanes/haze) library (KMP, Android +
  iOS). Below Android 12 it falls back to translucent white with no blur; that is acceptable. The
  app is on Compose Multiplatform **1.7.3**, so check which Haze version supports that before
  adding it. If none fits cleanly, use a translucent fallback everywhere and keep the blur on the
  bottom bar only.
- **Copy stays localised (EN/TR).** New strings go into both `values/strings.xml` and
  `values-tr/strings.xml`.

## Screens

Mockups (open in a browser): `docs/design/mockups/2026-11-23-screens-glass.html` is the agreed
look. `2026-11-23-screens-preset-flat.html` is the same layouts without glass, for reference. The
mockups render in Inter / Noto Sans; the agreed font is **Figtree**.

- **Home (new content):**
  - greeting ("Hello, {name}"), headline "Where to next?"
  - primary "Plan a new route" button → Explore
  - **upcoming trip card:** route (`Berlin → Rome → Paris`), dates, flight count, "N days to go"
    badge, a small map with the route, total price; tap → trip detail
  - "Recent" chips
  - empty state when there are no trips: the button and a short line
- **Route Results:**
  - preset chips (Budget / Fast / Comfort / Balanced)
  - the **Recommended** card, selected with a glow, showing price, city order, flight count and
    duration, and a small route map
  - the alternative options (cheapest / fastest / most direct) as compact cards
  - a full-width "Save this trip" button
- **Itinerary:**
  - day pills (Day 1 / 2 / 3)
  - a time column on the left, with each visit as a glass card (name, category · duration)
  - a walking time between visits ("🚶 12 min walk", rendered with a Rounded icon, not an emoji)
  - the existing badges kept in the new style: assumed hours ⓘ (muted, not error-coloured),
    closed that day
- **Everything else, restyled with the same components, no new mockup:**
  - sign-in
  - onboarding swipe deck
  - Explore (trip configuration form)
  - trips list
  - trip detail
  - profile hub, Interests, Preferences, Language, the delete-account dialog
  - the retry/error state component

## Where it sits in the remaining work

The order agreed on 2026-11-23 (also in `AGENTS.md` → Next):

1. Trip delete in mobile
2. Measure itinerary generation time
3. Recorded-fares demo mode
4. Remove the legacy Expo app
5. **This redesign.** Home's new content (task 3 on the original list) and the route map on Results
   and Itinerary (task 6, Android) are built inside it, in the new style.
6. Manual QA pass on Android
7. If time allows: Swagger, deploy

## Left to the builder

- How to structure the theme in code (for example a `ui/theme/` package with `SmartRouteTheme`,
  plus reusable `GlassCard` / `GlassChip` / `PrimaryButton` composables).
- The exact opacity, blur radius and shadow values within the ranges above, judged on the
  emulator.
- The order in which screens are restyled.
- How the route map draws its polyline, consistent with ADR-0004 and the existing `RouteMap`
  expect/actual (evolve it toward a state-holder parameter, per `AGENTS.md`).

## Verification

- Every screen checked on the Android emulator (`pixel8` AVD), with screenshots via
  `adb exec-out screencap`.
- `./gradlew :composeApp:testDebugUnitTest ktlintCheck assembleDebug` green; Mobile CI green,
  including the iOS framework link.
- Glass legibility: body text on glass keeps WCAG AA contrast against the lightest background
  point.
