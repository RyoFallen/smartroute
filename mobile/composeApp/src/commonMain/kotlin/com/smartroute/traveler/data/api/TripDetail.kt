package com.smartroute.traveler.data.api

import kotlinx.serialization.Serializable

/** Subset of the shared FlightLeg schema (packages/shared/src/flights.ts) the trip-detail screen needs. */
@Serializable
data class FlightLegDto(
    val origin: String,
    val destination: String,
    val depart: String,
    val arrive: String,
    val carrier: String?,
    // Minor units (cents) per repo convention; format via formatPrice.
    val priceCents: Long,
    val durationMin: Int,
    val stops: Int,
)

/** Subset of the shared Trip schema (packages/shared/src/trips.ts) the trip-detail screen needs. */
@Serializable
data class TripDetail(
    val id: String,
    val name: String,
    val startDate: String,
    val endDate: String,
    val cabinClass: String,
    val travelers: Int,
    val flights: List<FlightLegDto>,
    // Minor units (cents) per repo convention; format via formatPrice.
    val totalPriceCents: Long,
)
