package com.smartroute.traveler.ui.explore

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
    onRetryLoad: () -> Unit,
    onBack: () -> Unit,
) {
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
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(state.options) { option -> RouteOptionCard(option) }
                    }
                }
        }
    }
}

@Composable
private fun RouteOptionCard(option: RouteOptionDto) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
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
                    "${formatPrice(option.totalPriceCents, "USD")} · " +
                        "${option.totalDurationMin / 60}h${option.totalDurationMin % 60}m",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
