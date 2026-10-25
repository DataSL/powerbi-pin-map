"use strict";

import "leaflet/dist/leaflet.css";
import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.extensibility.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { VisualFormattingSettingsModel } from "./settings";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import ITooltipService = powerbi.extensibility.ITooltipService;

// Importation de Leaflet via le namespace global
import * as L from "leaflet";

export class Visual implements IVisual {
    private target: HTMLElement;
    private map: L.Map;
    private layerGroup: L.LayerGroup;
    private currentTileLayer: L.TileLayer; // Référence vers la couche de fond actuelle
    
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    private selectionManager: ISelectionManager;
    private blankSelectionId: ISelectionId;
    private tooltipService: ITooltipService;
    
    private filterContainer: HTMLDivElement;
    private filterToggleButton: HTMLButtonElement;
    private isFilterVisible: boolean = true;
    private filterState: Map<string, Set<string>> = new Map();
    private currentDataView: powerbi.DataView;

    // Visuel gratuit : aucune vérification de licence (plus de plan payant via Microsoft).
    constructor(options: VisualConstructorOptions) {
        this.target = options.element;
        if (this.target) {
            this.target.style.position = "relative";
        }

        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.blankSelectionId = this.host.createSelectionIdBuilder().createSelectionId();
        this.tooltipService = this.host.tooltipService;

        this.initLeafletIconFix();

        const mapDiv = this.createMapContainer();
        this.addRootContextMenu(mapDiv);
        this.initMap(mapDiv);
        this.createFilterUI();
    }

    private initLeafletIconFix(): void {
        // On supprime la méthode automatique de Leaflet qui échoue dans PowerBI
        delete (L.Icon.Default.prototype as any)._getIconUrl;
    }

    private createMapContainer(): HTMLDivElement {
        const mapDiv = document.createElement("div");
        mapDiv.id = "map-container";
        mapDiv.style.width = "100%";
        mapDiv.style.height = "100%";
        this.target.appendChild(mapDiv);
        return mapDiv;
    }

    private addRootContextMenu(mapDiv: HTMLDivElement): void {
        // Context menu Power BI sur clic droit (fond de carte / zones non interactives)
        // Capture-phase pour éviter que Leaflet n'intercepte/stoppe l'événement.
        mapDiv.addEventListener(
            "contextmenu",
            (event: MouseEvent) => {
                const target = event.target as Element | null;
                if (target?.closest(".leaflet-marker-icon") || target?.closest(".leaflet-interactive")) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                this.selectionManager.showContextMenu(this.blankSelectionId, {
                    x: event.clientX,
                    y: event.clientY
                });
            },
            true
        );
    }

    private initMap(mapDiv: HTMLDivElement): void {
        // On centre sur Paris par défaut, zoom 11
        this.map = L.map(mapDiv).setView([48.8566, 2.3522], 11);

        // Initialiser une couche de tuiles par défaut (sera mise à jour dans update)
        this.currentTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(this.map);

        // Créer un groupe pour les marqueurs (pour pouvoir les effacer facilement)
        this.layerGroup = L.layerGroup().addTo(this.map);
    }

    private createFilterUI(): void {
        // Créer le bouton de bascule des filtres
        this.filterToggleButton = document.createElement("button");
        this.filterToggleButton.id = "filter-toggle-btn";
        this.filterToggleButton.innerText = "Filtres ▼";
        this.filterToggleButton.style.position = "absolute";
        this.filterToggleButton.style.top = "10px";
        this.filterToggleButton.style.right = "10px";
        this.filterToggleButton.style.zIndex = "100000";
        this.filterToggleButton.style.display = "none";
        this.filterToggleButton.style.cursor = "pointer";
        this.filterToggleButton.style.backgroundColor = "white";
        this.filterToggleButton.style.border = "1px solid #ccc";
        this.filterToggleButton.style.borderRadius = "4px";
        this.filterToggleButton.style.padding = "5px 10px";
        this.filterToggleButton.style.boxShadow = "0 0 5px rgba(0,0,0,0.2)";
        this.filterToggleButton.style.fontWeight = "bold";
        this.filterToggleButton.style.fontSize = "12px";
        this.filterToggleButton.style.color = "#333";

        // Créer le conteneur de filtres avant l'handler pour éviter tout accès undefined
        this.filterContainer = document.createElement("div");
        this.filterContainer.id = "filter-container";
        this.filterContainer.style.position = "absolute";
        this.filterContainer.style.top = "45px";
        this.filterContainer.style.right = "10px";
        this.filterContainer.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
        this.filterContainer.style.padding = "10px";
        this.filterContainer.style.zIndex = "1000";
        this.filterContainer.style.borderRadius = "4px";
        this.filterContainer.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";
        this.filterContainer.style.display = "none";
        this.filterContainer.style.maxHeight = "80%";
        this.filterContainer.style.overflowY = "auto";
        L.DomEvent.disableClickPropagation(this.filterContainer);
        L.DomEvent.disableScrollPropagation(this.filterContainer);
        this.target.appendChild(this.filterContainer);

        this.filterToggleButton.onclick = (e) => {
            this.isFilterVisible = !this.isFilterVisible;
            this.filterContainer.style.display = this.isFilterVisible ? "block" : "none";
            this.filterToggleButton.innerText = this.isFilterVisible ? "Filtres ▼" : "Filtres ▶";
            e.stopPropagation();
        };
        this.target.appendChild(this.filterToggleButton);
    }

