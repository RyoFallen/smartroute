package com.smartroute.traveler.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.smartroute.traveler.AppGraph
import com.smartroute.traveler.data.api.OptimizeRequestDto
import com.smartroute.traveler.data.storage.AppLanguage
import com.smartroute.traveler.domain.OptimizePreset
import com.smartroute.traveler.ui.explore.ResultsScreen
import com.smartroute.traveler.ui.explore.ResultsViewModel
import com.smartroute.traveler.ui.explore.TripConfigScreen
import com.smartroute.traveler.ui.explore.TripConfigViewModel
import com.smartroute.traveler.ui.home.HomeScreen
import com.smartroute.traveler.ui.profile.DeleteAccountDialog
import com.smartroute.traveler.ui.profile.DeleteAccountUiState
import com.smartroute.traveler.ui.profile.DeleteAccountViewModel
import com.smartroute.traveler.ui.profile.InterestsScreen
import com.smartroute.traveler.ui.profile.InterestsViewModel
import com.smartroute.traveler.ui.profile.LanguageScreen
import com.smartroute.traveler.ui.profile.PreferencesScreen
import com.smartroute.traveler.ui.profile.PreferencesViewModel
import com.smartroute.traveler.ui.profile.ProfileScreen
import com.smartroute.traveler.ui.trips.TripDetailScreen
import com.smartroute.traveler.ui.trips.TripDetailViewModel
import com.smartroute.traveler.ui.trips.TripPlanScreen
import com.smartroute.traveler.ui.trips.TripPlanViewModel
import com.smartroute.traveler.ui.trips.TripsListScreen
import com.smartroute.traveler.ui.trips.TripsListViewModel
import kotlinx.serialization.Serializable
import org.jetbrains.compose.resources.StringResource
import org.jetbrains.compose.resources.stringResource
import smartroute_mobile.composeapp.generated.resources.Res
import smartroute_mobile.composeapp.generated.resources.tab_explore
import smartroute_mobile.composeapp.generated.resources.tab_home
import smartroute_mobile.composeapp.generated.resources.tab_my_trips
import smartroute_mobile.composeapp.generated.resources.tab_profile
import kotlin.reflect.KClass

@Serializable
object HomeRoute

@Serializable
object MyTripsRoute

@Serializable
object MyTripsListRoute

@Serializable
data class TripDetailRoute(
    val tripId: String,
)

@Serializable
data class TripPlanRoute(
    val tripId: String,
)

@Serializable
object ExploreRoute

@Serializable
object TripConfigRoute

@Serializable
data class ResultsRoute(
    val cities: List<String>,
    val perCityDays: List<Int>,
    val departDate: String,
    val directOnly: Boolean,
    val preset: OptimizePreset,
)

@Serializable
object ProfileGraphRoute

@Serializable
object ProfileRoute

@Serializable
object LanguageRoute

@Serializable
object PreferencesRoute

@Serializable
object InterestsRoute

private class TabItem(
    val route: Any,
    val routeClass: KClass<*>,
    val label: StringResource,
    val icon: ImageVector,
)

private val tabs =
    listOf(
        TabItem(HomeRoute, HomeRoute::class, Res.string.tab_home, Icons.Filled.Home),
        TabItem(MyTripsRoute, MyTripsRoute::class, Res.string.tab_my_trips, Icons.Filled.Place),
        TabItem(ExploreRoute, ExploreRoute::class, Res.string.tab_explore, Icons.Filled.Search),
        TabItem(ProfileGraphRoute, ProfileGraphRoute::class, Res.string.tab_profile, Icons.Filled.Person),
    )

