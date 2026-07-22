package com.smartroute.traveler.data.api

import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.domain.RouteLabel
import kotlinx.serialization.Serializable

/**
 * Mirrors the shared OptimizeRequest schema (packages/shared/src/optimize.ts).
 * startCity/endCity pinning isn't exposed by this app (see ADR/spec for Phase 8).
 */
@Serializable
data class OptimizeRequestDto(
    val cities: List<String>,
    val departDate: String,
    val perCityDays: List<Int>,
    val travelers: Int,
    val cabinClass: String,
    val directOnly: Boolean,
    val preset: OptimizePreset,
) {
    companion object {
        /** Neither is exposed by this app's UI yet — see the Phase 8 spec's Out of Scope. */
        const val DEFAULT_TRAVELERS = 1
        const val DEFAULT_CABIN_CLASS = "ECONOMY"
    }
}

/**
 * Mirrors the shared RouteOption schema. [flights] is needed to save the
 * selected option as a trip (POST /trips), not just to render the card.
 */
@Serializable
data class RouteOptionDto(
    val label: RouteLabel,
    val order: List<String>,
    val flights: List<FlightLegDto>,
    val totalPriceCents: Long,
    val totalDurationMin: Int,
)

/** Mirrors the shared OptimizeResponse schema. */
@Serializable
data class OptimizeResponseDto(
    val options: List<RouteOptionDto>,
    val reason: String? = null,
)
