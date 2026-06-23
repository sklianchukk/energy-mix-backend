// express routes for energy mix and optimal charging endpoints

import { Router, Request, Response } from "express";
import {
    getEnergyMixFor3Days,
    getOptimalChargingWindow,
} from "../services/carbonIntensityService";
import {
    EnergyMixResponse,
    OptimalWindowResponse,
    ChargingWindow,
} from "../types/index";

const router = Router();

router.get("/energy-mix", async (req: Request, res: Response) => {
    try {
        const energyData = await getEnergyMixFor3Days();

        const response: EnergyMixResponse = {
            days: energyData,
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({
            error:
                error instanceof Error
                    ? error.message
                    : "failed to fetch energy mix data",
        });
    }
});

router.get("/optimal-window", async (req: Request, res: Response) => {
    try {
        const windowLengthStr = req.query.hours as string;
        const windowLength = parseInt(windowLengthStr, 10);

        if (
            !windowLength ||
            isNaN(windowLength) ||
            windowLength < 1 ||
            windowLength > 6
        ) {
            return res.status(400).json({
                error: "hours parameter must be between 1 and 6",
            });
        }

        const optimalWindow = await getOptimalChargingWindow(windowLength);

        const chargingWindow: ChargingWindow = {
            startDateTime: optimalWindow.startDateTime,
            endDateTime: optimalWindow.endDateTime,
            averageCleanEnergyPercentage: optimalWindow.averageCleanEnergy,
            windowLengthHours: windowLength,
        };

        const response: OptimalWindowResponse = {
            chargingWindow,
        };

        res.json(response);
    } catch (error) {
        res.status(500).json({
            error:
                error instanceof Error
                    ? error.message
                    : "failed to find optimal charging window",
        });
    }
});

export default router;
