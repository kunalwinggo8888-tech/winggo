/** Type declarations for the original (verbatim) constants.js */
export declare const COORDINATES_MAP: Record<number, [number, number]>;
export declare const STEP_LENGTH: number;
export declare const PLAYERS: ["P1", "P2", "P3", "P4"];
export declare const BASE_POSITIONS: Record<PlayerId, number[]>;
export declare const START_POSITIONS: Record<PlayerId, number>;
export declare const HOME_ENTRANCE: Record<PlayerId, number[]>;
export declare const HOME_POSITIONS: Record<PlayerId, number>;
export declare const TURNING_POINTS: Record<PlayerId, number>;
export declare const SAFE_POSITIONS: number[];
export declare const STATE: { DICE_NOT_ROLLED: string; DICE_ROLLED: string };

export type PlayerId = "P1" | "P2" | "P3" | "P4";
