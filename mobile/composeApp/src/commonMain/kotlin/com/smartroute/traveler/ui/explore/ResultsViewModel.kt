package com.smartroute.traveler.ui.explore

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.CreateTripRequestDto
import com.smartroute.traveler.data.api.OptimizeRequestDto
import com.smartroute.traveler.data.api.RouteOptionDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus

sealed interface ResultsUiState {
    data object Loading : ResultsUiState

    data object LoadFailed : ResultsUiState

    /** An empty [options] with a non-null [reason] is "no viable route", not a load failure. */
    data class Loaded(
        val options: List<RouteOptionDto>,
        val reason: String?,
        val selectedIndex: Int? = null,
        val saving: Boolean = false,
        val saveFailed: Boolean = false,
        val savedTripId: String? = null,
    ) : ResultsUiState
}

/**
 * Runs the optimize request built by trip configuration, renders the route
 * options, and saves the selected one as a trip. `endDate` is computed as
 * `departDate + sum(CityStay for the selected order)` — the CityStay values
 * come from [request], keyed by city, not by the option's (possibly
 * reordered) visiting sequence.
 */
class ResultsViewModel(
    private val api: ApiClient,
    private val request: OptimizeRequestDto,
) : ViewModel() {
    private val _state = MutableStateFlow<ResultsUiState>(ResultsUiState.Loading)
    val state: StateFlow<ResultsUiState> = _state

    private val stayDaysByCity: Map<String, Int> = request.cities.zip(request.perCityDays).toMap()

    fun load() {
        _state.value = ResultsUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    val response = api.optimize(request)
                    ResultsUiState.Loaded(response.options, response.reason)
                } catch (_: Exception) {
                    ResultsUiState.LoadFailed
                }
        }
    }

    fun selectOption(index: Int) {
        withLoaded { it.copy(selectedIndex = index, saveFailed = false) }
    }

    fun save() {
        val loaded = _state.value as? ResultsUiState.Loaded ?: return
        val option = loaded.selectedIndex?.let { loaded.options.getOrNull(it) } ?: return
        if (loaded.saving) return
        _state.value = loaded.copy(saving = true, saveFailed = false)
        viewModelScope.launch {
            _state.value =
                try {
                    val trip = api.createTrip(tripRequestFor(option))
                    loaded.copy(saving = false, savedTripId = trip.id)
                } catch (_: Exception) {
                    loaded.copy(saving = false, saveFailed = true)
                }
        }
    }

    private fun tripRequestFor(option: RouteOptionDto): CreateTripRequestDto {
        val totalStayDays = option.order.sumOf { stayDaysByCity.getValue(it) }
        val endDate = LocalDate.parse(request.departDate).plus(DatePeriod(days = totalStayDays))
        return CreateTripRequestDto(
            name = option.order.joinToString(" → "),
            startDate = request.departDate,
            endDate = endDate.toString(),
            cabinClass = request.cabinClass,
            travelers = request.travelers,
            cities = option.order,
            flights = option.flights,
            totalPriceCents = option.totalPriceCents,
        )
    }

    private inline fun withLoaded(update: (ResultsUiState.Loaded) -> ResultsUiState.Loaded) {
        val loaded = _state.value as? ResultsUiState.Loaded ?: return
        _state.value = update(loaded)
    }
}
