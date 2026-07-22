package com.smartroute.traveler.domain

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The traveler-facing optimizer preset on POST /optimize (see CONTEXT.md).
 * Wire values are lowercase and must stay in sync with the zod enum in
 * packages/shared/src/optimize.ts.
 */
@Serializable
enum class OptimizePreset {
    @SerialName("budget")
    BUDGET,

    @SerialName("time")
    TIME,

    @SerialName("comfort")
    COMFORT,

    @SerialName("balanced")
    BALANCED,
}
