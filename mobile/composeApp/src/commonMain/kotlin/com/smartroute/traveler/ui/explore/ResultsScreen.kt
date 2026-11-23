package com.smartroute.traveler.ui.explore

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.RouteOptionDto
import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.domain.RouteLabel
import com.smartroute.traveler.domain.formatPrice
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.GlassPill
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.PrimaryButton
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.map.MapPoint
import com.smartroute.traveler.ui.map.RouteMap
import com.smartroute.traveler.ui.map.RouteMapState
import com.smartroute.traveler.ui.map.routePoints
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.pluralStringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.explore_preset_balanced
import smartroute_mobile.composeapp.generated.resources.explore_preset_budget
import smartroute_mobile.composeapp.generated.resources.explore_preset_comfort
import smartroute_mobile.composeapp.generated.resources.explore_preset_time
import smartroute_mobile.composeapp.generated.resources.results_error_load
import smartroute_mobile.composeapp.generated.resources.results_flights
import smartroute_mobile.composeapp.generated.resources.results_label_cheapest
import smartroute_mobile.composeapp.generated.resources.results_label_fastest
import smartroute_mobile.composeapp.generated.resources.results_label_most_direct
import smartroute_mobile.composeapp.generated.resources.results_label_recommended
import smartroute_mobile.composeapp.generated.resources.results_no_routes
import smartroute_mobile.composeapp.generated.resources.results_save
import smartroute_mobile.composeapp.generated.resources.results_save_error
import smartroute_mobile.composeapp.generated.resources.results_saving
import smartroute_mobile.composeapp.generated.resources.results_title

private const val MINUTES_PER_HOUR = 60
private const val MAP_HEIGHT_DP = 140
private const val RELOADING_ALPHA = 0.5f

private val RouteLabel.labelRes: StringResource
    get() =
        when (this) {
            RouteLabel.RECOMMENDED -> Res.string.results_label_recommended
            RouteLabel.CHEAPEST -> Res.string.results_label_cheapest
            RouteLabel.FASTEST -> Res.string.results_label_fastest
            RouteLabel.MOST_DIRECT -> Res.string.results_label_most_direct
        }

private val OptimizePreset.labelRes: StringResource
    get() =
        when (this) {
            OptimizePreset.BUDGET -> Res.string.explore_preset_budget
            OptimizePreset.TIME -> Res.string.explore_preset_time
            OptimizePreset.COMFORT -> Res.string.explore_preset_comfort
            OptimizePreset.BALANCED -> Res.string.explore_preset_balanced
        }

@Composable
fun ResultsScreen(
    state: ResultsUiState,
    onSelectOption: (Int) -> Unit,
    onPresetSelected: (OptimizePreset) -> Unit,
    onSave: () -> Unit,
    onRetryLoad: () -> Unit,
    onSaved: (tripId: String) -> Unit,
    onBack: () -> Unit,
) {
    if (state is ResultsUiState.Loaded && state.savedTripId != null) {
        LaunchedEffect(state.savedTripId) { onSaved(state.savedTripId) }
    }
    // The bottom bar floats over tab content; this keeps the pinned save button clear of it.
    Column(modifier = Modifier.fillMaxSize().padding(bottom = LocalBottomBarInset.current)) {
        SubScreenHeader(title = stringResource(Res.string.results_title), onBack = onBack)
        when (state) {
            is ResultsUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SrColors.Primary)
                }
            is ResultsUiState.LoadFailed ->
                RetryErrorState(message = stringResource(Res.string.results_error_load), onRetry = onRetryLoad)
            is ResultsUiState.Loaded ->
                LoadedContent(
                    state = state,
                    onSelectOption = onSelectOption,
                    onPresetSelected = onPresetSelected,
                    onSave = onSave,
                )
        }
    }
}

