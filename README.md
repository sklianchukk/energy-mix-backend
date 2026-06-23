# UK Energy Mix and EV Charging Backend

Backend service for fetching UK energy mix data and calculating optimal EV charging windows.

## Setup

```bash
npm install
npm run build
npm run dev
```

## Environment Variables

-   `PORT`: Server port (default: 5000)
-   `NODE_ENV`: Environment (development/production)

## API Endpoints

### GET /api/energy-mix

Returns energy mix data for today, tomorrow, and day after tomorrow.

Response:

```json
{
    "days": [
        {
            "date": "2026-06-22",
            "generationmix": {
                "wind": 30,
                "solar": 20,
                "nuclear": 25,
                "gas": 15,
                "coal": 10
            },
            "cleanEnergyPercentage": 75
        }
    ]
}
```

### GET /api/optimal-window?hours=2

Returns the optimal charging window for the next two days with highest clean energy percentage.

Parameters:

-   `hours`: Window length in full hours (1-6)

Response:

```json
{
    "chargingWindow": {
        "startDateTime": "2026-06-23T10:00:00Z",
        "endDateTime": "2026-06-23T12:00:00Z",
        "averageCleanEnergyPercentage": 80,
        "windowLengthHours": 2
    }
}
```

## Testing

```bash
npm test
npm run test:watch
```

## Deployment

Build and push Docker image:

```bash
docker build -t energy-backend .
docker run -p 5000:5000 energy-backend
```
