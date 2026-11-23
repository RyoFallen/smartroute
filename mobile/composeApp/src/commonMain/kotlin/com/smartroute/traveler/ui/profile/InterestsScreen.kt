package com.smartroute.traveler.ui.profile

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.domain.InterestCategory
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.i18n.labelRes
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.interests
import smartroute_mobile.composeapp.generated.resources.interests_error_load
import smartroute_mobile.composeapp.generated.resources.onboarding_error_save
import smartroute_mobile.composeapp.generated.resources.rating_dislike
import smartroute_mobile.composeapp.generated.resources.rating_like
import smartroute_mobile.composeapp.generated.resources.rating_neutral
import smartroute_mobile.composeapp.generated.resources.save
import smartroute_mobile.composeapp.generated.resources.saved
import smartroute_mobile.composeapp.generated.resources.saving

// Segment order: dislike, neutral, like.
private val RATING_SEGMENTS = listOf(-1, 0, 1)

@Composable
fun InterestsScreen(
    state: InterestsUiState,
    onRate: (InterestCategory, Int) -> Unit,
    onSave: () -> Unit,
    onRetryLoad: () -> Unit,
    onBack: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        SubScreenHeader(title = stringResource(Res.string.interests), onBack = onBack)
        when (state) {
            is InterestsUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is InterestsUiState.LoadFailed ->
                RetryErrorState(
                    message = stringResource(Res.string.interests_error_load),
                    onRetry = onRetryLoad,
                )
            is InterestsUiState.Editing ->
                EditingContent(editing = state, onRate = onRate, onSave = onSave)
        }
    }
}

@Composable
private fun EditingContent(
    editing: InterestsUiState.Editing,
    onRate: (InterestCategory, Int) -> Unit,
    onSave: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(bottom = LocalBottomBarInset.current)) {
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(InterestCategory.entries) { category ->
                InterestRow(
                    category = category,
                    rating = editing.ratings[category] ?: 0,
                    enabled = !editing.saving,
                    onRate = { onRate(category, it) },
                )
            }
        }
        Column(modifier = Modifier.padding(16.dp)) {
            if (editing.saveFailed) {
                Text(
                    text = stringResource(Res.string.onboarding_error_save),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
            }
            if (editing.saved) {
                Text(
                    text = stringResource(Res.string.saved),
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
            }
            Button(
                onClick = onSave,
                enabled = !editing.saving,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(if (editing.saving) Res.string.saving else Res.string.save))
            }
        }
    }
}

@Composable
private fun InterestRow(
    category: InterestCategory,
    rating: Int,
    enabled: Boolean,
    onRate: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            text = "${category.icon} ${stringResource(category.labelRes)}",
            style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(4.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            RATING_SEGMENTS.forEachIndexed { index, value ->
                SegmentedButton(
                    selected = rating == value,
                    onClick = { onRate(value) },
                    shape =
                        SegmentedButtonDefaults.itemShape(
                            index = index,
                            count = RATING_SEGMENTS.size,
                        ),
                    enabled = enabled,
                ) {
                    Text(
                        stringResource(
                            when (value) {
                                -1 -> Res.string.rating_dislike
                                1 -> Res.string.rating_like
                                else -> Res.string.rating_neutral
                            },
                        ),
                    )
                }
            }
        }
    }
}
