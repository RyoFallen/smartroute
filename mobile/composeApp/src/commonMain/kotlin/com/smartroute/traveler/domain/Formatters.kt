package com.smartroute.traveler.domain

fun formatPrice(
    amountMinorUnits: Long,
    currencyCode: String,
): String {
    val major = amountMinorUnits / 100
    val minor = amountMinorUnits % 100
    val minorPadded = minor.toString().padStart(2, '0')
    return "$currencyCode $major.$minorPadded"
}
