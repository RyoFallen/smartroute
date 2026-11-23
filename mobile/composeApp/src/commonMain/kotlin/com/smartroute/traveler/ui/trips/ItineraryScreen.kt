package com.smartroute.traveler.ui.trips

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.smartroute.traveler.data.api.ItineraryDayDto
import com.smartroute.traveler.data.api.VisitSlotDto
import com.smartroute.traveler.domain.AttractionCategory
import com.smartroute.traveler.domain.EmptyDayReason
import com.smartroute.traveler.domain.formatIsoTime
import com.smartroute.traveler.ui.components.GlassCard
import com.smartroute.traveler.ui.components.GlassPill
import com.smartroute.traveler.ui.components.LocalBottomBarInset
import com.smartroute.traveler.ui.components.RetryErrorState
import com.smartroute.traveler.ui.components.SubScreenHeader
import com.smartroute.traveler.ui.map.rememberMapOpener
import com.smartroute.traveler.ui.theme.SrColors
import com.smartroute.traveler.ui.theme.SrShapes
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
import smartroute_mobile.composeapp.generated.resources.itinerary_day
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

private val TimeColumnWidth = 52.dp
private const val LINE_ALPHA = 0.25f
private const val DESTRUCTIVE_FILL_ALPHA = 0.1f

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
    onSelectTab: (Int) -> Unit,
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
            is ItineraryUiState.Loaded -> {
                DayPills(state.tabs, state.selectedTab, onSelectTab)
                val tab = state.tabs.getOrNull(state.selectedTab)
                val day = tab?.day
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding =
                        PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = LocalBottomBarInset.current),
                ) {
                    if (tab != null && day == null) {
                        item { GlassNotice(stringResource(Res.string.itinerary_no_guide)) }
                    } else if (day != null) {
                        item { DayHeader(day) }
                        if (day.slots.isEmpty()) {
                            item { GlassNotice(stringResource((day.reason ?: EmptyDayReason.UNKNOWN).labelRes)) }
                        } else {
                            day.slots.forEachIndexed { index, slot ->
                                slot.walkMinutesFromPrevious?.let { minutes ->
                                    item(key = "walk-${state.selectedTab}-$index") { WalkRow(minutes) }
                                }
                                item(key = "visit-${state.selectedTab}-$index") {
                                    VisitRow(slot = slot, onOpenInMaps = { openInMaps(slot.lat, slot.lon, slot.name) })
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayPills(
    tabs: List<DayTab>,
    selected: Int,
    onSelect: (Int) -> Unit,
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        itemsIndexed(tabs) { index, tab ->
            GlassPill(
                text = stringResource(Res.string.itinerary_day, tab.number),
                subtitle = tab.cityName ?: tab.iata,
                selected = index == selected,
                onClick = { onSelect(index) },
            )
        }
    }
}

@Composable
private fun DayHeader(day: ItineraryDayDto) {
    val weekday = runCatching { LocalDate.parse(day.date).dayOfWeek }.getOrNull()
    val prefix = weekday?.let { "${stringResource(it.labelRes)} " } ?: ""
    Text(
        text = "$prefix${day.date}",
        style = MaterialTheme.typography.titleMedium,
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
    )
}

@Composable
private fun GlassNotice(text: String) {
    GlassCard(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), shape = SrShapes.SmallCard) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = SrColors.MutedForeground,
            modifier = Modifier.padding(16.dp),
        )
    }
}

/** One timeline row: time column, the vertical line (with a dot when [dot]), then the content. */
@Composable
private fun TimelineRow(
    time: String?,
    dot: Boolean,
    content: @Composable () -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Text(
            text = time.orEmpty(),
            style = MaterialTheme.typography.labelLarge,
            color = SrColors.MutedForeground,
            modifier = Modifier.width(TimeColumnWidth).padding(top = 14.dp),
        )
        Box(modifier = Modifier.width(20.dp).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
            Box(
                modifier =
                    Modifier
                        .width(2.dp)
                        .fillMaxHeight()
                        .background(SrColors.Primary.copy(alpha = LINE_ALPHA)),
            )
            if (dot) {
                Box(
                    modifier =
                        Modifier
                            .padding(top = 18.dp)
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(SrColors.Primary),
                )
            }
        }
        Box(modifier = Modifier.weight(1f).padding(start = 8.dp)) { content() }
    }
}

@Composable
private fun WalkRow(minutes: Int) {
    TimelineRow(time = null, dot = false) {
        Row(
            modifier = Modifier.padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(
                Icons.AutoMirrored.Rounded.DirectionsWalk,
                contentDescription = null,
                tint = SrColors.MutedForeground,
                modifier = Modifier.size(16.dp),
            )
            Text(
                text = stringResource(Res.string.itinerary_walk, minutes),
                style = MaterialTheme.typography.labelMedium,
                color = SrColors.MutedForeground,
            )
        }
    }
}

@Composable
private fun VisitRow(
    slot: VisitSlotDto,
    onOpenInMaps: () -> Unit,
) {
    TimelineRow(time = formatIsoTime(slot.startsAt), dot = true) {
        // The whole card is the tap target; "Open in maps" only labels what a tap does.
        GlassCard(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            shape = SrShapes.SmallCard,
            onClick = onOpenInMaps,
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(text = slot.name, style = MaterialTheme.typography.titleSmall)
                Text(
                    text =
                        "${stringResource(slot.category.labelRes)} · " +
                            stringResource(Res.string.itinerary_visit_minutes, slot.visitMinutes),
                    style = MaterialTheme.typography.bodySmall,
                    color = SrColors.MutedForeground,
                )
                // A conflict the schedule could not design away: destructive tint, because it
                // is the one thing on this card that will waste the traveler's morning.
                if (slot.closedOnThisDay) {
                    Badge(
                        text = stringResource(Res.string.itinerary_closed_today),
                        fill = SrColors.Destructive.copy(alpha = DESTRUCTIVE_FILL_ALPHA),
                        color = SrColors.Destructive,
                        icon = null,
                    )
                }
                // We hold no opening times for this attraction, so the hour came from an
                // assumption about its kind. Deliberately not the error colour: nothing is
                // wrong, the traveler is told which time to check.
                if (slot.hoursAssumed) {
                    Badge(
                        text = stringResource(Res.string.itinerary_hours_assumed),
                        fill = SrColors.Muted,
                        color = SrColors.MutedForeground,
                        icon = Icons.Rounded.Info,
                    )
                }
                Text(
                    text = slot.description,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    text = stringResource(Res.string.itinerary_open_in_maps),
                    style = MaterialTheme.typography.labelLarge,
                    color = SrColors.Primary,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun Badge(
    text: String,
    fill: Color,
    color: Color,
    icon: ImageVector?,
) {
    Row(
        modifier =
            Modifier
                .padding(top = 8.dp)
                .clip(SrShapes.Pill)
                .background(fill)
                .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(14.dp))
        Text(text = text, style = MaterialTheme.typography.labelSmall, color = color)
    }
}