    public update(options: VisualUpdateOptions) {
        // Signal rendering start
        this.host.eventService.renderingStarted(options);

        try {
        // Récupérer les paramètres de formatage
        // On passe null si dataViews est vide pour charger les valeurs par défaut
        const dataView = options.dataViews && options.dataViews[0];
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);

        // --- GESTION DU FOND DE CARTE ---
        const mapStyle = this.formattingSettings?.mapSettings?.style?.value?.value || "osm";
        let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        let attribution = '&copy; OpenStreetMap contributors';

        if (mapStyle === "cartoLight") {
            tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
        } else if (mapStyle === "cartoDark") {
            tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
        }

        // Si l'URL a changé, on remplace la couche
        if (this.currentTileLayer) {
            // Vérification simple pour éviter de recharger si c'est la même URL (optionnel mais performant)
            // @ts-expect-error - accessing private _url property of Leaflet TileLayer
            if (this.currentTileLayer._url !== tileUrl) {
                this.map.removeLayer(this.currentTileLayer);
                this.currentTileLayer = L.tileLayer(tileUrl, { attribution: attribution }).addTo(this.map);
                this.currentTileLayer.bringToBack(); // S'assurer que le fond reste derrière les marqueurs
            }
        }

        // --------------------------------
    // Vérifier si on a des données
            if (!options.dataViews || !options.dataViews[0] || !options.dataViews[0].categorical) {
                this.host.eventService.renderingFinished(options);
                return;
            }

            this.currentDataView = dataView;
            this.renderFilters();
            this.renderMarkers(dataView);
            
            // Forcer le redimensionnement de la carte (fix fréquent dans Power BI)
            this.map.invalidateSize();

            // Signal rendering success
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            // Signal rendering failure
            this.host.eventService.renderingFailed(options, error);
            throw error;
        }
    }

    /**
     * Cette méthode est OBLIGATOIRE pour afficher les options personnalisées dans le volet de formatage.
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        // Si les paramètres ne sont pas encore chargés (ex: pas de données), on charge les valeurs par défaut
        if (!this.formattingSettings) {
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, null);
        }
        
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private applyPowerBIFilter() {
        // For now, we rely on the built-in selection mechanism for cross-filtering
        // The internal filter UI is disabled when using categorical mapping
    }

    private renderFilters() {
        // Hide filter UI - filters are handled through Power BI's built-in mechanism
        this.filterContainer.style.display = "none";
        this.filterToggleButton.style.display = "none";
    }

    private createMarker(lat: number, lon: number, opacity: number, markerType: string, markerColor: string, markerRadius: number): L.Marker | L.CircleMarker {
        if (markerType === "circle") {
            return L.circleMarker([lat, lon], {
                color: 'white',
                weight: 1,
                fillColor: markerColor,
                fillOpacity: 0.8 * opacity,
                opacity: opacity,
                radius: markerRadius
            });
        }
        const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${markerRadius * 2}" height="${markerRadius * 2}" fill="${markerColor}" stroke="white" stroke-width="1" opacity="${opacity}">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
        const icon = L.divIcon({
            html: svgPin,
            className: "custom-pin-icon",
            iconSize: [markerRadius * 2, markerRadius * 2],
            iconAnchor: [markerRadius, markerRadius * 2],
            popupAnchor: [0, -markerRadius * 2]
        });
        return L.marker([lat, lon], { icon: icon });
    }

    private attachMarkerEvents(marker: L.Marker | L.CircleMarker, selectionId: ISelectionId, tooltipData: powerbi.extensibility.VisualTooltipDataItem[]) {
        marker.on('click', (e: L.LeafletMouseEvent) => {
            this.selectionManager.select(selectionId, e.originalEvent.ctrlKey || e.originalEvent.metaKey);
            L.DomEvent.stopPropagation(e);
        });
        marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
            this.selectionManager.showContextMenu(selectionId, { x: e.originalEvent.clientX, y: e.originalEvent.clientY });
            L.DomEvent.preventDefault(e.originalEvent);
            L.DomEvent.stopPropagation(e);
        });
        marker.on('mouseover', (e: L.LeafletMouseEvent) => {
            this.tooltipService.show({ coordinates: [e.originalEvent.clientX, e.originalEvent.clientY], isTouchEvent: false, dataItems: tooltipData, identities: [selectionId] });
        });
        marker.on('mouseout', () => {
            this.tooltipService.hide({ immediately: true, isTouchEvent: false });
        });
        marker.on('mousemove', (e: L.LeafletMouseEvent) => {
            this.tooltipService.move({ coordinates: [e.originalEvent.clientX, e.originalEvent.clientY], isTouchEvent: false, dataItems: tooltipData, identities: [selectionId] });
        });
    }

    private renderMarkers(dataView: powerbi.DataView) {
        this.layerGroup.clearLayers();
        const categorical = dataView.categorical;
        if (!categorical?.categories?.length) return;

        const categories = categorical.categories;
        const values = categorical.values || [];
        const labelCategory = categories[0];
        const labelValues = labelCategory?.values || [];

        let latValues: powerbi.PrimitiveValue[] = [];
        let lonValues: powerbi.PrimitiveValue[] = [];
        let descValues: powerbi.PrimitiveValue[] = [];
        values.forEach(v => {
            const role = v.source.roles;
            if (role?.["latitude"]) latValues = v.values;
            else if (role?.["longitude"]) lonValues = v.values;
            else if (role?.["description"]) descValues = v.values;
        });

        if (!latValues.length || !lonValues.length) return;

        const highlights = values.find(v => v.source.roles?.["latitude"])?.highlights;
        const hasHighlights = highlights?.some((h: powerbi.PrimitiveValue) => h !== null);
        const { markerSettings } = this.formattingSettings;
        const markerType = markerSettings.type.value.value;
        const markerColor = markerSettings.fill.value.value;
        const markerRadius = markerSettings.radius.value;
        const bounds = L.latLngBounds([]);

        for (let i = 0; i < labelValues.length; i++) {
            const lat = latValues[i] as number;
            const lon = lonValues[i] as number;
            if (!lat || !lon) continue;

            const label = labelValues[i] as string;
            const desc = descValues[i] as string;
            const isHighlighted = !hasHighlights || highlights?.[i] !== null;
            const opacity = isHighlighted ? 1.0 : 0.3;

            const popupContent = this.buildPopupContent(labelCategory.source.displayName, label, desc, values as powerbi.DataViewValueColumns);
            const tooltipData = this.buildTooltipData(labelCategory.source.displayName, label, desc, values as powerbi.DataViewValueColumns);
            const marker = this.createMarker(lat, lon, opacity, String(markerType), markerColor, markerRadius);

            marker.bindPopup(popupContent);
            this.layerGroup.addLayer(marker);
            bounds.extend([lat, lon]);

            const selectionId = this.host.createSelectionIdBuilder().withCategory(labelCategory, i).createSelectionId();
            this.attachMarkerEvents(marker, selectionId, tooltipData);
        }

        if (labelValues.length > 0 && bounds.isValid()) {
            this.map.fitBounds(bounds);
        }
    }

    private buildPopupContent(labelName: string, label: string, desc: string, values: powerbi.DataViewValueColumns): string {
        let content = `<table><tr><td><b>${labelName}</b></td><td>${label}</td></tr>`;
        if (desc) {
            const descSource = values.find(v => v.source.roles?.["description"]);
            if (descSource) content += `<tr><td><b>${descSource.source.displayName}</b></td><td>${desc}</td></tr>`;
        }
        return content + "</table>";
    }

    private buildTooltipData(labelName: string, label: string, desc: string, values: powerbi.DataViewValueColumns): powerbi.extensibility.VisualTooltipDataItem[] {
        const data: powerbi.extensibility.VisualTooltipDataItem[] = [{ displayName: labelName, value: String(label ?? "") }];
        if (desc) {
            const descSource = values.find(v => v.source.roles?.["description"]);
            if (descSource) data.push({ displayName: descSource.source.displayName, value: String(desc ?? "") });
        }
        return data;
    }
}

