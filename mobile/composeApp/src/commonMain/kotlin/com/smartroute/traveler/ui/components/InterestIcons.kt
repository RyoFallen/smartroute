package com.smartroute.traveler.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountBalance
import androidx.compose.material.icons.rounded.BeachAccess
import androidx.compose.material.icons.rounded.Brush
import androidx.compose.material.icons.rounded.Castle
import androidx.compose.material.icons.rounded.Church
import androidx.compose.material.icons.rounded.FamilyRestroom
import androidx.compose.material.icons.rounded.Forest
import androidx.compose.material.icons.rounded.Hiking
import androidx.compose.material.icons.rounded.LocalBar
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.PhotoCamera
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material.icons.rounded.ShoppingBag
import androidx.compose.material.icons.rounded.Spa
import androidx.compose.material.icons.rounded.TheaterComedy
import androidx.compose.ui.graphics.vector.ImageVector
import com.smartroute.traveler.domain.InterestCategory

/** UI-side icon for each interest; the domain model keeps its emoji field untouched. */
val InterestCategory.imageVector: ImageVector
    get() =
        when (this) {
            InterestCategory.MUSEUMS_GALLERIES -> Icons.Rounded.AccountBalance
            InterestCategory.HISTORICAL_SITES -> Icons.Rounded.Castle
            InterestCategory.NATURE_PARKS -> Icons.Rounded.Forest
            InterestCategory.BEACHES_WATER -> Icons.Rounded.BeachAccess
            InterestCategory.FOOD_DINING -> Icons.Rounded.Restaurant
            InterestCategory.NIGHTLIFE_BARS -> Icons.Rounded.LocalBar
            InterestCategory.SHOPPING -> Icons.Rounded.ShoppingBag
            InterestCategory.ART_ARCHITECTURE -> Icons.Rounded.Brush
            InterestCategory.ADVENTURE_SPORTS -> Icons.Rounded.Hiking
            InterestCategory.RELIGIOUS_SITES -> Icons.Rounded.Church
            InterestCategory.LOCAL_CULTURE -> Icons.Rounded.TheaterComedy
            InterestCategory.PHOTOGRAPHY_SPOTS -> Icons.Rounded.PhotoCamera
            InterestCategory.FAMILY_ACTIVITIES -> Icons.Rounded.FamilyRestroom
            InterestCategory.WELLNESS_SPA -> Icons.Rounded.Spa
            InterestCategory.LIVE_ENTERTAINMENT -> Icons.Rounded.MusicNote
        }
