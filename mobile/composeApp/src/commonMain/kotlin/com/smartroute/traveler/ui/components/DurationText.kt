package com.smartroute.traveler.ui.components

import androidx.compose.runtime.Composable
import com.smartroute.traveler.domain.splitDuration
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.duration_hours_minutes

/** "7h 05m" / "7 sa 05 dk": the one place a flight duration is written for the traveler. */
@Composable
fun formatDuration(totalMinutes: Int): String {
    val (hours, minutes) = splitDuration(totalMinutes)
    return stringResource(Res.string.duration_hours_minutes, hours, minutes.toString().padStart(2, '0'))
}
