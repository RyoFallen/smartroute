package com.smartroute.traveler.domain

/**
 * The 15 travel-interest categories a traveler rates (thesis spec §3.3.1).
 * Slugs are stable identifiers stored server-side — they must stay in sync
 * with the zod enum in packages/shared/src/interests.ts. Display names are
 * localized string resources, resolved at the UI layer.
 */
enum class InterestCategory(
    val slug: String,
    val icon: String,
) {
    MUSEUMS_GALLERIES("museums-galleries", "🏛️"),
    HISTORICAL_SITES("historical-sites", "🏰"),
    NATURE_PARKS("nature-parks", "🌳"),
    BEACHES_WATER("beaches-water", "🏖️"),
    FOOD_DINING("food-dining", "🍽️"),
    NIGHTLIFE_BARS("nightlife-bars", "🍸"),
    SHOPPING("shopping", "🛍️"),
    ART_ARCHITECTURE("art-architecture", "🎨"),
    ADVENTURE_SPORTS("adventure-sports", "⛷️"),
    RELIGIOUS_SITES("religious-sites", "⛪"),
    LOCAL_CULTURE("local-culture", "🎭"),
    PHOTOGRAPHY_SPOTS("photography-spots", "📸"),
    FAMILY_ACTIVITIES("family-activities", "👨‍👩‍👧"),
    WELLNESS_SPA("wellness-spa", "🧘"),
    LIVE_ENTERTAINMENT("live-entertainment", "🎵"),
    ;

    companion object {
        fun fromSlug(slug: String): InterestCategory? = entries.firstOrNull { it.slug == slug }
    }
}
