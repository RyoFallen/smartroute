package com.smartroute.traveler.domain

import kotlin.math.abs

fun formatPrice(
    amountMinorUnits: Long,
    currencyCode: String,
): String {
    val sign = if (amountMinorUnits < 0) "-" else ""
    val absolute = abs(amountMinorUnits)
    val major = absolute / 100
    val minorPadded = (absolute % 100).toString().padStart(2, '0')
    return "$currencyCode $sign$major.$minorPadded"
}
