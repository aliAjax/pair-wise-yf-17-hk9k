// 温度折算规则：纯函数模块，不依赖界面与存档，可单独维护。
// 规则：折算后偏差 = 实测偏差 − 敏感系数 × (现场温度 − 基准温度)
// 唇管（flue）与簧片（reed）使用各自独立的敏感系数。

export type PipeType = "flue" | "reed";

export const PIPE_TYPE_LABEL: Record<PipeType, string> = {
  flue: "唇管",
  reed: "簧片",
};

export interface VenueProfile {
  id: string;
  name: string;
  /** 基准温度 ℃，所有读数都折算回该温度 */
  referenceTemp: number;
  /** 唇管敏感系数：音分/℃ */
  flueCoeff: number;
  /** 簧片敏感系数：音分/℃ */
  reedCoeff: number;
  /** 复检阈值 ℃：现场温度相对基准温度升/降超过该值即列入待复检 */
  recheckThreshold: number;
}

export interface CorrectionResult {
  /** 现场温度 − 基准温度 */
  deltaT: number;
  /** 本次实际采用的敏感系数 */
  coeff: number;
  /** 热胀冷缩造成的偏差分量（音分） */
  thermalCents: number;
  /** 折算回基准温度后的音分偏差 */
  correctedCents: number;
  /** 温漂是否超过复检阈值 */
  needsRecheck: boolean;
}

export function coeffFor(venue: VenueProfile, pipeType: PipeType): number {
  return pipeType === "reed" ? venue.reedCoeff : venue.flueCoeff;
}

export function correctToReference(
  measuredCents: number,
  measuredTemp: number,
  venue: VenueProfile,
  pipeType: PipeType
): CorrectionResult {
  const deltaT = round1(measuredTemp - venue.referenceTemp);
  const coeff = coeffFor(venue, pipeType);
  const thermalCents = round1(coeff * deltaT);
  const correctedCents = round1(measuredCents - thermalCents);
  return {
    deltaT,
    coeff,
    thermalCents,
    correctedCents,
    needsRecheck: Math.abs(deltaT) >= venue.recheckThreshold,
  };
}

/** 温漂描述：未超阈值返回“温漂正常”，否则给出升温/降温幅度 */
export function driftLabel(deltaT: number, threshold: number): string {
  if (Math.abs(deltaT) < threshold) return "温漂正常";
  return deltaT > 0
    ? `升温 ${deltaT.toFixed(1)}℃`
    : `降温 ${Math.abs(deltaT).toFixed(1)}℃`;
}

export function formatCents(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
