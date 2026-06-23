// type definitions for carbon intensity and energy data

export interface GenerationSource {
    fuel: string;
    perc: number;
}

export interface HalfHourInterval {
    from: string;
    to: string;
    generationmix: GenerationSource[];
}

export interface CarbonIntensityApiResponse {
    data: {
        from: string;
        to: string;
        generationmix: GenerationSource[];
    }[];
}

export interface DailyEnergyData {
    date: string;
    generationmix: Record<string, number>;
    cleanEnergyPercentage: number;
}

export interface EnergyMixResponse {
    days: DailyEnergyData[];
}

export interface ChargingWindow {
    startDateTime: string;
    endDateTime: string;
    averageCleanEnergyPercentage: number;
    windowLengthHours: number;
}

export interface OptimalWindowResponse {
    chargingWindow: ChargingWindow;
}

export interface AggregatedInterval {
    startDateTime: string;
    endDateTime: string;
    generationmix: GenerationSource[];
    averageCleanEnergy: number;
}
