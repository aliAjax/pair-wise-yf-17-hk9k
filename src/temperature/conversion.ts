// ============================================================
// 温度折算规则模块（纯规则，不碰存储、不碰页面）
//
// 折算公式：corrected = measured − k × (T − T0)
//   measured  现场实测音分偏差
//   T         现场温度 ℃
//   T0        场馆基准温度 ℃
//   k         敏感系数（音分/℃），簧片与唇管分开取值
//
// 物理含义：升温时音管被热胀"抬高"（k > 0），折回基准温度时
// 把温度贡献的部分减掉，剩下的才是机械调音偏差，这样才能
// 区分"调音问题"和"热胀冷缩"。
// ============================================================

export type PipeKind = "reed" | "flue";

export const PIPE_KIND_LABEL: Record<PipeKind, string> = {
  reed: "簧片",
  flue: "唇管",
};

/** 折算偏差绝对值超过该值视为"偏差超限"（异常音管标记） */
export const OUT_OF_TOLERANCE_CENTS = 10;

export interface VenueProfile {
  id: string;
  name: string;
  /** 基准温度 ℃：该场馆读数统一折算到这一温度 */
  referenceTempC: number;
  /** 簧片敏感系数 音分/℃ */
  reedCentsPerDeg: number;
  /** 唇管敏感系数 音分/℃ */
  flueCentsPerDeg: number;
  /** 复检阈值 ℃：同一音管相邻两次读数温差超过它即列入待复检 */
  recheckThresholdC: number;
}

export type ReadingStatus = "ok" | "pending" | "reviewed";

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  ok: "正常",
  pending: "待复检",
  reviewed: "已复核",
};

export interface Reading {
  id: string;
  venueId: string;
  stopName: string;
  pipeNo: string;
  pipeKind: PipeKind;
  pitch: string;
  /** 现场实测音分偏差（原始值，永不改写） */
  measuredCents: number;
  tempC: number;
  humidityPct: number;
  reedState: string;
  note: string;
  /** 录入时折算回基准温度的偏差（随读数固化，改参数不追溯历史） */
  correctedCents: number;
  /** 现场温度 − 基准温度 */
  deltaTempC: number;
  /** 现场温度 − 对比基线温度（同一音管上次读数，无则基准温度） */
  swingC: number;
  swingBaselineC: number;
  swingBaselineLabel: string;
  status: ReadingStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface CorrectionResult {
  correctedCents: number;
  deltaTempC: number;
  coefficient: number;
}

export interface StabilityVerdict {
  needsRecheck: boolean;
  baselineTempC: number;
  baselineLabel: string;
  swingC: number;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function coefficientFor(venue: VenueProfile, kind: PipeKind): number {
  return kind === "reed" ? venue.reedCentsPerDeg : venue.flueCentsPerDeg;
}

/** 把实测偏差折算回场馆基准温度 */
export function correctToReference(
  venue: VenueProfile,
  kind: PipeKind,
  measuredCents: number,
  tempC: number
): CorrectionResult {
  const coefficient = coefficientFor(venue, kind);
  const deltaTempC = round1(tempC - venue.referenceTempC);
  const correctedCents = round1(measuredCents - coefficient * deltaTempC);
  return { correctedCents, deltaTempC, coefficient };
}

/** 同一音管的标识：场馆 + 音栓 + 音管编号 */
export function pipeKeyOf(r: { venueId: string; stopName: string; pipeNo: string }): string {
  return `${r.venueId}::${r.stopName.trim()}::${r.pipeNo.trim()}`;
}

/**
 * 稳定性判定：同一音管本次现场温度相对"上次读数温度"
 * （首次测量则相对基准温度）升温/降温超过阈值 → 待复检。
 */
export function evaluateStability(
  candidate: { venueId: string; stopName: string; pipeNo: string; tempC: number },
  history: Reading[],
  venue: VenueProfile
): StabilityVerdict {
  const key = pipeKeyOf(candidate);
  const previous = history
    .filter((r) => pipeKeyOf(r) === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const baselineTempC = previous ? previous.tempC : venue.referenceTempC;
  const swingC = round1(candidate.tempC - baselineTempC);
  return {
    needsRecheck: Math.abs(swingC) > venue.recheckThresholdC,
    baselineTempC,
    baselineLabel: previous ? "上次读数" : "基准温度",
    swingC,
  };
}

export function isOutOfTolerance(reading: Reading): boolean {
  return Math.abs(reading.correctedCents) > OUT_OF_TOLERANCE_CENTS;
}

/** 带符号的音分显示，如 +4.2 / -5.8 */
export function formatCents(n: number): string {
  const v = round1(n);
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

/** 带符号的温差显示，如 +6.0 / -1.0 */
export function formatTemp(n: number): string {
  const v = round1(n);
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

/** 默认场馆档案（首次启动写入本地存档，之后以存档为准） */
export const DEFAULT_VENUES: VenueProfile[] = [
  {
    id: "v-st-mary",
    name: "St.Mary 教堂",
    referenceTempC: 18,
    reedCentsPerDeg: 0.8,
    flueCentsPerDeg: 3.2,
    recheckThresholdC: 5,
  },
  {
    id: "v-concert-a",
    name: "ConcertHall A 音乐厅",
    referenceTempC: 20,
    reedCentsPerDeg: 0.6,
    flueCentsPerDeg: 2.8,
    recheckThresholdC: 4,
  },
  {
    id: "v-abbey",
    name: "Abbey Room 排练厅",
    referenceTempC: 16,
    reedCentsPerDeg: 1.0,
    flueCentsPerDeg: 3.6,
    recheckThresholdC: 6,
  },
];
