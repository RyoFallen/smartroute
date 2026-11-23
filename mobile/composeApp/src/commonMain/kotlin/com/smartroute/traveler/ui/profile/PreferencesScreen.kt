package com.smartroute.traveler.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.domain.TripIntensity
import com.smartroute.traveler.ui.components.GlassPill
import com.smartroute.traveler.ui.components.GlassTextFieldShape
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.PrimaryButton
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.components.glassTextFieldColors
import com.smartroute.traveler.ui.theme.SrColors
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.intensity_moderate
import smartroute_mobile.composeapp.generated.resources.intensity_packed
import smartroute_mobile.composeapp.generated.resources.intensity_relaxed
import smartroute_mobile.composeapp.generated.resources.preferences
import smartroute_mobile.composeapp.generated.resources.preferences_error_load
import smartroute_mobile.composeapp.generated.resources.preferences_error_save
import smartroute_mobile.composeapp.generated.resources.preferences_intensity
import smartroute_mobile.composeapp.generated.resources.preferences_wake_up
import smartroute_mobile.composeapp.generated.resources.save
import smartroute_mobile.composeapp.generated.resources.saved
import smartroute_mobile.composeapp.generated.resources.saving

private val WAKE_UP_PATTERN = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")

private val TripIntensity.labelRes: StringResource
    get() =
        when (this) {
            TripIntensity.RELAXED -> Res.string.intensity_relaxed
            TripIntensity.MODERATE -> Res.string.intensity_moderate
            TripIntensity.PACKED -> Res.string.intensity_packed
        }

@Composable
fun PreferencesScreen(
    state: PreferencesUiState,
    onIntensityChange: (TripIntensity) -> Unit,
    onWakeUpTimeChange: (String) -> Unit,
    onSave: () -> Unit,
    onRetryLoad: () -> Unit,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        SubScreenHeader(title = stringResource(Res.string.preferences), onBack = onBack)
        when (state) {
            is PreferencesUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is PreferencesUiState.LoadFailed ->
                RetryErrorState(
                    message = stringResource(Res.string.preferences_error_load),
                    onRetry = onRetryLoad,
                )
            is PreferencesUiState.Editing ->
                EditingContent(
                    editing = state,
                    onIntensityChange = onIntensityChange,
                    onWakeUpTimeChange = onWakeUpTimeChange,
                    onSave = onSave,
                )
        }
    }
}

@Composable
private fun EditingContent(
    editing: PreferencesUiState.Editing,
    onIntensityChange: (TripIntensity) -> Unit,
    onWakeUpTimeChange: (String) -> Unit,
    onSave: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(bottom = LocalBottomBarInset.current)) {
        // The fields scroll; Save stays pinned below them so a small screen or the
        // keyboard can never push it out of reach.
        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp)) {
            Text(
                text = stringResource(Res.string.preferences_intensity),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TripIntensity.entries.forEach { intensity ->
                    GlassPill(
                        text = stringResource(intensity.labelRes),
                        selected = editing.intensity == intensity,
                        onClick = { if (!editing.saving) onIntensityChange(intensity) },
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(
                text = stringResource(Res.string.preferences_wake_up),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = editing.wakeUpTime,
                onValueChange = onWakeUpTimeChange,
                singleLine = true,
                enabled = !editing.saving,
                isError = !WAKE_UP_PATTERN.matches(editing.wakeUpTime),
                placeholder = { Text("09:00") },
                shape = GlassTextFieldShape,
                colors = glassTextFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Column(modifier = Modifier.padding(16.dp)) {
            if (editing.saveFailed) {
                Text(
                    text = stringResource(Res.string.preferences_error_save),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
            }
            if (editing.saved) {
                Text(
                    text = stringResource(Res.string.saved),
                    color = SrColors.Primary,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
            }
            PrimaryButton(
                text = stringResource(if (editing.saving) Res.string.saving else Res.string.save),
                onClick = onSave,
                enabled = !editing.saving && WAKE_UP_PATTERN.matches(editing.wakeUpTime),
            )
        }
    }
}
