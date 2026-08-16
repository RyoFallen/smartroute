package com.smartroute.traveler.data.api

import com.smartroute.traveler.domain.AttractionCategory
import com.smartroute.traveler.domain.EmptyDayReason
import kotlinx.serialization.Serializable

/** Mirrors the shared VisitSlot schema (packages/shared/src/itinerary.ts). */
@Serializable
data class VisitSlotDto(
    val attractionId: String,
    val name: String,
    val category: AttractionCategory,
    val lat: Double,
    val lon: Double,
    val description: String,
    // ISO-8601 carrying the city's own UTC offset, so the wall-clock time is
    // already local — read it with formatIsoTime, never re-zone it.
    val startsAt: String,
    val endsAt: String,
    val visitMinutes: Int,
    // null on the first slot of a day: there is no previous slot to walk from.
    val walkMinutesFromPrevious: Int? = null,
    val hoursAssumed: Boolean = false,
    val closedOnThisDay: Boolean = false,
)

/** Mirrors the shared ItineraryDay schema — `slots` is empty exactly when `empty`. */
@Serializable
data class ItineraryDayDto(
    val date: String,
    val dayOfStay: Int,
    val empty: Boolean,
    // Kept as the raw wire string and widened through EmptyDayReason.fromWire, so
    // a reason this build has never heard of degrades to a generic message rather
    // than failing the whole response.
    val emptyReason: String? = null,
    val slots: List<VisitSlotDto> = emptyList(),
) {
    val reason: EmptyDayReason?
        get() = emptyReason?.let(EmptyDayReason::fromWire)
}

/** Mirrors the shared ItineraryCity schema — null name/no days when !available. */
@Serializable
data class ItineraryCityDto(
    val iata: String,
    val name: String?,
    val available: Boolean,
    val days: List<ItineraryDayDto> = emptyList(),
)

/** Mirrors the shared ItineraryResponse schema. */
@Serializable
data class ItineraryResponseDto(
    val tripId: String,
    val cities: List<ItineraryCityDto>,
)
