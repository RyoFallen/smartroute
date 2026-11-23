package com.smartroute.traveler.ui.explore

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.CityCatalog
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.CreateTripRequestDto
import com.smartroute.traveler.data.api.OptimizeRequestDto
import com.smartroute.traveler.data.api.RouteOptionDto
import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.domain.RouteLabel
import com.smartroute.traveler.ui.map.MapPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
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
        val preset: OptimizePreset,
        val coordinates: Map<String, MapPoint> = emptyMap(),
        val currency: String = "USD",
        /** A preset change is re-running the optimizer; selecting and saving wait for it. */
        val reloading: Boolean = false,
        val selectedIndex: Int? = null,
        val saving: Boolean = false,
        val saveFailed: Boolean = false,
        val savedTripId: String? = null,
    ) : ResultsUiState
}

/**
 * Runs the optimize request built by trip configuration, renders the route
 * options, and saves the selected one as a trip. `endDate` is computed as
 * `departDate + sum(CityStay for every city after the first)` — the first is
 * only flown out of (#34) — and the CityStay values
 * come from [request], keyed by city, not by the option's (possibly
 * reordered) visiting sequence.
 */
class ResultsViewModel(
    private val api: ApiClient,
    request: OptimizeRequestDto,
    private val cityCatalog: CityCatalog,
) : ViewModel() {
    private var request: OptimizeRequestDto = request
    private var optimizeJob: Job? = null

    private val _state = MutableStateFlow<ResultsUiState>(ResultsUiState.Loading)
    val state: StateFlow<ResultsUiState> = _state

    private val stayDaysByCity: Map<String, Int> = request.cities.zip(request.perCityDays).toMap()

    fun load() {
        _state.value = ResultsUiState.Loading
        optimizeJob?.cancel()
        optimizeJob =
            viewModelScope.launch {
                _state.value =
                    try {
                        val response = api.optimize(request)
                        ResultsUiState.Loaded(
                            options = response.options,
                            reason = response.reason,
                            preset = request.preset,
                            coordinates = cityCatalog.coordinates(),
                            currency = response.currency,
                            selectedIndex = recommendedIndex(response.options),
                        )
                    } catch (e: CancellationException) {
                        // A superseded run is cancelled on purpose; it must not report failure.
                        throw e
                    } catch (_: Exception) {
                        ResultsUiState.LoadFailed
                    }
            }
    }

    /**
     * Re-runs the optimizer for [preset] and drops the selection (the new Recommended
     * is preselected when the results arrive), since the
     * options it pointed at are gone. Ignored for the current preset and while a
     * save is in flight, so a trip is never saved against options that are being
     * replaced (or twice).
     */
    fun selectPreset(preset: OptimizePreset) {
        val loaded = _state.value as? ResultsUiState.Loaded ?: return
        if (preset == loaded.preset || loaded.saving) return
        request = request.copy(preset = preset)
        _state.value = loaded.copy(preset = preset, selectedIndex = null, saveFailed = false, reloading = true)
        optimizeJob?.cancel()
        optimizeJob =
            viewModelScope.launch {
                _state.value =
                    try {
                        val response = api.optimize(request)
                        loaded.copy(
                            options = response.options,
                            reason = response.reason,
                            preset = preset,
                            coordinates = cityCatalog.coordinates(),
                            currency = response.currency,
                            reloading = false,
                            selectedIndex = recommendedIndex(response.options),
                            saveFailed = false,
                        )
                    } catch (e: CancellationException) {
                        // A superseded run is cancelled on purpose; it must not report failure.
                        throw e
                    } catch (_: Exception) {
                        ResultsUiState.LoadFailed
                    }
            }
    }

    fun selectOption(index: Int) {
        withLoaded { if (it.reloading) it else it.copy(selectedIndex = index, saveFailed = false) }
    }

    fun save() {
        val loaded = _state.value as? ResultsUiState.Loaded ?: return
        val option = loaded.selectedIndex?.let { loaded.options.getOrNull(it) } ?: return
        if (loaded.saving || loaded.reloading) return
        _state.value = loaded.copy(saving = true, saveFailed = false)
        viewModelScope.launch {
            _state.value =
                try {
                    val trip = api.createTrip(tripRequestFor(option, loaded.currency))
                    loaded.copy(saving = false, savedTripId = trip.id)
                } catch (e: CancellationException) {
                    // A superseded run is cancelled on purpose; it must not report failure.
                    throw e
                } catch (_: Exception) {
                    loaded.copy(saving = false, saveFailed = true)
                }
        }
    }

    /** The Recommended option, else the first, so Save is usable as soon as results arrive. */
    private fun recommendedIndex(options: List<RouteOptionDto>): Int? =
        if (options.isEmpty()) null else options.indexOfFirst { it.label == RouteLabel.RECOMMENDED }.coerceAtLeast(0)

    private fun tripRequestFor(
        option: RouteOptionDto,
        currency: String,
    ): CreateTripRequestDto {
        // The first city is where the traveler flies out from and has no stay
        // (#34): the trip ends once the cities after it have had theirs.
        val totalStayDays = option.order.drop(1).sumOf { stayDaysByCity.getValue(it) }
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
            currency = currency,
        )
    }

    private inline fun withLoaded(update: (ResultsUiState.Loaded) -> ResultsUiState.Loaded) {
        val loaded = _state.value as? ResultsUiState.Loaded ?: return
        _state.value = update(loaded)
    }
}
