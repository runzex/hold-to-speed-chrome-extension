# Video Speed Controller (Chrome Extension)

Control HTML5 video playback speed with keyboard shortcuts, including a hold-to-boost key for temporary speed-up.

## Features

- Hold a key to temporarily boost playback speed.
- Increase/decrease playback speed with dedicated keys.
- Toggle playback speed between `1x` and previous speed with a key.
- Seek backward/forward with dedicated keys.
- Draggable on-video HUD showing current playback rate.
- Popup UI to configure keys, boost speed, speed step, and seek step.
- Reset all settings to defaults from the popup.
- Saves settings in `chrome.storage.sync`.

## Default Shortcuts

- Hold boost: `Backslash`
- Increase speed: `BracketRight` (`]`)
- Decrease speed: `BracketLeft` (`[`)
- Toggle 1x/previous: `Backquote` (`` ` ``)
- Seek backward: `Comma` (`,`)
- Seek forward: `Period` (`.`)

## Default Values

- Boost speed: `3.0`
- Speed step: `0.25`
- Seek step: `5` seconds

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/USER_NAME/Desktop/video_speed_controller`.

## Usage

1. Open any page with an HTML5 video.
2. Use the configured keys to control speed.
3. Click the extension icon to open settings.
4. In the popup:
   - Click **Set key** and press a key to capture a shortcut.
   - Set **Boost speed**, **Increase/decrease step**, and **Seek step (seconds)**.
   - Click **Save settings**.
   - Use **Reset to default settings** to restore all defaults.

## Validate Before Reloading

Run:

```bash
./scripts/validate.sh
```

This checks:
- JavaScript syntax
- `manifest.json` validity
- unresolved merge conflict markers

## HUD Notes

- The HUD displays the current playback rate.
- You can drag it to reposition it over the video.
- Position is saved and reused.

## Project Files

- `video_speed_controller/manifest.json` - Extension manifest
- `video_speed_controller/constants.js` - Shared default settings
- `video_speed_controller/content.js` - Video control + keyboard + HUD logic
- `video_speed_controller/content.css` - HUD styles
- `video_speed_controller/popup.html` - Popup UI
- `video_speed_controller/popup.js` - Popup behavior/settings
- `video_speed_controller/scripts/validate.sh` - Local validation script

## Troubleshooting

- If shortcuts do not work, make sure the page has an HTML5 `<video>` element.
- If key capture does not update, click a **Set key** button again and press the key once.
- If the popup shows old errors, reload the extension in `chrome://extensions` and reopen the popup.
