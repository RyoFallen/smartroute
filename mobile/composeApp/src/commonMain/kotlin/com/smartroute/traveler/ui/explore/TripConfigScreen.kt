package com.smartroute.traveler.ui.explore

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.CitySummaryDto
import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.GlassPill
import com.smartroute.traveler.ui.components.GlassTextFieldShape
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.PrimaryButton
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.glassTextFieldColors
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.explore_cities_label
import smartroute_mobile.composeapp.generated.resources.explore_date_confirm
import smartroute_mobile.composeapp.generated.resources.explore_date_hint
import smartroute_mobile.composeapp.generated.resources.explore_depart_date
import smartroute_mobile.composeapp.generated.resources.explore_depart_date_placeholder
import smartroute_mobile.composeapp.generated.resources.explore_direct_only
import smartroute_mobile.composeapp.generated.resources.explore_error_load
import smartroute_mobile.composeapp.generated.resources.explore_find_routes
import smartroute_mobile.composeapp.generated.resources.explore_fly_from_here
import smartroute_mobile.composeapp.generated.resources.explore_flying_from
import smartroute_mobile.composeapp.generated.resources.explore_preset_balanced
import smartroute_mobile.composeapp.generated.resources.explore_preset_budget
import smartroute_mobile.composeapp.generated.resources.explore_preset_comfort
import smartroute_mobile.composeapp.generated.resources.explore_preset_label
import smartroute_mobile.composeapp.generated.resources.explore_preset_time
import smartroute_mobile.composeapp.generated.resources.explore_select_hint
import smartroute_mobile.composeapp.generated.resources.explore_stay_days
import smartroute_mobile.composeapp.generated.resources.tab_explore

private fun Instant.toUtcDate() = toLocalDateTime(TimeZone.UTC).date

private val OptimizePreset.labelRes: StringResource
    get() =
        when (this) {
            OptimizePreset.BUDGET -> Res.string.explore_preset_budget
            OptimizePreset.TIME -> Res.string.explore_preset_time
            OptimizePreset.COMFORT -> Res.string.explore_preset_comfort
            OptimizePreset.BALANCED -> Res.string.explore_preset_balanced
        }

