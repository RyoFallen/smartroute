package com.smartroute.traveler.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.TripSummary
import com.smartroute.traveler.domain.formatIsoDate
import com.smartroute.traveler.domain.formatPrice
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.GlassPill
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.PrimaryButton
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.map.MapPoint
import com.smartroute.traveler.ui.map.RouteMap
import com.smartroute.traveler.ui.map.RouteMapState
import com.smartroute.traveler.ui.map.routePoints
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.home_days_to_go
import smartroute_mobile.composeapp.generated.resources.home_empty
import smartroute_mobile.composeapp.generated.resources.home_error_load
import smartroute_mobile.composeapp.generated.resources.home_greeting_afternoon
import smartroute_mobile.composeapp.generated.resources.home_greeting_evening
import smartroute_mobile.composeapp.generated.resources.home_greeting_morning
import smartroute_mobile.composeapp.generated.resources.home_headline
import smartroute_mobile.composeapp.generated.resources.home_plan_route
import smartroute_mobile.composeapp.generated.resources.home_recent
import smartroute_mobile.composeapp.generated.resources.home_today
import smartroute_mobile.composeapp.generated.resources.home_upcoming
import smartroute_mobile.composeapp.generated.resources.results_flights

private const val MAP_HEIGHT_DP = 120
private const val BADGE_BG_ALPHA = 0.12f

@Composable
fun HomeScreen(
    state: HomeUiState,
    onPlanRoute: () -> Unit,
    onTripClick: (String) -> Unit,
    onRetry: () -> Unit,
) {
    when (state) {
        is HomeUiState.Loading ->
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        is HomeUiState.LoadFailed ->
            RetryErrorState(message = stringResource(Res.string.home_error_load), onRetry = onRetry)
        is HomeUiState.Loaded -> HomeLoaded(state, onPlanRoute, onTripClick)
    }
}

@Composable
private fun HomeLoaded(
    state: HomeUiState.Loaded,
    onPlanRoute: () -> Unit,
    onTripClick: (String) -> Unit,
) {
    val greeting =
        remember {
            greetingFor(
                Clock.System
                    .now()
                    .toLocalDateTime(TimeZone.currentSystemDefault())
                    .hour,
            )
        }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 20.dp, end = 20.dp, top = 24.dp, bottom = 16.dp + LocalBottomBarInset.current),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column {
            Text(
                text = stringResource(greeting.labelRes()),
                style = MaterialTheme.typography.bodyLarge,
                color = SrColors.MutedForeground,
            )
            Text(
                text = stringResource(Res.string.home_headline),
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.SemiBold),
                color = SrColors.Foreground,
            )
        }
        PrimaryButton(
            text = stringResource(Res.string.home_plan_route),
            onClick = onPlanRoute,
            leadingIcon = Icons.Rounded.Add,
        )
        val content = state.content
        if (content.upcoming == null && content.recent.isEmpty()) {
            Text(
                text = stringResource(Res.string.home_empty),
                style = MaterialTheme.typography.bodyLarge,
                color = SrColors.MutedForeground,
            )
        }
        content.upcoming?.let { UpcomingCard(it, state.coordinates, onClick = { onTripClick(it.trip.id) }) }
        if (content.recent.isNotEmpty()) {
            RecentSection(content.recent, onTripClick)
        }
    }
}

@Composable
private fun UpcomingCard(
    upcoming: UpcomingTrip,
    coordinates: Map<String, MapPoint>,
    onClick: () -> Unit,
) {
    val trip = upcoming.trip
    val points = routePoints(trip.cities, coordinates)
    val flights = pluralStringResource(Res.plurals.results_flights, upcoming.flightCount, upcoming.flightCount)
    GlassCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(Res.string.home_upcoming),
                    style = MaterialTheme.typography.labelLarge,
                    color = SrColors.MutedForeground,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(end = 8.dp),
                )
                DaysBadge(upcoming.daysUntil)
            }
            Text(
                text = trip.cities.joinToString(" → "),
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                text = "${formatIsoDate(trip.startDate)} – ${formatIsoDate(trip.endDate)} · $flights",
                style = MaterialTheme.typography.bodyMedium,
                color = SrColors.MutedForeground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (points.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                RouteMap(
                    state = RouteMapState(points),
                    modifier = Modifier.fillMaxWidth().height(MAP_HEIGHT_DP.dp).clip(SrShapes.SmallCard),
                )
            }
            Text(
                text = formatPrice(trip.totalPriceCents, trip.currency),
                style = MaterialTheme.typography.headlineSmall,
                color = SrColors.Primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}

@Composable
private fun DaysBadge(daysUntil: Int) {
    val text =
        if (daysUntil == 0) {
            stringResource(Res.string.home_today)
        } else {
            pluralStringResource(Res.plurals.home_days_to_go, daysUntil, daysUntil)
        }
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = SrColors.Primary,
        maxLines = 1,
        modifier =
            Modifier
                .clip(SrShapes.Pill)
                .background(SrColors.Primary.copy(alpha = BADGE_BG_ALPHA), SrShapes.Pill)
                .padding(horizontal = 12.dp, vertical = 4.dp),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RecentSection(
    recent: List<TripSummary>,
    onTripClick: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(Res.string.home_recent),
            style = MaterialTheme.typography.titleMedium,
            color = SrColors.Foreground,
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            recent.forEach { trip ->
                GlassPill(
                    text = trip.name,
                    selected = false,
                    onClick = { onTripClick(trip.id) },
                )
            }
        }
    }
}

private fun Greeting.labelRes(): StringResource =
    when (this) {
        Greeting.MORNING -> Res.string.home_greeting_morning
        Greeting.AFTERNOON -> Res.string.home_greeting_afternoon
        Greeting.EVENING -> Res.string.home_greeting_evening
    }
