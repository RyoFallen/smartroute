package com.smartroute.traveler.ui.onboarding

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.ThumbDown
import androidx.compose.material.icons.rounded.ThumbUp
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.domain.InterestCategory
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.GlassIconButton
import com.smartroute.traveler.ui.components.MOTION_MS
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.i18n.labelRes
import com.smartroute.traveler.ui.theme.SrColors
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
            color = SrColors.MutedForeground,
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
            color = MaterialTheme.colorScheme.primary,
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

    fun flingAway(rating: Int) {
        scope.launch {
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            offsetX.animateTo(exitDistance * rating, tween(MOTION_MS, easing = EaseOut))
            onRate(rating)
        }
    }

    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        GlassCard(
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
                                    settled > threshold -> flingAway(1)
                                    settled < -threshold -> flingAway(-1)
                                    else -> scope.launch { offsetX.animateTo(0f) }
                                }
                            },
                            onHorizontalDrag = { change, dragAmount ->
                                change.consume()
                                scope.launch { offsetX.snapTo(offsetX.value + dragAmount) }
                            },
                        )
                    },
            onClick =
                if (enabled) {
                    {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onRate(0)
                    }
                } else {
                    null
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
                    textAlign = TextAlign.Center,
                )
            }
        }
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.CenterVertically) {
            GlassIconButton(
                icon = Icons.Rounded.ThumbDown,
                onClick = { flingAway(-1) },
                size = 56.dp,
                enabled = enabled,
            )
            GlassIconButton(
                icon = Icons.Rounded.Remove,
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onRate(0)
                },
                size = 56.dp,
                tint = SrColors.MutedForeground,
                enabled = enabled,
            )
            GlassIconButton(
                icon = Icons.Rounded.ThumbUp,
                onClick = { flingAway(1) },
                size = 56.dp,
                tint = SrColors.Primary,
                enabled = enabled,
            )
        }
    }
}
