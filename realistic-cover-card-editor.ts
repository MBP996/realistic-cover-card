import { HomeAssistant } from "../ha-types";
import { html, css, LitElement, CSSResultGroup, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ICardConfig } from "../types";

// --- ÜBERSETZUNGSDICTIONARY FÜR DEN EDITOR ---
const editorTranslations: Record<string, Record<string, string>> = {
    en: {
        title: "Title",
        entity: "Cover Entity",
        cover_type: "Cover Type",
        garage: "Garage Door",
        shutter: "Roller Shutter",
        blind: "Venetian Blind (Raffstore)",
        cover_view: "Display Format / View",
        view_window: "Window (Standard)",
        view_door: "Balcony Door (Floor-to-ceiling)",
        view_sliding: "Sliding Door (Wide)",
        garage_mode: "Garage Size / Mode",
        single_garage: "Single Garage (Standard)",
        double_garage: "Double Garage (1 Entity / Wide Door)",
        split_garage: "Split Garage (2 Entities / Side by Side)",
        entity_left: "First Garage Door (Left)",
        entity_right: "Second Garage Door (Right)",
        light_entity: "Light Entity (Optional)",
        sensor_entity: "Sensor Entity (Optional)",
        light_icon: "Light Icon (e.g. mdi:lightbulb)",
        invert_position: "Invert Position (0% = Open)",
        invert_tilt: "Invert Slat Tilt",
        show_status_text: "Show Status Text",
        show_main_buttons: "Show Main Controls (Up / Down)",
        show_stop_button: "Show Stop Button",
        show_vent_button: "Show Ventilation Button",
        vent_percentage: "Ventilation Position (%)",
        disable_drag: "Disable Touch Dragging",
        use_3d_colors: "Enable 3D Color Shading",
        show_light_glow: "Show Room Light Glow Effect",
        color_frame: "Frame Color",
        color_moving: "Door / Slat Color",
        color_window: "Window / Sky Background Color",
        color_button: "Button Color",
        appearance: "Appearance & Options",
        colors: "Custom Colors",
        window_sensor: "Window Animation Sensor (Optional)",
        handle_side: "Handle Position",
        left: "Left",
        right: "Right",
    },
    de: {
        title: "Titel",
        entity: "Cover-Entität",
        cover_type: "Abdeckungstyp",
        garage: "Garagentor",
        shutter: "Rollladen",
        blind: "Raffstore (Jalousie)",
        cover_view: "Ansicht / Format",
        view_window: "Fenster (Standard)",
        view_door: "Balkontür (Bodentief)",
        view_sliding: "Schiebetür (Breit)",
        garage_mode: "Garagengröße / Modus",
        single_garage: "Einzelgarage (Standard)",
        double_garage: "Doppelgarage (1 Entität / Breites Tor)",
        split_garage: "Splitgarage (2 Entitäten / Nebeneinander)",
        entity_left: "Erstes Garagentor (Links)",
        entity_right: "Zweites Garagentor (Rechts)",
        light_entity: "Licht-Entität (Optional)",
        sensor_entity: "Sensor-Entität (Optional)",
        light_icon: "Licht-Icon (z.B. mdi:lightbulb)",
        invert_position: "Position invertieren (0% = Offen)",
        invert_tilt: "Lamellenneigung invertieren",
        show_status_text: "Statustext anzeigen",
        show_main_buttons: "Haupttasten anzeigen (Auf / Zu)",
        show_stop_button: "Stopp-Taste anzeigen",
        show_vent_button: "Lüftungstaste anzeigen",
        vent_percentage: "Lüftungsposition (%)",
        disable_drag: "Ziehen per Touch/Maus deaktivieren",
        use_3d_colors: "3D-Farbverläufe aktivieren",
        show_light_glow: "Raumlicht-Schein anzeigen",
        color_frame: "Rahmenfarbe",
        color_moving: "Tor- / Lamellenfarbe",
        color_window: "Fenster- / Hintergrundfarbe",
        color_button: "Buttonfarbe",
        appearance: "Erscheinungsbild & Optionen",
        colors: "Eigene Farben",
        window_sensor: "Fenster-Animation Sensor (Optional)",
        handle_side: "Fenster-/Türgriff Position",
        left: "Links",
        right: "Rechts",
    }
};

