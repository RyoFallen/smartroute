package com.smartroute.traveler.data.api

import kotlinx.serialization.Serializable

/** Mirrors the shared CreateTripRequest schema (packages/shared/src/trips.ts). */
@Serializable
data class CreateTripRequestDto(
    val name: String,
    val startDate: String,
    val endDate: String,
    val cabinClass: String,
    val travelers: Int,
    val cities: List<String>,
    val flights: List<FlightLegDto>,
    val totalPriceCents: Long,
    /** The /optimize response's currency, so the saved trip keeps its label. */
    val currency: String,
)