@Composable
fun MainTabsScaffold(
    email: String?,
    language: AppLanguage?,
    onLanguageSelected: (AppLanguage) -> Unit,
    onSignOut: () -> Unit,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    val label = stringResource(tab.label)
                    NavigationBarItem(
                        selected =
                            currentDestination?.hierarchy?.any { it.hasRoute(tab.routeClass) } == true,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = label) },
                        label = { Text(label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = HomeRoute,
            modifier = Modifier.fillMaxSize().padding(innerPadding),
        ) {
            composable<HomeRoute> { HomeScreen() }
            navigation<MyTripsRoute>(startDestination = MyTripsListRoute) {
                composable<MyTripsListRoute> {
                    val tripsViewModel = viewModel { TripsListViewModel(AppGraph.apiClient) }
                    val tripsState by tripsViewModel.state.collectAsState()
                    LaunchedEffect(Unit) { tripsViewModel.load() }
                    TripsListScreen(
                        state = tripsState,
                        onTripClick = { tripId -> navController.navigate(TripDetailRoute(tripId)) },
                        onRetryLoad = tripsViewModel::load,
                    )
                }
                composable<TripDetailRoute> { backStackEntry ->
                    val route = backStackEntry.toRoute<TripDetailRoute>()
                    val detailViewModel =
                        viewModel { TripDetailViewModel(AppGraph.apiClient, route.tripId) }
                    val detailState by detailViewModel.state.collectAsState()
                    LaunchedEffect(route.tripId) { detailViewModel.load() }
                    TripDetailScreen(
                        state = detailState,
                        onRetryLoad = detailViewModel::load,
                        onPlanTripClick = { navController.navigate(TripPlanRoute(route.tripId)) },
                        onBack = { navController.popBackStack() },
                    )
                }
                composable<TripPlanRoute> { backStackEntry ->
                    val route = backStackEntry.toRoute<TripPlanRoute>()
                    val planViewModel = viewModel { TripPlanViewModel(AppGraph.apiClient, route.tripId) }
                    val planState by planViewModel.state.collectAsState()
                    LaunchedEffect(route.tripId) { planViewModel.load() }
                    TripPlanScreen(
                        state = planState,
                        onRetryLoad = planViewModel::load,
                        onBack = { navController.popBackStack() },
                    )
                }
            }
            navigation<ExploreRoute>(startDestination = TripConfigRoute) {
                composable<TripConfigRoute> {
                    val configViewModel = viewModel { TripConfigViewModel(AppGraph.apiClient) }
                    val configState by configViewModel.state.collectAsState()
                    LaunchedEffect(Unit) { configViewModel.load() }
                    TripConfigScreen(
                        state = configState,
                        onToggleCity = configViewModel::toggleCity,
                        onSetDays = configViewModel::setDays,
                        onSetPreset = configViewModel::setPreset,
                        onSetDirectOnly = configViewModel::setDirectOnly,
                        onSetDepartDate = configViewModel::setDepartDate,
                        onSubmit = {
                            configViewModel.buildRequest()?.let { request ->
                                navController.navigate(
                                    ResultsRoute(
                                        cities = request.cities,
                                        perCityDays = request.perCityDays,
                                        departDate = request.departDate,
                                        directOnly = request.directOnly,
                                        preset = request.preset,
                                    ),
                                )
                            }
                        },
                        onRetryLoad = configViewModel::load,
                    )
                }
                composable<ResultsRoute> { backStackEntry ->
                    val route = backStackEntry.toRoute<ResultsRoute>()
                    val request =
                        OptimizeRequestDto(
                            cities = route.cities,
                            departDate = route.departDate,
                            perCityDays = route.perCityDays,
                            travelers = OptimizeRequestDto.DEFAULT_TRAVELERS,
                            cabinClass = OptimizeRequestDto.DEFAULT_CABIN_CLASS,
                            directOnly = route.directOnly,
                            preset = route.preset,
                        )
                    val resultsViewModel = viewModel { ResultsViewModel(AppGraph.apiClient, request) }
                    val resultsState by resultsViewModel.state.collectAsState()
                    LaunchedEffect(request) { resultsViewModel.load() }
                    ResultsScreen(
                        state = resultsState,
                        onSelectOption = resultsViewModel::selectOption,
                        onSave = resultsViewModel::save,
                        onRetryLoad = resultsViewModel::load,
                        onSaved = { tripId ->
                            // Pop the whole Explore flow (config + results) so back-navigation
                            // from the new trip's detail doesn't return to a stale, already-saved
                            // Results screen — which would also re-fire this same save callback.
                            navController.navigate(TripDetailRoute(tripId)) {
                                popUpTo<ExploreRoute> { inclusive = true }
                            }
                        },
                        onBack = { navController.popBackStack() },
                    )
                }
            }
            navigation<ProfileGraphRoute>(startDestination = ProfileRoute) {
                composable<ProfileRoute> {
                    val deleteViewModel =
                        viewModel { DeleteAccountViewModel(AppGraph.apiClient, AppGraph.tokenStore) }
                    val deleteState by deleteViewModel.state.collectAsState()
                    ProfileScreen(
                        email = email,
                        onInterestsClick = { navController.navigate(InterestsRoute) },
                        onPreferencesClick = { navController.navigate(PreferencesRoute) },
                        onLanguageClick = { navController.navigate(LanguageRoute) },
                        onSignOut = onSignOut,
                        onDeleteAccountClick = deleteViewModel::requestDelete,
                    )
                    DeleteAccountDialog(
                        state = deleteState,
                        onConfirm = deleteViewModel::confirm,
                        onCancel = deleteViewModel::cancel,
                    )
                    if (deleteState is DeleteAccountUiState.Deleted) {
                        // Tokens are already cleared; this flips auth state to the sign-in screen.
                        LaunchedEffect(Unit) { onSignOut() }
                    }
                }
                composable<InterestsRoute> {
                    val viewModel = viewModel { InterestsViewModel(AppGraph.apiClient) }
                    val interestsState by viewModel.state.collectAsState()
                    LaunchedEffect(Unit) { viewModel.load() }
                    InterestsScreen(
                        state = interestsState,
                        onRate = viewModel::setRating,
                        onSave = viewModel::save,
                        onRetryLoad = viewModel::load,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable<PreferencesRoute> {
                    val viewModel = viewModel { PreferencesViewModel(AppGraph.apiClient) }
                    val prefState by viewModel.state.collectAsState()
                    LaunchedEffect(Unit) { viewModel.load() }
                    PreferencesScreen(
                        state = prefState,
                        onIntensityChange = viewModel::setIntensity,
                        onWakeUpTimeChange = viewModel::setWakeUpTime,
                        onSave = viewModel::save,
                        onRetryLoad = viewModel::load,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable<LanguageRoute> {
                    LanguageScreen(
                        selected = language,
                        onSelect = onLanguageSelected,
                        onBack = { navController.popBackStack() },
                    )
                }
            }
        }
    }
}
