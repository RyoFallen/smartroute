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

/** "2026-08-01" from a backend ISO-8601 datetime string. */
fun formatIsoDate(iso: String): String = iso.substring(0, 10)

/** "2026-08-01 08:00" from a backend ISO-8601 datetime string. */
fun formatIsoDateTime(iso: String): String = "${iso.substring(0, 10)} ${iso.substring(11, 16)}"

/**
 * "08:00" from a backend ISO-8601 datetime string.
 *
 * VisitSlot times already carry the city's own UTC offset, so the wall clock in
 * the string is the local one — reading it straight off is correct, and
 * converting through the device timezone would be wrong.
 */
fun formatIsoTime(iso: String): String = iso.substring(11, 16)

/** Whole hours and the remaining minutes of [totalMinutes], e.g. 425 -> (7, 5). */
fun splitDuration(totalMinutes: Int): Pair<Int, Int> = totalMinutes / 60 to totalMinutes % 60
