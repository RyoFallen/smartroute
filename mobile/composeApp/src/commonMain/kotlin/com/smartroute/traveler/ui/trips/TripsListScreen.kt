package com.smartroute.traveler.ui.trips

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.TripSummary
import com.smartroute.traveler.domain.formatIsoDate
import com.smartroute.traveler.domain.formatPrice
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.theme.SrColors
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
            fontWeight = FontWeight.SemiBold,
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
                            color = SrColors.MutedForeground,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 32.dp),
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding =
                            PaddingValues(
                                start = 16.dp,
                                end = 16.dp,
                                top = 4.dp,
                                bottom = LocalBottomBarInset.current + 16.dp,
                            ),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(state.trips, key = { it.id }) { trip ->
                            TripRow(trip = trip, onClick = { onTripClick(trip.id) })
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
    GlassCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, top = 14.dp, bottom = 14.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = trip.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                val route = trip.cities.joinToString(" → ")
                if (route != trip.name) {
                    Text(
                        text = route,
                        style = MaterialTheme.typography.bodyMedium,
                        color = SrColors.MutedForeground,
                    )
                }
                Text(
                    text = "${formatIsoDate(trip.startDate)} – ${formatIsoDate(trip.endDate)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = SrColors.MutedForeground,
                )
                Text(
                    text = formatPrice(trip.totalPriceCents, trip.currency),
                    style = MaterialTheme.typography.titleSmall,
                    color = SrColors.Primary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = SrColors.Primary)
        }
    }
}
