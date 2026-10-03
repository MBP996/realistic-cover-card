import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant } from "../ha-types";
import { ICardConfig } from "../types";

const editorTranslations: Record<string, Record<string, string>> = {
    en: {
        title: "Title (Heading)",
        entity: "Main Entity (cover.*)",
        invert_pos: "Invert position (0% = Open)",
        invert_tilt: "Invert tilt",
        cover_type: "Cover Type",
        garage: "Garage Door",
        shutter: "Roller Shutter",
        blind: "Venetian Blind",
        light: "Light / Switch (Optional)",
        light_icon: "Light Icon (Default: mdi:lightbulb)",
        sensor: "Sensor / Contact (Optional)",
        show_status: "Show status text",
        show_main: "Show main buttons (Up/Stop/Down)",
        show_stop: "Show stop button",
        show_vent: "Show vent button",
        vent_pos: "Vent position",
        disable_drag: "Disable drag control (Scroll/Buttons only)",
        colors: "Colors (Flat Design)",
        frame: "Frame",
        moving: "Moving part",
        window_bg: "Window Background",
        button_bg: "Button Background",
        reset: "Reset",
        auto_sun: "Auto (Sun)",
        use_3d: "Use 3D effect (Shadows)",
        light_glow: "Show room light reflection on window"
    },
    de: {
        title: "Titel (Überschrift)",
        entity: "Haupt-Entität (cover.*)",
        invert_pos: "Behanghöhe invertieren (0% = Offen)",
        invert_tilt: "Neigung invertieren",
        cover_type: "Art der Abdeckung",
        garage: "Garagentor",
        shutter: "Rollladen",
        blind: "Raffstore",
        light: "Licht / Schalter (Optional)",
        light_icon: "Licht Icon (Standard: mdi:lightbulb)",
        sensor: "Sensor / Kontakt (Optional)",
        show_status: "Status-Text anzeigen",
        show_main: "Haupt-Buttons (Auf/Zu) anzeigen",
        show_stop: "Stop-Button anzeigen",
        show_vent: "Lüften-Button anzeigen",
        vent_pos: "Lüftungs-Position",
        disable_drag: "Drag-Steuerung deaktivieren (nur Scrollen/Buttons)",
        colors: "Farben (Flat-Design)",
        frame: "Rahmen",
        moving: "Behang",
        window_bg: "Fenster-Hintergrund",
        button_bg: "Button-Hintergrund",
        reset: "Standard",
        auto_sun: "Auto (Sonne)",
        use_3d: "3D-Effekt (Schatten) verwenden",
        light_glow: "Raumlicht-Spiegelung (Glow) anzeigen"
    }
};

