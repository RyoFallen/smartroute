package com.smartroute.traveler.ui.explore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.RouteOptionDto
import com.smartroute.traveler.domain.RouteLabel
import com.smartroute.traveler.domain.formatPrice
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.results_error_load
import smartroute_mobile.composeapp.generated.resources.results_label_cheapest
import smartroute_mobile.composeapp.generated.resources.results_label_fastest
import smartroute_mobile.composeapp.generated.resources.results_label_most_direct
import smartroute_mobile.composeapp.generated.resources.results_label_recommended
import smartroute_mobile.composeapp.generated.resources.results_no_routes
import smartroute_mobile.composeapp.generated.resources.results_save
import smartroute_mobile.composeapp.generated.resources.results_save_error
import smartroute_mobile.composeapp.generated.resources.results_saving
import smartroute_mobile.composeapp.generated.resources.results_title

private val RouteLabel.labelRes: StringResource
    get() =
        when (this) {
            RouteLabel.RECOMMENDED -> Res.string.results_label_recommended
            RouteLabel.CHEAPEST -> Res.string.results_label_cheapest
            RouteLabel.FASTEST -> Res.string.results_label_fastest
            RouteLabel.MOST_DIRECT -> Res.string.results_label_most_direct
        }

@Composable
fun ResultsScreen(
    state: ResultsUiState,
    onSelectOption: (Int) -> Unit,
    onSave: () -> Unit,
    onRetryLoad: () -> Unit,
    onSaved: (tripId: String) -> Unit,
    onBack: () -> Unit,
) {
    if (state is ResultsUiState.Loaded && state.savedTripId != null) {
        LaunchedEffect(state.savedTripId) { onSaved(state.savedTripId) }
    }
    Column(modifier = Modifier.fillMaxSize()) {
        SubScreenHeader(title = stringResource(Res.string.results_title), onBack = onBack)
        when (state) {
            is ResultsUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is ResultsUiState.LoadFailed ->
                RetryErrorState(message = stringResource(Res.string.results_error_load), onRetry = onRetryLoad)
            is ResultsUiState.Loaded ->
                if (state.options.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = state.reason ?: stringResource(Res.string.results_no_routes),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                } else {
                    LoadedContent(state = state, onSelectOption = onSelectOption, onSave = onSave)
                }
        }
    }
}

@Composable
private fun LoadedContent(
    state: ResultsUiState.Loaded,
    onSelectOption: (Int) -> Unit,
    onSave: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(state.options) { index, option ->
                RouteOptionCard(
                    option = option,
                    currency = state.currency,
                    selected = state.selectedIndex == index,
                    onClick = { onSelectOption(index) },
                )
            }
        }
        Button(
            onClick = onSave,
            enabled = state.selectedIndex != null && !state.saving,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
        ) {
            Text(stringResource(if (state.saving) Res.string.results_saving else Res.string.results_save))
        }
        if (state.saveFailed) {
            Text(
                text = stringResource(Res.string.results_save_error),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun RouteOptionCard(
    option: RouteOptionDto,
    currency: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .clickable(onClick = onClick),
        border = if (selected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null,
        colors =
            if (selected) {
                CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            } else {
                CardDefaults.cardColors()
            },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(option.label.labelRes),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = option.order.joinToString(" → "),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                text =
                    "${formatPrice(option.totalPriceCents, currency)} · " +
                        "${option.totalDurationMin / 60}h${option.totalDurationMin % 60}m",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
