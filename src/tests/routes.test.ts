// http route tests for energy api endpoints

import request from "supertest";
import express from "express";
import cors from "cors";
import energyRoutes from "../routes/energyRoutes";
import * as carbonIntensityService from "../services/carbonIntensityService";

// mock the entire service module
jest.mock("../services/carbonIntensityService");

const mockedGetEnergyMix = carbonIntensityService.getEnergyMixFor3Days as jest.MockedFunction<
    typeof carbonIntensityService.getEnergyMixFor3Days
>;
const mockedGetOptimalWindow = carbonIntensityService.getOptimalChargingWindow as jest.MockedFunction<
    typeof carbonIntensityService.getOptimalChargingWindow
>;

// build a minimal express app for testing
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", energyRoutes);

// ------------------------------------------------------------------
// /api/energy-mix
// ------------------------------------------------------------------
describe("GET /api/energy-mix", () => {
    const fakeDays: import("../types/index").DailyEnergyData[] = [
        { date: "2026-06-23", generationmix: { wind: 30, gas: 70 } as Record<string, number>, cleanEnergyPercentage: 30 },
        { date: "2026-06-24", generationmix: { solar: 50, gas: 50 } as Record<string, number>, cleanEnergyPercentage: 50 },
        { date: "2026-06-25", generationmix: { nuclear: 40, gas: 60 } as Record<string, number>, cleanEnergyPercentage: 40 },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return 200 with energy mix for 3 days", async () => {
        mockedGetEnergyMix.mockResolvedValue(fakeDays);

        const res = await request(app).get("/api/energy-mix");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("days");
        expect(res.body.days).toHaveLength(3);
    });

    it("should return days with correct structure", async () => {
        mockedGetEnergyMix.mockResolvedValue(fakeDays);

        const res = await request(app).get("/api/energy-mix");
        const day = res.body.days[0];

        expect(day).toHaveProperty("date");
        expect(day).toHaveProperty("generationmix");
        expect(day).toHaveProperty("cleanEnergyPercentage");
    });

    it("should return 500 when service throws an error", async () => {
        mockedGetEnergyMix.mockRejectedValue(new Error("upstream api failed"));

        const res = await request(app).get("/api/energy-mix");

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty("error");
        expect(res.body.error).toBe("upstream api failed");
    });
});

// ------------------------------------------------------------------
// /api/optimal-window
// ------------------------------------------------------------------
describe("GET /api/optimal-window", () => {
    const fakeWindow = {
        startDateTime: "2026-06-24T10:00Z",
        endDateTime: "2026-06-24T12:00Z",
        generationmix: [{ fuel: "wind", perc: 40 }],
        averageCleanEnergy: 67.5,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return 200 with optimal charging window for valid hours param", async () => {
        mockedGetOptimalWindow.mockResolvedValue(fakeWindow);

        const res = await request(app).get("/api/optimal-window?hours=2");

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("chargingWindow");
    });

    it("should return correct window structure", async () => {
        mockedGetOptimalWindow.mockResolvedValue(fakeWindow);

        const res = await request(app).get("/api/optimal-window?hours=3");
        const { chargingWindow } = res.body;

        expect(chargingWindow).toHaveProperty("startDateTime");
        expect(chargingWindow).toHaveProperty("endDateTime");
        expect(chargingWindow).toHaveProperty("averageCleanEnergyPercentage");
        expect(chargingWindow).toHaveProperty("windowLengthHours", 3);
    });

    it("should call service with correct window length", async () => {
        mockedGetOptimalWindow.mockResolvedValue(fakeWindow);

        await request(app).get("/api/optimal-window?hours=4");

        expect(mockedGetOptimalWindow).toHaveBeenCalledWith(4);
    });

    it("should return 400 when hours param is missing", async () => {
        const res = await request(app).get("/api/optimal-window");

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("error");
    });

    it("should return 400 when hours is below 1", async () => {
        const res = await request(app).get("/api/optimal-window?hours=0");

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("between 1 and 6");
    });

    it("should return 400 when hours exceeds 6", async () => {
        const res = await request(app).get("/api/optimal-window?hours=7");

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("between 1 and 6");
    });

    it("should return 400 when hours is not a number", async () => {
        const res = await request(app).get("/api/optimal-window?hours=abc");

        expect(res.status).toBe(400);
    });

    it("should return 500 when service throws an error", async () => {
        mockedGetOptimalWindow.mockRejectedValue(new Error("no data available"));

        const res = await request(app).get("/api/optimal-window?hours=2");

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("no data available");
    });

    it("should accept all valid hour values (1-6)", async () => {
        mockedGetOptimalWindow.mockResolvedValue(fakeWindow);

        for (const hours of [1, 2, 3, 4, 5, 6]) {
            const res = await request(app).get(`/api/optimal-window?hours=${hours}`);
            expect(res.status).toBe(200);
        }
    });
});
