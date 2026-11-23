package com.smartroute.traveler.ui.trips

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.ItineraryCityDto
import com.smartroute.traveler.data.api.ItineraryDayDto
import com.smartroute.traveler.data.api.VisitSlotDto
import com.smartroute.traveler.domain.AttractionCategory
import com.smartroute.traveler.domain.EmptyDayReason
import com.smartroute.traveler.domain.formatIsoTime
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.map.rememberMapOpener
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
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
import smartroute_mobile.composeapp.generated.resources.itinerary_closed_today
import smartroute_mobile.composeapp.generated.resources.itinerary_day_of_stay
import smartroute_mobile.composeapp.generated.resources.itinerary_empty_arrival_too_late
import smartroute_mobile.composeapp.generated.resources.itinerary_empty_departure_too_early
import smartroute_mobile.composeapp.generated.resources.itinerary_empty_no_attractions_left
import smartroute_mobile.composeapp.generated.resources.itinerary_empty_scheduled_around_closures
import smartroute_mobile.composeapp.generated.resources.itinerary_empty_unknown
import smartroute_mobile.composeapp.generated.resources.itinerary_empty_window_too_short
import smartroute_mobile.composeapp.generated.resources.itinerary_error_load
import smartroute_mobile.composeapp.generated.resources.itinerary_hours_assumed
import smartroute_mobile.composeapp.generated.resources.itinerary_no_guide
import smartroute_mobile.composeapp.generated.resources.itinerary_open_in_maps
import smartroute_mobile.composeapp.generated.resources.itinerary_title
import smartroute_mobile.composeapp.generated.resources.itinerary_visit_minutes
import smartroute_mobile.composeapp.generated.resources.itinerary_walk
import smartroute_mobile.composeapp.generated.resources.weekday_friday
import smartroute_mobile.composeapp.generated.resources.weekday_monday
import smartroute_mobile.composeapp.generated.resources.weekday_saturday
import smartroute_mobile.composeapp.generated.resources.weekday_sunday
import smartroute_mobile.composeapp.generated.resources.weekday_thursday
import smartroute_mobile.composeapp.generated.resources.weekday_tuesday
import smartroute_mobile.composeapp.generated.resources.weekday_wednesday

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

private val DayOfWeek.labelRes: StringResource
    get() =
        when (this) {
            DayOfWeek.MONDAY -> Res.string.weekday_monday
            DayOfWeek.TUESDAY -> Res.string.weekday_tuesday
            DayOfWeek.WEDNESDAY -> Res.string.weekday_wednesday
            DayOfWeek.THURSDAY -> Res.string.weekday_thursday
            DayOfWeek.FRIDAY -> Res.string.weekday_friday
            DayOfWeek.SATURDAY -> Res.string.weekday_saturday
            DayOfWeek.SUNDAY -> Res.string.weekday_sunday
        }

private val EmptyDayReason.labelRes: StringResource
    get() =
        when (this) {
            EmptyDayReason.ARRIVAL_TOO_LATE -> Res.string.itinerary_empty_arrival_too_late
            EmptyDayReason.DEPARTURE_TOO_EARLY -> Res.string.itinerary_empty_departure_too_early
            EmptyDayReason.WINDOW_TOO_SHORT -> Res.string.itinerary_empty_window_too_short
            EmptyDayReason.NO_ATTRACTIONS_LEFT -> Res.string.itinerary_empty_no_attractions_left
            EmptyDayReason.SCHEDULED_AROUND_CLOSURES ->
                Res.string.itinerary_empty_scheduled_around_closures
            EmptyDayReason.UNKNOWN -> Res.string.itinerary_empty_unknown
        }

@Composable
fun ItineraryScreen(
    state: ItineraryUiState,
    onRetryLoad: () -> Unit,
    onBack: () -> Unit,
) {
    val openInMaps = rememberMapOpener()
    Column(modifier = Modifier.fillMaxSize()) {
        SubScreenHeader(title = stringResource(Res.string.itinerary_title), onBack = onBack)
        when (state) {
            is ItineraryUiState.Loading ->
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            is ItineraryUiState.LoadFailed ->
                RetryErrorState(
                    message = stringResource(Res.string.itinerary_error_load),
                    onRetry = onRetryLoad,
                )
            is ItineraryUiState.Loaded ->
                LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = LocalBottomBarInset.current)) {
                    state.cities.forEachIndexed { index, city ->
                        item { CityHeader(index = index, city = city) }
                        if (!city.available) {
                            item { NoGuideNotice() }
                        } else {
                            city.days.forEach { day ->
                                item { DayHeader(day) }
                                if (day.slots.isEmpty()) {
                                    item { EmptyDayNotice(day) }
                                } else {
                                    items(day.slots) { slot ->
                                        VisitSlotRow(
                                            slot = slot,
                                            onOpenInMaps = { openInMaps(slot.lat, slot.lon, slot.name) },
                                        )
                                    }
                                }
                            }
                        }
                        item { HorizontalDivider() }
                    }
                }
        }
    }
}

@Composable
private fun CityHeader(
    index: Int,
    city: ItineraryCityDto,
) {
    Text(
        text = "${index + 1}. ${city.name ?: city.iata}",
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
    )
}

@Composable
private fun DayHeader(day: ItineraryDayDto) {
    val weekday = runCatching { LocalDate.parse(day.date).dayOfWeek }.getOrNull()
    val prefix = weekday?.let { "${stringResource(it.labelRes)} " } ?: ""
    Text(
        text = "$prefix${day.date} · ${stringResource(Res.string.itinerary_day_of_stay, day.dayOfStay)}",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun EmptyDayNotice(day: ItineraryDayDto) {
    Text(
        text = stringResource((day.reason ?: EmptyDayReason.UNKNOWN).labelRes),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
    )
}

@Composable
private fun NoGuideNotice() {
    Text(
        text = stringResource(Res.string.itinerary_no_guide),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun VisitSlotRow(
    slot: VisitSlotDto,
    onOpenInMaps: () -> Unit,
) {
    // The whole slot is the tap target — "Open in maps" only labels what a tap does.
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpenInMaps)
                .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        slot.walkMinutesFromPrevious?.let { minutes ->
            Text(
                text = "🚶 ${stringResource(Res.string.itinerary_walk, minutes)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }
        Text(
            text =
                "${formatIsoTime(slot.startsAt)}–${formatIsoTime(slot.endsAt)} · " +
                    "${slot.category.icon} ${slot.name}",
            style = MaterialTheme.typography.titleSmall,
        )
        Text(
            text =
                "${stringResource(slot.category.labelRes)} · " +
                    stringResource(Res.string.itinerary_visit_minutes, slot.visitMinutes),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        // A conflict the schedule could not design away. Shown in the error
        // colour because it is the one thing on this row that will waste the
        // traveler's morning if they do not read it.
        if (slot.closedOnThisDay) {
            Text(
                text = "⚠️ ${stringResource(Res.string.itinerary_closed_today)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        // We do not hold this attraction's opening times, so the hour above came
        // from an assumption about its kind rather than from data. Deliberately
        // not the error colour — nothing is wrong, the traveler is simply being
        // told which of these times they should check.
        if (slot.hoursAssumed) {
            Text(
                text = "ⓘ ${stringResource(Res.string.itinerary_hours_assumed)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Text(
            text = slot.description,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(
            text = stringResource(Res.string.itinerary_open_in_maps),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
