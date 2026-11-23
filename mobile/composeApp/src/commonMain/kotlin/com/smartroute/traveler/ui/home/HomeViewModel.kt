package com.smartroute.traveler.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.CityCatalog
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.ui.map.MapPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
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

    private var loadJob: Job? = null

    /**
     * First load shows [HomeUiState.Loading]; later loads (returning to the tab)
     * refresh in the background and keep the content on screen, so Home neither
     * blanks nor rebuilds its map. A failed background refresh keeps what it has.
     */
    fun load() {
        val hadContent = _state.value is HomeUiState.Loaded
        if (!hadContent) _state.value = HomeUiState.Loading
        loadJob?.cancel()
        loadJob =
            viewModelScope.launch {
                try {
                    val trips = api.getTrips()
                    _state.value = HomeUiState.Loaded(homeContent(trips, today()), cityCatalog.coordinates())
                } catch (e: CancellationException) {
                    throw e
                } catch (
                    @Suppress("TooGenericExceptionCaught") _: Exception,
                ) {
                    if (!hadContent) _state.value = HomeUiState.LoadFailed
                }
            }
    }
}
