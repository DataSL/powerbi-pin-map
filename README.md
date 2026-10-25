# Pin Map (Open Source) for Power BI

Interactive Leaflet map of your locations from latitude and longitude, with custom markers, three map styles and built-in filters.

Free and open source Power BI custom visual by [Data SL Consulting](https://data-slconsulting.com/), an independent data and AI consultancy in Paris.

## Install

1. Download the latest `.pbiviz` file from the [Releases](https://github.com/DataSL/powerbi-pin-map/releases) page.
2. In Power BI Desktop, open the **Visualizations** pane, select **…** (Get more visuals), then **Import a visual from a file**, and choose the downloaded file.

This visual loads map tiles from OpenStreetMap and CARTO, so it can't be Power BI certified; report viewers need internet access. A Power BI certified edition is available on [Microsoft Marketplace](https://marketplace.microsoft.com/product/dslc1696681601173.pincarte).

## Build from source

```bash
npm ci
npx -y powerbi-visuals-tools@5.6.0 package
```

The package is created in `dist/`.

## License and attribution

Licensed under the [Apache License 2.0](LICENSE). You can use, modify and redistribute this visual, including commercially, provided that you keep the [NOTICE](NOTICE) file and the attribution to **Data SL Consulting** in any redistribution.

## En français

Visuel Power BI gratuit et open source de [Data SL Consulting](https://data-slconsulting.com/), cabinet de conseil data et IA à Paris. Téléchargez le fichier `.pbiviz` dans les [versions publiées](https://github.com/DataSL/powerbi-pin-map/releases), puis importez-le dans Power BI Desktop (volet Visualisations › … › Importer un visuel à partir d’un fichier). Licence Apache 2.0 : toute redistribution doit conserver le fichier NOTICE et la mention de Data SL Consulting.
