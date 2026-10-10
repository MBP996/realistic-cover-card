# Realistic Cover Card für Home Assistant

Eine hochwertige, interaktive und animierte Custom Card für Home Assistant zur Steuerung von Rollläden, Raffstores und Garagentoren[cite: 2]. 

Die Karte nutzt fortschrittliche SVG-Renderings, um den aktuellen Status und die Bewegung deiner Abdeckungen in Echtzeit darzustellen, und reagiert dynamisch auf deine Umgebung (z.B. Sonnenstand und Raumlicht)[cite: 2].

## 🎬 Vorschau der Modelle

Hier sind die verschiedenen Darstellungsmöglichkeiten der Karte. **Neu:** Rollladen und Raffstores gibt es nun in unterschiedlichen Versionen als Fenster, Türe und Schiebetüre inkl. neuer Fensteranimationen und verschiedener Garagenmodi!

| Garagentor | Rollladen | Raffstore |
|:---:|:---:|:---:|
| ![Garagentor](assets/Garage.gif) | ![Rollladen](assets/Rollladen.gif) | ![Raffstore](assets/Raffstore.gif) |

| Fenster | Schiebetür |
|:---:|:---:|
| ![Fenster](assets/Fenster.gif) | ![Schiebetür](assets/Schiebetür.gif) |

## 🛠️ Editor-Einstellungen & Funktionen

Alle neuen Funktionen lassen sich direkt im visuellen Editor konfigurieren. Hier ein Einblick in die verschiedenen Einstellungsmöglichkeiten:

* **Allgemeine Farbauswahl:**
  ![Farbauswahl](assets/FarbauswahlFunktion.gif)

* **Fenster- & Fenstergriff-Funktionen:**
  ![Fenster](assets/FensterFunktionen.gif)
  ![Fenstergriff](assets/FenstergriffFunktion.gif)

* **Spezifische Abdeckungs-Funktionen:**
  * **Garagen:** ![Garagen](assets/GaragenFunktionen.gif)
  * **Rollladen:** ![Rollladen](assets/RollladenFunktionen.gif)
  * **Raffstores:** ![Raffstore](assets/RaffstoreFunktionen.gif)

![Visual Editor](assets/image.png)

## ✨ Features

* **Erweiterte unterstützte Typen:** Garagentor (verschiedene Modi), Rollladen und Raffstore (inkl. Lamellen-Neigung) – jeweils anpassbar als Fenster, Türe oder Schiebetüre.
* **Interaktive Steuerung:** Wische (Drag) den Behang direkt in der Grafik hoch und runter, um die Position einzustellen[cite: 2].
* **Fensteranimationen:** Neue, flüssige Animationen für das Öffnen und Schließen von Fenstern und Türen.
* **Dynamischer Sonnen-Hintergrund:** Die Karte liest automatisch die Entität `sun.sun` aus. Der Himmel im Fensterhintergrund färbt sich stufenlos vom strahlenden Blau (Tag) über Orange (Dämmerung) bis hin zu Dunkelblau/Schwarz (Nacht)[cite: 2].
* **Raumlicht-Spiegelung (Glow):** Verknüpfe eine Licht-Entität mit der Karte. Wenn das Licht im Zimmer brennt, spiegelt sich ein warmer "Glow" im Fensterglas[cite: 2].
* **More-Info Dialog:** Ein Klick auf die Karte öffnet den Standard-Einstellungsdialog der Cover-Entität[cite: 2].
* **Anpassbare Buttons:** Blende Haupt-Buttons (Auf/Zu), einen Stop-Button und einen dedizierten Lüftungs-Button (mit definierbarer Zielposition) nach Belieben ein oder aus[cite: 2].
* **Visueller Editor:** Vollständige Integration in den Home Assistant Card Picker UI-Editor. Kein YAML-Code zwingend erforderlich![cite: 2].
* **100% Anpassbar:** Ändere die Farben von Rahmen, Behang, Fensterhintergrund und Buttons oder schalte den 3D-Schatten-Effekt um[cite: 2].

## 📦 Installation (über HACS)

1. Öffne Home Assistant und navigiere zu **HACS** > **Frontend**[cite: 2].
2. Klicke oben rechts auf das Drei-Punkte-Menü und wähle **Benutzerdefinierte Repositories**[cite: 2].
3. Füge die URL dieses Repositories ein und wähle die Kategorie **Lovelace**[cite: 2].
4. Klicke auf **Hinzufügen**[cite: 2].
5. Suche in HACS nach *Realistic Cover Card* und klicke auf **Herunterladen**[cite: 2].
6. Lade dein Dashboard neu (oder leere den Cache deines Browsers)[cite: 2].

## ⚙️ Konfiguration

Du kannst die Karte ganz einfach über den visuellen Editor in Home Assistant hinzufügen. Wähle dazu beim Hinzufügen einer neuen Karte **"Realistic Cover"** aus der Liste aus[cite: 2].

### Optionen im Editor

* **Titel:** Die Überschrift der Karte[cite: 2].
* **Haupt-Entität:** Deine `cover.*` Entität[cite: 2].
* **Art der Abdeckung:** Wähle zwischen *Garagentor*, *Rollladen* und *Raffstore* (sowie den neuen Fenster-/Tür-Varianten)[cite: 2].
* **Behanghöhe / Neigung invertieren:** Falls deine Entität 0% als "Offen" interpretiert, kannst du das Verhalten hier umkehren[cite: 2].
* **Licht / Schalter (Optional):** Für die Raumlicht-Spiegelung im Fenster[cite: 2].
* **Sensor / Kontakt (Optional):** Zeigt den Status eines zusätzlichen Fenster- oder Torkontakts als kleinen Text-Badge an[cite: 2].
* **Sichtbarkeit:** Schalte Status-Texte, Auf/Zu-Buttons, Stop-Buttons oder den Lüftungs-Button individuell ein[cite: 2].
* **Drag-Steuerung deaktivieren:** Deaktiviert das Wischen in der Grafik, falls du nur die Tasten nutzen möchtest[cite: 2].
* **Farben:** Individuelle Color-Picker für Rahmen, Behang, Fenster und Buttons inkl. Reset-Funktion. Wird die Fensterfarbe auf Standard (leer) gesetzt, greift automatisch der Himmels-Farbverlauf der Sonne[cite: 2].

### Manuelle YAML-Konfiguration (Optional)

Falls du YAML bevorzugst, hier ein Beispiel-Code:

```yaml
type: custom:realistic-cover-card
entity: cover.wohnzimmer_ost
title: Wohnzimmer Ost
cover_type: shutter
light_entity: light.wohnzimmer_decke
sensor_entity: binary_sensor.fensterkontakt_ost
show_stop_button: true
show_vent_button: true
vent_percentage: 15
use_3d_colors: true