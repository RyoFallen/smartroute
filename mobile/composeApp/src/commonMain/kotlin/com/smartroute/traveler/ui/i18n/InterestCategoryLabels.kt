package com.smartroute.traveler.ui.i18n

import com.smartroute.traveler.domain.InterestCategory
import org.jetbrains.compose.resources.StringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.interest_adventure_sports
import smartroute_mobile.composeapp.generated.resources.interest_art_architecture
import smartroute_mobile.composeapp.generated.resources.interest_beaches_water
import smartroute_mobile.composeapp.generated.resources.interest_family_activities
import smartroute_mobile.composeapp.generated.resources.interest_food_dining
import smartroute_mobile.composeapp.generated.resources.interest_historical_sites
import smartroute_mobile.composeapp.generated.resources.interest_live_entertainment
import smartroute_mobile.composeapp.generated.resources.interest_local_culture
import smartroute_mobile.composeapp.generated.resources.interest_museums_galleries
import smartroute_mobile.composeapp.generated.resources.interest_nature_parks
import smartroute_mobile.composeapp.generated.resources.interest_nightlife_bars
import smartroute_mobile.composeapp.generated.resources.interest_photography_spots
import smartroute_mobile.composeapp.generated.resources.interest_religious_sites
import smartroute_mobile.composeapp.generated.resources.interest_shopping
import smartroute_mobile.composeapp.generated.resources.interest_wellness_spa

/** Localized display name for an [InterestCategory]; slugs never render. */
val InterestCategory.labelRes: StringResource
    get() =
        when (this) {
            InterestCategory.MUSEUMS_GALLERIES -> Res.string.interest_museums_galleries
            InterestCategory.HISTORICAL_SITES -> Res.string.interest_historical_sites
            InterestCategory.NATURE_PARKS -> Res.string.interest_nature_parks
            InterestCategory.BEACHES_WATER -> Res.string.interest_beaches_water
            InterestCategory.FOOD_DINING -> Res.string.interest_food_dining
            InterestCategory.NIGHTLIFE_BARS -> Res.string.interest_nightlife_bars
            InterestCategory.SHOPPING -> Res.string.interest_shopping
            InterestCategory.ART_ARCHITECTURE -> Res.string.interest_art_architecture
            InterestCategory.ADVENTURE_SPORTS -> Res.string.interest_adventure_sports
            InterestCategory.RELIGIOUS_SITES -> Res.string.interest_religious_sites
            InterestCategory.LOCAL_CULTURE -> Res.string.interest_local_culture
            InterestCategory.PHOTOGRAPHY_SPOTS -> Res.string.interest_photography_spots
            InterestCategory.FAMILY_ACTIVITIES -> Res.string.interest_family_activities
            InterestCategory.WELLNESS_SPA -> Res.string.interest_wellness_spa
            InterestCategory.LIVE_ENTERTAINMENT -> Res.string.interest_live_entertainment
        }
