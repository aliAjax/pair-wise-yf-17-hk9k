import { useEffect, useState } from "react";
import "./styles.css";
import {
  correctToReference,
  evaluateStability,
  isOutOfTolerance,
  type Reading,
  type VenueProfile,
} from "./temperature/conversion";
import {
  loadReadings,
  loadReports,
  loadVenues,
  saveReadings,
  saveReports,
  saveVenues,
  uid,
  type MaintenanceReport,
} from "./storage/localStore";
import { EntryPage, type NewReadingInput } from "./pages/EntryPage";
import { ReviewPage } from "./pages/ReviewPage";
import { ReportPage } from "./pages/ReportPage";
import { VenueSettingsPage } from "./pages/VenueSettingsPage";

type TabKey = "entry" | "review" | "report" | "venues";

function App() {
  const [tab, setTab] = useState<TabKey>("entry");
  const [venues, setVenues] = useState<VenueProfile[]>(loadVenues);
  const [readings, setReadings] = useState<Reading[]>(loadReadings);
  const [reports, setReports] = useState<MaintenanceReport[]>(loadReports);

  // 本地存档：状态变更即落盘（折算规则在 temperature/conversion.ts，存档细节在 storage/localStore.ts）
  useEffect(() => saveVenues(venues), [venues]);
  useEffect(() => saveReadings(readings), [readings]);
  useEffect(() => saveReports(reports), [reports]);

  /** 录入读数：当场折算回基准温度并做同管温差稳定性判定，结果随读数固化 */
  function addReading(input: NewReadingInput): Reading {
    const venue = venues.find((v) => v.id === input.venueId);
    if (!venue) throw new Error("未知场馆");
    const { correctedCents, deltaTempC } = correctToReference(
      venue,
      input.pipeKind,
      input.measuredCents,
      input.tempC
    );
    const stability = evaluateStability(input, readings, venue);
    const reading: Reading = {
      id: uid("rd"),
      ...input,
      correctedCents,
      deltaTempC,
      swingC: stability.swingC,
      swingBaselineC: stability.baselineTempC,
      swingBaselineLabel: stability.baselineLabel,
      status: stability.needsRecheck ? "pending" : "ok",
      createdAt: new Date().toISOString(),
    };
    setReadings((prev) => [...prev, reading]);
    return reading;
  }

  /** 复核通过：只追加复核结论，原始读数保留 */
  function reviewReading(id: string, reviewNote: string) {
    setReadings((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: "reviewed", reviewedAt: new Date().toISOString(), reviewNote }
          : r
      )
    );
  }

  /** 签发维护报告：该场馆存在待复检读数时拒绝签发 */
  function issueReport(venueId: string, title: string): MaintenanceReport | null {
    const venue = venues.find((v) => v.id === venueId);
    if (!venue) return null;
    const scope = readings.filter((r) => r.venueId === venueId);
    if (scope.some((r) => r.status === "pending")) return null;
    const avg = scope.length ? scope.reduce((s, r) => s + r.correctedCents, 0) / scope.length : 0;
    const report: MaintenanceReport = {
      id: uid("rp"),
      venueId,
      title: title.trim() || `${venue.name} 维护报告`,
      issuedAt: new Date().toISOString(),
      readingIds: scope.map((r) => r.id),
      summary: {
        total: scope.length,
        reviewed: scope.filter((r) => r.status === "reviewed").length,
        outOfTolerance: scope.filter(isOutOfTolerance).length,
        avgCorrectedCents: Math.round(avg * 10) / 10,
      },
    };
    setReports((prev) => [report, ...prev]);
    return report;
  }

  const pendingCount = readings.filter((r) => r.status === "pending").length;
  const outCount = readings.filter(isOutOfTolerance).length;
  const reviewedCount = readings.filter((r) => r.status === "reviewed").length;
  const stopCount = new Set(readings.map((r) => r.stopName)).size;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "entry", label: "录入工作台" },
    { key: "review", label: pendingCount > 0 ? `温度复核（${pendingCount}）` : "温度复核" },
    { key: "report", label: "维护报告" },
    { key: "venues", label: "场馆与折算规则" },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62005 · 源提示词7 · Port 62005</p>
        <h1>管风琴音管调音记录</h1>
        <span>
          录入实测偏差时按场馆敏感系数折算回基准温度，区分调音问题与热胀冷缩；同一音管温升或温降超过阈值自动列入待复检，
          复核完成前该场馆维护报告不能签发，已复核的历史读数保留不改。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>音栓数量</small>
          <strong>{stopCount}</strong>
        </article>
        <article>
          <small>待复检</small>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <small>偏差超限</small>
          <strong>{outCount}</strong>
        </article>
        <article>
          <small>已复核</small>
          <strong>{reviewedCount}</strong>
        </article>
      </section>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "entry" && <EntryPage venues={venues} readings={readings} onAdd={addReading} />}
      {tab === "review" && (
        <ReviewPage venues={venues} readings={readings} onReview={reviewReading} />
      )}
      {tab === "report" && (
        <ReportPage venues={venues} readings={readings} reports={reports} onIssue={issueReport} />
      )}
      {tab === "venues" && <VenueSettingsPage venues={venues} onSave={setVenues} />}
    </main>
  );
}

export default App;
