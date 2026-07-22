package com.smartroute.traveler.ui.explore

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartroute.traveler.data.api.ApiClient
import com.smartroute.traveler.data.api.OptimizeRequestDto
import com.smartroute.traveler.data.api.RouteOptionDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed interface ResultsUiState {
    data object Loading : ResultsUiState

    data object LoadFailed : ResultsUiState

    /** An empty [options] with a non-null [reason] is "no viable route", not a load failure. */
    data class Loaded(
        val options: List<RouteOptionDto>,
        val reason: String?,
    ) : ResultsUiState
}

/** Runs the optimize request built by trip configuration and renders the route options. */
class ResultsViewModel(
    private val api: ApiClient,
    private val request: OptimizeRequestDto,
) : ViewModel() {
    private val _state = MutableStateFlow<ResultsUiState>(ResultsUiState.Loading)
    val state: StateFlow<ResultsUiState> = _state

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
}