@customElement("realistic-cover-card-editor")
export class RealisticCoverCardEditor extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;
    @state() private _config!: ICardConfig;

    public setConfig(config: ICardConfig): void {
        this._config = { ...config };
    }

    private localize(key: string): string {
        const lang = this.hass?.language || "de";
        if (editorTranslations[lang] && editorTranslations[lang][key]) {
            return editorTranslations[lang][key];
        }
        return editorTranslations["de"][key] || key;
    }

    private _valueChanged(ev: any): void {
        if (!this._config || !this.hass) return;
        const target = ev.target;
        const configKey = target.configValue as keyof ICardConfig;
        
        const newValue = target.tagName === 'HA-SWITCH' ? target.checked : target.value;

        if (this._config[configKey] === newValue) return;

        if (configKey) {
            const newConfig = { ...this._config } as any;
            // KORREKTUR: Leere Werte (wie gelöschte Sensoren) sauber entfernen
            if (newValue === "" || newValue === undefined || newValue === null) {
                delete newConfig[configKey];
            } else {
                newConfig[configKey] = newValue;
            }
            this._config = newConfig;
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

    private _handleSelectorChange(configKey: string, value: any): void {
        if (!this._config) return;
        this._config = {
            ...this._config,
            [configKey]: value
        };
        this._fireConfigChanged();
    }

    private _handleToggleChange(configKey: string, checked: boolean): void {
        if (!this._config) return;
        this._config = {
            ...this._config,
            [configKey]: checked
        };
        this._fireConfigChanged();
    }

    private _fireConfigChanged(): void {
        const event = new CustomEvent("config-changed", {
            detail: { config: this._config },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    static get styles(): CSSResultGroup {
        return css`
            .card-config {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 8px 0;
            }
            .section-title {
                font-weight: bold;
                font-size: 1.05rem;
                color: var(--primary-text-color);
                margin-top: 8px;
                padding-bottom: 4px;
                border-bottom: 1px solid var(--divider-color, #e2e8f0);
            }
            .sub-section {
                padding-left: 12px;
                border-left: 3px solid var(--primary-color, #3b82f6);
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-top: 4px;
            }
            .formfield-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            ha-textfield, ha-entity-picker, ha-selector {
                width: 100%;
            }
            .color-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 12px;
            }
            .color-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 0.85rem;
                color: var(--secondary-text-color);
            }
            .color-input-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            input[type="color"] {
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 6px;
                cursor: pointer;
                background: none;
            }
        `;
    }

    protected render(): TemplateResult {
        if (!this.hass || !this._config) {
            return html``;
        }

        const coverType = this._config.cover_type || "garage";
        const coverView = this._config.cover_view || "window";
        const garageMode = this._config.garage_mode || "single";

        return html`
            <div class="card-config">
                <!-- TITEL -->
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

                <!-- ABDECKUNGSTYP -->
                <ha-selector
                    .hass="${this.hass}"
                    .selector="${{
                        select: {
                            mode: "dropdown",
                            options: [
                                { value: "garage", label: this.localize('garage') },
                                { value: "shutter", label: this.localize('shutter') },
                                { value: "blind", label: this.localize('blind') }
                            ]
                        }
                    }}"
                    .value="${coverType}"
                    .label="${this.localize('cover_type')}"
                    @value-changed="${(ev: CustomEvent) => this._handleSelectorChange('cover_type', ev.detail.value)}"
                ></ha-selector>

                <!-- NEU: ANSICHT / FORMAT (Nur bei Rollladen & Raffstore) -->
                ${(coverType === 'shutter' || coverType === 'blind') ? html`
                    <div class="sub-section">
                        <ha-selector
                            .hass="${this.hass}"
                            .selector="${{
                                select: {
                                    mode: "dropdown",
                                    options: [
                                        { value: "window", label: this.localize('view_window') },
                                        { value: "door", label: this.localize('view_door') },
                                        { value: "sliding", label: this.localize('view_sliding') }
                                    ]
                                }
                            }}"
                            .value="${coverView}"
                            .label="${this.localize('cover_view')}"
                            @value-changed="${(ev: CustomEvent) => this._handleSelectorChange('cover_view', ev.detail.value)}"
                        ></ha-selector>
                    </div>
                ` : ''}

                <!-- HAUPT-ENTITÄT (Bezeichnung passt sich im Splitgarage-Modus an) -->
                <ha-entity-picker
                    label="${coverType === 'garage' && garageMode === 'split' ? this.localize('entity_left') : this.localize('entity')}"
                    .hass="${this.hass}"
                    .value="${this._config.entity || ''}"
                    configValue="entity"
                    include-domains='["cover"]'
                    @value-changed="${this._valueChanged}"
                    allow-custom-entity
                ></ha-entity-picker>

                <!-- GARAGEN-SPEZIFISCHE EINSTELLUNGEN -->
                ${coverType === 'garage' ? html`
                    <ha-selector
                        .hass="${this.hass}"
                        .selector="${{
                            select: {
                                mode: "dropdown",
                                options: [
                                    { value: "single", label: this.localize('single_garage') },
                                    { value: "double", label: this.localize('double_garage') },
                                    { value: "split", label: this.localize('split_garage') }
                                ]
                            }
                        }}"
                        .value="${garageMode}"
                        .label="${this.localize('garage_mode')}"
                        @value-changed="${(ev: CustomEvent) => this._handleSelectorChange('garage_mode', ev.detail.value)}"
                    ></ha-selector>

                    <!-- ZWEITE ENTITÄT BEI SPLITGARAGE -->
                    ${garageMode === 'split' ? html`
                        <div class="sub-section">
                            <ha-entity-picker
                                label="${this.localize('entity_right')}"
                                .hass="${this.hass}"
                                .value="${this._config.entity_2 || ''}"
                                configValue="entity_2"
                                include-domains='["cover"]'
                                @value-changed="${this._valueChanged}"
                                allow-custom-entity
                            ></ha-entity-picker>
                        </div>
                    ` : ''}
                ` : ''}
                
                <div class="formfield-row">
                    <label>${this.localize('invert_position')}</label>
                    <ha-switch
                        .checked="${this._config.invert_position === true}"
                        @change="${(ev: Event) => this._handleToggleChange('invert_position', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                ${coverType === 'blind' ? html`
                    <div class="formfield-row">
                        <label>${this.localize('invert_tilt')}</label>
                        <ha-switch
                            .checked="${this._config.invert_tilt === true}"
                            @change="${(ev: Event) => this._handleToggleChange('invert_tilt', (ev.target as HTMLInputElement).checked)}"
                        ></ha-switch>
                    </div>
                ` : ''}

                <!-- ZUSATZENTITÄTEN -->
                <ha-entity-picker
                    label="${this.localize('light_entity')}"
                    .hass="${this.hass}"
                    .value="${this._config.light_entity || ''}"
                    configValue="light_entity"
                    include-domains='["light", "switch"]'
                    @value-changed="${this._valueChanged}"
                    allow-custom-entity
                ></ha-entity-picker>

                ${this._config.light_entity ? html`
                    <ha-textfield
                        label="${this.localize('light_icon')}"
                        .value="${this._config.light_icon || 'mdi:lightbulb'}"
                        configValue="light_icon"
                        @input="${this._valueChanged}"
                    ></ha-textfield>
                ` : ''}

                <div class="formfield-row">
                    <label>${this.localize('show_light_glow')}</label>
                    <ha-switch
                        .checked="${this._config.show_light_glow !== false}"
                        @change="${(ev: Event) => this._handleToggleChange('show_light_glow', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                <ha-entity-picker
                    label="${this.localize('sensor_entity')}"
                    .hass="${this.hass}"
                    .value="${this._config.sensor_entity || ''}"
                    configValue="sensor_entity"
                    include-domains='["binary_sensor", "sensor"]'
                    @value-changed="${this._valueChanged}"
                    allow-custom-entity
                ></ha-entity-picker>

                ${this._config.cover_type !== 'garage' ? html`
                <ha-entity-picker
                    label="${this.localize('window_sensor')}"
                    .hass=${this.hass}
                    .value=${this._config.window_entity || ""}
                    .configValue=${"window_entity"}
                    include-domains='["binary_sensor", "sensor"]'
                    @value-changed=${this._valueChanged}
                    allow-custom-entity
                ></ha-entity-picker>

                <div style="margin-top: 8px; margin-bottom: 16px; padding-left: 12px; border-left: 2px solid var(--primary-color);">
                    <ha-selector
                        .hass=${this.hass}
                        .selector=${{
                            select: {
                                mode: "dropdown",
                                options: [
                                    { value: "right", label: this.localize('right') },
                                    { value: "left", label: this.localize('left') }
                                ]
                            }
                        }}
                        .value=${this._config.handle_side || "right"}
                        .label=${this.localize('handle_side')}
                        @value-changed=${(ev: any) => {
                            const newValue = ev.detail.value;
                            if (newValue && this._config.handle_side !== newValue) {
                                this._config = { ...this._config, handle_side: newValue };
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

                <!-- OPTIONEN & ERSCHEINUNGSBILD -->
                <div class="section-title">${this.localize('appearance')}</div>

                <div class="formfield-row">
                    <label>${this.localize('show_status_text')}</label>
                    <ha-switch
                        .checked="${this._config.show_status_text !== false}"
                        @change="${(ev: Event) => this._handleToggleChange('show_status_text', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                <div class="formfield-row">
                    <label>${this.localize('show_main_buttons')}</label>
                    <ha-switch
                        .checked="${this._config.show_main_buttons !== false}"
                        @change="${(ev: Event) => this._handleToggleChange('show_main_buttons', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                <div class="formfield-row">
                    <label>${this.localize('show_stop_button')}</label>
                    <ha-switch
                        .checked="${this._config.show_stop_button !== false}"
                        @change="${(ev: Event) => this._handleToggleChange('show_stop_button', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                <div class="formfield-row">
                    <label>${this.localize('show_vent_button')}</label>
                    <ha-switch
                        .checked="${this._config.show_vent_button === true}"
                        @change="${(ev: Event) => this._handleToggleChange('show_vent_button', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                ${this._config.show_vent_button ? html`
                    <div class="sub-section">
                        <ha-textfield
                            type="number"
                            label="${this.localize('vent_percentage')}"
                            .value="${this._config.vent_percentage ?? 15}"
                            configValue="vent_percentage"
                            @input="${this._valueChanged}"
                        ></ha-textfield>
                    </div>
                ` : ''}

                <div class="formfield-row">
                    <label>${this.localize('disable_drag')}</label>
                    <ha-switch
                        .checked="${this._config.disable_drag === true}"
                        @change="${(ev: Event) => this._handleToggleChange('disable_drag', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

                <!-- FARBEN -->
                <div class="section-title">${this.localize('colors')}</div>

                <div style="margin-top: 24px; margin-bottom: 8px;">
                    <div style="color: var(--secondary-text-color); font-size: 12px; margin-bottom: 8px;">${this.localize('colors')}</div>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        
                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_frame || "#1e293b"}
                                   @input=${(ev: any) => this._colorChanged("color_frame", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('color_frame')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_frame", "")}>${this.localize('reset')}</span>
                            </div>
                        </div>
                        
                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_moving || "#475569"}
                                   @input=${(ev: any) => this._colorChanged("color_moving", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('color_moving')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_moving", "")}>${this.localize('reset')}</span>
                            </div>
                        </div>

                        <div style="flex: 1; min-width: 130px; display: flex; align-items: center; gap: 12px; background: rgba(120,120,120,0.1); padding: 8px 12px; border-radius: 8px;">
                            <input type="color" 
                                   .value=${this._config.color_window || "#87CEEB"}
                                   @input=${(ev: any) => this._colorChanged("color_window", ev.target.value)}
                                   style="width: 32px; height: 32px; padding: 0; border: none; border-radius: 50%; cursor: pointer; background: transparent;">
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('color_window')}</span>
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
                                <span style="font-size: 13px; font-weight: bold; color: var(--primary-text-color);">${this.localize('color_button')}</span>
                                <span style="font-size: 11px; color: var(--primary-color); cursor: pointer;" @click=${() => this._colorChanged("color_button", "")}>${this.localize('reset')}</span>
                            </div>
                        </div>

                    </div>
                </div>

                <div class="formfield-row">
                    <label>${this.localize('use_3d_colors')}</label>
                    <ha-switch
                        .checked="${this._config.use_3d_colors !== false}"
                        @change="${(ev: Event) => this._handleToggleChange('use_3d_colors', (ev.target as HTMLInputElement).checked)}"
                    ></ha-switch>
                </div>

            </div>
        `;
    }
}