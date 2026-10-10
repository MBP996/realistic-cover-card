export interface ICardConfig {
  type: string;
  entity: string;
  title?: string;
  cover_type?: string;

  // --- NEU: Garagengröße & zweite Entität ---
  garage_mode?: 'single' | 'double' | 'split';
  entity_2?: string;

  // Neu: window, door, sliding
  cover_view?: string;

  // bestehende Einstellungen
  light_entity?: string;
  sensor_entity?: string;
  // ... (bestehende Felder)
  window_entity?: string; // NEU
  handle_side?: 'left' | 'right'; // NEU
  light_icon?: string;
  invert_position?: boolean;
  invert_tilt?: boolean;
  show_status_text?: boolean;
  show_main_buttons?: boolean;
  show_stop_button?: boolean;
  show_vent_button?: boolean;
  vent_percentage?: number;
  disable_drag?: boolean;
  color_frame?: string;
  color_moving?: string;
  color_window?: string;
  color_button?: string;
  use_3d_colors?: boolean;
  show_light_glow?: boolean;
}
