// utility functions for date manipulation and calculations

export function getToday(): Date {
    const date = new Date();
    // set to UTC midnight, not local midnight
    return new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0,
            0,
            0,
            0
        )
    );
}

export function getTomorrow(): Date {
    const date = getToday();
    date.setUTCDate(date.getUTCDate() + 1);
    return date;
}

export function getDayAfterTomorrow(): Date {
    const date = getToday();
    date.setUTCDate(date.getUTCDate() + 2);
    return date;
}

export function formatDateForApi(date: Date): string {
    return date.toISOString().split("T")[0];
}

export function formatDateTimeForApi(date: Date): string {
    return date.toISOString();
}

export function getDateFromString(dateString: string): Date {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function extractDateFromDateTime(dateTime: string): string {
    return dateTime.split("T")[0];
}

export function cleanEnergyTypes(): string[] {
    return ["biomass", "nuclear", "hydro", "wind", "solar"];
}

export function calculateCleanEnergyPercentage(generationmix: any[]): number {
    const cleanTypes = cleanEnergyTypes();
    const totalClean = generationmix
        .filter((source) => cleanTypes.includes(source.fuel.toLowerCase()))
        .reduce((sum, source) => sum + source.perc, 0);
    return Math.round(totalClean * 100) / 100;
}

export function createDateTimeRange(
    startDate: Date,
    startTime: string,
    durationHours: number
): { from: string; to: string } {
    const [hours, minutes] = startTime.split(":").map(Number);
    const start = new Date(startDate);
    start.setUTCHours(hours, minutes, 0, 0);
    const end = new Date(start);
    end.setUTCHours(end.getUTCHours() + durationHours);
    return {
        from: formatDateTimeForApi(start),
        to: formatDateTimeForApi(end),
    };
}
