// ============================================================
// 本地存档模块：只负责 localStorage 读写与初始种子数据。
// 折算规则见 temperature/conversion.ts，本模块不做任何折算决策，
// 只在生成种子读数时调用规则模块，保证存档与规则一致。
// ============================================================

import {
  DEFAULT_VENUES,
  correctToReference,
  evaluateStability,
  type PipeKind,
  type Reading,
  type VenueProfile,
} from "../temperature/conversion";

const KEYS = {
  venues: "organ-tuning:venues:v1",
  readings: "organ-tuning:readings:v1",
  reports: "organ-tuning:reports:v1",
} as const;

export interface MaintenanceReport {
  id: string;
  venueId: string;
  title: string;
  issuedAt: string;
  readingIds: string[];
  summary: {
    total: number;
    reviewed: number;
    outOfTolerance: number;
    avgCorrectedCents: number;
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隐私模式 / 配额满：静默失败，页面内状态仍可用
  }
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadVenues(): VenueProfile[] {
  const stored = readJson<VenueProfile[]>(KEYS.venues, []);
  return stored.length > 0 ? stored : DEFAULT_VENUES;
}

export function saveVenues(venues: VenueProfile[]): void {
  writeJson(KEYS.venues, venues);
}

export function loadReadings(): Reading[] {
  const stored = readJson<Reading[]>(KEYS.readings, []);
  return stored.length > 0 ? stored : buildSeedReadings();
}

export function saveReadings(readings: Reading[]): void {
  writeJson(KEYS.readings, readings);
}

export function loadReports(): MaintenanceReport[] {
  return readJson<MaintenanceReport[]>(KEYS.reports, []);
}

export function saveReports(reports: MaintenanceReport[]): void {
  writeJson(KEYS.reports, reports);
}

// ---------- 初始种子读数（按时间顺序生成，稳定性判定逐条链上） ----------

interface SeedSpec {
  venueId: string;
  stopName: string;
  pipeNo: string;
  pipeKind: PipeKind;
  pitch: string;
  measuredCents: number;
  tempC: number;
  humidityPct: number;
  reedState: string;
  note: string;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

const SEED_SPECS: SeedSpec[] = [
  {
    venueId: "v-st-mary",
    stopName: "Trumpet 8'",
    pipeNo: "C#4",
    pipeKind: "reed",
    pitch: "C#4",
    measuredCents: 11,
    tempC: 25,
    humidityPct: 55,
    reedState: "需微调",
    note: "簧片需微调",
    createdAt: "2026-09-20T09:30:00",
    reviewedAt: "2026-09-21T10:05:00",
    reviewNote: "复测确认，簧片已调整",
  },
  {
    venueId: "v-concert-a",
    stopName: "Principal 4'",
    pipeNo: "G3",
    pipeKind: "flue",
    pitch: "G3",
    measuredCents: -3,
    tempC: 21,
    humidityPct: 48,
    reedState: "正常",
    note: "正常",
    createdAt: "2026-09-22T14:00:00",
  },
  {
    venueId: "v-abbey",
    stopName: "Bourdon 16'",
    pipeNo: "F2",
    pipeKind: "flue",
    pitch: "F2",
    measuredCents: -12,
    tempC: 9,
    humidityPct: 61,
    reedState: "正常",
    note: "标记复检",
    createdAt: "2026-09-24T08:40:00",
  },
  {
    venueId: "v-st-mary",
    stopName: "Trumpet 8'",
    pipeNo: "C#4",
    pipeKind: "reed",
    pitch: "C#4",
    measuredCents: 9,
    tempC: 24,
    humidityPct: 57,
    reedState: "需微调",
    note: "簧片需微调",
    createdAt: "2026-09-25T09:35:00",
  },
  {
    venueId: "v-concert-a",
    stopName: "Principal 4'",
    pipeNo: "G3",
    pipeKind: "flue",
    pitch: "G3",
    measuredCents: 8,
    tempC: 26,
    humidityPct: 45,
    reedState: "正常",
    note: "午后升温复测",
    createdAt: "2026-09-26T15:10:00",
  },
];

function buildSeedReadings(): Reading[] {
  const readings: Reading[] = [];
  for (const spec of SEED_SPECS) {
    const venue = DEFAULT_VENUES.find((v) => v.id === spec.venueId);
    if (!venue) continue;
    const { correctedCents, deltaTempC } = correctToReference(
      venue,
      spec.pipeKind,
      spec.measuredCents,
      spec.tempC
    );
    const stability = evaluateStability(spec, readings, venue);
    readings.push({
      id: uid("rd"),
      venueId: spec.venueId,
      stopName: spec.stopName,
      pipeNo: spec.pipeNo,
      pipeKind: spec.pipeKind,
      pitch: spec.pitch,
      measuredCents: spec.measuredCents,
      tempC: spec.tempC,
      humidityPct: spec.humidityPct,
      reedState: spec.reedState,
      note: spec.note,
      correctedCents,
      deltaTempC,
      swingC: stability.swingC,
      swingBaselineC: stability.baselineTempC,
      swingBaselineLabel: stability.baselineLabel,
      status: spec.reviewedAt ? "reviewed" : stability.needsRecheck ? "pending" : "ok",
      createdAt: spec.createdAt,
      reviewedAt: spec.reviewedAt,
      reviewNote: spec.reviewNote,
    });
  }
  return readings;
}
