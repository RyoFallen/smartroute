package com.smartroute.traveler.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.CityCatalog
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.ui.map.MapPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.todayIn

sealed interface HomeUiState {
    data object Loading : HomeUiState

    data object LoadFailed : HomeUiState

    data class Loaded(
        val content: HomeContent,
        // Empty when /cities failed; Home then just omits the map.
        val coordinates: Map<String, MapPoint>,
    ) : HomeUiState
}

class HomeViewModel(
    private val api: ApiClient,
    private val cityCatalog: CityCatalog,
    private val today: () -> LocalDate = { Clock.System.todayIn(TimeZone.currentSystemDefault()) },
) : ViewModel() {
    private val _state = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val state: StateFlow<HomeUiState> = _state

    fun load() {
        _state.value = HomeUiState.Loading
        viewModelScope.launch {
            _state.value =
                try {
                    val trips = api.getTrips()
                    HomeUiState.Loaded(homeContent(trips, today()), cityCatalog.coordinates())
                } catch (e: CancellationException) {
                    throw e
                } catch (
                    @Suppress("TooGenericExceptionCaught") _: Exception,
                ) {
                    HomeUiState.LoadFailed
                }
        }
    }
}
