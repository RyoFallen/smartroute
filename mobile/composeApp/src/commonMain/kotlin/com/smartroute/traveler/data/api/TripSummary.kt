package com.smartroute.traveler.data.api

import kotlinx.serialization.Serializable

/** Subset of the shared Trip schema (packages/shared/src/trips.ts) the mobile UI needs. */
@Serializable
data class TripSummary(
    val id: String,
    val name: String,
    val startDate: String,
    val endDate: String,
    val cities: List<String>,
    // Minor units (cents) per repo convention; format via formatPrice.
    val totalPriceCents: Long,
)
