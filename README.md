# Video Speed Controller (Chrome Extension)

Control HTML5 video playback speed with keyboard shortcuts, including a hold-to-boost key for temporary speed-up.

## Features

- Hold a key to temporarily boost playback speed.
- Increase/decrease playback speed with dedicated keys.
- Reset playback speed to `1x` with a key.
- Draggable on-video HUD showing current playback rate.
- Popup UI to configure keys, boost speed, and speed step.
- Saves settings in `chrome.storage.sync`.

## Default Shortcuts

- Hold boost: `Backslash`
- Increase speed: `BracketRight` (`]`)
- Decrease speed: `BracketLeft` (`[`)
- Reset to 1x: `Backquote` (`` ` ``)

## Default Values

- Boost speed: `3.0`
- Speed step: `0.25`

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
   - Set **Boost speed** and **Increase/decrease step**.
   - Click **Save settings**.
   - Use **Reset active video to 1x** to reset the current tab's video immediately.

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

## Troubleshooting

- If shortcuts do not work, make sure the page has an HTML5 `<video>` element.
- If key capture does not update, click a **Set key** button again and press the key once.
- If reset from popup fails, open a tab containing a video and try again.
