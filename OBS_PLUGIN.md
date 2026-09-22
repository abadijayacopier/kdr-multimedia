# KDR Camera OBS Plugin

KDR Camera now includes a native OBS source integration under `obs-plugin/`.

The plugin exposes **KDR Camera** as an OBS source and internally uses the OBS Browser Source engine to render the existing KDR WebRTC receiver. This avoids duplicating the WebRTC stack while giving OBS users a dedicated source type.

Official OBS documentation confirms that native plugins can register custom sources through `obs_register_source()`, and the Browser Source plugin exposes the `browser_source` source type with URL, width, height and FPS settings. citeturn0search2turn2search0

Build requirements are documented in `obs-plugin/README.md`.
