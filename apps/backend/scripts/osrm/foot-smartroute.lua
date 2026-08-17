-- SmartRoute's pedestrian profile: OSRM's stock `foot` with ferries removed.
--
-- Why this exists. Verifying the Golden Horn barrier case turned up a worse
-- problem than the one it was looking for: the stock foot profile routed
-- Galata Tower -> Dolmabahçe Palace over "Uzun Boğaz Turu", a Bosphorus
-- sightseeing cruise, covering 3.7 km of the trip at 48 km/h. OSRM derives
-- ferry speed from the OSM `duration` tag, and on a tour route that tag
-- describes the cruise, not a crossing — so the number is not merely optimistic,
-- it is meaningless.
--
-- Two independent reasons to drop ferries rather than fix that speed:
--
--   * CONTEXT.md defines WalkingRoute as "the shortest pedestrian route" and a
--     VisitSlot's gap as "how long the walk from the previous slot took". A
--     boat is not a walk. An Itinerary that quietly puts the traveler on a ferry
--     is telling them something false about their day.
--   * It keeps the mock and OSRM providers the same *kind* of estimate. They
--     should differ in accuracy, not in which modes of transport they assume.
--
-- The cost is real and accepted: in a city like Istanbul a commuter ferry is
-- genuinely how a local crosses the water, so a few cross-Bosphorus pairs come
-- back longer than a resident would walk them. That is the conservative
-- direction to be wrong in — an Itinerary that over-books walking time leaves
-- slack, one that under-books it strands the traveler.
--
-- Written as a wrapper rather than a fork so the ~300 lines of stock profile
-- keep coming from the pinned image and only this one decision is ours.

local foot = require('foot')

local stock_setup = foot.setup

foot.setup = function()
  local profile = stock_setup()
  -- `route_speeds` is the only source of a speed for a `route=ferry` way. With
  -- it empty, WayHandlers.ferries assigns nothing, no later handler can supply
  -- a speed for a way that carries no `highway` tag, and the way is dropped
  -- from the graph.
  profile.route_speeds = {}
  return profile
end

return foot
