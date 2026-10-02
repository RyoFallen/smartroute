package com.smartroute.traveler.data.api

import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.domain.RouteLabel
import kotlinx.serialization.Serializable

/**
 * Mirrors the shared OptimizeRequest schema (packages/shared/src/optimize.ts).
 *
 * [startCity] is where the traveler flies out from: the optimizer keeps it
 * first and gives it no stay, so its [perCityDays] entry is 0 (#34). It is
 * null-defaulted so an unset value is omitted rather than sent as `null`,
 * which the backend schema rejects. endCity pinning is not exposed.
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
    val startCity: String? = null,
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