@customElement("realistic-cover-card-editor")
export class MyCustomCardEditor extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;
    @state() private _config!: ICardConfig;

    private localize(stringKey: string): string {
        const lang = this.hass?.language || 'en';
        if (editorTranslations[lang] && editorTranslations[lang][stringKey]) {
            return editorTranslations[lang][stringKey];
        }
        return editorTranslations['en'][stringKey] || stringKey;
    }

    public setConfig(config: ICardConfig): void {
        this._config = config;
    }

    private _valueChanged(ev: any): void {
        if (!this._config || !this.hass) return;
        const target = ev.target;
        const configKey = target.configValue as keyof ICardConfig;
        
        const newValue = target.tagName === 'HA-SWITCH' ? target.checked : target.value;

        if (this._config[configKey] === newValue) return;

        if (configKey) {
            this._config = {
                ...this._config,
                [configKey]: newValue,
            };
        }

        this.dispatchEvent(new CustomEvent("config-changed", {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
        }));
    }

    private _colorChanged(key: string, value: string): void {
        if ((this._config as any)[key] !== value) {
            const newConfig = { ...this._config } as any;
            
            if (value === "") {
                delete newConfig[key];
            } else {
                newConfig[key] = value;
            }
            
            this._config = newConfig;
            this.dispatchEvent(new CustomEvent("config-changed", { 
                detail: { config: this._config }, 
                bubbles: true, 
                composed: true 
            }));
            this.requestUpdate();
        }
    }

    render(): TemplateResult {
        if (!this.hass || !this._config) return html``;

        return html`
            <div class="card-config">

                <ha-selector
                    .hass=${this.hass}
                    .selector=${{ text: {} }}
                    .value=${this._config.title || ""}
                    .label=${this.localize('title')}
                    @value-changed=${(ev: any) => {
                        const val = ev.detail.value;
                        if (this._config.title !== val) {
                            this._config = { ...this._config, title: val };
                            this.dispatchEvent(new CustomEvent("config-changed", { 
                                detail: { config: this._config }, 
                                bubbles: true, 
                                composed: true 
                            }));
                        }
                    }}
                ></ha-selector>

                <ha-entity-picker
                    label="${this.localize('entity')}"
                    .hass=${this.hass}
                    .value=${this._config.entity}
                    .configValue=${"entity"}
                    include-domains='["cover"]'
                    @value-changed=${this._valueChanged}
                    allow-custom-entity
                ></ha-entity-picker>

                <ha-formfield label="${this.localize('invert_pos')}">
                    <ha-switch
                        .checked=${this._config.invert_position === true}
                        .configValue=${"invert_position"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <ha-formfield label="${this.localize('invert_tilt')}">
                    <ha-switch
                        .checked=${this._config.invert_tilt === true}
                        .configValue=${"invert_tilt"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <ha-selector
                    .hass=${this.hass}
                    .selector=${{
                        select: {
                            mode: "dropdown",
                            options: [
                                { value: "garage", label: this.localize('garage') },
                                { value: "shutter", label: this.localize('shutter') },
                                { value: "blind", label: this.localize('blind') }
                            ]
                        }
                    }}
                    .value=${this._config.cover_type || "garage"}
                    .label=${this.localize('cover_type')}
                    @value-changed=${(ev: any) => {
                        const newValue = ev.detail.value;
                        if (newValue && this._config.cover_type !== newValue) {
                            this._config = { ...this._config, cover_type: newValue };
                            this.dispatchEvent(new CustomEvent("config-changed", { 
                                detail: { config: this._config }, 
                                bubbles: true, 
                                composed: true 
                            }));
                        }
                    }}
                ></ha-selector>

                <ha-entity-picker
                    label="${this.localize('light')}"
                    .hass=${this.hass}
                    .value=${this._config.light_entity || ""}
                    .configValue=${"light_entity"}
                    include-domains='["light", "switch"]'
                    @value-changed=${this._valueChanged}
                    allow-custom-entity
                ></ha-entity-picker>

                ${this._config.light_entity ? html`
                    <div style="margin-top: 4px; margin-bottom: 8px; padding-left: 12px; border-left: 2px solid #eab308;">
                        <ha-formfield label="${this.localize('light_glow')}">
                            <ha-switch
                                .checked=${this._config.show_light_glow !== false}
                                .configValue=${"show_light_glow"}
                                @change=${this._valueChanged}
                            ></ha-switch>
                        </ha-formfield>
                    </div>
                ` : ""}

                <ha-icon-picker
                    label="${this.localize('light_icon')}"
                    .value=${this._config.light_icon || "mdi:lightbulb"}
                    .configValue=${"light_icon"}
                    @value-changed=${this._valueChanged}
                ></ha-icon-picker>

                <ha-entity-picker
                    label="${this.localize('sensor')}"
                    .hass=${this.hass}
                    .value=${this._config.sensor_entity || ""}
                    .configValue=${"sensor_entity"}
                    include-domains='["sensor", "binary_sensor"]'
                    @value-changed=${this._valueChanged}
                    allow-custom-entity
                ></ha-entity-picker>

                <ha-formfield label="${this.localize('show_status')}">
                    <ha-switch
                        .checked=${this._config.show_status_text !== false}
                        .configValue=${"show_status_text"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <ha-formfield label="${this.localize('show_main')}">
                    <ha-switch
                        .checked=${this._config.show_main_buttons !== false}
                        .configValue=${"show_main_buttons"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <ha-formfield label="${this.localize('show_stop')}">
                    <ha-switch
                        .checked=${this._config.show_stop_button !== false}
                        .configValue=${"show_stop_button"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <ha-formfield label="${this.localize('show_vent')}">
                    <ha-switch
                        .checked=${this._config.show_vent_button === true}
                        .configValue=${"show_vent_button"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                ${this._config.show_vent_button === true ? html`
                    <div style="margin-top: 8px; margin-bottom: 16px; padding-left: 12px; border-left: 2px solid var(--primary-color);">
                        <ha-selector
                            .hass=${this.hass}
                            .selector=${{
                                number: {
                                    min: 1,
                                    max: 99,
                                    mode: "box",
                                    unit_of_measurement: "%"
                                }
                            }}
                            .value=${this._config.vent_percentage !== undefined ? this._config.vent_percentage : 8}
                            .label=${this.localize('vent_pos')}
                            @value-changed=${(ev: any) => {
                                const val = ev.detail.value;
                                if (val !== undefined && this._config.vent_percentage !== val) {
                                    this._config = { ...this._config, vent_percentage: Number(val) };
                                    this.dispatchEvent(new CustomEvent("config-changed", { 
                                        detail: { config: this._config }, 
                                        bubbles: true, 
                                        composed: true 
                                    }));
                                }
                            }}
                        ></ha-selector>
                    </div>
                ` : ""}

                <ha-formfield label="${this.localize('disable_drag')}">
                    <ha-switch
                        .checked=${this._config.disable_drag === true}
                        .configValue=${"disable_drag"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

                <div style="margin-top: 24px; margin-bottom: 8px;">
                    <div style="color: var(--secondary-text-color); font-size: 12px; margin-bottom: 8px;">${this.localize('colors')}</div>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        
                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_frame || "#1e293b"}
                                   @input=${(ev: any) => this._colorChanged("color_frame", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('frame')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_frame", "")}>${this.localize('reset')}</span>
                            </div>
                        </div>
                        
                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_moving || "#475569"}
                                   @input=${(ev: any) => this._colorChanged("color_moving", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('moving')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_moving", "")}>${this.localize('reset')}</span>
                            </div>
                        </div>

                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_window || "#87CEEB"}
                                   @input=${(ev: any) => this._colorChanged("color_window", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('window_bg')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_window", "")}>${this.localize('auto_sun')}</span>
                            </div>
                        </div>

                        <!-- NEU: Button-Farbe -->
                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_button || "#1e293b"}
                                   @input=${(ev: any) => this._colorChanged("color_button", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('button_bg')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_button", "")}>${this.localize('reset')}</span>
                            </div>
                        </div>

                    </div>
                </div>

                <ha-formfield label="${this.localize('use_3d')}">
                    <ha-switch
                        .checked=${this._config.use_3d_colors !== false}
                        .configValue=${"use_3d_colors"}
                        @change=${this._valueChanged}
                    ></ha-switch>
                </ha-formfield>

            </div>
        `;
    }

    static styles = css`
        .card-config {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
    `;
}