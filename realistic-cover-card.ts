import "./realistic-cover-card-editor";
import { HomeAssistant } from "../ha-types";
import { html, css, LitElement, CSSResultGroup, svg, TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { ICardConfig } from "../types";
import styles from "./card.css";

// --- ÜBERSETZUNGS-WÖRTERBUCH ---
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
    
    // Zweites Tor für Splitgarage
    @property({ attribute: false }) private currentPercentage2 = 0;
    @property({ attribute: false }) private windowStateObj: any = null;

    private entity: string = "";
    private entity2: string = "";
    private lightEntity: string = "";
    private sensorEntity: string = "";
    private windowEntity: string = "";
    private _hass!: HomeAssistant;

    private currentPercentage = 0;
    private isDragging = false;
    private isDragging2 = false;
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

    private _renderLightGlow(x = 15, y = 20, w = 230, h = 210): TemplateResult | string {
        if (this._config?.show_light_glow === false) return "";
        if (this.lightStateObj?.state !== 'on') return "";
        
        return svg`
            <radialGradient id="light-glow-grad" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stop-color="#eab308" stop-opacity="0.35" />
                <stop offset="50%" stop-color="#eab308" stop-opacity="0.1" />
                <stop offset="100%" stop-color="#eab308" stop-opacity="0" />
            </radialGradient>
            <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#light-glow-grad)" style="pointer-events: none;" />
        `;
    }

    private _setCoverPosition(pos: number, doorIndex: 1 | 2 = 1) {
        const targetEntity = doorIndex === 1 ? this.entity : this.entity2;
        if (!this._hass || !targetEntity) return;
        
        let targetPos = pos;
        if (this._config?.invert_position) {
            targetPos = 100 - targetPos;
        }

        this._hass.callService("cover", "set_cover_position", {
            entity_id: targetEntity,
            position: targetPos
        });
    }

    private _callCover(action: 'open' | 'stop' | 'close', doorIndex: 1 | 2 = 1) {
        const targetEntity = doorIndex === 1 ? this.entity : this.entity2;
        if (!this._hass || !targetEntity) return;

        const serviceMap = {
            open: 'open_cover',
            stop: 'stop_cover',
            close: 'close_cover'
        };

        this._hass.callService('cover', serviceMap[action], { entity_id: targetEntity });
    }

    public static async getConfigElement() {
        return document.createElement("realistic-cover-card-editor");
    }

    public static getStubConfig() {
        return {
            entity: "",
            title: "Garagentor",
            cover_type: "garage",
            garage_mode: "single",
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
        this.entity2 = config.entity_2 || "";
        this.cardTitle = config.title || "Garagentor";
        this.lightEntity = config.light_entity;
        this.sensorEntity = config.sensor_entity;
        this.windowEntity = config.window_entity;
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

        // NEU: Fenster Status Tracking
        const oldWindow = this.windowStateObj;
        if (this.windowEntity) {
            this.windowStateObj = hass.states[this.windowEntity];
        }

        if (this.sensorEntity) {
            this.sensorStateObj = hass.states[this.sensorEntity];
        }

        if (
            (oldSun && this.sunStateObj && oldSun.attributes.elevation !== this.sunStateObj.attributes.elevation) ||
            (oldLight && this.lightStateObj && oldLight.state !== this.lightStateObj.state) ||
            (oldWindow && this.windowStateObj && oldWindow.state !== this.windowStateObj.state) // NEU: Update bei Fenster-Bewegung
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

        // Splitgarage: Zweite Entität abfragen
        if (this._config?.garage_mode === 'split' && this.entity2 && hass.states[this.entity2]) {
            const stateObj2 = hass.states[this.entity2];
            let pos2 = stateObj2.attributes.current_position ?? (stateObj2.state === 'open' ? 100 : 0);
            if (this._config?.invert_position) pos2 = 100 - pos2;
            this.currentPercentage2 = Math.round(pos2);
        }

        if (stateObj.attributes.current_tilt_position !== undefined) {
            let tilt = stateObj.attributes.current_tilt_position;
            if (this._config?.invert_tilt) tilt = 100 - tilt;
            this.currentTilt = 100 - tilt; 
        }

        const roundedPos = Math.round(position);
        let displayState = "";
        
        if (this._config?.cover_type === 'garage' && this._config?.garage_mode === 'split') {
            displayState = `L: ${roundedPos}% | R: ${this.currentPercentage2}%`;
        } else if (rawState === 'opening') {
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

        if (!this.isDragging && !this.isDragging2) {
            this.updateVisuals(position, displayState);
        }
    }

    firstUpdated() {
        const btnOpen = this.shadowRoot?.getElementById('btn-open');
        const btnVent = this.shadowRoot?.getElementById('btn-vent');
        const btnClose = this.shadowRoot?.getElementById('btn-close');
        const btnStop = this.shadowRoot?.getElementById('btn-stop');

        const animateToAndCall = (targetPercent: number, service: string, payload: any) => {
            const doorGroup = this.shadowRoot?.getElementById('door-group');
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
            const doorGroup = this.shadowRoot?.getElementById('door-group');
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

    // --- GARAGENDOR INTERAKTION ---
    private processGarageDrag(e: PointerEvent, doorIndex: 1 | 2 = 1) {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const relativeY = ((e.clientY - rect.top) / rect.height) * 215; 
        let physicalPercent = (1 - (relativeY / 180)) * 100;
        physicalPercent = Math.max(0, Math.min(100, physicalPercent));
        
        if (doorIndex === 1) {
            this.currentPercentage = Math.round(physicalPercent);
        } else {
            this.currentPercentage2 = Math.round(physicalPercent);
        }
        this.requestUpdate();
    }

    private handleGarageStart(e: PointerEvent, doorIndex: 1 | 2 = 1) {
        if (this._config?.disable_drag) return; 
        if (doorIndex === 1) this.isDragging = true;
        else this.isDragging2 = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.processGarageDrag(e, doorIndex);
    }

    private handleGarageEnd(e: PointerEvent, doorIndex: 1 | 2 = 1) {
        const isDrag = doorIndex === 1 ? this.isDragging : this.isDragging2;
        if (!isDrag) return;
        if (doorIndex === 1) this.isDragging = false;
        else this.isDragging2 = false;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

        const targetEntity = doorIndex === 1 ? this.entity : this.entity2;
        const pos = doorIndex === 1 ? this.currentPercentage : this.currentPercentage2;

        if (this._hass && targetEntity) {
            let targetPos = Math.round(pos);
            if (this._config?.invert_position) targetPos = 100 - targetPos; 

            this._hass.callService("cover", "set_cover_position", {
                entity_id: targetEntity,
                position: targetPos
            });
        }
    }

    // --- RAFFSTORE INTERAKTION ---
    private processBlindDrag(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        const view = this._config?.cover_view || 'window';
        const startY = view === 'window' ? 40 : 35;
        const maxTravel = view === 'window' ? 190 : 205;
        
        const relativeY = ((e.clientY - rect.top) / rect.height) * 240; 
        let svgPercent = ((relativeY - startY) / maxTravel) * 100;
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

    // --- ROLLLADEN INTERAKTION ---
    private processShutterDrag(e: PointerEvent) {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        
        const isDoor = this._config?.cover_view === 'door' || this._config?.cover_view === 'sliding';
        const startY = isDoor ? 10 : 20;
        const maxTravel = isDoor ? 230 : 210;

        const relativeY = ((e.clientY - rect.top) / rect.height) * 240; 
        let svgPercent = ((relativeY - startY) / maxTravel) * 100;
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

// --- RENDER-METHODEN ---
    private renderGarage(): TemplateResult {
        const mode = this._config?.garage_mode || "single";
        const use3D = this._config?.use_3d_colors !== false;
        
        const baseFrame = this._config?.color_frame || "#1e293b";
        const frameLight = use3D ? this._getShadedColor(baseFrame, 0.15) : baseFrame;
        const frameDark = use3D ? this._getShadedColor(baseFrame, -0.3) : baseFrame;

        const baseMoving = this._config?.color_moving || "#475569";
        const movingLight = use3D ? this._getShadedColor(baseMoving, 0.15) : baseMoving;
        const movingDark = use3D ? this._getShadedColor(baseMoving, -0.3) : baseMoving;

        const sky = this._getSkyColors();

        // --- HILFSFUNKTION FÜR DEN KASKADEN-EFFEKT (Generiert Segmente + Schatten) ---
        const renderSegments = (x: number, width: number, percent: number, dragging: boolean) => {
            const segments: TemplateResult[] = [];
            const M = 41.4; 
            const GAP = 1.5; 
            const MAX_TRAVEL = 207; 
            const Y_BEND = 30; 

            const travel = (percent / 100) * MAX_TRAVEL;
            const f = 0.85; 
            const overlap = M * (1 - f); 
            const initialAlone = M * f;  
            
            let S = [0, 0, 0, 0, 0]; 
            let t = travel;
            
            let p0 = Math.min(t, initialAlone);
            S[0] += p0;
            t -= p0;
            
            for (let i = 0; i < 4; i++) {
                let sharedTravel = Math.min(t, overlap * 2);
                S[i] += sharedTravel / 2;
                S[i+1] += sharedTravel / 2;
                t -= sharedTravel;
                
                let aloneTravel = Math.min(t, initialAlone - overlap);
                S[i+1] += aloneTravel;
                t -= aloneTravel;
            }
            if (t > 0) S[4] += t;
            
            let currentTop = Y_BEND;

            for (let i = 0; i < 5; i++) {
                const shrink = Math.min(M, Math.max(0, S[i]));
                const currentHeight = M - shrink;
                const drawHeight = Math.max(0, currentHeight - GAP);

                if (drawHeight > 0.1) {
                    const ratio = shrink / M; 
                    const shadowOpacity = Math.pow(ratio, 1.8) * 1.0; 
                    
                    segments.push(svg`
                        <rect class="door-section" x="${x}" y="${currentTop.toFixed(2)}" width="${width}" height="${drawHeight.toFixed(2)}" rx="3" fill="url(#dyn-moving-grad)" stroke="#020617" stroke-width="1" style="pointer-events: none;" />
                        ${use3D ? svg`<rect x="${x}" y="${currentTop.toFixed(2)}" width="${width}" height="${drawHeight.toFixed(2)}" rx="3" fill="url(#top-shadow-grad)" style="pointer-events: none; mix-blend-mode: multiply; opacity: ${shadowOpacity.toFixed(3)};" />` : ""}
                    `);
                }
                currentTop += currentHeight; 
            }

            let lipHeight = 4 + Math.min(4, travel); 
            let lipY = Math.max(Y_BEND, currentTop);
            const lipColor = dragging ? "#38bdf8" : "#020617";
            
            segments.push(svg`
                <rect x="${x}" y="${lipY.toFixed(2)}" width="${width}" height="${lipHeight.toFixed(2)}" rx="2" fill="${lipColor}" style="transition: fill 0.2s ease; pointer-events: none;"/>
            `);

            return segments;
        };


        // 1. EINZELGARAGE (300 x 240)
        if (mode === "single") {
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
                        <linearGradient id="top-shadow-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#000000" stop-opacity="0.9" />
                            <stop offset="80%" stop-color="#000000" stop-opacity="0" />
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
                    ${this._renderLightGlow(20, 30, 260, 210)}
                    
                    <rect x="15" y="30" width="10" height="210" fill="url(#track-grad)" />
                    <rect x="275" y="30" width="10" height="210" fill="url(#track-grad)" />

                    <g clip-path="url(#door-clip)">
                        <g id="door-group">
                            ${renderSegments(25, 250, this.currentPercentage, this.isDragging)}
                            
                            <rect id="interaction-zone" x="20" y="30" width="260" height="215" fill="transparent" 
                                cursor="${this._config?.disable_drag ? 'default' : 'ns-resize'}" 
                                style="touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                                @pointerdown=${(e: PointerEvent) => this.handleGarageStart(e, 1)}
                                @pointermove=${(e: PointerEvent) => { if (this.isDragging) this.processGarageDrag(e, 1); }}
                                @pointerup=${(e: PointerEvent) => this.handleGarageEnd(e, 1)}
                                @pointercancel=${(e: PointerEvent) => this.handleGarageEnd(e, 1)}/>
                        </g>
                    </g>

                    <rect x="10" y="10" width="280" height="20" rx="4" fill="url(#dyn-frame-grad)" stroke="#0f172a" stroke-width="2" />
                </svg>
            </div>
            `;
        }

        // 2. DOPPELGARAGE (550 x 240 – Paneelbreite 510px)
        if (mode === "double") {
            return html`
            <div style="width: 100%; display: flex; justify-content: center;">
                <svg viewBox="0 0 550 240" class="garage-svg" style="width: 100%; height: auto; touch-action: none;">
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
                        <linearGradient id="top-shadow-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#000000" stop-opacity="0.9" />
                            <stop offset="80%" stop-color="#000000" stop-opacity="0" />
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
                        <clipPath id="door-clip-double">
                            <rect x="0" y="30" width="550" height="210" />
                        </clipPath>
                    </defs>

                    <rect x="20" y="30" width="510" height="210" fill="url(#dynamic-sky-garage)" style="transition: fill 1s ease;" />
                    ${this._renderLightGlow(20, 30, 510, 210)}
                    
                    <rect x="12" y="30" width="10" height="210" fill="url(#track-grad)" />
                    <rect x="528" y="30" width="10" height="210" fill="url(#track-grad)" />

                    <g clip-path="url(#door-clip-double)">
                        <g id="door-group">
                            ${renderSegments(20, 510, this.currentPercentage, this.isDragging)}
                            
                            <rect id="interaction-zone" x="15" y="30" width="520" height="215" fill="transparent" 
                                cursor="${this._config?.disable_drag ? 'default' : 'ns-resize'}" 
                                style="touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                                @pointerdown=${(e: PointerEvent) => this.handleGarageStart(e, 1)}
                                @pointermove=${(e: PointerEvent) => { if (this.isDragging) this.processGarageDrag(e, 1); }}
                                @pointerup=${(e: PointerEvent) => this.handleGarageEnd(e, 1)}
                                @pointercancel=${(e: PointerEvent) => this.handleGarageEnd(e, 1)}/>
                        </g>
                    </g>

                    <rect x="8" y="10" width="534" height="20" rx="4" fill="url(#dyn-frame-grad)" stroke="#0f172a" stroke-width="2" />
                </svg>
            </div>
            `;
        }

        // 3. SPLITGARAGE (570 x 240 – Zwei Tore & Mittelpfeiler)
        return html`
        <div style="width: 100%; display: flex; justify-content: center;">
            <svg viewBox="0 0 570 240" class="garage-svg" style="width: 100%; height: auto; touch-action: none;">
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
                    <linearGradient id="top-shadow-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#000000" stop-opacity="0.9" />
                        <stop offset="80%" stop-color="#000000" stop-opacity="0" />
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
                    <clipPath id="door-clip-left"><rect x="0" y="30" width="270" height="210" /></clipPath>
                    <clipPath id="door-clip-right"><rect x="300" y="30" width="270" height="210" /></clipPath>
                </defs>

                <!-- Innenräume -->
                <rect x="20" y="30" width="245" height="210" fill="url(#dynamic-sky-garage)" style="transition: fill 1s ease;" />
                <rect x="305" y="30" width="245" height="210" fill="url(#dynamic-sky-garage)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(20, 30, 260, 210)}
                ${this._renderLightGlow(305, 30, 260, 210)}

                <!-- Schienen & Mittelpfeiler -->
                <rect x="15" y="30" width="10" height="210" fill="url(#track-grad)" />
                <rect x="260" y="30" width="10" height="210" fill="url(#track-grad)" />
                <rect x="300" y="30" width="10" height="210" fill="url(#track-grad)" />
                <rect x="545" y="30" width="10" height="210" fill="url(#track-grad)" />
                <rect x="270" y="10" width="30" height="230" fill="url(#dyn-frame-grad)" stroke="#0f172a" stroke-width="1" />

                <!-- TOR 1 (LINKS) -->
                <g clip-path="url(#door-clip-left)">
                    <g id="door-group-left">
                        ${renderSegments(25, 235, this.currentPercentage, this.isDragging)}
                        
                        <rect id="interaction-zone-left" x="20" y="30" width="245" height="215" fill="transparent" 
                            cursor="${this._config?.disable_drag ? 'default' : 'ns-resize'}" 
                            style="touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                            @pointerdown=${(e: PointerEvent) => this.handleGarageStart(e, 1)}
                            @pointermove=${(e: PointerEvent) => { if (this.isDragging) this.processGarageDrag(e, 1); }}
                            @pointerup=${(e: PointerEvent) => this.handleGarageEnd(e, 1)}
                            @pointercancel=${(e: PointerEvent) => this.handleGarageEnd(e, 1)}/>
                    </g>
                </g>

                <!-- TOR 2 (RECHTS) -->
                <g clip-path="url(#door-clip-right)">
                    <g id="door-group-right">
                        ${renderSegments(310, 235, (this as any).currentPercentage2 || 0, (this as any).isDragging2 || false)}
                        
                        <rect id="interaction-zone-right" x="305" y="30" width="245" height="215" fill="transparent" 
                            cursor="${this._config?.disable_drag ? 'default' : 'ns-resize'}" 
                            style="touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                            @pointerdown=${(e: PointerEvent) => this.handleGarageStart(e, 2)}
                            @pointermove=${(e: PointerEvent) => { if ((this as any).isDragging2) this.processGarageDrag(e, 2); }}
                            @pointerup=${(e: PointerEvent) => this.handleGarageEnd(e, 2)}
                            @pointercancel=${(e: PointerEvent) => this.handleGarageEnd(e, 2)}/>
                    </g>
                </g>

                <!-- Sturz oben -->
                <rect x="10" y="10" width="550" height="20" rx="4" fill="url(#dyn-frame-grad)" stroke="#0f172a" stroke-width="2" />
            </svg>
        </div>
        `;
    }

    private renderSash(x: number, y: number, w: number, h: number, handleSide: 'left' | 'right', state: string, isSliding: boolean, viewBoxW: number, viewBoxH: number, isFixedPane: boolean = false): TemplateResult {
        const isSashOpen = state === 'open' && !isFixedPane;
        const isSashTilt = state === 'tilt' && !isFixedPane;
        const isHandleLeft = handleSide === 'left';

        let transform = '';
        let transformOrigin = '';
        let handleTransform = '';
        let shadowOpacity = 0;

        if (isSliding) {
            const slidePct = isHandleLeft ? 85 : -85; 
            transformOrigin = '50% 100%';
            
            if (isSashOpen) {
                transform = `translate(${slidePct}%, -2%)`;
                handleTransform = 'rotate(-180deg)';
                shadowOpacity = 0.5;
            } else if (isSashTilt) {
                transform = `rotateX(-6deg)`;
                handleTransform = isHandleLeft ? 'rotate(-90deg)' : 'rotate(90deg)';
                shadowOpacity = 0.2;
            } else {
                transform = `translate(0%, 0%) rotateX(0deg)`;
                handleTransform = 'rotate(0deg)';
            }
        } else {
            transformOrigin = isHandleLeft ? '100% 50%' : '0% 50%'; 
            const rotateDir = isHandleLeft ? '' : '-';

            if (isSashOpen) {
                transform = `rotateY(${rotateDir}35deg)`;
                handleTransform = isHandleLeft ? 'rotate(-90deg)' : 'rotate(90deg)';
            } else if (isSashTilt) {
                transformOrigin = '50% 100%';
                transform = `rotateX(-12deg)`;
                handleTransform = 'rotate(-180deg)';
            } else {
                transform = `rotateY(0deg) rotateX(0deg)`;
                handleTransform = 'rotate(0deg)';
            }
        }

        const leftPct = (x / viewBoxW) * 100;
        const topPct = (y / viewBoxH) * 100;
        const widthPct = (w / viewBoxW) * 100;
        const heightPct = (h / viewBoxH) * 100;

        const frameW = isSliding ? 12 : 8;
        const hBaseW = 14, hBaseH = 28;
        const hX = isHandleLeft ? frameW + 2 : w - frameW - 2 - hBaseW;
        const hY = h / 2 - hBaseH / 2;
        const hLeverW = 8, hLeverH = 44;
        const leverX = hX + 3;
        const leverY = hY + hBaseH / 2 - hLeverW / 2;
        const pivotX = leverX + hLeverW / 2;
        const pivotY = leverY + hLeverW / 2;

        const zIndex = isFixedPane ? 5 : 10;

        return html`
            <div style="position: absolute; left: ${leftPct}%; top: ${topPct}%; width: ${widthPct}%; height: ${heightPct}%; perspective: 1200px; pointer-events: none; z-index: ${zIndex};">
                <div style="width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: ${transformOrigin}; transform: ${transform};">
                    
                    ${(isSliding && !isFixedPane) ? svg`
                        <svg viewBox="0 0 ${w} ${h}" style="position: absolute; width: 100\%; height: 100\%; left: 0; top: 0; opacity: ${shadowOpacity}; transition: opacity 0.6s;">
                            <rect x="0" y="0" width="${w}" height="${h}" fill="rgba(0,0,0,0.3)" filter="url(#sash-blur)" transform="translate(8,8)" />
                        </svg>
                    ` : ''}

                    <svg viewBox="0 0 ${w} ${h}" style="position: absolute; width: 100%; height: 100%; left: 0; top: 0; overflow: visible;">
                        <rect x="0" y="0" width="${w}" height="${h}" fill="url(#glass-reflection-sash)" />
                        
                        <rect x="${frameW/2}" y="${frameW/2}" width="${w - frameW}" height="${h - frameW}" fill="${isSliding ? 'rgba(255,255,255,0.02)' : 'none'}" stroke="#334155" stroke-width="${frameW}" />
                        <rect x="${frameW}" y="${frameW}" width="${w - frameW * 2}" height="${h - frameW * 2}" fill="none" stroke="#1e293b" stroke-width="1" />

                        ${!isFixedPane ? svg`
                            <g>
                                <rect x="${hX}" y="${hY}" width="${hBaseW}" height="${hBaseH}" rx="2" fill="#475569" stroke="#334155" stroke-width="1" />
                                <g style="transform-origin: ${pivotX}px ${pivotY}px; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); transform:${handleTransform};">
                                    <rect x="${leverX}" y="${leverY}" width="${hLeverW}" height="${hLeverH}" rx="3" fill="url(#handle-grad)" stroke="#94a3b8" stroke-width="1" filter="drop-shadow(2px 2px 3px rgba(0,0,0,0.4))"/>
                                </g>
                            </g>
                        ` : ''}
                    </svg>
                </div>
            </div>
        `;
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
        const view = this._config?.cover_view || "window";
        const handleSide = this._config?.handle_side || "right";
        const isHandleLeft = handleSide === "left";
        
        const hasWindowSensor = !!this._config?.window_entity; 
        
        let windowState = "closed";
        if (hasWindowSensor && this.windowStateObj) {
            const s = this.windowStateObj.state.toLowerCase();
            if (s === 'on' || s === 'open' || s === 'true') windowState = "open";
            else if (s === 'tilt' || s === 'gekippt') windowState = "tilt";
        }
        
        let viewBoxW = 260;
        let viewBoxH = 240;
        let backgroundSvg: TemplateResult;
        let overlayHtml: TemplateResult | string = "";

        if (view === "sliding") {
            viewBoxW = 520;
            const staticHandleX = isHandleLeft ? 244 : 268;
            
            backgroundSvg = svg`
                <clipPath id="shutter-window-clip"><rect x="55" y="10" width="410" height="230" /></clipPath>
                <rect x="52" y="10" width="416" height="230" fill="url(#dynamic-sky-shutter)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(55, 10, 410, 230)}
                
                ${!hasWindowSensor ? svg`
                    <rect x="52" y="10" width="416" height="230" fill="url(#glass-reflection-shutter)" />
                    <rect x="258" y="10" width="4" height="230" fill="#1e293b" opacity="0.9" /> 
                    <rect x="${staticHandleX}" y="130" width="8" height="25" rx="3" fill="#94a3b8" /> 
                    <line x1="52" y1="239" x2="468" y2="239" stroke="#0f172a" stroke-width="2" stroke-dasharray="8 4" opacity="0.4"/> 
                ` : ''}

                <g clip-path="url(#shutter-window-clip)">${this.renderShutterSlats(35, 1.0, 410, 55, 10, 230)}</g>
                
                <rect x="50" y="10" width="5" height="230" fill="${baseFrame}" />
                <rect x="465" y="10" width="5" height="230" fill="${baseFrame}" />
                <rect x="50" y="0" width="420" height="10" rx="2" fill="${baseFrame}" />
                <rect x="50" y="10" width="420" height="2" fill="#0f172a" opacity="0.4"/>
            `;

            if (hasWindowSensor) {
                const sashX = isHandleLeft ? 50 : 260; 
                const staticX = isHandleLeft ? 260 : 50;
                overlayHtml = html`
                    ${this.renderSash(staticX, 10, 210, 230, handleSide, 'closed', true, viewBoxW, viewBoxH, true)}
                    ${this.renderSash(sashX, 10, 210, 230, handleSide, windowState, true, viewBoxW, viewBoxH, false)}
                `;
            }

        } else if (view === "door") {
            const staticHandleX = isHandleLeft ? 60 : 188;
            backgroundSvg = svg`
                <clipPath id="shutter-window-clip"><rect x="55" y="10" width="150" height="230" /></clipPath>
                <rect x="52" y="10" width="156" height="230" fill="url(#dynamic-sky-shutter)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(55, 10, 150, 230)}
                
                ${!hasWindowSensor ? svg`
                    <rect x="52" y="10" width="156" height="230" fill="url(#glass-reflection-shutter)" />
                    <rect x="${staticHandleX}" y="130" width="8" height="25" rx="3" fill="#94a3b8" /> 
                    <line x1="52" y1="239" x2="208" y2="239" stroke="#0f172a" stroke-width="2" stroke-dasharray="8 4" opacity="0.4"/> 
                ` : ''}

                <g clip-path="url(#shutter-window-clip)">${this.renderShutterSlats(35, 1.0, 150, 55, 10, 230)}</g>

                <rect x="50" y="10" width="5" height="230" fill="${baseFrame}" /> 
                <rect x="205" y="10" width="5" height="230" fill="${baseFrame}" /> 
                <rect x="50" y="0" width="160" height="10" rx="2" fill="${baseFrame}" />
                <rect x="50" y="10" width="160" height="2" fill="#0f172a" opacity="0.4"/>
            `;
            if (hasWindowSensor) {
                overlayHtml = this.renderSash(50, 10, 160, 230, handleSide, windowState, false, viewBoxW, viewBoxH);
            }

        } else {
            backgroundSvg = svg`
                <clipPath id="shutter-window-clip"><rect x="30" y="20" width="200" height="210" /></clipPath>
                <rect x="27" y="20" width="206" height="210" fill="url(#dynamic-sky-shutter)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(30, 20, 200, 210)}
                
                ${!hasWindowSensor ? svg`<rect x="27" y="20" width="206" height="210" fill="url(#glass-reflection-shutter)" />` : ''}
                
                <g clip-path="url(#shutter-window-clip)">${this.renderShutterSlats(20, 1.5, 200, 30, 20, 210)}</g>

                <rect x="25" y="20" width="5" height="210" fill="${baseFrame}" />
                <rect x="230" y="20" width="5" height="210" fill="${baseFrame}" />
                <rect x="25" y="10" width="210" height="10" rx="2" fill="${baseFrame}" />
                <rect x="25" y="20" width="210" height="2" fill="#0f172a" opacity="0.4"/>
            `;
            if (hasWindowSensor) {
                overlayHtml = this.renderSash(25, 20, 210, 210, handleSide, windowState, false, viewBoxW, viewBoxH);
            }
        }

        return html`
            <div style="display: flex; justify-content: center; width: 100%;">
                <div style="position: relative; width: 100%; max-width: ${view === 'sliding' ? '100%' : 'calc(100% - 56px)'}; 
                            cursor: ${this._config?.disable_drag ? 'default' : 'ns-resize'}; 
                            touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                    @pointerdown=${this.handleShutterStart}
                    @pointermove=${(e: PointerEvent) => { if(this.isDragging) this.processShutterDrag(e); }}
                    @pointerup=${this.handleShutterEnd}
                    @pointercancel=${this.handleShutterEnd}>
                    
                    <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" style="width: 100%; height: auto; pointer-events: none; display: block;">
                        <defs>
                            <linearGradient id="dyn-moving-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${movingLight}" /><stop offset="50%" stop-color="${baseMoving}" /><stop offset="100%" stop-color="${movingDark}" /></linearGradient>
                            <linearGradient id="dynamic-sky-shutter" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sky.top}" /><stop offset="100%" stop-color="${sky.bottom}" /></linearGradient>
                            <linearGradient id="glass-reflection-shutter" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" /><stop offset="30%" stop-color="#ffffff" stop-opacity="0.0" /></linearGradient>
                            <linearGradient id="glass-reflection-sash" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" /><stop offset="40%" stop-color="#ffffff" stop-opacity="0.0" /><stop offset="100%" stop-color="#ffffff" stop-opacity="0.05" /></linearGradient>
                            <linearGradient id="handle-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#cbd5e1" /><stop offset="50%" stop-color="#f8fafc" /><stop offset="100%" stop-color="#94a3b8" /></linearGradient>
                            <filter id="sash-blur"><feGaussianBlur stdDeviation="4"/></filter>
                        </defs>
                        ${backgroundSvg}
                    </svg>

                    ${overlayHtml}
                </div>
            </div>
        `;
    }

    private renderBlind(): TemplateResult {
        const use3D = this._config?.use_3d_colors !== false;
        const baseFrame = this._config?.color_frame || "#1e293b";
        const baseMoving = this._config?.color_moving || "#475569";
        const movingLight = use3D ? this._getShadedColor(baseMoving, 0.15) : baseMoving;
        const movingDark = use3D ? this._getShadedColor(baseMoving, -0.3) : baseMoving;
        
        const view = this._config?.cover_view || "window";
        const handleSide = this._config?.handle_side || "right";
        const isHandleLeft = handleSide === "left";
        const hasWindowSensor = !!this._config?.window_entity;
        
        const visualPercent = 100 - this.currentPercentage;
        const startY = view === 'window' ? 40 : 35;
        const maxTravel = view === 'window' ? 190 : 205;
        const yBottomRail = startY + (visualPercent / 100) * maxTravel;
        const bottomRailColor = this.isDragging ? "#38bdf8" : (use3D ? this._getShadedColor(baseMoving, -0.2) : baseMoving);

        const sky = this._getSkyColors();

        let windowState = "closed";
        if (hasWindowSensor && this.windowStateObj) {
            const s = this.windowStateObj.state.toLowerCase();
            if (s === 'on' || s === 'open' || s === 'true') windowState = "open";
            else if (s === 'tilt' || s === 'gekippt') windowState = "tilt";
        }

        let viewBoxW = 260;
        let viewBoxH = 240;
        let backgroundSvg: TemplateResult;
        let overlayHtml: TemplateResult | string = "";

        if (view === "sliding") {
            viewBoxW = 520;
            const staticHandleX = isHandleLeft ? 244 : 268;

            backgroundSvg = svg`
                <rect x="52" y="35" width="416" height="205" fill="url(#dynamic-sky-blind)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(55, 35, 410, 205)}
                
                ${!hasWindowSensor ? svg`
                    <rect x="52" y="35" width="416" height="205" fill="url(#glass-reflection-shutter)" />
                    <rect x="258" y="35" width="4" height="205" fill="#1e293b" opacity="0.9" /> 
                    <rect x="${staticHandleX}" y="130" width="8" height="25" rx="3" fill="#94a3b8" /> 
                    <line x1="52" y1="239" x2="468" y2="239" stroke="#0f172a" stroke-width="2" stroke-dasharray="8 4" opacity="0.4"/> 
                ` : ''}

                <line x1="157.5" y1="35" x2="157.5" y2="240" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>
                <line x1="362.5" y1="35" x2="362.5" y2="240" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>

                ${this.renderSlats()}
                
                <g>
                    <rect x="52" y="${(yBottomRail - 1).toFixed(2)}" width="3" height="4.0" fill="${baseFrame}" />
                    <rect x="465" y="${(yBottomRail - 1).toFixed(2)}" width="3" height="4.0" fill="${baseFrame}" />
                    <rect x="54" y="${(yBottomRail - 4.5).toFixed(2)}" width="412" height="6.0" fill="${bottomRailColor}" rx="1" style="transition: fill 0.2s ease;" />
                </g>

                <rect x="52" y="35" width="3" height="205" fill="${baseFrame}" />
                <rect x="465" y="35" width="3" height="205" fill="${baseFrame}" />
                <rect x="50" y="10" width="420" height="25" fill="${baseFrame}" />
                <rect x="50" y="35" width="420" height="1" fill="#0f172a" opacity="0.6" />
            `;

            if (hasWindowSensor) {
                const sashX = isHandleLeft ? 52 : 260;
                const staticX = isHandleLeft ? 260 : 52;
                overlayHtml = html`
                    ${this.renderSash(staticX, 35, 208, 205, handleSide, 'closed', true, viewBoxW, viewBoxH, true)}
                    ${this.renderSash(sashX, 35, 208, 205, handleSide, windowState, true, viewBoxW, viewBoxH, false)}
                `;
            }

        } else if (view === "door") {
            const staticHandleX = isHandleLeft ? 60 : 188;
            backgroundSvg = svg`
                <rect x="52" y="35" width="156" height="205" fill="url(#dynamic-sky-blind)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(55, 35, 150, 205)}
                
                ${!hasWindowSensor ? svg`
                    <rect x="52" y="35" width="156" height="205" fill="url(#glass-reflection-shutter)" />
                    <rect x="${staticHandleX}" y="130" width="8" height="25" rx="3" fill="#94a3b8" /> 
                    <line x1="52" y1="239" x2="208" y2="239" stroke="#0f172a" stroke-width="2" stroke-dasharray="8 4" opacity="0.4"/> 
                ` : ''}

                <line x1="80" y1="35" x2="80" y2="240" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>
                <line x1="180" y1="35" x2="180" y2="240" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>

                ${this.renderSlats()}
                
                <g>
                    <rect x="52" y="${(yBottomRail - 1).toFixed(2)}" width="3" height="4.0" fill="${baseFrame}" />
                    <rect x="205" y="${(yBottomRail - 1).toFixed(2)}" width="3" height="4.0" fill="${baseFrame}" />
                    <rect x="54" y="${(yBottomRail - 4.5).toFixed(2)}" width="152" height="6.0" fill="${bottomRailColor}" rx="1" style="transition: fill 0.2s ease;" />
                </g>

                <rect x="52" y="35" width="3" height="205" fill="${baseFrame}" />
                <rect x="205" y="35" width="3" height="205" fill="${baseFrame}" />
                <rect x="50" y="10" width="160" height="25" fill="${baseFrame}" />
                <rect x="50" y="35" width="160" height="1" fill="#0f172a" opacity="0.6" />
            `;
            if (hasWindowSensor) {
                overlayHtml = this.renderSash(52, 35, 156, 205, handleSide, windowState, false, viewBoxW, viewBoxH);
            }
        } else {
            backgroundSvg = svg`
                <rect x="27" y="40" width="206" height="190" fill="url(#dynamic-sky-blind)" style="transition: fill 1s ease;" />
                ${this._renderLightGlow(30, 40, 200, 190)}
                
                ${!hasWindowSensor ? svg`<rect x="27" y="40" width="206" height="190" fill="url(#glass-reflection-shutter)" />` : ''}

                <line x1="60" y1="40" x2="60" y2="230" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>
                <line x1="200" y1="40" x2="200" y2="230" stroke="#334155" stroke-width="1.0" stroke-dasharray="2,2" opacity="0.6"/>

                ${this.renderSlats()}
                
                <g>
                    <rect x="27" y="${(yBottomRail - 2).toFixed(2)}" width="3" height="4.0" fill="${baseFrame}" />
                    <rect x="230" y="${(yBottomRail - 2).toFixed(2)}" width="3" height="4.0" fill="${baseFrame}" />
                    <rect x="29" y="${(yBottomRail - 5.5).toFixed(2)}" width="202" height="6.0" fill="${bottomRailColor}" rx="1" style="transition: fill 0.2s ease;" />
                </g>
                <rect x="27" y="40" width="3" height="190" fill="${baseFrame}" />
                <rect x="230" y="40" width="3" height="190" fill="${baseFrame}" />
                <rect x="25" y="15" width="210" height="25" fill="${baseFrame}" />
                <rect x="25" y="40" width="210" height="1" fill="#0f172a" opacity="0.6" />
            `;
            if (hasWindowSensor) {
                overlayHtml = this.renderSash(27, 40, 206, 190, handleSide, windowState, false, viewBoxW, viewBoxH);
            }
        }

        return html`
            <div style="display: flex; gap: 12px; width: 100%; align-items: flex-end;">
                <div style="position: relative; flex-grow: 1; max-width: ${view === 'sliding' ? '100%' : 'calc(100% - 56px)'}; aspect-ratio: ${viewBoxW} / ${viewBoxH};
                            cursor: ${this._config?.disable_drag ? 'default' : 'ns-resize'}; 
                            touch-action: ${this._config?.disable_drag ? 'auto' : 'none'};"
                    @pointerdown=${this.handleBlindStart}
                    @pointermove=${(e: PointerEvent) => { if(this.isDragging) this.processBlindDrag(e); }}
                    @pointerup=${this.handleBlindEnd}
                    @pointercancel=${this.handleBlindEnd}>
                    
                    <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: block;">
                        <defs>
                            <linearGradient id="dyn-moving-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${movingDark}" /><stop offset="25%" stop-color="${movingLight}" /><stop offset="75%" stop-color="${baseMoving}" /><stop offset="100%" stop-color="${movingDark}" /></linearGradient>
                            <linearGradient id="dynamic-sky-blind" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${sky.top}" /><stop offset="100%" stop-color="${sky.bottom}" /></linearGradient>
                            <linearGradient id="glass-reflection-shutter" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" /><stop offset="30%" stop-color="#ffffff" stop-opacity="0.0" /></linearGradient>
                            <linearGradient id="glass-reflection-sash" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" /><stop offset="40%" stop-color="#ffffff" stop-opacity="0.0" /><stop offset="100%" stop-color="#ffffff" stop-opacity="0.05" /></linearGradient>
                            <linearGradient id="handle-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#cbd5e1" /><stop offset="50%" stop-color="#f8fafc" /><stop offset="100%" stop-color="#94a3b8" /></linearGradient>
                            <filter id="sash-blur"><feGaussianBlur stdDeviation="4"/></filter>
                        </defs>

                        ${backgroundSvg}
                        
                        ${view === 'window' ? svg`
                            <text x="130" y="31" fill="#0f172a" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="0.5" opacity="0.8">${this.localize('blind')}:${Math.round(this.currentPercentage)}%</text>
                        ` : ''}
                    </svg>

                    ${overlayHtml}
                </div>

                <div style="position: relative; width: 44px; align-self: stretch; background: #0f172a; border-radius: 12px; border: 1px solid #1e293b; display: flex; justify-content: center; padding: 12px 0; 
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

    private renderShutterSlats(count: number, gap: number, width: number, xPos: number, startY: number, maxTravel: number): TemplateResult[] {
        const slats: TemplateResult[] = [];
        const slatHeight = maxTravel / count;
        
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

        const currentGap = ventilationRatio * gap;
        const liftOffset = liftRatio * maxTravel;
        const bottomRailY = startY + maxTravel - liftOffset;

        for (let i = 0; i < count; i++) {
            const slatY = bottomRailY - ((count - i) * slatHeight) - ((count - 1 - i) * currentGap);
            slats.push(svg`
                <rect x="${xPos}" y="${slatY.toFixed(2)}" width="${width}" height="${(slatHeight + 0.5).toFixed(2)}" fill="url(#dyn-moving-grad)" stroke="#0f172a" stroke-width="0.5" style="transition: y 0.1s linear;" />
            `);
        }

        slats.push(svg`
            <rect x="${xPos}" y="${bottomRailY.toFixed(2)}" width="${width}" height="8" fill="${bottomRailColor}" stroke="#0f172a" stroke-width="1" rx="2" style="transition: y 0.1s linear, fill 0.2s ease;" />
        `);

        return slats;
    }

    private renderSlats(): TemplateResult[] {
        const view = this._config?.cover_view || 'window';
        const isWindow = view === 'window';
        
        // Dynamische Eigenschaften anhand der Ansicht
        const count = isWindow ? 16 : 22;
        const slatHeight = isWindow ? 12.0 : 9.0;
        const stackedHeight = isWindow ? 1.5 : 1.2;
        const startY = isWindow ? 40 : 35;
        const maxTravel = isWindow ? 190 : 205;
        const width = view === 'sliding' ? 410 : (isWindow ? 200 : 150);
        const xPos = isWindow ? 30 : 55; // Perfekt zentriert
        
        const slats: TemplateResult[] = [];
        const visualPercent = 100 - this.currentPercentage;
        
        const yBottomRail = startY + (visualPercent / 100) * maxTravel;
        const maxSpacing = maxTravel / (count - 1); 

        for (let i = 0; i < count; i++) {
            const yExtended = startY + (i * maxSpacing);
            const yStacked = yBottomRail - ((count - 1 - i) * stackedHeight);
            const yActual = Math.min(yExtended, yStacked);

            const distFromStack = yStacked - yActual;
            const transitionZone = 12.0; 
            const tiltFactor = Math.min(1, Math.max(0, distFromStack / transitionZone));
            const currentSlatTilt = this.currentTilt * tiltFactor;

            const maxRotation = 78;
            const currentRotation = maxRotation * (1 - (currentSlatTilt / 100));

            slats.push(svg`
                <g style="transform-box: fill-box; transform-origin: center; transform: rotateX(${currentRotation}deg); transition: transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1);">
                    <rect x="${xPos - 1.5}" y="${(yActual - 0.5).toFixed(2)}" width="1.5" height="2.0" fill="#475569" />
                    <rect x="${xPos + width}" y="${(yActual - 0.5).toFixed(2)}" width="1.5" height="2.0" fill="#475569" />
                    <rect x="${xPos}" y="${(yActual - (slatHeight / 2)).toFixed(2)}" width="${width}" height="${slatHeight}" rx="1" fill="url(#dyn-moving-grad)" />
                </g>
            `);
        }
        return slats;
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
        const garageMode = this._config?.garage_mode || "single";
        const btnColor = this._config?.color_button || "#1e293b";

        return html`

        <ha-card @click=${this._handleMoreInfo} style="cursor: pointer; overflow: visible;">
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

                <!-- CONTROLS BEREICH -->
                ${coverType === 'garage' && garageMode === 'split' ? html`
                    <!-- Splitgarage: Getrennte Steuerung für Tor 1 (Links) und Tor 2 (Rechts) -->
                    <div class="controls-split" @click=${(e: Event) => e.stopPropagation()} style="display: flex; gap: 16px; width: 100%; cursor: default;">
                        <!-- Tor 1 Buttons (Links) -->
                        <div style="flex: 1; display: flex; gap: 6px; justify-content: center;">
                            ${this._config?.show_main_buttons !== false ? html`
                                <button @click=${() => this._callCover('open', 1)} style="flex: 1; max-width: 80px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center;"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                            ` : ''}
                            ${this._config?.show_stop_button !== false ? html`
                                <button @click=${() => this._callCover('stop', 1)} style="flex: 1; max-width: 80px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center;"><ha-icon icon="mdi:stop"></ha-icon></button>
                            ` : ''}
                            ${this._config?.show_main_buttons !== false ? html`
                                <button @click=${() => this._callCover('close', 1)} style="flex: 1; max-width: 80px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center;"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                            ` : ''}
                        </div>

                        <!-- Tor 2 Buttons (Rechts) -->
                        <div style="flex: 1; display: flex; gap: 6px; justify-content: center;">
                            ${this._config?.show_main_buttons !== false ? html`
                                <button @click=${() => this._callCover('open', 2)} style="flex: 1; max-width: 80px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center;"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
                            ` : ''}
                            ${this._config?.show_stop_button !== false ? html`
                                <button @click=${() => this._callCover('stop', 2)} style="flex: 1; max-width: 80px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center;"><ha-icon icon="mdi:stop"></ha-icon></button>
                            ` : ''}
                            ${this._config?.show_main_buttons !== false ? html`
                                <button @click=${() => this._callCover('close', 2)} style="flex: 1; max-width: 80px; height: 44px; border-radius: 8px; border: none; background: ${btnColor}; color: #f8fafc; cursor: pointer; display: flex; justify-content: center; align-items: center;"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
                            ` : ''}
                        </div>
                    </div>
                ` : (this._config?.show_main_buttons !== false || this._config?.show_stop_button !== false || this._config?.show_vent_button === true) ? html`
                    <!-- Standard Buttons (Einzelgarage, Doppelgarage, Rollladen, Raffstore) -->
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
