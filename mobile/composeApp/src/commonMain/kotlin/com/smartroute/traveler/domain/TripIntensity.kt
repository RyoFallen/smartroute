package com.smartroute.traveler.domain

/** Trip pacing ("preferences", never interest ratings — see glossary). */
enum class TripIntensity(
    val wire: String,
) {
    RELAXED("RELAXED"),
    MODERATE("MODERATE"),
    PACKED("PACKED"),
    ;

    companion object {
        fun fromWire(value: String): TripIntensity = entries.firstOrNull { it.wire == value } ?: MODERATE
    }
}
