package com.smartroute.traveler.ui.explore

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.CitySummaryDto
import com.smartroute.traveler.data.api.OptimizeRequestDto
import com.smartroute.traveler.domain.OptimizePreset
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val MAX_CITIES = 8
private const val DEFAULT_STAY_DAYS = 2

/** One city the traveler has picked for this trip, with how long they'll stay. */
data class SelectedCity(
    val iata: String,
    val name: String,
    val days: Int,
)

sealed interface TripConfigUiState {
    data object Loading : TripConfigUiState

    data object LoadFailed : TripConfigUiState

    data class Ready(
        val cities: List<CitySummaryDto>,
        val selected: List<SelectedCity> = emptyList(),
        val preset: OptimizePreset = OptimizePreset.BALANCED,
        val directOnly: Boolean = false,
        val departDate: String = "",
    ) : TripConfigUiState
}

/**
 * Trip configuration: pick 2-8 curated cities, set per-city stay length,
 * an optimizer preset, direct-only, and a departure date. [buildRequest]
 * validates and returns the request to submit, or null if not ready yet.
 */
class TripConfigViewModel(
    private val api: ApiClient,
) : ViewModel() {
    private val _state = MutableStateFlow<TripConfigUiState>(TripConfigUiState.Loading)
    val state: StateFlow<TripConfigUiState> = _state

    fun load() {
        _state.value = TripConfigUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    TripConfigUiState.Ready(cities = api.getCities())
                } catch (_: Exception) {
                    TripConfigUiState.LoadFailed
                }
        }
    }

    fun toggleCity(city: CitySummaryDto) {
        withReady { ready ->
            val alreadySelected = ready.selected.any { it.iata == city.iata }
            val next =
                when {
                    alreadySelected -> ready.selected.filterNot { it.iata == city.iata }
                    ready.selected.size >= MAX_CITIES -> ready.selected
                    else -> ready.selected + SelectedCity(city.iata, city.name, DEFAULT_STAY_DAYS)
                }
            ready.copy(selected = next)
        }
    }

    fun setDays(
        iata: String,
        days: Int,
    ) {
        withReady { ready ->
            ready.copy(selected = ready.selected.map { if (it.iata == iata) it.copy(days = days) else it })
        }
    }

    fun setPreset(preset: OptimizePreset) {
        withReady { it.copy(preset = preset) }
    }

    fun setDirectOnly(directOnly: Boolean) {
        withReady { it.copy(directOnly = directOnly) }
    }

    fun setDepartDate(departDate: String) {
        withReady { it.copy(departDate = departDate) }
    }

    /** Null when the current selection can't be submitted yet (2-8 cities, a departure date). */
    fun buildRequest(): OptimizeRequestDto? {
        val ready = _state.value as? TripConfigUiState.Ready ?: return null
        if (ready.selected.size !in 2..MAX_CITIES) return null
        if (ready.departDate.isBlank()) return null
        return OptimizeRequestDto(
            cities = ready.selected.map { it.iata },
            departDate = ready.departDate,
            perCityDays = ready.selected.map { it.days },
            travelers = OptimizeRequestDto.DEFAULT_TRAVELERS,
            cabinClass = OptimizeRequestDto.DEFAULT_CABIN_CLASS,
            directOnly = ready.directOnly,
            preset = ready.preset,
        )
    }

    private inline fun withReady(update: (TripConfigUiState.Ready) -> TripConfigUiState.Ready) {
        val ready = _state.value as? TripConfigUiState.Ready ?: return
        _state.value = update(ready)
    }
}