@Composable
fun TripConfigScreen(
    state: TripConfigUiState,
    onToggleCity: (CitySummaryDto) -> Unit,
    onSetDays: (String, Int) -> Unit,
    onSetOrigin: (String) -> Unit,
    onSetPreset: (OptimizePreset) -> Unit,
    onSetDirectOnly: (Boolean) -> Unit,
    onSetDepartDate: (String) -> Unit,
    onSubmit: () -> Unit,
    onRetryLoad: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = stringResource(Res.string.tab_explore),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(16.dp),
        )
        when (state) {
            is TripConfigUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is TripConfigUiState.LoadFailed ->
                RetryErrorState(message = stringResource(Res.string.explore_error_load), onRetry = onRetryLoad)
            is TripConfigUiState.Ready ->
                ReadyContent(
                    state = state,
                    onToggleCity = onToggleCity,
                    onSetDays = onSetDays,
                    onSetOrigin = onSetOrigin,
                    onSetPreset = onSetPreset,
                    onSetDirectOnly = onSetDirectOnly,
                    onSetDepartDate = onSetDepartDate,
                    onSubmit = onSubmit,
                )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReadyContent(
    state: TripConfigUiState.Ready,
    onToggleCity: (CitySummaryDto) -> Unit,
    onSetDays: (String, Int) -> Unit,
    onSetOrigin: (String) -> Unit,
    onSetPreset: (OptimizePreset) -> Unit,
    onSetDirectOnly: (Boolean) -> Unit,
    onSetDepartDate: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val canSubmit = state.selected.size in 2..8 && state.departDate.isNotBlank()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = LocalBottomBarInset.current),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                text = stringResource(Res.string.explore_cities_label, state.selected.size),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        item {
            FlowRow(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                state.cities.forEach { city ->
                    GlassPill(
                        text = "${city.name}, ${city.country}",
                        selected = state.selected.any { it.iata == city.iata },
                        onClick = { onToggleCity(city) },
                    )
                }
            }
        }
        if (state.selected.isNotEmpty()) {
            item {
                GlassCard(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        state.selected.forEach { city ->
                            StayRow(
                                city = city,
                                isOrigin = city.iata == state.originIata,
                                onSetDays = onSetDays,
                                onSetOrigin = { onSetOrigin(city.iata) },
                            )
                        }
                    }
                }
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (state.selected.size !in 2..8) {
                    Text(
                        text = stringResource(Res.string.explore_select_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
                Text(
                    text = stringResource(Res.string.explore_preset_label),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
                FlowRow(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OptimizePreset.entries.forEach { preset ->
                        GlassPill(
                            text = stringResource(preset.labelRes),
                            selected = state.preset == preset,
                            onClick = { onSetPreset(preset) },
                        )
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(Res.string.explore_direct_only), style = MaterialTheme.typography.bodyLarge)
                    Switch(checked = state.directOnly, onCheckedChange = onSetDirectOnly)
                }
                DepartDateField(date = state.departDate, onDateSelected = onSetDepartDate)
                if (state.departDate.isBlank()) {
                    Text(
                        text = stringResource(Res.string.explore_date_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
                PrimaryButton(
                    text = stringResource(Res.string.explore_find_routes),
                    onClick = onSubmit,
                    enabled = canSubmit,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}

@Composable
private fun StayRow(
    city: SelectedCity,
    isOrigin: Boolean,
    onSetDays: (String, Int) -> Unit,
    onSetOrigin: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = city.name,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
        if (isOrigin) {
            // Only flown out of, so there is no stay to set (#34).
            Text(
                text = stringResource(Res.string.explore_flying_from),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
        } else {
            TextButton(onClick = onSetOrigin) {
                Text(stringResource(Res.string.explore_fly_from_here))
            }
            IconButton(onClick = { onSetDays(city.iata, (city.days - 1).coerceAtLeast(1)) }) {
                Icon(Icons.Rounded.Remove, contentDescription = null, tint = SrColors.Primary)
            }
            Text("${city.days} ${stringResource(Res.string.explore_stay_days)}", style = MaterialTheme.typography.bodyMedium)
            IconButton(onClick = { onSetDays(city.iata, (city.days + 1).coerceAtMost(30)) }) {
                Icon(Icons.Rounded.Add, contentDescription = null, tint = SrColors.Primary)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DepartDateField(
    date: String,
    onDateSelected: (String) -> Unit,
) {
    var showPicker by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = date,
        onValueChange = {},
        readOnly = true,
        label = { Text(stringResource(Res.string.explore_depart_date)) },
        placeholder = { Text(stringResource(Res.string.explore_depart_date_placeholder)) },
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .clickable { showPicker = true },
        enabled = false,
        shape = GlassTextFieldShape,
        colors = glassTextFieldColors(),
    )
    if (showPicker) {
        val todayOrLater =
            remember {
                object : SelectableDates {
                    override fun isSelectableDate(utcTimeMillis: Long): Boolean {
                        val picked = Instant.fromEpochMilliseconds(utcTimeMillis).toUtcDate()
                        val today = Clock.System.now().toUtcDate()
                        return picked >= today
                    }
                }
            }
        val pickerState = rememberDatePickerState(selectableDates = todayOrLater)
        val pickerColors =
            DatePickerDefaults.colors(
                containerColor = Color.White,
                selectedDayContainerColor = SrColors.Primary,
                selectedDayContentColor = SrColors.OnPrimary,
                todayDateBorderColor = SrColors.Primary,
                todayContentColor = SrColors.Primary,
                selectedYearContainerColor = SrColors.Primary,
                selectedYearContentColor = SrColors.OnPrimary,
                currentYearContentColor = SrColors.Primary,
            )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            shape = SrShapes.Card,
            colors = pickerColors,
            confirmButton = {
                TextButton(onClick = {
                    val millis = pickerState.selectedDateMillis
                    if (millis != null) {
                        val localDate = Instant.fromEpochMilliseconds(millis).toUtcDate()
                        onDateSelected(localDate.toString())
                    }
                    showPicker = false
                }) {
                    Text(stringResource(Res.string.explore_date_confirm))
                }
            },
        ) {
            DatePicker(state = pickerState, colors = pickerColors)
        }
    }
}
