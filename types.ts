export interface ICardConfig {
    type: string;
    entity: string;
    title?: string;
    light_entity?: string;
    sensor_entity?: string;
    light_icon?: string;
    cover_type?: string;
    invert_position?: boolean;
    invert_tilt?: boolean;
    show_status_text?: boolean;
    show_main_buttons?: boolean;
    show_vent_button?: boolean;
    disable_drag?: boolean; 
    color_frame?: string;
    color_moving?: string;
    use_3d_colors?: boolean;
    vent_percentage?: number;
    color_window?: string;
    show_light_glow?: boolean;
    show_stop_button?: boolean;
    color_button?: string;
}
