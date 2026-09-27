import { useEffect, useState } from "react";
import "./styles.css";
import {
  loadState,
  makeReading,
  periodReadings,
  saveState,
  uid,
  type AppState,
  type NewReadingInput,
  type Reading,
  type ReportSignoff,
} from "./data/store";
import type { VenueProfile } from "./domain/temperature";
import EntryForm from "./components/EntryForm";
import RecheckPage from "./components/RecheckPage";
import ReportPage from "./components/ReportPage";
import VenueSettings from "./components/VenueSettings";

type Tab = "entry" | "recheck" | "report" | "venues";

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>("entry");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const pendingCount = state.readings.filter((r) => r.status === "pending").length;
  const recheckedCount = state.readings.filter((r) => r.status === "rechecked").length;

  const addReading = (venueId: string, input: NewReadingInput) => {
    const venue = state.venues.find((v) => v.id === venueId);
    if (!venue) return;
    setState((s) => ({ ...s, readings: [...s.readings, makeReading(input, venue)] }));
  };

  const recheckReading = (readingId: string, note: string) => {
    setState((s) => ({
      ...s,
      readings: s.readings.map(
        (r): Reading =>
          r.id === readingId
            ? {
                ...r,
                status: "rechecked",
                recheckNote: note.trim() || "复核通过",
                recheckedAt: new Date().toISOString(),
              }
            : r
      ),
    }));
  };

  // 签发闸门：报告期内存在待复检读数时一律拒绝签发
  const signReport = (venueId: string) => {
    setState((s) => {
      const period = periodReadings(s.readings, s.signoffs, venueId);
      if (period.length === 0 || period.some((r) => r.status === "pending")) return s;
      const signoff: ReportSignoff = {
        id: uid(),
        venueId,
        signedAt: new Date().toISOString(),
        readingCount: period.length,
      };
      return { ...s, signoffs: [...s.signoffs, signoff] };
    });
  };

  const saveVenue = (venue: VenueProfile) => {
    setState((s) => ({ ...s, venues: s.venues.map((v) => (v.id === venue.id ? venue : v)) }));
  };

  const addVenue = () => {
    setState((s) => ({
      ...s,
      venues: [
        ...s.venues,
        { id: uid(), name: "新场馆", referenceTemp: 20, flueCoeff: 2.8, reedCoeff: 0.4, recheckThreshold: 3 },
      ],
    }));
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "entry", label: "录入与折算" },
    { key: "recheck", label: pendingCount > 0 ? `复核队列（${pendingCount}）` : "复核队列" },
    { key: "report", label: "维护报告" },
    { key: "venues", label: "场馆与折算规则" },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62005 · 管风琴维护</p>
        <h1>管风琴音管调音记录</h1>
        <span>
          现场实测的音分偏差会随温度热胀冷缩。录入时按各场馆保存的基准温度与簧片、唇管敏感系数自动折算回基准温度；
          同一音管升温或降温超过阈值即列入待复检，复检完成前该场馆的维护报告不能签发，已复核的历史读数继续保留。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>记录总数</small>
          <strong>{state.readings.length}</strong>
        </article>
        <article>
          <small>待复检</small>
          <strong>{pendingCount}</strong>
        </article>
        <article>
          <small>已复核</small>
          <strong>{recheckedCount}</strong>
        </article>
        <article>
          <small>已签发报告</small>
          <strong>{state.signoffs.length}</strong>
        </article>
      </section>

      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "entry" && <EntryForm venues={state.venues} readings={state.readings} onAdd={addReading} />}
      {tab === "recheck" && (
        <RecheckPage venues={state.venues} readings={state.readings} onRecheck={recheckReading} />
      )}
      {tab === "report" && (
        <ReportPage venues={state.venues} readings={state.readings} signoffs={state.signoffs} onSign={signReport} />
      )}
      {tab === "venues" && <VenueSettings venues={state.venues} onSave={saveVenue} onAdd={addVenue} />}
    </main>
  );
}

export default App;
