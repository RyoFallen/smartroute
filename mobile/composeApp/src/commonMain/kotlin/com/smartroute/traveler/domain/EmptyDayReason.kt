package com.smartroute.traveler.domain

/**
 * Why an ItineraryDay holds no VisitSlot (see CONTEXT.md "ItineraryDay").
 *
 * Constant names mirror the zod enum in packages/shared/src/itinerary.ts.
 * [UNKNOWN] exists so a reason added on the backend before this build shipped
 * still renders something honest instead of crashing the screen.
 */
enum class EmptyDayReason {
    ARRIVAL_TOO_LATE,
    DEPARTURE_TOO_EARLY,
    WINDOW_TOO_SHORT,
    NO_ATTRACTIONS_LEFT,
    UNKNOWN,
    ;

    companion object {
        fun fromWire(value: String): EmptyDayReason = entries.firstOrNull { it.name == value } ?: UNKNOWN
    }
}
