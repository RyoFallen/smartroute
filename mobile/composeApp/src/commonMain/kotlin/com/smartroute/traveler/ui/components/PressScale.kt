package com.smartroute.traveler.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer

/** Duration shared by every screen and tab transition. */
const val MOTION_MS = 250

private const val PRESSED_SCALE = 0.97f
private const val PRESS_MS = 200

fun Modifier.pressScale(interactionSource: MutableInteractionSource): Modifier =
    composed {
        val pressed by interactionSource.collectIsPressedAsState()
        val scale by animateFloatAsState(
            targetValue = if (pressed) PRESSED_SCALE else 1f,
            animationSpec = tween(PRESS_MS, easing = FastOutSlowInEasing),
            label = "pressScale",
        )
        graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
    }
