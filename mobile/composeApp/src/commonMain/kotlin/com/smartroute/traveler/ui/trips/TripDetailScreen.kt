package com.smartroute.traveler.ui.trips

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.FlightLegDto
import com.smartroute.traveler.data.api.TripDetail
import com.smartroute.traveler.domain.formatIsoDate
import com.smartroute.traveler.domain.formatIsoDateTime
import com.smartroute.traveler.domain.formatPrice
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.delete_trip
import smartroute_mobile.composeapp.generated.resources.plan_trip
import smartroute_mobile.composeapp.generated.resources.trip_detail_error_load
import smartroute_mobile.composeapp.generated.resources.trip_detail_flights
import smartroute_mobile.composeapp.generated.resources.trip_detail_stops
import smartroute_mobile.composeapp.generated.resources.trip_detail_travelers

@Composable
fun TripDetailScreen(
    state: TripDetailUiState,
    onRetryLoad: () -> Unit,
    onPlanTripClick: () -> Unit,
    onBack: () -> Unit,
    deleteState: TripDeleteUiState = TripDeleteUiState.Idle,
    onDeleteClick: () -> Unit = {},
    onConfirmDelete: () -> Unit = {},
    onCancelDelete: () -> Unit = {},
) {
    DeleteTripDialog(state = deleteState, onConfirm = onConfirmDelete, onCancel = onCancelDelete)
    Column(modifier = Modifier.fillMaxSize()) {
        when (state) {
            is TripDetailUiState.Loading -> {
                SubScreenHeader(title = "", onBack = onBack)
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is TripDetailUiState.LoadFailed -> {
                SubScreenHeader(title = "", onBack = onBack)
                RetryErrorState(
                    message = stringResource(Res.string.trip_detail_error_load),
                    onRetry = onRetryLoad,
                )
            }
            is TripDetailUiState.Loaded ->
                LoadedContent(
                    trip = state.trip,
                    onPlanTripClick = onPlanTripClick,
                    onBack = onBack,
                    onDeleteClick = onDeleteClick,
                )
        }
    }
}

@Composable
private fun LoadedContent(
    trip: TripDetail,
    onPlanTripClick: () -> Unit,
    onBack: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = LocalBottomBarInset.current)) {
        item {
            SubScreenHeader(title = trip.name, onBack = onBack) {
                IconButton(onClick = onDeleteClick) {
                    Icon(Icons.Rounded.Delete, contentDescription = stringResource(Res.string.delete_trip))
                }
            }
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Text(
                    text =
                        "${formatIsoDate(trip.startDate)} – ${formatIsoDate(trip.endDate)} · " +
                            "${trip.travelers} ${stringResource(Res.string.trip_detail_travelers)} · " +
                            trip.cabinClass,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(onClick = onPlanTripClick, modifier = Modifier.padding(top = 12.dp)) {
                    Text(stringResource(Res.string.plan_trip))
                }
                Text(
                    text = stringResource(Res.string.trip_detail_flights),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
                )
            }
        }
        items(trip.flights) { leg ->
            FlightLegRow(leg, trip.currency)
            HorizontalDivider()
        }
        item {
            Text(
                text = formatPrice(trip.totalPriceCents, trip.currency),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(16.dp),
            )
        }
    }
}

@Composable
private fun FlightLegRow(
    leg: FlightLegDto,
    currency: String,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(
            text = "${leg.origin} → ${leg.destination} · ${leg.carrier ?: "?"}",
            style = MaterialTheme.typography.titleSmall,
        )
        Text(
            text = "${formatIsoDateTime(leg.depart)} → ${formatIsoDateTime(leg.arrive)}",
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text =
                "${formatPrice(leg.priceCents, currency)} · ${leg.durationMin / 60}h${leg.durationMin % 60}m · " +
                    "${leg.stops} ${stringResource(Res.string.trip_detail_stops)}",
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
