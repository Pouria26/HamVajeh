// Manually-added / manually-edited collocations don't come from a real
// corpus run, so we don't have genuine PMI/t-score/LLR/logDice numbers for
// them. Instead, the admin gives a single overall "quality score" (the same
// 0–1 number used as minmax_score elsewhere in the app) and this module
// fabricates the other statistical columns so CSV exports keep the original
// file's shape. The ranges below were measured from the real final_df.csv
// (5000 rows): each metric is linearly (or log-linearly, for the two
// heavily right-skewed ones) interpolated across its observed [min, max]
// using the quality score as the position, then perturbed with a small
// Gaussian noise term and clamped back into the observed range.

interface DerivedScores {
    pmi: number;
    t_score: number;
    llr: number;
    logdice: number;
    combined_score: number;
}

const RANGES = {
    // linear metrics: [min, max, stdev-of-original-data]
    pmi: { min: 1.704, max: 17.261, stdev: 2.112 },
    logdice: { min: 5.664, max: 13.958, stdev: 1.16 },
    combined_score: { min: 0.585, max: 0.994, stdev: 0.109 },
    // log-scale metrics (heavily right-skewed in the original data)
    t_score: { min: 3.82, max: 48.832 },
    llr: { min: 99.845, max: 21065.725 },
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

// Box-Muller transform for a standard-normal sample.
function gaussianSample(): number {
    const u1 = Math.max(Math.random(), Number.EPSILON);
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function lerpWithNoise(quality: number, min: number, max: number, noiseStdev: number): number {
    const base = min + quality * (max - min);
    const noisy = base + gaussianSample() * noiseStdev;
    return clamp(noisy, min, max);
}

function logLerpWithNoise(quality: number, min: number, max: number, logNoiseFraction: number): number {
    const logMin = Math.log(min);
    const logMax = Math.log(max);
    const base = logMin + quality * (logMax - logMin);
    const noisy = base + gaussianSample() * (logMax - logMin) * logNoiseFraction;
    return clamp(Math.exp(noisy), min, max);
}

export function deriveScoresFromQuality(qualityScoreRaw: number): DerivedScores {
    const quality = clamp(Number.isFinite(qualityScoreRaw) ? qualityScoreRaw : 0.5, 0, 1);

    return {
        pmi: round(lerpWithNoise(quality, RANGES.pmi.min, RANGES.pmi.max, RANGES.pmi.stdev * 0.25)),
        logdice: round(
            lerpWithNoise(quality, RANGES.logdice.min, RANGES.logdice.max, RANGES.logdice.stdev * 0.2)
        ),
        combined_score: round(
            lerpWithNoise(quality, RANGES.combined_score.min, RANGES.combined_score.max, RANGES.combined_score.stdev * 0.15)
        ),
        t_score: round(logLerpWithNoise(quality, RANGES.t_score.min, RANGES.t_score.max, 0.05)),
        llr: round(logLerpWithNoise(quality, RANGES.llr.min, RANGES.llr.max, 0.08)),
    };
}

function round(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}
