package com.smartroute.traveler.ui.trips

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.smartroute.traveler.ui.theme.SrShapes
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.cancel
import smartroute_mobile.composeapp.generated.resources.delete_trip
import smartroute_mobile.composeapp.generated.resources.delete_trip_confirm
import smartroute_mobile.composeapp.generated.resources.delete_trip_error
import smartroute_mobile.composeapp.generated.resources.delete_trip_message
import smartroute_mobile.composeapp.generated.resources.deleting
import smartroute_mobile.composeapp.generated.resources.retry

/** Confirmation before a saved trip is deleted; cancel is always safe. */
@Composable
fun DeleteTripDialog(
    state: TripDeleteUiState,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    when (state) {
        is TripDeleteUiState.Idle, TripDeleteUiState.Deleted -> Unit
        is TripDeleteUiState.Confirming, TripDeleteUiState.Deleting, TripDeleteUiState.Failed -> {
            val busy = state is TripDeleteUiState.Deleting
            AlertDialog(
                shape = SrShapes.Card,
                containerColor = Color.White,
                onDismissRequest = { if (!busy) onCancel() },
                title = { Text(stringResource(Res.string.delete_trip)) },
                text = {
                    Text(
                        if (state is TripDeleteUiState.Failed) {
                            stringResource(Res.string.delete_trip_error)
                        } else {
                            stringResource(Res.string.delete_trip_message)
                        },
                    )
                },
                confirmButton = {
                    TextButton(onClick = onConfirm, enabled = !busy) {
                        Text(
                            text =
                                stringResource(
                                    when {
                                        busy -> Res.string.deleting
                                        state is TripDeleteUiState.Failed -> Res.string.retry
                                        else -> Res.string.delete_trip_confirm
                                    },
                                ),
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                },
                dismissButton = {
                    TextButton(onClick = onCancel, enabled = !busy) {
                        Text(stringResource(Res.string.cancel))
                    }
                },
            )
        }
    }
}
