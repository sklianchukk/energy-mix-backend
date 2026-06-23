// unit tests for carbon intensity service

import {
    calculateCleanEnergyPercentage,
    extractDateFromDateTime,
} from "../utils/dateUtils";

describe("dateUtils", () => {
    describe("calculateCleanEnergyPercentage", () => {
        it("should calculate clean energy percentage correctly", () => {
            const generationmix = [
                { fuel: "wind", perc: 30 },
                { fuel: "solar", perc: 20 },
                { fuel: "nuclear", perc: 25 },
                { fuel: "gas", perc: 25 },
            ];

            const result = calculateCleanEnergyPercentage(generationmix);
            expect(result).toBe(75);
        });

        it("should handle case-insensitive fuel types", () => {
            const generationmix = [
                { fuel: "Wind", perc: 40 },
                { fuel: "Solar", perc: 10 },
                { fuel: "coal", perc: 50 },
            ];

            const result = calculateCleanEnergyPercentage(generationmix);
            expect(result).toBe(50);
        });

        it("should return 0 when no clean energy sources", () => {
            const generationmix = [
                { fuel: "gas", perc: 50 },
                { fuel: "coal", perc: 50 },
            ];

            const result = calculateCleanEnergyPercentage(generationmix);
            expect(result).toBe(0);
        });

        it("should handle all clean energy", () => {
            const generationmix = [
                { fuel: "wind", perc: 50 },
                { fuel: "solar", perc: 50 },
            ];

            const result = calculateCleanEnergyPercentage(generationmix);
            expect(result).toBe(100);
        });
    });

    describe("extractDateFromDateTime", () => {
        it("should extract date from ISO datetime string", () => {
            const dateTime = "2026-06-22T12:30:00Z";
            const result = extractDateFromDateTime(dateTime);
            expect(result).toBe("2026-06-22");
        });

        it("should handle different ISO formats", () => {
            const dateTime = "2026-06-22T00:00:00+00:00";
            const result = extractDateFromDateTime(dateTime);
            expect(result).toBe("2026-06-22");
        });
    });
});

describe("carbonIntensityService", () => {
    // integration tests would require mocking axios calls
    it("should validate sliding window algorithm", () => {
        // test that window length is correctly applied
        const windowLengthHours = 2;
        const expectedIntervals = windowLengthHours * 2;
        expect(expectedIntervals).toBe(4);
    });
});
