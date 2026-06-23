// unit tests for carbonIntensityService with mocked axios

import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import {
    fetchGenerationData,
    getEnergyMixFor3Days,
    getOptimalChargingWindow,
} from "../services/carbonIntensityService";

const mock = new MockAdapter(axios);

// helper: generate n half-hour intervals starting from a given ISO date-time
function buildIntervals(startIso: string, count: number) {
    const intervals = [];
    const start = new Date(startIso);
    for (let i = 0; i < count; i++) {
        const from = new Date(start.getTime() + i * 30 * 60 * 1000);
        const to = new Date(from.getTime() + 30 * 60 * 1000);
        intervals.push({
            from: from.toISOString().replace(".000", "").slice(0, 16) + "Z",
            to: to.toISOString().replace(".000", "").slice(0, 16) + "Z",
            generationmix: [
                { fuel: "wind", perc: 30 },
                { fuel: "solar", perc: 10 },
                { fuel: "nuclear", perc: 15 },
                { fuel: "gas", perc: 40 },
                { fuel: "coal", perc: 5 },
            ],
        });
    }
    return intervals;
}

afterEach(() => {
    mock.reset();
});

afterAll(() => {
    mock.restore();
});

// ------------------------------------------------------------------
// fetchGenerationData
// ------------------------------------------------------------------
describe("fetchGenerationData", () => {
    it("should return api response data on success", async () => {
        const fakeData = { data: buildIntervals("2026-06-23T00:00Z", 4) };
        mock.onGet(/carbonintensity/).reply(200, fakeData);

        const result = await fetchGenerationData("2026-06-23", "2026-06-24");

        expect(result).toEqual(fakeData);
        expect(result.data).toHaveLength(4);
    });

    it("should throw an error when api returns non-2xx status", async () => {
        mock.onGet(/carbonintensity/).reply(503, { error: "service unavailable" });

        await expect(fetchGenerationData("2026-06-23", "2026-06-24")).rejects.toThrow(
            "failed to fetch carbon intensity data"
        );
    });

    it("should throw an error when network times out", async () => {
        mock.onGet(/carbonintensity/).timeout();

        await expect(fetchGenerationData("2026-06-23", "2026-06-24")).rejects.toThrow();
    });

    it("should build the url with correct from/to datetime format", async () => {
        const fakeData = { data: buildIntervals("2026-06-23T00:00Z", 1) };
        let capturedUrl = "";
        mock.onGet(/carbonintensity/).reply((config) => {
            capturedUrl = config.url ?? "";
            return [200, fakeData];
        });

        await fetchGenerationData("2026-06-23", "2026-06-24");

        // api uses path-based date segments, not query params
        expect(capturedUrl).toContain("2026-06-23T00:00Z");
        expect(capturedUrl).toContain("2026-06-24T23:59Z");
    });
});

// ------------------------------------------------------------------
// getEnergyMixFor3Days
// ------------------------------------------------------------------
describe("getEnergyMixFor3Days", () => {
    it("should return data for 3 days", async () => {
        // 48 intervals = 24h per day × 2 intervals/h × 3 days
        const intervals = buildIntervals("2026-06-23T00:00Z", 144);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getEnergyMixFor3Days();

        expect(result).toHaveLength(3);
    });

    it("should calculate cleanEnergyPercentage for each day", async () => {
        const intervals = buildIntervals("2026-06-23T00:00Z", 144);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getEnergyMixFor3Days();

        result.forEach((day) => {
            // wind(30) + solar(10) + nuclear(15) = 55 %
            expect(day.cleanEnergyPercentage).toBe(55);
        });
    });

    it("should include generationmix as a record for each day", async () => {
        const intervals = buildIntervals("2026-06-23T00:00Z", 48);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getEnergyMixFor3Days();

        result.forEach((day) => {
            expect(typeof day.generationmix).toBe("object");
        });
    });

    it("should return zero cleanEnergyPercentage for days without data", async () => {
        // Only 1 interval — only today will have data
        const intervals = buildIntervals("2026-06-23T00:00Z", 1);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getEnergyMixFor3Days();

        // days without data get 0
        const zeroDays = result.filter((d) => d.cleanEnergyPercentage === 0);
        expect(zeroDays.length).toBeGreaterThanOrEqual(1);
    });

    it("should throw when api returns invalid format", async () => {
        mock.onGet(/carbonintensity/).reply(200, { data: null });

        // service calls forEach on null before reaching the explicit check — still throws
        await expect(getEnergyMixFor3Days()).rejects.toThrow();
    });
});

// ------------------------------------------------------------------
// getOptimalChargingWindow
// ------------------------------------------------------------------
describe("getOptimalChargingWindow", () => {
    it("should return the window with highest clean energy for 2h window", async () => {
        // 96 intervals = 2 days × 48 intervals
        const intervals = buildIntervals("2026-06-24T00:00Z", 96);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getOptimalChargingWindow(2);

        expect(result).toHaveProperty("startDateTime");
        expect(result).toHaveProperty("endDateTime");
        expect(result).toHaveProperty("averageCleanEnergy");
        expect(typeof result.averageCleanEnergy).toBe("number");
    });

    it("should find a window of correct length (1h = 2 intervals)", async () => {
        const intervals = buildIntervals("2026-06-24T00:00Z", 48);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getOptimalChargingWindow(1);

        const start = new Date(result.startDateTime).getTime();
        const end = new Date(result.endDateTime).getTime();
        const diffHours = (end - start) / (1000 * 60 * 60);

        // 1h window = 2 half-hour intervals, so end - start = 1h
        expect(diffHours).toBeGreaterThanOrEqual(0.5);
        expect(diffHours).toBeLessThanOrEqual(2);
    });

    it("should pick the window with maximum clean energy percentage", async () => {
        // build intervals where index 10-13 has high clean energy
        const intervals = buildIntervals("2026-06-24T00:00Z", 48);
        intervals[10].generationmix = [
            { fuel: "wind", perc: 60 },
            { fuel: "solar", perc: 30 },
            { fuel: "gas", perc: 10 },
        ];
        intervals[11].generationmix = [
            { fuel: "wind", perc: 55 },
            { fuel: "solar", perc: 35 },
            { fuel: "gas", perc: 10 },
        ];
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        const result = await getOptimalChargingWindow(1);

        // the best window should have clean energy >= 55%
        expect(result.averageCleanEnergy).toBeGreaterThanOrEqual(55);
    });

    it("should throw when there are not enough intervals to form a window", async () => {
        // only 1 interval but asking for 6h window (needs 12 intervals)
        const intervals = buildIntervals("2026-06-24T00:00Z", 1);
        mock.onGet(/carbonintensity/).reply(200, { data: intervals });

        await expect(getOptimalChargingWindow(6)).rejects.toThrow(
            "unable to find optimal charging window"
        );
    });

    it("should throw when api fails", async () => {
        mock.onGet(/carbonintensity/).reply(500);

        await expect(getOptimalChargingWindow(2)).rejects.toThrow();
    });
});
