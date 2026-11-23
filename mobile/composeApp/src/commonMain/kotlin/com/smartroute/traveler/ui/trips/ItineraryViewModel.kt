package com.smartroute.traveler.ui.trips

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.ItineraryCityDto
import com.smartroute.traveler.data.api.ItineraryDayDto
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface ItineraryUiState {
    data object Loading : ItineraryUiState

    data object LoadFailed : ItineraryUiState

    data class Loaded(
        val cities: List<ItineraryCityDto>,
        val tabs: List<DayTab> = dayTabs(cities),
        val selectedTab: Int = 0,
    ) : ItineraryUiState
}

/**
 * One pill of the day selector. Days are numbered across the whole trip, because
 * a trip spans several cities. `day == null` marks a city without a guide.
 */
data class DayTab(
    val number: Int,
    val cityName: String?,
    val iata: String,
    val day: ItineraryDayDto?,
)

/** One tab per day across all cities in visiting order; an unavailable city gets one empty tab. */
fun dayTabs(cities: List<ItineraryCityDto>): List<DayTab> {
    var number = 0
    return cities.flatMap { city ->
        if (!city.available) {
            listOf(DayTab(++number, city.name, city.iata, null))
        } else {
            city.days.map { DayTab(++number, city.name, city.iata, it) }
        }
    }
}

/** A trip's day-by-day Itinerary: loads via GET /trips/:id/itinerary. */
class ItineraryViewModel(
    private val api: ApiClient,
    private val tripId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<ItineraryUiState>(ItineraryUiState.Loading)
    val state: StateFlow<ItineraryUiState> = _state

    fun load() {
        // A reload (e.g. the route re-entering composition) keeps the day the traveler was on.
        val previousTab = (_state.value as? ItineraryUiState.Loaded)?.selectedTab ?: 0
        _state.value = ItineraryUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    val cities = api.getTripItinerary(tripId).cities
                    val tabs = dayTabs(cities)
                    ItineraryUiState.Loaded(
                        cities = cities,
                        tabs = tabs,
                        selectedTab = previousTab.coerceIn(0, maxOf(tabs.lastIndex, 0)),
                    )
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    ItineraryUiState.LoadFailed
                }
        }
    }

    fun selectTab(index: Int) {
        val current = _state.value as? ItineraryUiState.Loaded ?: return
        if (index in current.tabs.indices) _state.value = current.copy(selectedTab = index)
    }
}
