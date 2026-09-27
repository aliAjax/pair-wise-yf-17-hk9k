// 本地存档：负责 localStorage 读写、读数实体组装与报告周期计算，
// 与折算规则（domain/temperature.ts）、复核页面（components/RecheckPage.tsx）分开维护。
import type { PipeType, VenueProfile } from "../domain/temperature";
import { correctToReference } from "../domain/temperature";

export type ReadingStatus = "normal" | "pending" | "rechecked";

export interface NewReadingInput {
  stop: string;
  pipeNo: string;
  pipeType: PipeType;
  pitch: string;
  measuredCents: number;
  temperature: number;
  humidity: number;
  reedStatus: string;
  note: string;
}

export interface Reading extends NewReadingInput {
  id: string;
  venueId: string;
  measuredAt: string;
  /** 录入时场馆的基准温度（快照，之后改规则不影响历史读数） */
  referenceTemp: number;
  /** 录入时实际采用的敏感系数（快照） */
  coeffUsed: number;
  deltaT: number;
  correctedCents: number;
  status: ReadingStatus;
  recheckNote?: string;
  recheckedAt?: string;
}

export interface ReportSignoff {
  id: string;
  venueId: string;
  signedAt: string;
  readingCount: number;
}

export interface AppState {
  venues: VenueProfile[];
  readings: Reading[];
  signoffs: ReportSignoff[];
}

const STORAGE_KEY = "organ-tuning-store-v1";

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 录入新读数：立即按当前场馆规则折算并落库，超阈值直接标记待复检 */
export function makeReading(input: NewReadingInput, venue: VenueProfile): Reading {
  return assemble(input, venue, new Date().toISOString());
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!Array.isArray(parsed.venues) || !Array.isArray(parsed.readings) || !Array.isArray(parsed.signoffs)) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存档不可用时保持界面可用，本次数据仅留在内存
  }
}

/** 某场馆最近一次签发 */
export function lastSignoff(signoffs: ReportSignoff[], venueId: string): ReportSignoff | undefined {
  return signoffs
    .filter((s) => s.venueId === venueId)
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt))[0];
}

/** 某场馆当前报告期内的读数（上次签发之后录入的），按时间升序 */
export function periodReadings(readings: Reading[], signoffs: ReportSignoff[], venueId: string): Reading[] {
  const last = lastSignoff(signoffs, venueId);
  return readings
    .filter((r) => r.venueId === venueId && (!last || r.measuredAt > last.signedAt))
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}

function assemble(input: NewReadingInput, venue: VenueProfile, measuredAt: string): Reading {
  const c = correctToReference(input.measuredCents, input.temperature, venue, input.pipeType);
  return {
    ...input,
    id: uid(),
    venueId: venue.id,
    measuredAt,
    referenceTemp: venue.referenceTemp,
    coeffUsed: c.coeff,
    deltaT: c.deltaT,
    correctedCents: c.correctedCents,
    status: c.needsRecheck ? "pending" : "normal",
  };
}

function seedState(): AppState {
  const venues: VenueProfile[] = [
    { id: "st-mary", name: "St.Mary 教堂", referenceTemp: 18, flueCoeff: 2.8, reedCoeff: 0.4, recheckThreshold: 3 },
    { id: "concert-hall-a", name: "ConcertHall A 音乐厅", referenceTemp: 21, flueCoeff: 3.0, reedCoeff: 0.5, recheckThreshold: 2.5 },
    { id: "abbey-room", name: "Abbey Room 室内乐厅", referenceTemp: 19, flueCoeff: 2.6, reedCoeff: 0.35, recheckThreshold: 3 },
  ];

  const readings: Reading[] = [
    assemble(
      { stop: "Trumpet 8'", pipeNo: "R-12", pipeType: "reed", pitch: "C#4", measuredCents: 9, temperature: 23.5, humidity: 55, reedStatus: "簧片需微调", note: "热态下偏高，需复核" },
      venues[0],
      "2026-09-25T10:20:00"
    ),
    assemble(
      { stop: "Principal 4'", pipeNo: "F-03", pipeType: "flue", pitch: "G3", measuredCents: -3, temperature: 21.4, humidity: 48, reedStatus: "—", note: "正常" },
      venues[1],
      "2026-09-25T15:40:00"
    ),
    assemble(
      { stop: "Bourdon 16'", pipeNo: "B-27", pipeType: "flue", pitch: "F2", measuredCents: -12, temperature: 14.8, humidity: 61, reedStatus: "—", note: "标记复检" },
      venues[2],
      "2026-09-26T09:05:00"
    ),
    // 已复核的历史读数：保留录入时的折算结果与复核结论
    {
      ...assemble(
        { stop: "Gedackt 8'", pipeNo: "G-08", pipeType: "flue", pitch: "A3", measuredCents: 14, temperature: 22.8, humidity: 52, reedStatus: "—", note: "暖机后偏高" },
        venues[0],
        "2026-09-20T14:10:00"
      ),
      status: "rechecked",
      recheckNote: "复检确认折算后 +0.6 音分，属正常温漂，无需调整",
      recheckedAt: "2026-09-21T11:30:00",
    },
  ];

  return { venues, readings, signoffs: [] };
}
