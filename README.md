# Market Day

An interactive map of Philadelphia farmers markets. Every marker and market detail is loaded directly from [`data/Farmers_Markets.csv`](data/Farmers_Markets.csv).

## Features

- Converts the CSV's Web Mercator `X`/`Y` coordinates to map-ready latitude and longitude
- Search by market name, address, ZIP code, or neighborhood text
- Filter for markets open today, SNAP acceptance, and year-round operation
- View weekly schedules, payment methods, transit options, operators, and websites
- Responsive layout for desktop and mobile

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Updating the data

Replace `data/Farmers_Markets.csv` with an updated file using the same column names. The app reads the CSV at build time, so no code changes are needed.
