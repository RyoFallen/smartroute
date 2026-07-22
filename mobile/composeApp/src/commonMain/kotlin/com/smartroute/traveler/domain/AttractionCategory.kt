package com.smartroute.traveler.domain

import kotlinx.serialization.Serializable

/**
 * The data-facing classification of an attraction (see CONTEXT.md).
 * Constant names must stay in sync with the zod enum in
 * packages/shared/src/attractions.ts — kotlinx.serialization matches
 * enum constants by name, so no separate wire-value mapping is needed.
 */
@Serializable
enum class AttractionCategory(
    val icon: String,
) {
    LANDMARK("📍"),
    MUSEUM("🏛️"),
    RELIGIOUS("🕌"),
    PARK("🌳"),
    VIEWPOINT("🌆"),
    HISTORICAL("🏰"),
    MARKET("🛍️"),
}
