> **Repo alignment note (2026-07-06):** This is the thesis master spec (v2.0), written before it was decided to host the project in the existing `smartroute` repo. Where the spec and the shipped codebase disagree, the codebase wins:
>
> - Backend framework: **Fastify** (shipped, Plans 1–6), not Express
> - Auth: **Clerk** (JWT verification via Clerk), not custom email/password + bcrypt/refresh-tokens (§9 describes the spec-ideal; Clerk provides the equivalent guarantees)
> - Flight API: **Duffel** (shipped, Plan 4) — resolves the spec's "TBD" in §8.1
> - Database schema: the shipped Prisma schema in `apps/backend/prisma` is the source of truth, not §5.2
> - The mobile sections (§3, §4.2 `mobile/`, §10) describe the **new Kotlin/Compose Multiplatform app** that replaces `apps/mobile` (Expo)

# SmartRoute Traveler - Complete Technical Specification

> **Thesis Project** | Student: Burak Berk Yılmaz (97342) | Group: SD 2
> **Deadline:** Early December 2026 | **Last Updated:** July 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [User Experience Design](#3-user-experience-design)
4. [Technical Architecture](#4-technical-architecture)
5. [Database Design](#5-database-design)
6. [API Specification](#6-api-specification)
7. [Core Algorithms](#7-core-algorithms)
8. [External Integrations](#8-external-integrations)
9. [Security & Authentication](#9-security--authentication)
10. [Mobile App Specification](#10-mobile-app-specification)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)
13. [Implementation Phases](#13-implementation-phases)
14. [Risk Mitigation](#14-risk-mitigation)
15. [Future Enhancements (V2)](#15-future-enhancements-v2)

---

## 1. Executive Summary

### 1.1 Project Overview

**SmartRoute Traveler** is an intelligent mobile application that optimizes multi-city travel routes based on flight costs while generating personalized city exploration itineraries based on user interests.

### 1.2 Core Value Propositions

| Value                          | Description                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| **Cost Optimization**          | Automatically determines the optimal city sequence to minimize total flight cost |
| **Direct Flight Priority**     | Weighted preference for direct flights to save time                              |
| **Personalized Itineraries**   | Interest-based attraction recommendations for each destination                   |
| **Walking Route Optimization** | Efficient daily schedules with proximity-based clustering                        |
| **Unified Platform**           | Single app replaces multiple travel planning tools                               |

### 1.3 Key Decisions Summary

| Decision         | Choice                         | Rationale                                                       |
| ---------------- | ------------------------------ | --------------------------------------------------------------- |
| Mobile Framework | Kotlin + Compose Multiplatform | Single Kotlin codebase for Android & iOS UI, native performance |
| Backend          | Node.js + Express + TypeScript | Fast development, good ecosystem (already shipped, kept as-is)  |
| Database         | PostgreSQL                     | Relational data, JSONB for flexibility                          |
| State Management | ViewModel + StateFlow          | Standard KMP pattern, lifecycle-aware, testable                 |
| Maps             | Mapbox                         | Beautiful maps, generous free tier                              |
| Optimization     | Genetic Algorithm (provided)   | Handles TSP-variant efficiently                                 |
| Authentication   | Email/Password + JWT           | Simple, sufficient for MVP                                      |
| Hosting          | Railway                        | Easy deploy, free tier                                          |

---

## 2. Product Vision

### 2.1 Problem Statement

Planning multi-city trips requires:

- Manual comparison of flight prices across platforms
- Determining optimal city order (combinatorial problem)
- Researching attractions for each destination
- Creating efficient daily schedules

Current solutions address these in isolation, creating a fragmented experience.

### 2.2 Solution

SmartRoute Traveler integrates:

1. **Route Optimization Engine** - Genetic algorithm finds cost-optimal city sequence
2. **Recommendation System** - Interest-based attraction filtering and ranking
3. **Itinerary Generator** - Daily schedules with walking route optimization

### 2.3 Target Users

| Persona               | Description                            | Needs                                |
| --------------------- | -------------------------------------- | ------------------------------------ |
| **Budget Backpacker** | 18-30, multi-city Eurotrips            | Lowest cost, flexibility             |
| **Family Planner**    | 30-50, organizing group trips          | Efficiency, kid-friendly             |
| **Business Traveler** | Frequent flyer, time-sensitive         | Direct flights, quick planning       |
| **Digital Nomad**     | Location-independent, long-term travel | Multiple cities, work-friendly spots |

### 2.4 Success Metrics

| Metric                  | Target                                                    | Measurement                        |
| ----------------------- | --------------------------------------------------------- | ---------------------------------- |
| Route Optimization Time | < 10 seconds                                              | 95th percentile                    |
| Cost Savings            | > 15% vs. naive ordering                                  | Average across benchmark scenarios |
| Competitor Benchmark    | Match or beat best competitor price in ≥ 60% of scenarios | Benchmark study (see §11.5)        |
| User Satisfaction       | > 4.2 / 5.0                                               | In-app rating                      |
| Itinerary Generation    | < 5 seconds                                               | Per city                           |

### 2.5 Competitive Landscape

The thesis evaluates SmartRoute against three established competitors. The comparison has two parts: a qualitative **feature comparison** (below) and a quantitative **cost benchmark** (methodology in §11.5).

| Capability                                 |        SmartRoute        |   Kiwi.com (Nomad)    |    Skyscanner     |  Google Flights   |
| ------------------------------------------ | :----------------------: | :-------------------: | :---------------: | :---------------: |
| Multi-city flight search                   |            ✅            |          ✅           | ✅ (manual order) | ✅ (manual order) |
| Automatic city-order optimization          | ✅ (GA, multi-objective) |      ✅ (Nomad)       |        ❌         |        ❌         |
| Optimization presets (budget/time/comfort) |            ✅            |    ❌ (price only)    |        ❌         |        ❌         |
| Direct-flight weighting                    |            ✅            | Partial (filter only) |    Filter only    |    Filter only    |
| Interest-based attraction recommendations  |            ✅            |          ❌           |        ❌         |        ❌         |
| Daily itinerary generation                 |            ✅            |          ❌           |        ❌         |        ❌         |
| Walking-route optimization                 |            ✅            |          ❌           |        ❌         |        ❌         |
| In-app booking                             |         ❌ (V2)          |          ✅           |     Redirect      |     Redirect      |
| Price alerts                               |         ❌ (V2)          |          ✅           |        ✅         |        ✅         |

**Positioning:** Kiwi Nomad is the closest competitor on route optimization — the thesis must benchmark against it directly rather than ignore it. SmartRoute's defensible differentiation is the **end-to-end trip pipeline**: optimized route _plus_ personalized per-city itineraries with walking routes, which no competitor combines, and multi-objective optimization (cost/directness/time presets) versus Nomad's price-only ordering.

---

## 3. User Experience Design

### 3.1 Design System

#### 3.1.1 Brand Identity

| Element             | Value                                 |
| ------------------- | ------------------------------------- |
| **App Name**        | SmartRoute Traveler                   |
| **Primary Color**   | Teal #0D9488                          |
| **Secondary Color** | Slate #64748B                         |
| **Background**      | White #FFFFFF / Dark #0F172A          |
| **Typography**      | Inter (all weights)                   |
| **Icons**           | Custom teal-tinted, rounded style     |
| **Corner Radius**   | 12-16px                               |
| **Shadows**         | Subtle elevation                      |
| **Animations**      | Spring-based (Compose animation APIs) |

#### 3.1.2 Color Palette

```
Primary:
  50:  #F0FDFA
  100: #CCFBF1
  500: #14B8A6
  600: #0D9488  ← Primary
  700: #0F766E
  900: #134E4A

Neutral:
  50:  #F8FAFC
  100: #F1F5F9
  500: #64748B
  900: #0F172A  ← Dark mode background

Semantic:
  Success: #22C55E
  Warning: #F59E0B
  Error:   #EF4444
  Info:    #3B82F6
```

#### 3.1.3 Typography Scale

| Name    | Size | Weight   | Use                |
| ------- | ---- | -------- | ------------------ |
| h1      | 32px | Bold     | Screen titles      |
| h2      | 24px | SemiBold | Section headers    |
| h3      | 20px | SemiBold | Card titles        |
| body    | 16px | Regular  | Body text          |
| caption | 14px | Regular  | Secondary text     |
| small   | 12px | Medium   | Labels, timestamps |

### 3.2 User Flows

#### 3.2.1 First-Time User Journey

```
App Launch
    │
    ▼
┌─────────────────────┐
│  Welcome Screen 1   │  "Plan smarter, travel cheaper"
│  Value Proposition  │
└─────────────────────┘
    │ Swipe
    ▼
┌─────────────────────┐
│  Welcome Screen 2   │  "Optimized routes, personalized plans"
│  How It Works       │
└─────────────────────┘
    │ Swipe
    ▼
┌─────────────────────┐
│  Welcome Screen 3   │  "Get started in 2 minutes"
│  Get Started CTA    │
└─────────────────────┘
    │ Tap "Get Started"
    ▼
┌─────────────────────┐
│  Interest Selection │  Tinder-style swipe cards
│  12-15 categories   │  Left=Dislike, Right=Like, Skip=Neutral
└─────────────────────┘
    │ Complete swiping
    ▼
┌─────────────────────┐
│  Registration       │  Email + Password
│  Create Account     │
└─────────────────────┘
    │ Submit
    ▼
┌─────────────────────┐
│  Home Screen        │  "Create Your First Trip" CTA
│  Empty State        │
└─────────────────────┘
```

#### 3.2.2 Trip Creation Flow

```
Home Screen
    │ Tap "New Trip"
    ▼
┌─────────────────────────────────────────────┐
│  City Selection                              │
│  ┌─────────────────────────────────────┐    │
│  │ 🔍 Search cities...                  │    │
│  └─────────────────────────────────────┘    │
│  Popular: Paris, Tokyo, New York, Barcelona │
│                                              │
│  Selected Cities:                            │
│  [Paris ✕] [Rome ✕] [Barcelona ✕]           │
│                                              │
│  [Continue →]                                │
└─────────────────────────────────────────────┘
    │ Tap "Continue"
    ▼
┌─────────────────────────────────────────────┐
│  Trip Configuration                          │
│                                              │
│  Starting City: [Paris      ▼]              │
│  Ending City:   [Optional   ▼]              │
│                                              │
│  Travelers:                                  │
│  Adults: [2 -/+]  Children: [1 -/+]         │
│  Infants: [0 -/+]                           │
│                                              │
│  Flight Class: [Economy ▼]                  │
│  ☑ Direct flights only                      │
│                                              │
│  Per-City Days:                             │
│  Paris: [3 days ▼]                          │
│  Rome: [2 days ▼]                           │
│  Barcelona: [2 days ▼]                      │
│                                              │
│  Travel Dates: [Mar 15] → [Mar 22]          │
│                                              │
│  [Optimize Route →]                          │
└─────────────────────────────────────────────┘
    │ Tap "Optimize Route"
    ▼
┌─────────────────────────────────────────────┐
│  Optimization Loading                        │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │        ✈️ Finding flights...         │    │
│  │        ━━━━━━━━━━━━░░░░░░░░░        │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Did you know? Rome has over 2,000          │
│  fountains, more than any other city.       │
└─────────────────────────────────────────────┘
    │ Optimization complete (< 10 sec)
    ▼
┌─────────────────────────────────────────────┐
│  Route Results                               │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ [MAP: Curved lines connecting cities]│   │
│  │      ①Paris → ②Barcelona → ③Rome    │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ◀ Swipe for alternatives ▶                 │
│  ┌──────────────────────────────────────┐   │
│  │ ROUTE 1 (Best)               💎       │   │
│  │ Total: $847  │ Save $234!             │   │
│  │ 2 direct flights │ 3h 20m total       │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Select This Route]                         │
└─────────────────────────────────────────────┘
    │ Tap "Select This Route"
    ▼
┌─────────────────────────────────────────────┐
│  Trip Overview                               │
│                                              │
│  Paris → Barcelona → Rome                    │
│  Mar 15 - Mar 22, 2026                      │
│                                              │
│  Flights:                                    │
│  ├─ Mar 15: Paris → Barcelona               │
│  │   AF 1234 • 10:30 → 12:15 • Direct      │
│  ├─ Mar 18: Barcelona → Rome                │
│  │   VY 6789 • 14:00 → 16:10 • Direct      │
│  └─ Mar 22: Rome → Paris                    │
│      AZ 2468 • 19:00 → 21:15 • Direct      │
│                                              │
│  [Generate Itineraries]                      │
└─────────────────────────────────────────────┘
    │ Tap "Generate Itineraries"
    ▼
┌─────────────────────────────────────────────┐
│  City Itinerary - Barcelona                  │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ [Mini-map with walking route]         │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Day 1 - March 15                           │
│  ├─ 14:00 🏛️ La Sagrada Familia             │
│  │      2.5 hours • 15 min walk →           │
│  ├─ 17:00 🌳 Park Güell                     │
│  │      1.5 hours • 20 min transit →        │
│  └─ 19:00 🍽️ Free evening                   │
│                                              │
│  Day 2 - March 16                           │
│  ...                                         │
│                                              │
│  [Save Trip]                                 │
└─────────────────────────────────────────────┘
```

### 3.3 Interest Selection (Swipe Cards)

#### 3.3.1 Interest Categories (15)

| #   | Category            | Icon | Example Attractions           |
| --- | ------------------- | ---- | ----------------------------- |
| 1   | Museums & Galleries | 🏛️   | Louvre, British Museum        |
| 2   | Historical Sites    | 🏰   | Colosseum, Acropolis          |
| 3   | Nature & Parks      | 🌳   | Central Park, Gardens         |
| 4   | Beaches & Water     | 🏖️   | Barceloneta, Copacabana       |
| 5   | Food & Dining       | 🍽️   | Local restaurants, food tours |
| 6   | Nightlife & Bars    | 🍸   | Clubs, rooftop bars           |
| 7   | Shopping            | 🛍️   | Markets, boutiques            |
| 8   | Art & Architecture  | 🎨   | Sagrada Familia, Gaudi        |
| 9   | Adventure & Sports  | ⛷️   | Hiking, water sports          |
| 10  | Religious Sites     | ⛪   | Cathedrals, temples           |
| 11  | Local Culture       | 🎭   | Festivals, traditions         |
| 12  | Photography Spots   | 📸   | Viewpoints, iconic locations  |
| 13  | Family Activities   | 👨‍👩‍👧   | Theme parks, zoos             |
| 14  | Wellness & Spa      | 🧘   | Spas, thermal baths           |
| 15  | Live Entertainment  | 🎵   | Concerts, theaters            |

#### 3.3.2 Swipe Mechanics

| Gesture     | Meaning | Database Value |
| ----------- | ------- | -------------- |
| Swipe Left  | Dislike | -1             |
| Swipe Right | Like    | +1             |
| Skip (tap)  | Neutral | 0              |

### 3.4 Navigation Architecture

```
┌────────────────────────────────────────────────────────┐
│                                                         │
│                    [Current Screen]                     │
│                                                         │
├────────────────────────────────────────────────────────┤
│  🏠 Home   │   🗺️ My Trips   │   🔍 Explore   │   👤 Profile   │
└────────────────────────────────────────────────────────┘
```

#### 3.4.1 Tab Structure

| Tab          | Screens                                                   | Purpose                        |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| **Home**     | Home, New Trip, Trip Config, Route Results, Trip Overview | Create and manage current trip |
| **My Trips** | Trip List, Trip Detail, City Itinerary, Attraction Detail | View saved trips               |
| **Explore**  | Destinations, Destination Detail                          | Discover and get inspired      |
| **Profile**  | Settings, Edit Profile, Interests, Preferences            | Account management             |

### 3.5 Loading & Empty States

#### 3.5.1 Skeleton Screens

All list/card views show skeleton placeholders while loading:

- Gray shimmer animation
- Match final layout shape
- 300ms minimum display (avoid flash)

#### 3.5.2 Empty States

| Screen                   | Illustration      | Message                | CTA                      |
| ------------------------ | ----------------- | ---------------------- | ------------------------ |
| My Trips (empty)         | Traveler with map | "No trips yet"         | "Create Your First Trip" |
| City search (no results) | Magnifying glass  | "No cities found"      | "Try a different search" |
| Attractions (empty)      | Compass           | "No attractions match" | "Adjust your interests"  |

### 3.6 Error Handling UX

| Error Type      | Display Method     | Example                          |
| --------------- | ------------------ | -------------------------------- |
| Form validation | Inline below field | "Email is required"              |
| Network error   | Toast notification | "Connection lost. Retrying..."   |
| API error       | Toast with action  | "Failed to load. [Retry]"        |
| Critical error  | Modal dialog       | "Session expired. [Login Again]" |

### 3.7 Haptic Feedback

| Action              | Haptic Type          |
| ------------------- | -------------------- |
| Button press        | Light impact         |
| Trip saved          | Success notification |
| Swipe interest card | Light impact         |
| Error occurred      | Error notification   |
| Pull to refresh     | Light impact         |

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │              Compose Multiplatform (Android + iOS)                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │  │
│  │  │ Composables │  │  ViewModels │  │   Repositories + Cache      │ │  │
│  │  │   & UI      │  │  StateFlow  │  │   (Ktor Client)             │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Node.js + Express                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │  │
│  │  │    Auth     │  │   Route     │  │     Recommendation          │ │  │
│  │  │  Middleware │  │  Optimizer  │  │     Engine                  │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │                    │                         │
          ▼                    ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│    PostgreSQL    │  │    Flight API    │  │      Places API          │
│    (Railway)     │  │    (TBD)         │  │      (TBD)               │
└──────────────────┘  └──────────────────┘  └──────────────────────────┘
```

### 4.2 Repository Structure

```
smartroute-traveler/
├── mobile/                        # Kotlin Multiplatform project (Gradle)
│   ├── composeApp/
│   │   └── src/
│   │       ├── commonMain/kotlin/ # ~95% of mobile code (shared)
│   │       │   ├── ui/
│   │       │   │   ├── components/  # Reusable composables (buttons, cards)
│   │       │   │   ├── screens/     # Screen composables
│   │       │   │   │   ├── auth/    # Login, Register, Forgot
│   │       │   │   │   ├── onboarding/ # Welcome, Interests
│   │       │   │   │   ├── home/    # Home, NewTrip
│   │       │   │   │   ├── trips/   # MyTrips, TripDetail
│   │       │   │   │   ├── explore/ # Explore, Destination
│   │       │   │   │   └── profile/ # Settings, EditProfile
│   │       │   │   ├── navigation/  # Compose Navigation graph
│   │       │   │   └── theme/       # Colors, typography, shapes
│   │       │   ├── presentation/    # ViewModels (StateFlow)
│   │       │   ├── data/
│   │       │   │   ├── api/         # Ktor client, DTOs
│   │       │   │   ├── repository/  # Repositories + caching
│   │       │   │   └── storage/     # multiplatform-settings (tokens, prefs)
│   │       │   ├── domain/          # Models, validators
│   │       │   ├── di/              # Koin modules
│   │       │   └── util/            # Helpers, formatters
│   │       ├── commonMain/composeResources/ # Images, fonts, strings (en/tr)
│   │       ├── androidMain/kotlin/  # MainActivity, Mapbox actual, FCM
│   │       └── iosMain/kotlin/      # Mapbox actual (UIKitView), APNs bridge
│   ├── iosApp/                    # Thin Xcode wrapper (Swift entry point)
│   ├── gradle/libs.versions.toml  # Version catalog
│   ├── build.gradle.kts
│   └── settings.gradle.kts
│
├── apps/
│   └── backend/                   # Node.js Express API (unchanged)
│       ├── src/
│       │   ├── config/            # Environment, database
│       │   ├── controllers/       # Route handlers
│       │   ├── services/          # Business logic
│       │   │   ├── auth/          # Authentication
│       │   │   ├── optimizer/     # Genetic algorithm
│       │   │   ├── recommendation/# Attraction ranking
│       │   │   └── itinerary/     # Schedule generation
│       │   ├── models/            # Database models
│       │   ├── middleware/        # Auth, validation, rate limit
│       │   ├── routes/            # API route definitions
│       │   ├── integrations/      # External API clients
│       │   │   ├── flights/       # Flight API
│       │   │   ├── places/        # Places API
│       │   │   ├── maps/          # Mapbox/Google
│       │   │   └── images/        # Unsplash
│       │   ├── utils/             # Helpers
│       │   └── types/             # TypeScript types
│       ├── prisma/                # Prisma schema & migrations
│       ├── tests/                 # Jest tests
│       └── package.json
│
├── packages/
│   └── shared/                    # Backend-side shared TypeScript code
│       ├── src/
│       │   ├── types/             # Shared TypeScript types
│       │   ├── constants/         # Shared constants
│       │   └── utils/             # Shared utilities
│       └── package.json
│
├── turbo.json                     # Turborepo config (backend workspace only)
├── pnpm-workspace.yaml            # pnpm workspaces (backend workspace only)
├── package.json                   # Root package.json
└── README.md
```

> **Note:** The mobile app lives in its own Gradle build (`mobile/`) and is **not** part of the pnpm/Turborepo workspace. The two build systems coexist in one repository; the contract between them is the REST API (Section 6).

### 4.3 Technology Stack

| Layer        | Technology                     | Version | Purpose                                 |
| ------------ | ------------------------------ | ------- | --------------------------------------- |
| **Mobile**   | Kotlin                         | 2.1+    | Language (shared Android/iOS)           |
|              | Compose Multiplatform          | 1.7+    | Shared UI framework                     |
|              | Kotlin Multiplatform           | -       | Shared logic, expect/actual             |
|              | Lifecycle ViewModel (KMP)      | 2.8+    | State management (StateFlow)            |
|              | Ktor Client                    | 3.x     | HTTP client                             |
|              | kotlinx.serialization          | 1.7+    | JSON serialization                      |
|              | Compose Navigation (JetBrains) | 2.8+    | Navigation                              |
|              | Koin                           | 4.x     | Dependency injection                    |
|              | Mapbox Native SDKs             | 11.x    | Maps (via expect/actual wrappers)       |
|              | multiplatform-settings         | 1.x     | Token storage (Keychain/EncryptedPrefs) |
|              | kotlinx-datetime               | 0.6+    | Date/time handling                      |
|              | Compose Resources              | -       | Internationalization (en, tr)           |
| **Backend**  | Node.js                        | 20 LTS  | Runtime                                 |
|              | Express                        | 4.x     | Web framework                           |
|              | TypeScript                     | 5.x     | Type safety                             |
|              | Prisma                         | 5.x     | ORM                                     |
|              | JWT                            | -       | Authentication                          |
|              | bcrypt                         | 5.x     | Password hashing                        |
|              | Zod                            | 3.x     | Validation                              |
|              | express-rate-limit             | 7.x     | Rate limiting                           |
| **Database** | PostgreSQL                     | 15+     | Primary database                        |
| **Testing**  | Jest                           | 29.x    | Backend unit/integration tests          |
|              | Supertest                      | 6.x     | API testing                             |
|              | kotlin.test + Turbine          | -       | Mobile unit tests, Flow testing         |
|              | Compose UI Test                | -       | Mobile component tests                  |
| **DevOps**   | GitHub Actions                 | -       | CI/CD (macOS runner for iOS)            |
|              | Gradle + fastlane              | -       | Mobile builds (AAB + IPA)               |
|              | Railway                        | -       | Backend hosting                         |
|              | Sentry (Kotlin Multiplatform)  | -       | Error monitoring                        |
|              | Firebase Analytics (GitLive)   | -       | Usage analytics                         |

### 4.4 Monorepo Configuration

#### 4.4.1 pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

#### 4.4.2 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 5. Database Design

### 5.1 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      users       │       │  user_interests  │       │interest_categories│
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │──────<│ user_id (FK)     │       │ id (PK)          │
│ email            │       │ category_id (FK) │>──────│ name             │
│ password_hash    │       │ preference       │       │ icon             │
│ name             │       │                  │       │ description      │
│ wake_up_time     │       └──────────────────┘       └──────────────────┘
│ intensity        │
│ language         │
│ created_at       │       ┌──────────────────┐       ┌──────────────────┐
│ updated_at       │       │   trip_cities    │       │ city_itineraries │
└──────────────────┘       ├──────────────────┤       ├──────────────────┤
         │                 │ id (PK)          │──────<│ trip_city_id (FK)│
         │                 │ trip_id (FK)     │       │ day_number       │
         │                 │ city_code        │       │ attractions      │
         ▼                 │ city_name        │       │ walking_route    │
┌──────────────────┐       │ country          │       └──────────────────┘
│      trips       │       │ order_index      │
├──────────────────┤       │ arrival_date     │
│ id (PK)          │──────<│ departure_date   │       ┌──────────────────┐
│ user_id (FK)     │       │ days_count       │       │  cached_flights  │
│ name             │       │ flight_price     │       ├──────────────────┤
│ start_city       │       │ flight_details   │       │ id (PK)          │
│ end_city         │       │ is_direct        │       │ origin           │
│ start_date       │       └──────────────────┘       │ destination      │
│ end_date         │                                  │ date             │
│ travelers        │       ┌──────────────────┐       │ price            │
│ flight_class     │       │  refresh_tokens  │       │ is_direct        │
│ direct_only      │       ├──────────────────┤       │ airline          │
│ intensity        │       │ id (PK)          │       │ flight_number    │
│ total_cost       │       │ user_id (FK)     │       │ departure_time   │
│ savings          │       │ token_hash       │       │ arrival_time     │
│ optimized_route  │       │ expires_at       │       │ fetched_at       │
│ status           │       │ created_at       │       └──────────────────┘
│ created_at       │       └──────────────────┘
│ updated_at       │                                  ┌──────────────────┐
└──────────────────┘                                  │      cities      │
                                                      ├──────────────────┤
                                                      │ code (PK)        │
                                                      │ name             │
                                                      │ country          │
                                                      │ airports (JSONB) │
                                                      │ image_url        │
                                                      │ popular          │
                                                      └──────────────────┘
```

### 5.2 Schema Definition (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String    @map("password_hash")
  name          String?
  wakeUpTime    String    @default("09:00") @map("wake_up_time")
  intensity     Intensity @default(MODERATE)
  language      String    @default("en")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  interests     UserInterest[]
  trips         Trip[]
  refreshTokens RefreshToken[]

  @@map("users")
}

enum Intensity {
  RELAXED   // 4-5 attractions/day
  MODERATE  // 6-7 attractions/day
  PACKED    // 8-10 attractions/day
}

model InterestCategory {
  id          Int     @id @default(autoincrement())
  name        String
  icon        String
  description String?

  userInterests UserInterest[]

  @@map("interest_categories")
}

model UserInterest {
  userId     String @map("user_id")
  categoryId Int    @map("category_id")
  preference Int    // -1 = dislike, 0 = neutral, 1 = like

  user     User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  category InterestCategory @relation(fields: [categoryId], references: [id])

  @@id([userId, categoryId])
  @@map("user_interests")
}

model Trip {
  id             String     @id @default(uuid())
  userId         String     @map("user_id")
  name           String
  startCity      String     @map("start_city")
  endCity        String?    @map("end_city")
  startDate      DateTime   @map("start_date")
  endDate        DateTime   @map("end_date")
  travelers      Json       // { adults: 2, children: 1, infants: 0 }
  flightClass    FlightClass @default(ECONOMY) @map("flight_class")
  directOnly     Boolean    @default(false) @map("direct_only")
  intensity      Intensity  @default(MODERATE)
  totalCost      Decimal?   @map("total_cost") @db.Decimal(10, 2)
  savings        Decimal?   @db.Decimal(10, 2)
  optimizedRoute Json?      @map("optimized_route")
  status         TripStatus @default(DRAFT)
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  cities TripCity[]

  @@map("trips")
}

enum FlightClass {
  ECONOMY
  BUSINESS
  FIRST
}

enum TripStatus {
  DRAFT
  OPTIMIZED
  SAVED
  COMPLETED
}

model TripCity {
  id            Int       @id @default(autoincrement())
  tripId        String    @map("trip_id")
  cityCode      String    @map("city_code")
  cityName      String    @map("city_name")
  country       String
  orderIndex    Int       @map("order_index")
  arrivalDate   DateTime? @map("arrival_date")
  departureDate DateTime? @map("departure_date")
  daysCount     Int       @map("days_count")
  flightPrice   Decimal?  @map("flight_price") @db.Decimal(10, 2)
  flightDetails Json?     @map("flight_details")
  isDirect      Boolean?  @map("is_direct")

  trip        Trip            @relation(fields: [tripId], references: [id], onDelete: Cascade)
  itineraries CityItinerary[]

  @@map("trip_cities")
}

model CityItinerary {
  id           Int    @id @default(autoincrement())
  tripCityId   Int    @map("trip_city_id")
  dayNumber    Int    @map("day_number")
  attractions  Json   // Array of attraction objects with times
  walkingRoute Json?  @map("walking_route") // Polyline data

  tripCity TripCity @relation(fields: [tripCityId], references: [id], onDelete: Cascade)

  @@map("city_itineraries")
}

model RefreshToken {
  id        Int      @id @default(autoincrement())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}

model City {
  code     String  @id
  name     String
  country  String
  airports Json    // [{ code: "CDG", name: "Charles de Gaulle" }]
  imageUrl String? @map("image_url")
  popular  Boolean @default(false)

  @@map("cities")
}

model CachedFlight {
  id            Int      @id @default(autoincrement())
  origin        String
  destination   String
  date          DateTime
  price         Decimal  @db.Decimal(10, 2)
  isDirect      Boolean  @map("is_direct")
  airline       String?
  flightNumber  String?  @map("flight_number")
  departureTime String?  @map("departure_time")
  arrivalTime   String?  @map("arrival_time")
  fetchedAt     DateTime @default(now()) @map("fetched_at")

  @@index([origin, destination, date])
  @@map("cached_flights")
}
```

### 5.3 Seed Data

#### 5.3.1 Interest Categories

```typescript
const interestCategories = [
  {
    id: 1,
    name: 'Museums & Galleries',
    icon: 'museum',
    description: 'Art museums, history museums, galleries',
  },
  {
    id: 2,
    name: 'Historical Sites',
    icon: 'landmark',
    description: 'Ancient ruins, castles, monuments',
  },
  {
    id: 3,
    name: 'Nature & Parks',
    icon: 'tree',
    description: 'Parks, gardens, natural landscapes',
  },
  {
    id: 4,
    name: 'Beaches & Water',
    icon: 'umbrella-beach',
    description: 'Beaches, lakes, water activities',
  },
  {
    id: 5,
    name: 'Food & Dining',
    icon: 'utensils',
    description: 'Restaurants, food tours, local cuisine',
  },
  {
    id: 6,
    name: 'Nightlife & Bars',
    icon: 'glass-martini',
    description: 'Bars, clubs, night entertainment',
  },
  { id: 7, name: 'Shopping', icon: 'shopping-bag', description: 'Markets, malls, boutiques' },
  {
    id: 8,
    name: 'Art & Architecture',
    icon: 'palette',
    description: 'Unique buildings, street art, design',
  },
  {
    id: 9,
    name: 'Adventure & Sports',
    icon: 'hiking',
    description: 'Hiking, sports, outdoor activities',
  },
  { id: 10, name: 'Religious Sites', icon: 'church', description: 'Churches, temples, mosques' },
  {
    id: 11,
    name: 'Local Culture',
    icon: 'masks-theater',
    description: 'Festivals, traditions, local life',
  },
  {
    id: 12,
    name: 'Photography Spots',
    icon: 'camera',
    description: 'Viewpoints, iconic locations',
  },
  {
    id: 13,
    name: 'Family Activities',
    icon: 'child',
    description: 'Theme parks, zoos, kid-friendly',
  },
  { id: 14, name: 'Wellness & Spa', icon: 'spa', description: 'Spas, thermal baths, relaxation' },
  { id: 15, name: 'Live Entertainment', icon: 'music', description: 'Concerts, theater, shows' },
];
```

---

## 6. API Specification

### 6.1 API Overview

| Base URL   | Production: `https://api.smartroute.app/v1` |
| ---------- | ------------------------------------------- |
| Format     | JSON                                        |
| Auth       | Bearer JWT                                  |
| Rate Limit | 100 requests/minute per user                |

### 6.2 Authentication Endpoints

#### POST /auth/register

Create a new user account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

#### POST /auth/login

Authenticate existing user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

#### POST /auth/refresh

Get new access token using refresh token.

**Request:**

```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..." // New refresh token (sliding expiry)
}
```

#### POST /auth/logout

Invalidate refresh token.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**

```json
{
  "message": "Logged out successfully"
}
```

#### POST /auth/forgot-password

Request password reset.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "message": "Reset instructions sent to email"
}
```

#### POST /auth/reset-password

Reset password with code.

**Request:**

```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newsecurepassword123"
}
```

### 6.3 User Endpoints

#### GET /users/me

Get current user profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "wakeUpTime": "09:00",
  "intensity": "MODERATE",
  "language": "en",
  "interests": [
    { "categoryId": 1, "categoryName": "Museums & Galleries", "preference": 1 },
    { "categoryId": 5, "categoryName": "Food & Dining", "preference": 1 },
    { "categoryId": 6, "categoryName": "Nightlife & Bars", "preference": -1 }
  ]
}
```

#### PUT /users/me

Update user profile.

**Request:**

```json
{
  "name": "John Smith",
  "wakeUpTime": "10:00",
  "intensity": "PACKED",
  "language": "tr"
}
```

#### PUT /users/interests

Update user interests.

**Request:**

```json
{
  "interests": [
    { "categoryId": 1, "preference": 1 },
    { "categoryId": 2, "preference": 0 },
    { "categoryId": 3, "preference": -1 }
  ]
}
```

#### DELETE /users/me

Delete user account (GDPR).

**Response (200):**

```json
{
  "message": "Account deleted successfully"
}
```

### 6.4 Trip Endpoints

#### POST /trips

Create a new trip (auto-saved as draft).

**Request:**

```json
{
  "cities": ["PAR", "ROM", "BCN"],
  "startCity": "PAR",
  "endCity": null,
  "startDate": "2026-03-15",
  "endDate": "2026-03-22",
  "travelers": { "adults": 2, "children": 1, "infants": 0 },
  "flightClass": "ECONOMY",
  "directOnly": false,
  "daysPerCity": { "PAR": 3, "ROM": 2, "BCN": 2 },
  "intensity": "MODERATE"
}
```

**Response (201):**

```json
{
  "id": "trip-uuid",
  "name": "Paris-Rome-Barcelona Trip",
  "status": "DRAFT",
  "cities": [...],
  "createdAt": "2026-03-10T10:00:00Z"
}
```

#### POST /trips/:id/optimize

Run route optimization.

**Response (200):**

```json
{
  "routes": [
    {
      "rank": 1,
      "sequence": ["PAR", "BCN", "ROM"],
      "totalCost": 847.0,
      "savingsVsOriginal": 234.0,
      "totalTravelTime": "6h 45m",
      "directFlights": 3,
      "legs": [
        {
          "from": "PAR",
          "to": "BCN",
          "date": "2026-03-15",
          "price": 127.0,
          "airline": "Air France",
          "flightNumber": "AF1234",
          "departureTime": "10:30",
          "arrivalTime": "12:15",
          "isDirect": true
        }
      ]
    },
    {
      "rank": 2,
      "sequence": ["PAR", "ROM", "BCN"],
      "totalCost": 892.0,
      "savingsVsOriginal": 189.0
      // ...
    },
    {
      "rank": 3
      // ...
    }
  ]
}
```

#### POST /trips/:id/select-route

Select one of the optimized routes.

**Request:**

```json
{
  "routeRank": 1
}
```

**Response (200):**

```json
{
  "id": "trip-uuid",
  "status": "OPTIMIZED",
  "selectedRoute": { ... },
  "cities": [
    {
      "cityCode": "PAR",
      "cityName": "Paris",
      "orderIndex": 0,
      "arrivalDate": "2026-03-15",
      "departureDate": "2026-03-18",
      "daysCount": 3
    }
  ]
}
```

#### POST /trips/:id/generate-itineraries

Generate daily itineraries for all cities.

**Response (200):**

```json
{
  "itineraries": [
    {
      "cityCode": "PAR",
      "cityName": "Paris",
      "days": [
        {
          "dayNumber": 1,
          "date": "2026-03-15",
          "attractions": [
            {
              "id": "place-123",
              "name": "Eiffel Tower",
              "category": "Photography Spots",
              "startTime": "14:00",
              "endTime": "16:30",
              "duration": 150,
              "imageUrl": "https://...",
              "walkingTimeToNext": 25
            }
          ],
          "walkingRoute": {
            "polyline": "encoded-polyline",
            "totalDistance": 4.2,
            "totalTime": 65
          }
        }
      ]
    }
  ]
}
```

#### GET /trips

Get user's trips.

**Query Parameters:**

- `status`: Filter by status (DRAFT, OPTIMIZED, SAVED, COMPLETED)
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset

**Response (200):**

```json
{
  "trips": [
    {
      "id": "trip-uuid",
      "name": "Paris-Rome-Barcelona Trip",
      "startDate": "2026-03-15",
      "endDate": "2026-03-22",
      "totalCost": 847.0,
      "status": "SAVED",
      "cities": ["Paris", "Rome", "Barcelona"],
      "imageUrl": "https://unsplash.com/..."
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

#### GET /trips/:id

Get full trip details.

#### PUT /trips/:id

Update trip details.

#### DELETE /trips/:id

Delete trip (hard delete).

#### POST /trips/:id/duplicate

Duplicate trip for modification.

#### GET /trips/:id/export/ics

Export trip to iCal format.

**Response:** `.ics` file download

### 6.5 City & Attraction Endpoints

#### GET /cities/search

Search cities.

**Query Parameters:**

- `q`: Search query
- `limit`: Results limit (default: 10)

**Response (200):**

```json
{
  "cities": [
    {
      "code": "PAR",
      "name": "Paris",
      "country": "France",
      "airports": [
        { "code": "CDG", "name": "Charles de Gaulle" },
        { "code": "ORY", "name": "Orly" }
      ]
    }
  ]
}
```

#### GET /cities/popular

Get popular destinations.

#### GET /cities/:code/attractions

Get attractions for a city (filtered by user interests).

**Query Parameters:**

- `interests`: Comma-separated category IDs (optional, uses user's if not provided)
- `limit`: Results limit

**Response (200):**

```json
{
  "attractions": [
    {
      "id": "place-123",
      "name": "Eiffel Tower",
      "category": "Photography Spots",
      "categoryId": 12,
      "rating": 4.8,
      "reviewCount": 125000,
      "typicalDuration": 120,
      "imageUrl": "https://...",
      "location": { "lat": 48.8584, "lng": 2.2945 },
      "openingHours": {
        "monday": "09:00-23:45",
        "tuesday": "09:00-23:45"
      },
      "matchScore": 0.95
    }
  ]
}
```

### 6.6 Utility Endpoints

#### POST /feedback

Submit attraction feedback (thumbs up/down).

**Request:**

```json
{
  "attractionId": "place-123",
  "tripId": "trip-uuid",
  "feedback": "up" // or "down"
}
```

#### GET /interest-categories

Get all interest categories.

### 6.7 Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [{ "field": "email", "message": "Must be a valid email address" }]
  }
}
```

| Status Code | Error Code       | Description              |
| ----------- | ---------------- | ------------------------ |
| 400         | VALIDATION_ERROR | Invalid request data     |
| 401         | UNAUTHORIZED     | Missing or invalid token |
| 403         | FORBIDDEN        | Insufficient permissions |
| 404         | NOT_FOUND        | Resource not found       |
| 409         | CONFLICT         | Resource already exists  |
| 429         | RATE_LIMITED     | Too many requests        |
| 500         | INTERNAL_ERROR   | Server error             |

---

## 7. Core Algorithms

### 7.1 Route Optimization (Genetic Algorithm)

#### 7.1.1 Overview

The route optimization problem is modeled as a variant of the Traveling Salesman Problem (TSP) with:

- Fixed start city (required)
- Optional fixed end city
- Weighted multi-objective optimization

#### 7.1.2 Fitness Function

```
fitness(route) = w1 * normalize(totalCost)
              + w2 * normalize(directFlightCount)
              + w3 * normalize(totalTravelTime)
```

**Weights (Presets):**

| Preset             | Cost (w1) | Direct (w2) | Time (w3) |
| ------------------ | --------- | ----------- | --------- |
| Budget Traveler    | 0.7       | 0.1         | 0.2       |
| Time Saver         | 0.3       | 0.4         | 0.3       |
| Comfort First      | 0.3       | 0.5         | 0.2       |
| Balanced (Default) | 0.5       | 0.3         | 0.2       |

#### 7.1.3 Algorithm Parameters

| Parameter       | Default    | Notes                          |
| --------------- | ---------- | ------------------------------ |
| Population Size | TBD        | To be tuned                    |
| Generations     | TBD        | To be tuned                    |
| Mutation Rate   | TBD        | To be tuned                    |
| Crossover Rate  | TBD        | To be tuned                    |
| Timeout         | 30 seconds | Return best-so-far if exceeded |

#### 7.1.4 Constraints

- Start city is always first
- End city (if specified) is always last
- All cities must be visited exactly once

### 7.2 Attraction Recommendation

#### 7.2.1 Scoring Formula

```
score(attraction) = interestMatch * popularity
```

Where:

- `interestMatch` = 1 if category matches user's liked interests, 0.5 for neutral, 0 for disliked
- `popularity` = normalized rating (0-1)

#### 7.2.2 Filtering Logic

1. Fetch all attractions for the city
2. Filter out attractions in disliked categories
3. Score and rank remaining attractions
4. Return top N based on day count and intensity

### 7.3 Itinerary Generation

#### 7.3.1 Daily Clustering

```
Algorithm: Proximity-based Assignment

1. Get top N attractions (N = days × attractions_per_day)
2. Identify geographic clusters (k-means, k = days)
3. Assign attractions to days based on cluster membership
4. Consider opening hours for day assignment
5. Arrival day: Block first half (airport, check-in)
6. Departure day: Block second half
```

#### 7.3.2 Walking Route Optimization

```
For each day:
1. Get day's attractions
2. Call Google Directions API with waypoint optimization
3. Get optimal visiting order
4. Calculate walking times between attractions
5. Assign time slots based on:
   - User's wake-up time
   - Attraction duration
   - Walking time buffer
   - Opening hours constraints
```

#### 7.3.3 Attractions Per Day

| Intensity | Attractions/Day | Active Hours |
| --------- | --------------- | ------------ |
| Relaxed   | 3-4             | 5-6 hours    |
| Moderate  | 5-6             | 7-8 hours    |
| Packed    | 7-8             | 10-12 hours  |

---

## 8. External Integrations

### 8.1 Flight API (TBD)

**Decision pending.** Options:

- Amadeus API (recommended)
- Skyscanner API (RapidAPI)
- Mock data for thesis demo

**Interface:**

```typescript
interface FlightSearchParams {
  origin: string; // IATA code
  destination: string; // IATA code
  date: string; // YYYY-MM-DD
  adults: number;
  children: number;
  infants: number;
  cabinClass: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  directOnly: boolean;
}

interface FlightOffer {
  price: number;
  currency: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  duration: number; // minutes
  isDirect: boolean;
  stops: number;
}
```

### 8.2 Places API (TBD)

**Decision pending.** Options:

- Google Places API (recommended)
- Foursquare API
- OpenTripMap (free)

**Interface:**

```typescript
interface PlaceSearchParams {
  city: string;
  category?: string;
  limit?: number;
}

interface Place {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  location: { lat: number; lng: number };
  imageUrl?: string;
  typicalDuration?: number; // minutes
  openingHours?: Record<string, string>;
}
```

### 8.3 Mapbox

**Used for:**

- Route visualization (curved lines)
- City markers
- Walking route display
- Interactive maps

**Configuration:**

- Style: Custom teal-tinted
- Free tier: 50,000 map loads/month

**KMP Integration:**

- No Compose Multiplatform artifact exists; native SDKs are embedded via `expect`/`actual`:
  - Android: Mapbox Android SDK wrapped in `AndroidView`
  - iOS: Mapbox iOS SDK wrapped in `UIKitView` (Kotlin/Native cinterop or Swift interop via `iosApp`)
- **Fallback:** MapLibre (open-source fork, same embedding pattern, no token limits) if Mapbox interop proves problematic — spike this early (Phase 1)

### 8.4 Google Directions API

**Used for:**

- Walking route optimization
- Time estimation between attractions
- Transit suggestions

### 8.5 Unsplash API

**Used for:**

- Destination images
- Trip card backgrounds

**Configuration:**

- Free tier: 50 requests/hour
- Cache images to reduce API calls

### 8.6 Push Notifications (FCM + APNs)

**Used for:**

- Trip reminders (X days before departure)

**Implementation:**

- Android: Firebase Cloud Messaging (`androidMain`)
- iOS: APNs via FCM iOS SDK (`iosMain` / `iosApp` bridge)

### 8.7 Firebase Analytics

**Used for:**

- Basic usage analytics
- Screen views
- Feature usage

**Implementation:** GitLive `firebase-kotlin-sdk` (single API from `commonMain`)

### 8.8 Sentry

**Used for:**

- Error tracking
- Crash reporting
- Performance monitoring

**Implementation:** `sentry-kotlin-multiplatform` SDK

---

## 9. Security & Authentication

### 9.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION FLOW                         │
└─────────────────────────────────────────────────────────────────┘

Registration/Login:
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │────>│ Backend │────>│ Database│     │ Client  │
│ Submit  │     │ Validate│     │  Store  │     │ Store   │
│ Creds   │     │ & Hash  │     │  User   │     │ Tokens  │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                     │
                     ▼
              Generate JWT Pair:
              - Access Token (24h)
              - Refresh Token (15d)

API Request:
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────>│  Auth   │────>│  API    │
│ Request │     │Middleware│    │ Handler │
│ + Token │     │ Verify  │     │         │
└─────────┘     └─────────┘     └─────────┘

Token Refresh (Sliding Expiry):
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────>│ Refresh │────>│  New    │
│ Send RT │     │ Endpoint│     │  Pair   │
└─────────┘     └─────────┘     └─────────┘
                                     │
                                     ▼
                              RT expiry resets to 15 days
```

### 9.2 JWT Configuration

| Token         | Lifetime          | Storage                                                                          | Purpose              |
| ------------- | ----------------- | -------------------------------------------------------------------------------- | -------------------- |
| Access Token  | 24 hours          | Memory / secure settings                                                         | API authentication   |
| Refresh Token | 15 days (sliding) | Keychain (iOS) / EncryptedSharedPreferences (Android) via multiplatform-settings | Get new access token |

**JWT Payload (Access Token):**

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1679900000,
  "exp": 1679986400
}
```

### 9.3 Password Security

| Aspect       | Implementation              |
| ------------ | --------------------------- |
| Hashing      | bcrypt (12 rounds)          |
| Min Length   | 8 characters                |
| Requirements | At least 1 letter, 1 number |

### 9.4 Rate Limiting

| Endpoint              | Limit        | Window     |
| --------------------- | ------------ | ---------- |
| /auth/login           | 5 requests   | 15 minutes |
| /auth/register        | 3 requests   | 1 hour     |
| /auth/forgot-password | 3 requests   | 1 hour     |
| All other endpoints   | 100 requests | 1 minute   |

### 9.5 Data Security

| Data             | Protection                      |
| ---------------- | ------------------------------- |
| Passwords        | bcrypt hash, never stored plain |
| JWT Secrets      | Environment variables           |
| Database         | TLS connection                  |
| API Traffic      | HTTPS only                      |
| Sensitive fields | Excluded from logs              |

### 9.6 GDPR Compliance

- **Data deletion:** DELETE /users/me removes all user data
- **Privacy policy:** Required before registration
- **Consent:** Explicit opt-in for analytics

---

## 10. Mobile App Specification

### 10.1 KMP Project Configuration

```kotlin
// composeApp/build.gradle.kts (essentials)
kotlin {
    androidTarget()
    listOf(iosArm64(), iosSimulatorArm64()).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.components.resources)
            implementation(libs.androidx.lifecycle.viewmodel.compose)
            implementation(libs.androidx.navigation.compose)
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.kotlinx.datetime)
            implementation(libs.koin.core)
            implementation(libs.koin.compose.viewmodel)
            implementation(libs.multiplatform.settings)
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
            implementation(libs.mapbox.android)
            implementation(libs.firebase.messaging)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
    }
}

android {
    namespace = "com.smartroute.traveler"
    defaultConfig {
        applicationId = "com.smartroute.traveler"
        versionName = "1.0.0"
    }
}
```

- iOS bundle identifier `com.smartroute.traveler` is set in `iosApp/Configuration/Config.xcconfig`
- App icons/splash: standard Android resources + iOS asset catalog (no Expo equivalent needed)
- Build-time config (API URL, Mapbox token) injected via **BuildKonfig** Gradle plugin

### 10.2 Key Dependencies (Version Catalog)

```toml
# gradle/libs.versions.toml (excerpt)
[versions]
kotlin = "2.1.0"
composeMultiplatform = "1.7.3"
ktor = "3.0.3"
koin = "4.0.1"
lifecycle = "2.8.4"
navigationCompose = "2.8.0-alpha11"
kotlinxDatetime = "0.6.1"
multiplatformSettings = "1.2.0"
mapbox = "11.9.0"
sentryKmp = "0.10.0"
firebaseGitlive = "2.1.0"
turbine = "1.2.0"
```

### 10.3 ViewModel + StateFlow Structure

```kotlin
// presentation/auth/AuthViewModel.kt
class AuthViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {
    data class AuthUiState(
        val user: User? = null,
        val isAuthenticated: Boolean = false,
        val isLoading: Boolean = false,
        val error: String? = null,
    )

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) { /* ... */ }
    fun logout() { /* ... */ }
}

// presentation/trip/TripViewModel.kt
class TripViewModel(
    private val tripRepository: TripRepository,
) : ViewModel() {
    data class TripUiState(
        val currentTrip: Trip? = null,
        val optimizationResults: List<RouteOption>? = null,
        val selectedRoute: RouteOption? = null,
    )

    private val _uiState = MutableStateFlow(TripUiState())
    val uiState: StateFlow<TripUiState> = _uiState.asStateFlow()

    fun setCurrentTrip(trip: Trip) { /* ... */ }
    fun optimize() { /* ... */ }
    fun selectRoute(rank: Int) { /* ... */ }
    fun clearCurrentTrip() { /* ... */ }
}

// presentation/profile/UserPrefsViewModel.kt
class UserPrefsViewModel(
    private val userRepository: UserRepository,
) : ViewModel() {
    data class PrefsUiState(
        val interests: List<UserInterest> = emptyList(),
        val intensity: Intensity = Intensity.MODERATE,
        val wakeUpTime: String = "09:00",
        val language: String = "en", // "en" | "tr"
    )

    private val _uiState = MutableStateFlow(PrefsUiState())
    val uiState: StateFlow<PrefsUiState> = _uiState.asStateFlow()

    fun updateInterests(interests: List<UserInterest>) { /* ... */ }
    fun updatePreferences(update: (PrefsUiState) -> PrefsUiState) { /* ... */ }
}
```

- Token refresh is handled centrally by Ktor's `Auth` plugin (bearer provider with `refreshTokens` block) — the KMP equivalent of an Axios interceptor
- ViewModels are provided via Koin (`koinViewModel()`) and survive configuration changes on Android automatically

### 10.4 Navigation Structure

```kotlin
// ui/navigation/Routes.kt — type-safe routes (kotlinx.serialization)
@Serializable object Onboarding
@Serializable object Login
@Serializable object Register
@Serializable object ForgotPassword
@Serializable data class ResetPassword(val email: String)

// Bottom tabs
@Serializable object HomeTab
@Serializable object TripsTab
@Serializable object ExploreTab
@Serializable object ProfileTab

// Home stack
@Serializable object Home
@Serializable object NewTrip
@Serializable data class TripConfig(val tripId: String)
@Serializable data class Optimizing(val tripId: String)
@Serializable data class RouteResults(val tripId: String)
@Serializable data class TripOverview(val tripId: String)
@Serializable data class CityItinerary(val tripId: String, val cityCode: String)
@Serializable data class AttractionDetail(val attractionId: String)
```

- Single `NavHost` in `commonMain`; bottom tab bar implemented with Material 3 `NavigationBar`
- Navigation arguments are type-safe via Compose Navigation 2.8+ serializable routes (equivalent to typed param lists in React Navigation)

### 10.5 Internationalization

**Supported Languages:**

- English (en) - Default
- Turkish (tr)

**i18n Setup (Compose Resources):**

```
composeApp/src/commonMain/composeResources/
├── values/strings.xml       # English (default/fallback)
└── values-tr/strings.xml    # Turkish
```

```kotlin
// Usage in composables — resolves to device locale automatically
Text(stringResource(Res.string.create_first_trip))

// In-app language override (Profile > Language) stored in
// multiplatform-settings and applied via a CompositionLocal wrapper
```

### 10.6 Component Library

All components are composables in `commonMain/ui/components/`:

| Composable     | Parameters                               | Description                            |
| -------------- | ---------------------------------------- | -------------------------------------- |
| AppButton      | variant, size, loading, enabled, onClick | Primary action button                  |
| AppTextField   | label, error, isPassword, onValueChange  | Text input with label                  |
| AppCard        | onClick, elevated, content               | Tappable container                     |
| SkeletonBox    | width, height, shape                     | Shimmer loading placeholder            |
| AppSnackbar    | type, message, duration                  | Notification toast (SnackbarHost)      |
| EmptyState     | illustration, title, ctaLabel, onCta     | Empty list state                       |
| SwipeCard      | onSwipeLeft, onSwipeRight, onSkip        | Interest selection (anchoredDraggable) |
| RouteMap       | route, markers, modifier                 | Mapbox wrapper (expect/actual)         |
| CityChip       | city, onRemove                           | Selected city chip                     |
| AttractionCard | attraction, onClick                      | Attraction list item                   |

---

## 11. Testing Strategy

### 11.1 Testing Pyramid

```
         ┌─────────────┐
         │    E2E      │  10%  (Critical flows only)
         │   Tests     │
         ├─────────────┤
         │ Integration │  30%  (API tests, component integration)
         │   Tests     │
         ├─────────────┤
         │    Unit     │  60%  (Services, utilities, components)
         │   Tests     │
         └─────────────┘
```

### 11.2 Backend Testing

**Framework:** Jest + Supertest

**Coverage Targets:**

- Services: 80%
- Controllers: 70%
- Utilities: 90%

**Test Categories:**

| Category    | Example                             |
| ----------- | ----------------------------------- |
| Unit        | Genetic algorithm fitness function  |
| Unit        | Recommendation scoring              |
| Unit        | JWT token generation/validation     |
| Integration | POST /auth/register creates user    |
| Integration | POST /trips/optimize returns routes |
| Integration | GET /trips/:id returns correct data |

### 11.3 Mobile Testing

**Frameworks:** kotlin.test (unit) + Turbine (Flow/StateFlow assertions) + Compose UI Test (components)

**Coverage Targets:**

- Composables: 70%
- ViewModels: 80%
- Utils: 90%

**Test Categories:**

| Category    | Example                                              |
| ----------- | ---------------------------------------------------- |
| Unit        | formatCurrency utility                               |
| Unit        | date formatting (kotlinx-datetime)                   |
| Unit        | AuthViewModel emits loading→success states (Turbine) |
| Component   | AppButton renders correctly                          |
| Component   | SwipeCard fires callbacks                            |
| Integration | Login flow stores token (mocked Ktor engine)         |

> Ktor's `MockEngine` allows API-level integration tests entirely in `commonTest` without a running server.

### 11.4 Test Commands

```bash
# Backend tests (pnpm workspace)
pnpm --filter backend test
pnpm test:coverage

# Mobile tests (Gradle)
cd mobile
./gradlew :composeApp:testDebugUnitTest        # common + Android unit tests
./gradlew :composeApp:iosSimulatorArm64Test    # iOS-specific tests
./gradlew :composeApp:connectedDebugAndroidTest # Compose UI tests (device)
```

### 11.5 Thesis Evaluation: Competitor Cost Benchmark

The headline quantitative result of the thesis: does SmartRoute find cheaper multi-city routes than what a user achieves on Kiwi.com (Nomad), Skyscanner, and Google Flights?

#### 11.5.1 Benchmark Design

| Element                                 | Definition                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios                               | 20 multi-city trips: 3–6 cities, Europe-weighted (matches seed cities), departure 2–8 weeks out                                                                         |
| SmartRoute measurement                  | Optimized route total price (best of top-3 routes)                                                                                                                      |
| Kiwi Nomad measurement                  | Nomad result for same cities/dates/passenger config                                                                                                                     |
| Skyscanner / Google Flights measurement | Multi-city search using (a) the user's naive city order and (b) SmartRoute's optimized order — isolates the value of ordering from the value of inventory               |
| Controls                                | All four platforms queried the **same day within a 2-hour window** (prices are volatile); economy class; same passenger count; currency normalized to USD at day's rate |
| Repetitions                             | Each scenario captured 3 times on different days; report per-scenario median                                                                                            |

#### 11.5.2 Reported Metrics

| Metric            | Description                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Win rate          | % of scenarios where SmartRoute ≤ cheapest competitor                                                                           |
| Median savings    | % difference vs. each competitor, per scenario                                                                                  |
| Ordering value    | Skyscanner/Google price with optimized order vs. naive order — quantifies the GA's contribution independent of flight inventory |
| Optimization time | SmartRoute wall-clock time per scenario (target < 10 s)                                                                         |

#### 11.5.3 Threats to Validity (address in thesis)

- **Inventory mismatch:** SmartRoute's flight source (Duffel/Amadeus) and competitors use different fare inventories; the "ordering value" metric controls for this by replaying SmartRoute's order on the competitor's own inventory.
- **Price volatility:** mitigated by same-day capture windows and 3× repetition.
- **Nomad flexibility advantage:** Nomad can shift dates/stay lengths; benchmark pins dates exactly on all platforms for a fair comparison and notes this as a limitation.
- **Manual collection bias:** competitor prices are read manually from their UIs; record screenshots for reproducibility.

---

## 12. Deployment & Infrastructure

### 12.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRODUCTION ENVIRONMENT                      │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │    App Store     │
                    │    Play Store    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Mobile Apps    │
                    │ (Compose MP/KMP) │
                    └────────┬─────────┘
                             │ HTTPS
                    ┌────────▼─────────┐
                    │     Railway      │
                    │  (Node.js API)   │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│     Railway      │ │   External APIs  │ │     Sentry       │
│   (PostgreSQL)   │ │  (Flights/Places)│ │   (Monitoring)   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 12.2 Railway Configuration

**Backend Service:**

- Node.js 20 LTS
- Auto-deploy from GitHub main branch
- Environment variables in Railway dashboard

**Database Service:**

- PostgreSQL 15
- Auto-backups enabled
- Connection via internal network

### 12.3 Mobile Build Configuration

| Artifact         | Tooling                                          | Notes                                            |
| ---------------- | ------------------------------------------------ | ------------------------------------------------ |
| Android AAB      | `./gradlew :composeApp:bundleRelease`            | Signed with upload keystore, Play Console upload |
| iOS IPA          | Xcode / `fastlane gym`                           | Requires macOS + Apple Developer account         |
| Store submission | fastlane `supply` (Play) / `deliver` (App Store) | Replaces EAS Submit                              |

```ruby
# mobile/fastlane/Fastfile (excerpt)
platform :android do
  lane :release do
    gradle(task: "bundleRelease", project_dir: "..")
    upload_to_play_store(track: "internal")
  end
end

platform :ios do
  lane :release do
    build_app(scheme: "iosApp", workspace: "../iosApp/iosApp.xcworkspace")
    upload_to_testflight
  end
end
```

### 12.4 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test

  build-backend:
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm --filter backend build
      # Railway auto-deploys from main

  build-mobile-android:
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - uses: gradle/actions/setup-gradle@v4
      - run: cd mobile && ./gradlew :composeApp:bundleRelease

  build-mobile-ios:
    needs: [lint, test]
    runs-on: macos-latest # iOS builds require macOS
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - run: cd mobile && ./gradlew :composeApp:iosSimulatorArm64Test
      - run: cd mobile && xcodebuild -workspace iosApp/iosApp.xcworkspace -scheme iosApp -sdk iphoneos
```

### 12.5 Environment Variables

**Backend (.env):**

```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
FLIGHT_API_KEY=...
PLACES_API_KEY=...
MAPBOX_TOKEN=...
UNSPLASH_ACCESS_KEY=...
SENTRY_DSN=...
```

**Mobile (BuildKonfig — compile-time constants, no .env at runtime):**

```
API_URL=https://api.smartroute.app
MAPBOX_TOKEN=...
SENTRY_DSN=...
```

Values are supplied via `gradle.properties` / CI secrets and generated into a `BuildKonfig` object accessible from `commonMain`.

---

## 13. Implementation Phases

### Phase Overview

| Phase     | Focus                      | Duration Estimate |
| --------- | -------------------------- | ----------------- |
| 1         | Project Setup & Foundation | 2 weeks           |
| 2         | Authentication System      | 1.5 weeks         |
| 3         | User Profile & Interests   | 1 week            |
| 4         | Route Optimization Engine  | 2 weeks           |
| 5         | Flight Data Integration    | 1.5 weeks         |
| 6         | Attraction Recommendations | 1.5 weeks         |
| 7         | City Itinerary Generation  | 2 weeks           |
| 8         | Trip Planning UI           | 3 weeks           |
| 9         | Trip Management            | 1 week            |
| 10        | Testing & QA               | 2 weeks           |
| 11        | Documentation & Deployment | 1.5 weeks         |
| **Total** |                            | **~19 weeks**     |

> **Deadline check:** ~19 weeks from July 2026 lands mid-November, leaving a ~2-week buffer before the **early December 2026** delivery. The buffer is intentionally reserved for the KMP/Compose learning curve and the Mapbox interop spike — do not spend it on scope additions.

### Phase 1: Project Setup & Foundation

**Deliverables:** _(status as of 2026-07-06 — Phase 1 executed; see `docs/superpowers/plans/2026-07-06-kmp-bootstrap-map-spike.md`)_

- [x] Backend workspace (Turborepo + pnpm) — already in place
- [x] Kotlin Multiplatform / Compose Multiplatform project initialized (`mobile/`)
- [ ] iOS app builds and runs from `iosApp` Xcode wrapper — **deferred until Mac access** (Windows host); interim iOS deliverable delivered instead: Kotlin framework links on macOS CI
- [x] Map interop spike (expect/actual map) — **executed with MapLibre** (no API token needed); Mapbox swap remains a later styling decision per §8.3. Android rendering verified on emulator; iOS actual is a placeholder until Mac access
- [x] Backend initialized — **Fastify** (shipped pre-pivot, Plans 1–6), not Express as originally drafted; kept per repo-alignment note at top of this document
- [x] PostgreSQL database with Prisma schema (pre-existing)
- [x] Docker Compose for local development (pre-existing)
- [x] Lint configuration — **ktlint only** (engine 1.5.0; detekt dropped as unnecessary for solo scope) + existing ESLint/Prettier
- [x] Git repository with branching strategy (pre-existing; trunk-based on `main`)
- [x] Basic CI pipeline — `mobile-ci.yml`: Android build/test/lint on ubuntu + iOS framework link on macOS, both green

### Phase 2: Authentication System

**Deliverables:**

- [ ] User registration endpoint
- [ ] Login endpoint with JWT generation
- [ ] Refresh token rotation
- [ ] JWT middleware for protected routes
- [ ] Password reset (email link + code)
- [ ] Registration screen (mobile)
- [ ] Login screen (mobile)
- [ ] Token storage with multiplatform-settings (Keychain/EncryptedPrefs)
- [ ] Auto-refresh via Ktor Auth plugin (bearer refreshTokens)

### Phase 3: User Profile & Interests

**Deliverables:**

- [ ] Interest categories seed data
- [ ] Swipe card component
- [ ] Interest selection screen (onboarding)
- [ ] Profile API endpoints
- [ ] Profile screen with edit
- [ ] Preferences (intensity, wake-up time)
- [ ] Language selection (EN/TR)
- [ ] Account deletion (GDPR)

### Phase 4: Route Optimization Engine

**Deliverables:**

- [ ] Integrate provided Genetic Algorithm
- [ ] Flight data service interface (abstract)
- [ ] Mock flight data provider
- [ ] Graph model for cities/flights
- [ ] Multi-objective fitness function
- [ ] Optimizer presets (Budget, Time, Comfort)
- [ ] Constraint handling (start/end cities)
- [ ] Timeout with best-so-far return
- [ ] Optimization API endpoint
- [ ] Top 3 routes response

### Phase 5: Flight Data Integration

**Deliverables:**

- [ ] Select and configure Flight API
- [ ] API client with rate limiting
- [ ] Flight search endpoint
- [ ] Flight caching layer (24h TTL)
- [ ] Multi-airport city handling
- [ ] Flight class support
- [ ] Direct flight toggle
- [ ] Error handling & fallbacks

### Phase 6: Attraction Recommendations

**Deliverables:**

- [ ] Select and configure Places API
- [ ] Category mapping (API → interests)
- [ ] Attraction search endpoint
- [ ] Interest-based filtering
- [ ] Popularity-based ranking
- [ ] Attraction details endpoint
- [ ] Image handling
- [ ] Thumbs up/down feedback API

### Phase 7: City Itinerary Generation

**Deliverables:**

- [ ] Itinerary data model
- [ ] Proximity clustering algorithm
- [ ] Daily schedule generator
- [ ] Opening hours consideration
- [ ] Arrival/departure day blocking
- [ ] Google Directions integration
- [ ] Walking route optimization
- [ ] Time slot assignment
- [ ] Itinerary API endpoint

### Phase 8: Trip Planning UI (Mobile)

**Deliverables:**

- [ ] Onboarding screens (3)
- [ ] Home screen with quick actions
- [ ] City search/selection
- [ ] Trip configuration screen
- [ ] Optimization loading animation
- [ ] Route results (card carousel)
- [ ] Route map visualization
- [ ] Trip overview screen
- [ ] City itinerary view
- [ ] Attraction cards
- [ ] Walking route map
- [ ] Day-by-day navigation

### Phase 9: Trip Management

**Deliverables:**

- [ ] Auto-save as draft
- [ ] My Trips list screen
- [ ] Trip card with image
- [ ] Trip detail view
- [ ] Trip editing
- [ ] Trip duplication
- [ ] Trip deletion
- [ ] iCal export
- [ ] Share link (view-only)
- [ ] Trip reminders (push notifications)

### Phase 10: Testing & QA

**Deliverables:**

- [ ] Unit tests for optimizer
- [ ] Unit tests for recommendation
- [ ] API integration tests
- [ ] Component tests (mobile)
- [ ] Manual QA testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Edge case handling
- [ ] **Competitor cost benchmark** — run the 20-scenario study vs. Kiwi Nomad / Skyscanner / Google Flights (§11.5); 3 capture days, screenshots archived

### Phase 11: Documentation & Deployment

**Deliverables:**

- [ ] API documentation (Swagger)
- [ ] README files
- [ ] Setup guides
- [ ] Technical documentation (thesis)
- [ ] Thesis evaluation chapter: feature comparison table (§2.5) + benchmark results analysis (§11.5)
- [ ] User guide
- [ ] Production deployment (Railway)
- [ ] App Store submission
- [ ] Play Store submission
- [ ] Demo preparation

---

## 14. Risk Mitigation

### 14.1 Technical Risks

| Risk                           | Impact | Likelihood | Mitigation                                               |
| ------------------------------ | ------ | ---------- | -------------------------------------------------------- |
| Flight API rate limits         | High   | Medium     | Aggressive caching, mock data fallback                   |
| GA performance issues          | Medium | Medium     | Timeout mechanism, parameter tuning                      |
| Places API data quality        | Medium | Low        | Manual curation for popular cities                       |
| Real-time collab complexity    | High   | N/A        | **Dropped for V1**                                       |
| Mapbox/Compose MP interop      | Medium | Medium     | Phase 1 spike; expect/actual wrappers; MapLibre fallback |
| Kotlin/Native iOS build issues | Medium | Low        | Keep iosApp wrapper thin; pin Kotlin/CMP versions        |

### 14.2 Schedule Risks

| Risk                       | Impact | Mitigation                                                                          |
| -------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Feature creep              | High   | Strict MVP scope, say no to new features                                            |
| KMP/Compose learning curve | Medium | 2-week buffer before Dec deadline; lean on Android-first iteration, test iOS weekly |
| API integration delays     | Medium | Start with mocks, integrate incrementally                                           |
| Underestimated complexity  | Medium | Buffer time in schedule                                                             |
| External dependency issues | Medium | Have fallback options ready                                                         |

### 14.3 Business Risks

| Risk                        | Impact       | Mitigation                         |
| --------------------------- | ------------ | ---------------------------------- |
| API costs exceed budget     | Medium       | Monitor usage, implement limits    |
| Low user adoption           | Low (thesis) | Focus on demo quality              |
| Competitor launches similar | Low          | Unique algorithm is differentiator |

---

## 15. Future Enhancements (V2)

**Deferred for post-thesis:**

| Feature                                | Priority | Complexity |
| -------------------------------------- | -------- | ---------- |
| Real-time collaborative editing        | High     | High       |
| Hotel recommendations                  | Medium   | Medium     |
| Full budget tracking                   | Low      | Medium     |
| Weather integration                    | Low      | Low        |
| In-app flight booking                  | High     | Very High  |
| Accessibility filters                  | Medium   | Medium     |
| Multi-modal transport (trains)         | Medium   | High       |
| Social features (share trips publicly) | Low      | Medium     |
| AI chatbot trip planning               | High     | High       |
| Offline mode                           | Medium   | High       |

---

## Appendix A: Glossary

| Term | Definition                                              |
| ---- | ------------------------------------------------------- |
| GA   | Genetic Algorithm                                       |
| TSP  | Traveling Salesman Problem                              |
| IATA | International Air Transport Association (airport codes) |
| POI  | Point of Interest (attraction)                          |
| JWT  | JSON Web Token                                          |
| KMP  | Kotlin Multiplatform                                    |
| CMP  | Compose Multiplatform                                   |
| AAB  | Android App Bundle                                      |

---

## Appendix B: References

- Kotlin Multiplatform: https://kotlinlang.org/docs/multiplatform.html
- Compose Multiplatform: https://www.jetbrains.com/compose-multiplatform/
- Ktor: https://ktor.io/docs
- Prisma: https://www.prisma.io/docs
- Mapbox: https://docs.mapbox.com
- Genetic Algorithm Theory: [Academic sources TBD]

---

**Document Version:** 2.0 — Tech stack revised: React Native/Expo → Kotlin + Compose Multiplatform
**Last Updated:** July 2026
**Author:** Burak Berk Yılmaz
