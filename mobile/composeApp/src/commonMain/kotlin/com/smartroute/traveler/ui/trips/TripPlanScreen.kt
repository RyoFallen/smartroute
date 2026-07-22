package com.smartroute.traveler.ui.trips

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.AttractionDto
import com.smartroute.traveler.data.api.TripPlanCityDto
import com.smartroute.traveler.domain.AttractionCategory
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.map.rememberMapOpener
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.attraction_category_historical
import smartroute_mobile.composeapp.generated.resources.attraction_category_landmark
import smartroute_mobile.composeapp.generated.resources.attraction_category_market
import smartroute_mobile.composeapp.generated.resources.attraction_category_museum
import smartroute_mobile.composeapp.generated.resources.attraction_category_park
import smartroute_mobile.composeapp.generated.resources.attraction_category_religious
import smartroute_mobile.composeapp.generated.resources.attraction_category_viewpoint
import smartroute_mobile.composeapp.generated.resources.plan_trip
import smartroute_mobile.composeapp.generated.resources.trip_plan_error_load
import smartroute_mobile.composeapp.generated.resources.trip_plan_no_guide
import smartroute_mobile.composeapp.generated.resources.trip_plan_open_in_maps

private val AttractionCategory.labelRes: StringResource
    get() =
        when (this) {
            AttractionCategory.LANDMARK -> Res.string.attraction_category_landmark
            AttractionCategory.MUSEUM -> Res.string.attraction_category_museum
            AttractionCategory.RELIGIOUS -> Res.string.attraction_category_religious
            AttractionCategory.PARK -> Res.string.attraction_category_park
            AttractionCategory.VIEWPOINT -> Res.string.attraction_category_viewpoint
            AttractionCategory.HISTORICAL -> Res.string.attraction_category_historical
            AttractionCategory.MARKET -> Res.string.attraction_category_market
        }

@Composable
fun TripPlanScreen(
    state: TripPlanUiState,
    onRetryLoad: () -> Unit,
    onBack: () -> Unit,
) {
    val openInMaps = rememberMapOpener()
    Column(modifier = Modifier.fillMaxSize()) {
        SubScreenHeader(title = stringResource(Res.string.plan_trip), onBack = onBack)
        when (state) {
            is TripPlanUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is TripPlanUiState.LoadFailed ->
                RetryErrorState(
                    message = stringResource(Res.string.trip_plan_error_load),
                    onRetry = onRetryLoad,
                )
            is TripPlanUiState.Loaded ->
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    state.cities.forEachIndexed { index, city ->
                        item { CityHeader(index = index, city = city) }
                        if (city.available) {
                            items(city.mustGo) { attraction ->
                                AttractionCard(
                                    attraction = attraction,
                                    onOpenInMaps = { openInMaps(attraction.lat, attraction.lon, attraction.name) },
                                )
                            }
                        } else {
                            item {
                                Text(
                                    text = stringResource(Res.string.trip_plan_no_guide),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                                )
                            }
                        }
                    }
                }
        }
    }
}

@Composable
private fun CityHeader(
    index: Int,
    city: TripPlanCityDto,
) {
    Text(
        text = "${index + 1}. ${city.name ?: city.iata}",
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
    )
}

@Composable
private fun AttractionCard(
    attraction: AttractionDto,
    onOpenInMaps: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            text = "${attraction.category.icon} ${attraction.name} · ${stringResource(attraction.category.labelRes)}",
            style = MaterialTheme.typography.titleSmall,
        )
        Text(
            text = attraction.description,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(
            text = stringResource(Res.string.trip_plan_open_in_maps),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.clickable(onClick = onOpenInMaps).padding(top = 8.dp),
        )
    }
}
