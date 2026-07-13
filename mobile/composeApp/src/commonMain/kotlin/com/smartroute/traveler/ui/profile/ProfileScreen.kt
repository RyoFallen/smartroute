package com.smartroute.traveler.ui.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.interests
import smartroute_mobile.composeapp.generated.resources.language
import smartroute_mobile.composeapp.generated.resources.preferences
import smartroute_mobile.composeapp.generated.resources.profile_signed_in_as
import smartroute_mobile.composeapp.generated.resources.sign_out
import smartroute_mobile.composeapp.generated.resources.tab_profile

/** The Profile settings hub (spec: email read-only, Preferences, Language,
 * Sign out; Interests and Delete account arrive with their tickets). */
@Composable
fun ProfileScreen(
    email: String?,
    onInterestsClick: () -> Unit,
    onPreferencesClick: () -> Unit,
    onLanguageClick: () -> Unit,
    onSignOut: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = stringResource(Res.string.tab_profile),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(16.dp),
        )
        email?.let {
            Text(
                text = stringResource(Res.string.profile_signed_in_as),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Text(
                text = it,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }
        HorizontalDivider(modifier = Modifier.padding(16.dp))
        SettingsRow(label = stringResource(Res.string.interests), onClick = onInterestsClick)
        SettingsRow(label = stringResource(Res.string.preferences), onClick = onPreferencesClick)
        SettingsRow(label = stringResource(Res.string.language), onClick = onLanguageClick)
        SettingsRow(label = stringResource(Res.string.sign_out), onClick = onSignOut)
    }
}

@Composable
internal fun SettingsRow(
    label: String,
    onClick: () -> Unit,
    value: String? = null,
    emphasis: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = if (emphasis) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        value?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
    HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
}
