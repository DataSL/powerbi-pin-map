/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */


"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

/**
 * Paramètres de la carte (Fond de plan)
 */
class MapSettings extends FormattingSettingsCard {
    style = new formattingSettings.ItemDropdown({
        name: "style",
        displayName: "Style de carte",
        items: [
            { displayName: "Standard (OSM)", value: "osm" },
            { displayName: "Clair (CartoDB Light)", value: "cartoLight" },
            { displayName: "Sombre (CartoDB Dark)", value: "cartoDark" }
        ],
        value: { displayName: "Standard (OSM)", value: "osm" }
    });

    name: string = "mapSettings";
    displayName: string = "Paramètres de la carte";
    slices: Array<FormattingSettingsSlice> = [this.style];
}

/**
 * Paramètres des marqueurs (Nouveau)
 */
class MarkerSettings extends FormattingSettingsCard {
    type = new formattingSettings.ItemDropdown({
        name: "type",
        displayName: "Type de marqueur",
        items: [
            { displayName: "Épingle standard", value: "pin" },
            { displayName: "Cercle", value: "circle" }
        ],
        value: { displayName: "Épingle standard", value: "pin" }
    });

    fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Couleur",
        value: { value: "#118DFF" }
    });

    radius = new formattingSettings.NumUpDown({
        name: "radius",
        displayName: "Taille",
        value: 10
    });

    name: string = "markerSettings";
    displayName: string = "Marqueurs";
    slices: Array<FormattingSettingsSlice> = [this.type, this.fill, this.radius];
}

/**
* visual settings model class
*
*/
export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    mapSettings = new MapSettings();
    markerSettings = new MarkerSettings(); // Nouvelle carte active

    cards = [this.mapSettings, this.markerSettings];
}
