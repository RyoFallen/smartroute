package com.smartroute.traveler.domain

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Which pick a returned route option represents, per POST /optimize's response. */
@Serializable
enum class RouteLabel {
    @SerialName("recommended")
    RECOMMENDED,

    @SerialName("cheapest")
    CHEAPEST,

    @SerialName("fastest")
    FASTEST,

    @SerialName("most_direct")
    MOST_DIRECT,
}
