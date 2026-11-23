package com.smartroute.traveler.ui.components

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Space the frosted bottom bar (including the system navigation-bar inset) occupies at the
 * bottom of the content area. Content scrolls under the bar; screens add this as bottom
 * padding so their last items and pinned actions stay reachable.
 */
val LocalBottomBarInset = compositionLocalOf<Dp> { 0.dp }
