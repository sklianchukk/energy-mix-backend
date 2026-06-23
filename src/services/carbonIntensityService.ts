import axios from "axios";
import {
    CarbonIntensityApiResponse,
    DailyEnergyData,
    AggregatedInterval,
    GenerationSource,
} from "../types/index";
import {
    formatDateForApi,
    getToday,
    getTomorrow,
    getDayAfterTomorrow,
    calculateCleanEnergyPercentage,
    extractDateFromDateTime,
    cleanEnergyTypes,
} from "../utils/dateUtils";

const CARBON_INTENSITY_API_BASE =
    "https://api.carbonintensity.org.uk/generation";

export async function fetchGenerationData(
    fromDate: string,
    toDate: string
): Promise<CarbonIntensityApiResponse> {
    try {
        // api expects format: YYYY-MM-DDTHH:mmZ
        const fromDateTime = `${fromDate}T00:00Z`;
        const toDateTime = `${toDate}T23:59Z`;

        const url = `${CARBON_INTENSITY_API_BASE}/${fromDateTime}/${toDateTime}`;
        console.log(`fetching from: ${url}`);

        const response = await axios.get<CarbonIntensityApiResponse>(url, {
            timeout: 15000,
        });

        console.log(
            `api response status: ${response.status}, data points: ${
                response.data.data?.length || 0
            }`
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                `api request failed: ${error.response?.status} - ${error.response?.statusText}`
            );
            console.error(
                `response data: ${JSON.stringify(error.response?.data)}`
            );
        }
        throw new Error(
            `failed to fetch carbon intensity data: ${
                error instanceof Error ? error.message : "unknown error"
            }`
        );
    }
}

export async function getEnergyMixFor3Days(): Promise<DailyEnergyData[]> {
    try {
        const today = getToday();
        const tomorrow = getTomorrow();
        const dayAfterTomorrow = getDayAfterTomorrow();

        const todayStr = formatDateForApi(today);
        const tomorrowStr = formatDateForApi(tomorrow);
        const dayAfterStr = formatDateForApi(dayAfterTomorrow);

        // fetch data from today through day after tomorrow (inclusive)
        const fromDate = todayStr;
        const toDate = dayAfterStr;

        console.log(`requesting energy mix for ${fromDate} to ${toDate}`);
        const apiResponse = await fetchGenerationData(fromDate, toDate);

        // group by date and calculate averages
        const groupedByDate: Record<string, GenerationSource[][]> = {};

        apiResponse.data.forEach((interval) => {
            const date = extractDateFromDateTime(interval.from);
            if (!groupedByDate[date]) {
                groupedByDate[date] = [];
            }
            groupedByDate[date].push(interval.generationmix);
        });

        // calculate daily averages
        const results: DailyEnergyData[] = [];

        [todayStr, tomorrowStr, dayAfterStr].forEach((dateStr) => {
            if (
                !groupedByDate[dateStr] ||
                groupedByDate[dateStr].length === 0
            ) {
                results.push({
                    date: dateStr,
                    generationmix: {},
                    cleanEnergyPercentage: 0,
                });
                return;
            }

            const dailyData = groupedByDate[dateStr];
            const averagedMix = calculateAverageGenerationMix(dailyData);
            const cleanPercentage = calculateCleanEnergyPercentage(averagedMix);

            const generationmixRecord: Record<string, number> = {};
            averagedMix.forEach((source) => {
                generationmixRecord[source.fuel] = source.perc;
            });

            results.push({
                date: dateStr,
                generationmix: generationmixRecord,
                cleanEnergyPercentage: cleanPercentage,
            });
        });

        return results;
    } catch (error) {
        console.error(
            `error in getEnergyMixFor3Days: ${
                error instanceof Error ? error.message : "unknown error"
            }`
        );
        throw error;
    }
}

export async function getOptimalChargingWindow(
    windowLengthHours: number
): Promise<AggregatedInterval> {
    try {
        const tomorrow = getTomorrow();
        const dayAfterTomorrow = getDayAfterTomorrow();

        const fromDate = formatDateForApi(tomorrow);
        const toDate = formatDateForApi(dayAfterTomorrow);

        console.log(
            `requesting optimal window for ${fromDate} to ${toDate} (${windowLengthHours}h)`
        );
        const apiResponse = await fetchGenerationData(fromDate, toDate);

        // aggregate half-hour intervals into sliding windows
        const windowLengthIntervals = windowLengthHours * 2; // convert hours to half-hour intervals

        let optimalWindow: AggregatedInterval | null = null;
        let maxCleanEnergy = -1;

        // sliding window across all intervals
        for (
            let i = 0;
            i <= apiResponse.data.length - windowLengthIntervals;
            i++
        ) {
            const windowIntervals = apiResponse.data.slice(
                i,
                i + windowLengthIntervals
            );

            if (windowIntervals.length < windowLengthIntervals) {
                continue;
            }

            const aggregatedMix = calculateAverageGenerationMix(
                windowIntervals.map((interval) => interval.generationmix)
            );

            const cleanEnergyPerc =
                calculateCleanEnergyPercentage(aggregatedMix);

            if (cleanEnergyPerc > maxCleanEnergy) {
                maxCleanEnergy = cleanEnergyPerc;

                const startDateTime = windowIntervals[0].from;
                const endDateTime =
                    windowIntervals[windowIntervals.length - 1].to;

                optimalWindow = {
                    startDateTime,
                    endDateTime,
                    generationmix: aggregatedMix,
                    averageCleanEnergy: cleanEnergyPerc,
                };
            }
        }

        if (!optimalWindow) {
            throw new Error("unable to find optimal charging window");
        }

        console.log(
            `found optimal window: ${optimalWindow.startDateTime} to ${optimalWindow.endDateTime} with ${optimalWindow.averageCleanEnergy}% clean energy`
        );
        return optimalWindow;
    } catch (error) {
        console.error(
            `error in getOptimalChargingWindow: ${
                error instanceof Error ? error.message : "unknown error"
            }`
        );
        throw error;
    }
}

function calculateAverageGenerationMix(
    generationMixArray: GenerationSource[][]
): GenerationSource[] {
    if (generationMixArray.length === 0) {
        return [];
    }

    const fuelMap: Record<string, number[]> = {};

    generationMixArray.forEach((mix) => {
        mix.forEach((source) => {
            if (!fuelMap[source.fuel]) {
                fuelMap[source.fuel] = [];
            }
            fuelMap[source.fuel].push(source.perc);
        });
    });

    const averagedMix: GenerationSource[] = [];

    Object.entries(fuelMap).forEach(([fuel, percentages]) => {
        const average =
            percentages.reduce((a, b) => a + b, 0) / percentages.length;
        averagedMix.push({
            fuel,
            perc: Math.round(average * 100) / 100,
        });
    });

    return averagedMix;
}
