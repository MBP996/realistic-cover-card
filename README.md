# Realistic Cover Card for Home Assistant

A highly interactive and visually realistic cover card for Home Assistant. This custom card goes beyond standard state displays by offering fluid drag-and-drop controls, accurate 2-phase physics, and dynamic 3D rendering for garage doors, roller shutters, and venetian blinds.

![alt text](image.png)

## Key Features

* **Interactive Drag Control:** Directly manipulate your covers by dragging the visual representation up or down. The UI updates in real-time.
* **Realistic Physics:** 
  * *Roller Shutters:* Accurately renders ventilation gaps before lifting the main body.
  * *Venetian Blinds:* Simulates realistic slat rotation and calculates accurate stacking height when raised.
  * *Garage Doors:* Smooth sectional mechanics moving into the track.
* **Dynamic 3D Color Engine:** Select flat base colors in the editor, and the card automatically calculates realistic lighting, gradients, and shadows.
* **Full UI Editor:** Configurable entirely via the Home Assistant visual editor. No YAML knowledge required.
* **Multi-Language Support:** Automatically adapts to your Home Assistant UI language (Currently supports English and German).
* **Responsive Scaling:** Perfectly aligns and scales across different dashboard layouts and screen sizes.

## Installation

### Method 1: HACS (Recommended)
1. Open Home Assistant and navigate to **HACS**.
2. Click on the three dots in the top right corner and select **Custom repositories**.
3. Add the URL to this GitHub repository and select the category **Lovelace**.
4. Click **Add** and then download the "Realistic Cover Card".
5. Refresh your browser cache.

### Method 2: Manual
1. Download the `realistic-cover-card.js` file from the latest release.
2. Copy the file into your `<config>/www/` directory in Home Assistant.
3. Go to **Settings > Dashboards > 3 dots (top right) > Resources**.
4. Add a new resource with the URL `/local/realistic-cover-card.js` and set the resource type to **JavaScript Module**.

## Configuration

The card is fully supported by the visual UI editor. However, if you prefer YAML, here is a list of all available options:

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `type` | string | **Required** | `custom:my-custom-card` |
| `entity` | string | **Required** | Your cover entity (e.g., `cover.garage_door`) |
| `title` | string | Garage Door | Title displayed above the card |
| `cover_type` | string | `garage` | Defines the visual type: `garage`, `shutter`, or `blind` |
| `invert_position` | boolean | false | Inverts the position state (0% = Open instead of 100% = Open) |
| `invert_tilt` | boolean | false | Inverts the tilt state for venetian blinds |
| `show_status_text` | boolean | true | Displays the current text state (e.g., OPEN, CLOSED) |
| `show_main_buttons` | boolean | true | Shows the standard up/down control buttons |
| `show_vent_button` | boolean | false | Adds a dedicated ventilation button |
| `vent_percentage` | number | 8 | Target position when the vent button is pressed |
| `disable_drag` | boolean | false | Disables touch interaction on the graphic |
| `color_frame` | string | (Theme default) | Custom hex color for the window/door frame |
| `color_moving` | string | (Theme default) | Custom hex color for the moving parts |
| `use_3d_colors` | boolean | true | Toggles the dynamic 3D lighting calculation |
| `light_entity` | string | | Optional switch/light entity displayed as an icon in the header |
| `sensor_entity` | string | | Optional sensor displayed as a badge in the header |

### Example YAML

```yaml
type: custom:my-custom-card
title: Living Room Blind
entity: cover.living_room_blind
cover_type: blind
show_vent_button: true
vent_percentage: 15
use_3d_colors: true
color_frame: '#1e293b'
color_moving: '#475569'