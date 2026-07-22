package com.smartroute.traveler.ui.trips

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.TripSummary
import com.smartroute.traveler.domain.formatPrice
import com.smartroute.traveler.ui.components.RetryErrorState
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.my_trips_empty
import smartroute_mobile.composeapp.generated.resources.my_trips_error_load
import smartroute_mobile.composeapp.generated.resources.tab_my_trips

@Composable
fun TripsListScreen(
    state: TripsListUiState,
    onTripClick: (String) -> Unit,
    onRetryLoad: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = stringResource(Res.string.tab_my_trips),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(16.dp),
        )
        when (state) {
            is TripsListUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is TripsListUiState.LoadFailed ->
                RetryErrorState(
                    message = stringResource(Res.string.my_trips_error_load),
                    onRetry = onRetryLoad,
                )
            is TripsListUiState.Loaded ->
                if (state.trips.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = stringResource(Res.string.my_trips_empty),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(state.trips, key = { it.id }) { trip ->
                            TripRow(trip = trip, onClick = { onTripClick(trip.id) })
                            HorizontalDivider()
                        }
                    }
                }
        }
    }
}

@Composable
private fun TripRow(
    trip: TripSummary,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text(text = trip.name, style = MaterialTheme.typography.titleMedium)
        Text(
            // USD is the only currency SmartRoute prices in today (Duffel test-mode
            // prefers USD; no currency field exists in the domain yet — Phase 5 follow-up).
            text = "${trip.cities.joinToString(" → ")} · ${formatPrice(trip.totalPriceCents, "USD")}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
