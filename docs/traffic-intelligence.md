# Traffic intelligence (route map)

This pass keeps traffic status and incidents separate. An incident is not automatically a delay.

## Evidence order

1. Official travel-time / speed / congestion data
2. Official 511 closures and incidents
3. Live camera imagery as visual confirmation
4. Historical camera baselines (future only)

Ontario 511 events currently supply incidents. This pipeline does **not** ingest travel-time or speed. Camera stills are never used to claim speed, delay minutes, “heavier than normal,” or incident causation.

## What each source decides

| Question | Source today |
|---|---|
| How is my drive? | Official delay minutes if present; otherwise a mainline collision/closure in the travel direction; otherwise **Moving well** |
| What happened on the road? | Ontario 511 events in `data/traffic-surface.json` |
| Does a ramp affect through traffic? | Facility (`on-ramp` / `off-ramp` / mainline) + travel direction. Ramps default to **local access** |
| Camera congestion label | Only if official congestion is mapped to that camera. **Not used in v1** |

Preferred drive headlines: **Moving well**, **Some slowing**, **Heavy traffic**, **Major delay**.

Do not use **Normal** or **Heavier than normal** until a real same-camera / same-direction / same-hour / weekday-weekend baseline exists.

## Ramp relevance

A Burlington → Toronto driver already on the QEW does not need the Dorval Drive Toronto-bound **on-ramp**. That event stays on the map as a secondary line:

- Traffic: Moving well
- Incident: Toronto-bound on-ramp closed at Dorval Drive
- Impact: Local access affected

Opposite-direction events never become the route headline and are omitted from that route’s map.

## Camera sequence

Cameras are ordered by progress along the clipped Burlington → destination polyline, not API order. Pucks are numbered 1–6 in that physical order. Auto-rotation follows the same sequence.

Without official per-camera congestion, pucks stay blue (available) or grey (511 placeholder / failed image). Green / yellow / orange-red classes exist for a future official mapping.

## Future baseline (not built)

Store aggregate samples only, never faces, plates, or raw images unless licensing allows:

- cameraId
- timestamp
- weekday
- hourBucket
- densityScore
- availability
- incidentNearby

`data/traffic-estimates.json` is empty (`source: none`). `scripts/analyze_traffic_cameras.py` remains optional and off.
