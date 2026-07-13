package com.smartroute.traveler.ui.onboarding

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.domain.InterestCategory
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.i18n.labelRes
import kotlinx.coroutines.launch
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.onboarding_error_load
import smartroute_mobile.composeapp.generated.resources.onboarding_error_save
import smartroute_mobile.composeapp.generated.resources.onboarding_hint
import smartroute_mobile.composeapp.generated.resources.onboarding_skip_all
import smartroute_mobile.composeapp.generated.resources.onboarding_title
import smartroute_mobile.composeapp.generated.resources.retry

@Composable
fun OnboardingScreen(
    state: OnboardingUiState,
    onRate: (Int) -> Unit,
    onSkipAll: () -> Unit,
    onRetryLoad: () -> Unit,
    onRetrySubmit: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
        when (state) {
            is OnboardingUiState.Loading, OnboardingUiState.Complete ->
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            is OnboardingUiState.LoadFailed ->
                RetryErrorState(
                    message = stringResource(Res.string.onboarding_error_load),
                    onRetry = onRetryLoad,
                )
            is OnboardingUiState.Deck ->
                DeckContent(
                    deck = state,
                    onRate = onRate,
                    onSkipAll = onSkipAll,
                    onRetrySubmit = onRetrySubmit,
                )
        }
    }
}

@Composable
private fun DeckContent(
    deck: OnboardingUiState.Deck,
    onRate: (Int) -> Unit,
    onSkipAll: () -> Unit,
    onRetrySubmit: () -> Unit,
) {
    val category = InterestCategory.entries[deck.cardIndex]
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(Res.string.onboarding_title),
                style = MaterialTheme.typography.headlineSmall,
            )
            TextButton(onClick = onSkipAll, enabled = !deck.submitting) {
                Text(stringResource(Res.string.onboarding_skip_all))
            }
        }
        Text(
            text = stringResource(Res.string.onboarding_hint),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
            SwipeableInterestCard(
                category = category,
                enabled = !deck.submitting,
                onRate = onRate,
            )
        }
        if (deck.submitFailed) {
            Text(
                text = stringResource(Res.string.onboarding_error_save),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
            TextButton(onClick = onRetrySubmit) {
                Text(stringResource(Res.string.retry))
            }
        }
        Text(
            text = "${deck.cardIndex + 1} / ${InterestCategory.entries.size}",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 8.dp),
        )
    }
}

@Composable
private fun SwipeableInterestCard(
    category: InterestCategory,
    enabled: Boolean,
    onRate: (Int) -> Unit,
) {
    val offsetX = remember(category) { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val threshold = with(LocalDensity.current) { 96.dp.toPx() }
    val exitDistance = with(LocalDensity.current) { 600.dp.toPx() }

    Card(
        modifier =
            Modifier
                .fillMaxWidth(0.85f)
                .aspectRatio(0.75f)
                .graphicsLayer {
                    translationX = offsetX.value
                    rotationZ = offsetX.value / 40f
                }.pointerInput(category, enabled) {
                    if (!enabled) return@pointerInput
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            val settled = offsetX.value
                            when {
                                settled > threshold ->
                                    scope.launch {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        offsetX.animateTo(exitDistance)
                                        onRate(1)
                                    }
                                settled < -threshold ->
                                    scope.launch {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        offsetX.animateTo(-exitDistance)
                                        onRate(-1)
                                    }
                                else -> scope.launch { offsetX.animateTo(0f) }
                            }
                        },
                        onHorizontalDrag = { change, dragAmount ->
                            change.consume()
                            scope.launch { offsetX.snapTo(offsetX.value + dragAmount) }
                        },
                    )
                }.clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    enabled = enabled,
                ) {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onRate(0)
                },
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = category.icon, style = MaterialTheme.typography.displayLarge)
            Spacer(Modifier.height(16.dp))
            Text(
                text = stringResource(category.labelRes),
                style = MaterialTheme.typography.headlineSmall,
            )
        }
    }
}
