import "./realistic-cover-card-editor";
import { HomeAssistant } from "../ha-types";
import { html, css, LitElement, CSSResultGroup, svg, TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { ICardConfig } from "../types";
import styles from "./card.css";

const translations: Record<string, Record<string, string>> = {
    en: {
        closed: "CLOSED",
        open: "OPEN",
        vent: "VENT",
        manual: "MANUAL",
        opening: "OPENING...",
        closing: "CLOSING...",
        sending: "SENDING COMMAND...",
        stop: "STOPPED",
        blind: "BLIND",
        open_sensor: "Open",
        closed_sensor: "Closed"
    },
    de: {
        closed: "GESCHLOSSEN",
        open: "GEÖFFNET",
        vent: "LÜFTEN",
        manual: "MANUELL",
        opening: "WIRD GEÖFFNET...",
        closing: "WIRD GESCHLOSSEN...",
        sending: "SENDE BEFEHL...",
        stop: "GESTOPPT",
        blind: "BEHANG",
        open_sensor: "Offen",
        closed_sensor: "Zu"
    }
};

export class MyCustomCard extends LitElement {
    @property({ attribute: false }) private cardTitle: string = "Garagentor";
    @property({ attribute: false }) private state: string = "";
    
    @property({ attribute: false }) private lightStateObj: any = null;
    @property({ attribute: false }) private sensorStateObj: any = null;
    @property({ attribute: false }) private sunStateObj: any = null; 
    
    private entity: string = "";
    private lightEntity: string = "";
    private sensorEntity: string = "";
    private _hass!: HomeAssistant;

    private currentPercentage = 0;
    private isDragging = false;
    private maxTravelPixels = 180;
    private _config!: any;

    private currentTilt = 0;
    private isDraggingTilt = false;
    private readonly SLAT_COUNT = 16;          
    private readonly BLIND_START_Y = 40;       
    private readonly BLIND_MAX_TRAVEL = 190;   
    private readonly STACKED_HEIGHT = 1.5;     
    private readonly SLAT_HEIGHT = 10.0;       

    private localize(stringKey: string): string {
        const lang = this._hass?.language || 'en'; 
        if (translations[lang] && translations[lang][stringKey]) {
            return translations[lang][stringKey];
        }
        return translations['en'][stringKey] || stringKey;
    }

    private _getShadedColor(color: string, percent: number): string {
        if (!color || !color.startsWith('#')) return color;
        
        const f = parseInt(color.slice(1), 16);
        const t = percent < 0 ? 0 : 255;
        const p = percent < 0 ? percent * -1 : percent;
        const R = f >> 16;
        const G = (f >> 8) & 0x00FF;
        const B = f & 0x0000FF;
        
        return "#" + (
            0x1000000 + 
            (Math.round((t - R) * p) + R) * 0x10000 + 
            (Math.round((t - G) * p) + G) * 0x100 + 
            (Math.round((t - B) * p) + B)
        ).toString(16).slice(1);
    }

    private _interpolateColor(color1: string, color2: string, factor: number): string {
        const hex1 = color1.replace('#', '');
        const hex2 = color2.replace('#', '');
        
        const r1 = parseInt(hex1.substring(0, 2), 16);
        const g1 = parseInt(hex1.substring(2, 4), 16);
        const b1 = parseInt(hex1.substring(4, 6), 16);
        
        const r2 = parseInt(hex2.substring(0, 2), 16);
        const g2 = parseInt(hex2.substring(2, 4), 16);
        const b2 = parseInt(hex2.substring(4, 6), 16);
        
        const r = Math.round(r1 + factor * (r2 - r1));
        const g = Math.round(g1 + factor * (g2 - g1));
        const b = Math.round(b1 + factor * (b2 - b1));
        
        return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    }

    private _getSkyColors(): { top: string, bottom: string } {
        if (this._config?.color_window) {
            return { 
                top: this._config.color_window, 
                bottom: this._getShadedColor(this._config.color_window, -0.4) 
            };
        }

        const sun = this._hass?.states['sun.sun'];
        if (!sun || sun.attributes.elevation === undefined) {
            return { top: "#1e293b", bottom: "#0f172a" }; 
        }
        
        const elevation = sun.attributes.elevation;

        if (elevation >= 10) return { top: "#38bdf8", bottom: "#bae6fd" }; 
        if (elevation <= -10) return { top: "#0f172a", bottom: "#1e293b" }; 

        if (elevation >= 0) {
            const factor = elevation / 10;
            return {
                top: this._interpolateColor("#1e3a8a", "#38bdf8", factor),
                bottom: this._interpolateColor("#fb923c", "#bae6fd", factor)
            };
        } else {
            const factor = (elevation + 10) / 10;
            return {
                top: this._interpolateColor("#0f172a", "#1e3a8a", factor),
                bottom: this._interpolateColor("#1e293b", "#fb923c", factor)
            };
        }
    }

    private _renderLightGlow(): TemplateResult | string {
        if (this._config?.show_light_glow === false) return "";
        if (this.lightStateObj?.state !== 'on') return "";
        
        return svg`
            <radialGradient id="light-glow-grad" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stop-color="#eab308" stop-opacity="0.35" />
                <stop offset="50%" stop-color="#eab308" stop-opacity="0.1" />
                <stop offset="100%" stop-color="#eab308" stop-opacity="0" />
            </radialGradient>
            <rect x="15" y="20" width="230" height="210" fill="url(#light-glow-grad)" style="pointer-events: none;" />
        `;
    }

    private _setCoverPosition(pos: number) {
        if (!this._hass || !this.entity) return;
        
        let targetPos = pos;
        if (this._config?.invert_position) {
            targetPos = 100 - targetPos;
        }

        this._hass.callService("cover", "set_cover_position", {
            entity_id: this.entity,
            position: targetPos
        });
    }

    public static async getConfigElement() {
        return document.createElement("realistic-cover-card-editor");
    }

    public static getStubConfig() {
        return {
            entity: "",
            title: "Garagentor",
            cover_type: "garage",
            show_status_text: true,      
            show_main_buttons: true,
            show_stop_button: true, 
            show_vent_button: false,
            disable_drag: false, 
            vent_percentage: 8,
            use_3d_colors: true
        };
    }

    static get styles(): CSSResultGroup {
        return css(<TemplateStringsArray><any>[styles]);
    }

    setConfig(config: any): void {
        this._config = config; 
        this.entity = config.entity;
        this.cardTitle = config.title || "Garagentor";
        this.lightEntity = config.light_entity;
        this.sensorEntity = config.sensor_entity;
    }

    private updateVisuals(percent: number, stateText?: string) {
        this.currentPercentage = Math.max(0, Math.min(100, percent));
        
        const doorGroup = this.shadowRoot?.getElementById('door-group');
        const statusDisplay = this.shadowRoot?.getElementById('status-display');
        
        if (doorGroup) {
            const travel = (this.currentPercentage / 100) * 180; 
            doorGroup.setAttribute('transform', `translate(0, -${travel})`);
        }
        
        if (statusDisplay && stateText) {
            statusDisplay.textContent = stateText;
        }

        this.requestUpdate(); 
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;

        const oldSun = this.sunStateObj;
        this.sunStateObj = hass.states['sun.sun'];
        
        const oldLight = this.lightStateObj;
        if (this.lightEntity) {
            this.lightStateObj = hass.states[this.lightEntity];
        }

        if (this.sensorEntity) {
            this.sensorStateObj = hass.states[this.sensorEntity];
        }

        if (
            (oldSun && this.sunStateObj && oldSun.attributes.elevation !== this.sunStateObj.attributes.elevation) ||
            (oldLight && this.lightStateObj && oldLight.state !== this.lightStateObj.state)
        ) {
            this.requestUpdate();
        }

        if (!this.entity || !hass.states[this.entity]) return;

        const stateObj = hass.states[this.entity];
        const rawState = stateObj.state; 
        
        let position = stateObj.attributes.current_position;
        if (position === undefined) {
            position = rawState === 'open' ? 100 : 0;
        } else if (this._config?.invert_position) {
            position = 100 - position; 
        }

        if (stateObj.attributes.current_tilt_position !== undefined) {
            let tilt = stateObj.attributes.current_tilt_position;
            if (this._config?.invert_tilt) tilt = 100 - tilt;
            this.currentTilt = 100 - tilt; 
        }

        const roundedPos = Math.round(position);
        let displayState = "";
        
        if (rawState === 'opening') {
            displayState = `${roundedPos}% - ${this.localize('opening')}`;
        } else if (rawState === 'closing') {
            displayState = `${roundedPos}% - ${this.localize('closing')}`;
        } else if (roundedPos > 0 && roundedPos < 100) {
            displayState = `${roundedPos}% ${this.localize('open')}`;
        } else if (roundedPos === 100 || rawState === 'open') {
            displayState = this.localize('open');
        } else if (roundedPos === 0 || rawState === 'closed') {
            displayState = this.localize('closed');
        } else {
            displayState = rawState.toUpperCase();
        }

        if (!this.isDragging) {
            this.updateVisuals(position, displayState);
        }
    }

    firstUpdated() {
        const interactionZone = this.shadowRoot?.getElementById('interaction-zone');
        const doorGroup = this.shadowRoot?.getElementById('door-group');
        const btnOpen = this.shadowRoot?.getElementById('btn-open');
        const btnVent = this.shadowRoot?.getElementById('btn-vent');
        const btnClose = this.shadowRoot?.getElementById('btn-close');
        const btnStop = this.shadowRoot?.getElementById('btn-stop');

        let startY = 0;
        let startPercent = 0;

        interactionZone?.addEventListener('pointerdown', (e: PointerEvent) => {
            if (this._config?.disable_drag) return; 
            this.isDragging = true;
            startY = e.clientY;
            startPercent = this.currentPercentage;
            interactionZone.setPointerCapture(e.pointerId);
            
            if (doorGroup) doorGroup.style.transition = 'none';
        });

        interactionZone?.addEventListener('pointermove', (e: PointerEvent) => {
            if (!this.isDragging) return;
            const rect = interactionZone.getBoundingClientRect();
            const maxRealTravel = rect.height * (180 / 210);
            
            const deltaY = startY - e.clientY;
            const deltaPercent = (deltaY / maxRealTravel) * 100;
            
            this.updateVisuals(startPercent + deltaPercent, `${Math.round(this.currentPercentage)}% ${this.localize('manual')}`);
        });

        const stopDrag = (e: PointerEvent) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            interactionZone?.releasePointerCapture(e.pointerId);
            
            if (doorGroup) doorGroup.style.transition = 'transform 0.3s ease-out';
            
            if (this._hass && this.entity) {
                this._hass.callService("cover", "set_cover_position", {
                    entity_id: this.entity,
                    position: Math.round(this.currentPercentage)
                });
            }
        };

        interactionZone?.addEventListener('pointerup', stopDrag);
        interactionZone?.addEventListener('pointercancel', stopDrag);

        const animateToAndCall = (targetPercent: number, service: string, payload: any) => {
            if (doorGroup) doorGroup.style.transition = 'transform 0.8s ease-in-out';
            this.updateVisuals(targetPercent, this.localize('sending'));
            
            if (this._hass && this.entity) {
                this._hass.callService("cover", service, payload);
            }
        };

        btnOpen?.addEventListener('click', () => {
            animateToAndCall(100, "open_cover", { entity_id: this.entity });
        });

        btnVent?.addEventListener('click', () => {
            animateToAndCall(15, "set_cover_position", { entity_id: this.entity, position: 15 });
        });

        btnClose?.addEventListener('click', () => {
            animateToAndCall(0, "close_cover", { entity_id: this.entity });
        });

        btnStop?.addEventListener('click', () => {
            if (doorGroup) doorGroup.style.transition = 'none';
            this.updateVisuals(this.currentPercentage, this.localize('stop'));
            
            if (this._hass && this.entity) {
                this._hass.callService("cover", "stop_cover", { entity_id: this.entity });
            }
        });
    }

    private toggleLight(ev: Event) {
        ev.stopPropagation(); 
        if (this._hass && this.lightEntity) {
            const domain = this.lightEntity.split('.')[0]; 
            this._hass.callService(domain, "toggle", { entity_id: this.lightEntity });
        }
    }

    private _handleMoreInfo() {
        if (!this.entity) return;
        const event = new CustomEvent('hass-more-info', {
            bubbles: true,
            composed: true,
            detail: { entityId: this.entity }
        });
        this.dispatchEvent(event);
    }

    private processBlindDrag(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        const relativeY = ((e.clientY - rect.top) / rect.height) * 240; 
        let svgPercent = ((relativeY - this.BLIND_START_Y) / this.BLIND_MAX_TRAVEL) * 100;
        svgPercent = Math.max(0, Math.min(100, svgPercent));
        
        const haPercent = 100 - svgPercent;
        
        this.updateVisuals(Math.round(haPercent), `${Math.round(haPercent)}% ${this.localize('manual')}`);
    }

    private handleBlindStart(e: PointerEvent) {
        if (this._config?.disable_drag) return; 
        this.isDragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.processBlindDrag(e);
    }

    private handleBlindEnd(e: PointerEvent) {
        if (!this.isDragging) return;
        this.isDragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (this._hass && this.entity) {
            let targetPos = Math.round(this.currentPercentage);
            if (this._config?.invert_position) targetPos = 100 - targetPos; 

            this._hass.callService("cover", "set_cover_position", {
                entity_id: this.entity,
                position: targetPos
            });
        }
    }

    private processTiltDrag(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        const clickFromBottom = rect.height - (e.clientY - rect.top);
        const relativeY = Math.max(0, Math.min(rect.height, clickFromBottom));
        
        this.currentTilt = Math.round((relativeY / rect.height) * 100);
        this.requestUpdate(); 
    }

    private handleTiltStart(e: PointerEvent) {
        if (this._config?.disable_drag) return; 
        this.isDraggingTilt = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.processTiltDrag(e);
    }

    private handleTiltEnd(e: PointerEvent) {
        if (!this.isDraggingTilt) return;
        this.isDraggingTilt = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (this._hass && this.entity) {
            let targetTilt = 100 - this.currentTilt; 
            if (this._config?.invert_tilt) targetTilt = 100 - targetTilt; 

            this._hass.callService("cover", "set_cover_tilt_position", {
                entity_id: this.entity,
                tilt_position: targetTilt
            });
        }
    }

    private processShutterDrag(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        const relativeY = ((e.clientY - rect.top) / rect.height) * 240; 
        let svgPercent = ((relativeY - 20) / 210) * 100;
        svgPercent = Math.max(0, Math.min(100, svgPercent));
        
        const haPercent = 100 - svgPercent;
        
        this.updateVisuals(Math.round(haPercent), `${Math.round(haPercent)}% ${this.localize('manual')}`);
    }

    private handleShutterStart(e: PointerEvent) {
        if (this._config?.disable_drag) return; 
        this.isDragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.processShutterDrag(e);
    }

    private handleShutterEnd(e: PointerEvent) {
        if (!this.isDragging) return;
        this.isDragging = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (this._hass && this.entity) {
            let targetPos = Math.round(this.currentPercentage);
            if (this._config?.invert_position) targetPos = 100 - targetPos; 

            this._hass.callService("cover", "set_cover_position", {
                entity_id: this.entity,
                position: targetPos
            });
        }
    }

    private renderGarage(): TemplateResult {
        const use3D = this._config?.use_3d_colors !== false;
        
        const baseFrame = this._config?.color_frame || "#1e293b";
        const frameLight = use3D ? this._getShadedColor(baseFrame, 0.15) : baseFrame;
        const frameDark = use3D ? this._getShadedColor(baseFrame, -0.3) : baseFrame;

        const baseMoving = this._config?.color_moving || "#475569";
        const movingLight = use3D ? this._getShadedColor(baseMoving, 0.15) : baseMoving;
        const movingDark = use3D ? this._getShadedColor(baseMoving, -0.3) : baseMoving;

        const sky = this._getSkyColors(); 

        return html`
        <div style="width: 100%; display: flex; justify-content: center;">
            <svg viewBox="0 0 300 240" class="garage-svg" style="width: 100%; height: auto; touch-action: none;">
                <defs>
                    <linearGradient id="dyn-frame-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${frameLight}" />
                        <stop offset="50%" stop-color="${baseFrame}" />
                        <stop offset="100%" stop-color="${frameDark}" />
                    </linearGradient>
                    <linearGradient id="dyn-moving-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${movingLight}" />
                        <stop offset="50%" stop-color="${baseMoving}" />
                        <stop offset="100%" stop-color="${movingDark}" />
                    </linearGradient>
                    
                    <linearGradient id="dynamic-sky-garage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${sky.top}" />
                        <stop offset="100%" stop-color="${sky.bottom}" />
                    </linearGradient>

                    <linearGradient id="track-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#020617" />
                        <stop offset="50%" stop-color="#334155" />
                        <stop offset="100%" stop-color="#020617" />
                    </linearGradient>
                    <clipPath id="door-clip">
                        <rect x="0" y="30" width="300" height="210" />
                    </clipPath>
                </defs>

                <rect x="20" y="30" width="260" height="210" fill="url(#dynamic-sky-garage)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow()}
                
                <rect x="15" y="30" width="10" height="210" fill="url(#track-grad)" />
                <rect x="275" y="30" width="10" height="210" fill="url(#track-grad)" />

                <g clip-path="url(#door-clip)">
                    <g id="door-group" style="transition: transform 0.1s linear;">
                        <rect class="door-section" x="25" y="35" width="250" height="40" rx="3" fill="url(#dyn-moving-grad)" stroke="#020617" stroke-width="1"/>
                        <rect class="door-section" x="25" y="76.5" width="250" height="40" rx="3" fill="url(#dyn-moving-grad)" stroke="#020617" stroke-width="1"/>
                        <rect class="door-section" x="25" y="118" width="250" height="40" rx="3" fill="url(#dyn-moving-grad)" stroke="#020617" stroke-width="1"/>
                        <rect class="door-section" x="25" y="159.5" width="250" height="40" rx="3" fill="url(#dyn-moving-grad)" stroke="#020617" stroke-width="1"/>
                        <rect class="door-section" x="25" y="201" width="250" height="40" rx="3" fill="url(#dyn-moving-grad)" stroke="#020617" stroke-width="1"/>
                        <rect class="door-section" x="25" y="241" width="250" height="8" rx="2" fill="#020617"/>
                        
                        <rect id="interaction-zone" x="20" y="30" width="260" height="215" fill="transparent" 
                            cursor="${this._config?.disable_drag ? 'default' : 'ns-resize'}" 
                            style="touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"/>
                    </g>
                </g>

                <rect x="10" y="10" width="280" height="20" rx="4" fill="url(#dyn-frame-grad)" stroke="#0f172a" stroke-width="2" />
            </svg>
        </div>
        `;
    }

    private renderShutterSlats(): TemplateResult[] {
        const slats: TemplateResult[] = [];
        const SHUTTER_COUNT = 20;
        const START_Y = 20;
        const MAX_TRAVEL = 210;
        const SLAT_HEIGHT = MAX_TRAVEL / SHUTTER_COUNT; 
        const MAX_GAP = 1.5;

        const use3D = this._config?.use_3d_colors !== false;
        const baseMoving = this._config?.color_moving || "#475569";
        const bottomRailColor = this.isDragging ? "#38bdf8" : (use3D ? this._getShadedColor(baseMoving, -0.2) : baseMoving);

        let ventilationRatio = 0;
        let liftRatio = 0;
        if (this.currentPercentage <= 10) {
            ventilationRatio = this.currentPercentage / 10;
        } else {
            ventilationRatio = 1;
            liftRatio = (this.currentPercentage - 10) / 90;
        }

        const currentGap = ventilationRatio * MAX_GAP;
        const liftOffset = liftRatio * MAX_TRAVEL;
        const bottomRailY = START_Y + MAX_TRAVEL - liftOffset;

        for (let i = 0; i < SHUTTER_COUNT; i++) {
            const slatY = bottomRailY - ((SHUTTER_COUNT - i) * SLAT_HEIGHT) - ((SHUTTER_COUNT - 1 - i) * currentGap);
            slats.push(svg`
                <rect x="15" y="${slatY.toFixed(2)}" width="230" height="${(SLAT_HEIGHT + 0.5).toFixed(2)}" fill="url(#dyn-moving-grad)" stroke="#0f172a" stroke-width="0.5" style="transition: y 0.1s linear;" />
            `);
        }

        slats.push(svg`
            <rect x="15" y="${bottomRailY.toFixed(2)}" width="230" height="8" fill="${bottomRailColor}" stroke="#0f172a" stroke-width="1" rx="2" style="transition: y 0.1s linear, fill 0.2s ease;" />
        `);

        return slats;
    }

    private renderShutter(): TemplateResult {
        const use3D = this._config?.use_3d_colors !== false;
        const baseFrame = this._config?.color_frame || "#1e293b";
        const frameLight = use3D ? this._getShadedColor(baseFrame, 0.15) : baseFrame;
        const frameDark = use3D ? this._getShadedColor(baseFrame, -0.3) : baseFrame;

        const baseMoving = this._config?.color_moving || "#475569";
        const movingLight = use3D ? this._getShadedColor(baseMoving, 0.15) : baseMoving;
        const movingDark = use3D ? this._getShadedColor(baseMoving, -0.3) : baseMoving;

        const sky = this._getSkyColors();

        return html`
            <div style="display: flex; justify-content: center; width: 100%;">
                <div style="position: relative; width: calc(100% - 56px); 
                            cursor: ${this._config?.disable_drag ? 'default' : 'ns-resize'}; 
                            touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                    @pointerdown=${this.handleShutterStart}
                    @pointermove=${(e: PointerEvent) => { if(this.isDragging) this.processShutterDrag(e); }}
                    @pointerup=${this.handleShutterEnd}
                    @pointercancel=${this.handleShutterEnd}>
                    
                    <svg viewBox="0 0 260 240" style="width: 100%; height: auto; pointer-events: none;">
                        <defs>
                            <linearGradient id="dyn-frame-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="${frameLight}" />
                                <stop offset="50%" stop-color="${baseFrame}" />
                                <stop offset="100%" stop-color="${frameDark}" />
                            </linearGradient>
                            <linearGradient id="dyn-moving-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="${movingLight}" />
                                <stop offset="50%" stop-color="${baseMoving}" />
                                <stop offset="100%" stop-color="${movingDark}" />
                            </linearGradient>

                            <linearGradient id="dynamic-sky-shutter" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="${sky.top}" />
                                <stop offset="100%" stop-color="${sky.bottom}" />
                            </linearGradient>

                            <linearGradient id="glass-reflection-shutter" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" />
                                <stop offset="30%" stop-color="#ffffff" stop-opacity="0.0" />
                            </linearGradient>
                            
                            <clipPath id="shutter-window-clip">
                                <rect x="15" y="20" width="230" height="210" />
                            </clipPath>
                        </defs>

                        <rect x="10" y="10" width="240" height="220" rx="10" fill="url(#dyn-frame-grad)" stroke="#0f172a" stroke-width="4"/>
                        <rect x="15" y="20" width="230" height="210" fill="url(#dynamic-sky-shutter)" style="transition: fill 1s ease;" />
                        ${this._renderLightGlow()}
                        <rect x="15" y="20" width="230" height="210" fill="url(#glass-reflection-shutter)" />

                        <g clip-path="url(#shutter-window-clip)">
                            ${this.renderShutterSlats()}
                        </g>
                    </svg>
                </div>
            </div>
        `;
    }

    private renderSlats(): TemplateResult[] {
        const slats: TemplateResult[] = [];
        const visualPercent = 100 - this.currentPercentage;
        
        const yBottomRail = this.BLIND_START_Y + (visualPercent / 100) * this.BLIND_MAX_TRAVEL;
        const maxSpacing = this.BLIND_MAX_TRAVEL / (this.SLAT_COUNT - 1); 

        for (let i = 0; i < this.SLAT_COUNT; i++) {
            const yExtended = this.BLIND_START_Y + (i * maxSpacing);
            const yStacked = yBottomRail - ((this.SLAT_COUNT - 1 - i) * this.STACKED_HEIGHT);
            const yActual = Math.min(yExtended, yStacked);

            const distFromStack = yStacked - yActual;
            const transitionZone = 12.0; 
            const tiltFactor = Math.min(1, Math.max(0, distFromStack / transitionZone));
            const currentSlatTilt = this.currentTilt * tiltFactor;

            const maxRotation = 78;
            const currentRotation = maxRotation * (1 - (currentSlatTilt / 100));

            slats.push(svg`
                <g style="transform-box: fill-box; transform-origin: center; transform: rotateX(${currentRotation}deg); transition: transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1);">
                    <rect x="13.5" y="${(yActual - 0.5).toFixed(2)}" width="1.5" height="2.0" fill="#475569" />
                    <rect x="245" y="${(yActual - 0.5).toFixed(2)}" width="1.5" height="2.0" fill="#475569" />
                    <rect x="15" y="${(yActual - (this.SLAT_HEIGHT / 2)).toFixed(2)}" width="230" height="${this.SLAT_HEIGHT}" rx="1" fill="url(#dyn-moving-grad)" />
                </g>
            `);
        }
        return slats;
    }

    private renderBlind(): TemplateResult {
        const use3D = this._config?.use_3d_colors !== false;
        const baseFrame = this._config?.color_frame || "#1e293b";
        const frameLight = use3D ? this._getShadedColor(baseFrame, 0.15) : baseFrame;
        const frameDark = use3D ? this._getShadedColor(baseFrame, -0.3) : baseFrame;

        const baseMoving = this._config?.color_moving || "#475569";
        const movingLight = use3D ? this._getShadedColor(baseMoving, 0.15) : baseMoving;
        const movingDark = use3D ? this._getShadedColor(baseMoving, -0.3) : baseMoving;
        
        const visualPercent = 100 - this.currentPercentage;
        const yBottomRail = this.BLIND_START_Y + (visualPercent / 100) * this.BLIND_MAX_TRAVEL;
        const bottomRailColor = this.isDragging ? "#38bdf8" : (use3D ? this._getShadedColor(baseMoving, -0.2) : baseMoving);

        const sky = this._getSkyColors();

        return html`
            <div style="display: flex; gap: 12px; width: 100%; align-items: stretch;">
                <div style="position: relative; flex-grow: 1; 
                            cursor: ${this._config?.disable_drag ? 'default' : 'ns-resize'}; 
                            touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                     @pointerdown=${this.handleBlindStart}
                     @pointermove=${(e: PointerEvent) => { if(this.isDragging) this.processBlindDrag(e); }}
                     @pointerup=${this.handleBlindEnd}
                     @pointercancel=${this.handleBlindEnd}>
                    
                    <svg viewBox="0 0 260 240" style="width: 100%; height: auto; pointer-events: none;">
                        <defs>
                            <linearGradient id="dyn-frame-grad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stop-color="${frameDark}" />
                                <stop offset="40%" stop-color="${frameLight}" />
                                <stop offset="70%" stop-color="${baseFrame}" />
                                <stop offset="100%" stop-color="${frameDark}" />
                            </linearGradient>
                            <linearGradient id="dyn-moving-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="${movingDark}" />
                                <stop offset="25%" stop-color="${frameLight}" />
                                <stop offset="75%" stop-color="${baseMoving}" />
                                <stop offset="100%" stop-color="${movingDark}" />
                            </linearGradient>

                            <linearGradient id="dynamic-sky-blind" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="${sky.top}" />
                                <stop offset="100%" stop-color="${sky.bottom}" />
                            </linearGradient>

                            <linearGradient id="glass-reflection" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" /><stop offset="30%" stop-color="#ffffff" stop-opacity="0.02" /><stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" /></linearGradient>
                        </defs>

                        <rect x="15" y="40" width="230" height="190" fill="url(#dynamic-sky-blind)" rx="2" style="transition: fill 1s ease;" />
                        ${this._renderLightGlow()}
                        <rect x="15" y="40" width="230" height="190" fill="url(#glass-reflection)" rx="2" />
                        
                        <line x1="60" y1="40" x2="60" y2="230" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>
                        <line x1="200" y1="40" x2="200" y2="230" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>

                        ${this.renderSlats()}
                        
                        <g>
                            <rect x="13.5" y="${(yBottomRail - 2).toFixed(2)}" width="1.5" height="4.0" fill="#334155" />
                            <rect x="245" y="${(yBottomRail - 2).toFixed(2)}" width="1.5" height="4.0" fill="#334155" />
                            <rect x="14" y="${(yBottomRail - 3).toFixed(2)}" width="232" height="6.0" fill="${bottomRailColor}" rx="1" style="transition: fill 0.2s ease;" />
                        </g>

                        <rect x="13.5" y="40" width="1.5" height="190" fill="url(#dyn-frame-grad)" />
                        <rect x="245" y="40" width="1.5" height="190" fill="url(#dyn-frame-grad)" />
                        <rect x="10" y="5" width="240" height="35" fill="url(#dyn-frame-grad)" rx="2" />
                        <rect x="10" y="40" width="240" height="1" fill="#0f172a" opacity="0.6" />
                        
                        <text x="130" y="27" fill="#0f172a" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="0.5" opacity="0.8">${this.localize('blind')}: ${Math.round(this.currentPercentage)}%</text>
                    </svg>
                </div>

                <div style="position: relative; width: 44px; background: #0f172a; border-radius: 12px; border: 1px solid #1e293b; display: flex; justify-content: center; padding: 12px 0; 
                            cursor: ${this._config?.disable_drag ? 'default' : 'ns-resize'}; 
                            touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"                    
                     @pointerdown=${this.handleTiltStart}
                     @pointermove=${(e: PointerEvent) => { if(this.isDraggingTilt) this.processTiltDrag(e); }}
                     @pointerup=${this.handleTiltEnd}
                     @pointercancel=${this.handleTiltEnd}>
                    
                    <div style="position: relative; width: 6px; height: 100%; background: #1e293b; border-radius: 3px; pointer-events: none;">
                        <div style="position: absolute; bottom: 0; width: 100%; background: #38bdf8; border-radius: 3px; height: ${this.currentTilt}%;"></div>
                        <div style="position: absolute; left: 50%; transform: translateX(-50%); width: 24px; height: 24px; background: white; border: 2px solid #38bdf8; border-radius: 50%; bottom: calc(${this.currentTilt}% - 12px); box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>
                    </div>
                </div>
            </div>
        `;
    }

    render(): TemplateResult {
        let sensorDisplay = "";
        if (this.sensorStateObj) {
            let state = this.sensorStateObj.state;
            const uom = this.sensorStateObj.attributes.unit_of_measurement || "";
            
            const numericState = parseFloat(state);
            if (!isNaN(numericState)) {
                state = numericState.toFixed(1);
            }

            if (state === "on" && !uom) sensorDisplay = this.localize('open_sensor');
            else if (state === "off" && !uom) sensorDisplay = this.localize('closed_sensor');
            else sensorDisplay = `${state} ${uom}`.trim();
        }

        const isLightOn = this.lightStateObj && this.lightStateObj.state === 'on';
        const lightIcon = this._config?.light_icon || "mdi:lightbulb";
        
        const coverType = this._config?.cover_type || "garage";
        const btnColor = this._config?.color_button || "#1e293b";

        return html`
        <ha-card @click=${this._handleMoreInfo} style="cursor: pointer;">
            <div id="cover-card" class="cover-container" style="padding: 16px; display: flex; flex-direction: column; gap: 16px;">
                
                <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.2rem; color: var(--primary-text-color);">${this.cardTitle}</h2>
                    
                    <div class="extra-info" style="display: flex; gap: 10px; align-items: center;">
                        ${this.sensorStateObj ? html`
                            <div class="sensor-badge" style="font-size: 0.8rem; background: #1e293b; padding: 4px 10px; border-radius: 12px; color: #94a3b8; font-weight: bold;">
                                ${sensorDisplay}
                            </div>
                        ` : ''}

                        ${this.lightStateObj ? html`
                            <button @click="${this.toggleLight}" style="background: none; border: none; cursor: pointer; color: ${isLightOn ? '#eab308' : '#64748b'}; transition: color 0.2s; padding: 0; display: flex;">
                                <ha-icon icon="${lightIcon}"></ha-icon>
                            </button>
                        ` : ''}
                    </div>
                </div>
                                
                ${this._config?.show_status_text !== false ? html`
                    <div id="status-display" class="status-display" style="font-size: 0.9rem; color: #94a3b8; font-weight: bold;">${this.localize('closed')}</div>
                ` : ''}

                <div class="main-area" @click=${(e: Event) => e.stopPropagation()} style="display: flex; gap: 16px; align-items: stretch; cursor: default;">
                    <div style="flex-grow: 1;">
                        ${coverType === 'garage' ? this.renderGarage() : ''}
                        ${coverType === 'shutter' ? this.renderShutter() : ''}
                        ${coverType === 'blind' ? this.renderBlind() : ''}
                    </div>
                </div>

                ${(this._config?.show_main_buttons !== false || this._config?.show_stop_button !== false || this._config?.show_vent_button === true) ? html`
                    <div class="controls" @click=${(e: Event) => e.stopPropagation()} style="display: flex; gap: 8px; justify-content: center; cursor: default;">
                        
                        ${this._config?.show_main_buttons !== false ? html`
                            <button id="btn-open" style="flex: 1; max-width: 100px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s;">
                                <ha-icon icon="mdi:arrow-up"></ha-icon>
                            </button>
                        ` : ''}

                        ${this._config?.show_stop_button !== false ? html`
                            <button id="btn-stop" style="flex: 1; max-width: 100px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s;">
                                <ha-icon icon="mdi:stop"></ha-icon>
                            </button>
                        ` : ''}
                        
                        ${this._config?.show_vent_button === true ? html`
                            <button id="btn-vent" 
                                @click=${() => this._setCoverPosition(Number(this._config?.vent_percentage || 8))}
                                style="flex: 1; max-width: 100px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s;">
                                <ha-icon icon="mdi:air-filter"></ha-icon>
                            </button>
                        ` : ''}
                        
                        ${this._config?.show_main_buttons !== false ? html`
                            <button id="btn-close" style="flex: 1; max-width: 100px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s;">
                                <ha-icon icon="mdi:arrow-down"></ha-icon>
                            </button>
                        ` : ''}

                    </div>
                ` : ''}

            </div>
        </ha-card>
        `;
    }
}

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: "realistic-cover-card", 
    name: "Realistic Cover",
    preview: true, 
    description: "Interactive animated card for covers and blinds with real-time physics and sun-tracking background."
});