@Composable
private fun LoadedContent(
    state: ResultsUiState.Loaded,
    onSelectOption: (Int) -> Unit,
    onPresetSelected: (OptimizePreset) -> Unit,
    onSave: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        PresetPills(selected = state.preset, onSelected = onPresetSelected)
        if (state.options.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(
                    text = state.reason ?: stringResource(Res.string.results_no_routes),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(24.dp),
                )
            }
            return
        }
        val recommendedIndex = state.options.indexOfFirst { it.label == RouteLabel.RECOMMENDED }.coerceAtLeast(0)
        LazyColumn(
            modifier = Modifier.weight(1f).alpha(if (state.reloading) RELOADING_ALPHA else 1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "recommended") {
                RecommendedCard(
                    option = state.options[recommendedIndex],
                    currency = state.currency,
                    coordinates = state.coordinates,
                    selected = state.selectedIndex == recommendedIndex,
                    onClick = { onSelectOption(recommendedIndex) },
                )
            }
            itemsIndexed(state.options) { index, option ->
                if (index != recommendedIndex) {
                    CompactCard(
                        option = option,
                        currency = state.currency,
                        selected = state.selectedIndex == index,
                        onClick = { onSelectOption(index) },
                    )
                }
            }
        }
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            if (state.saveFailed) {
                Text(
                    text = stringResource(Res.string.results_save_error),
                    color = SrColors.Destructive,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }
            PrimaryButton(
                text = stringResource(if (state.saving) Res.string.results_saving else Res.string.results_save),
                onClick = onSave,
                enabled = state.selectedIndex != null && !state.saving && !state.reloading,
            )
        }
    }
}

@Composable
private fun PresetPills(
    selected: OptimizePreset,
    onSelected: (OptimizePreset) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OptimizePreset.entries.forEach { preset ->
            GlassPill(
                text = stringResource(preset.labelRes),
                selected = preset == selected,
                onClick = { onSelected(preset) },
            )
        }
    }
}

@Composable
private fun flightsAndDuration(option: RouteOptionDto): String {
    val flights = option.flights.size
    val minutes = option.totalDurationMin
    val duration = "${minutes / MINUTES_PER_HOUR}h ${(minutes % MINUTES_PER_HOUR).toString().padStart(2, '0')}m"
    return "${pluralStringResource(Res.plurals.results_flights, flights, flights)} · $duration"
}

@Composable
private fun RecommendedCard(
    option: RouteOptionDto,
    currency: String,
    coordinates: Map<String, MapPoint>,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val points = routePoints(option.order, coordinates)
    GlassCard(modifier = Modifier.fillMaxWidth(), selected = selected, onClick = onClick) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(option.label.labelRes),
                    style = MaterialTheme.typography.labelLarge,
                    color = SrColors.Primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPrice(option.totalPriceCents, currency),
                    style = MaterialTheme.typography.headlineSmall,
                    color = SrColors.Primary,
                    maxLines = 1,
                )
            }
            Text(
                text = option.order.joinToString(" → "),
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp),
            )
            Text(
                text = flightsAndDuration(option),
                style = MaterialTheme.typography.bodyMedium,
                color = SrColors.MutedForeground,
                modifier = Modifier.padding(top = 2.dp),
            )
            if (points.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                RouteMap(
                    state = RouteMapState(points),
                    modifier = Modifier.fillMaxWidth().height(MAP_HEIGHT_DP.dp).clip(SrShapes.SmallCard),
                )
            }
        }
    }
}

@Composable
private fun CompactCard(
    option: RouteOptionDto,
    currency: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), shape = SrShapes.SmallCard, selected = selected, onClick = onClick) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(option.label.labelRes),
                    style = MaterialTheme.typography.labelLarge,
                    color = SrColors.Primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = formatPrice(option.totalPriceCents, currency),
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                )
            }
            Text(
                text = option.order.joinToString(" → "),
                style = MaterialTheme.typography.bodyMedium,
                color = SrColors.MutedForeground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
