import { periodReadings, type Reading, type ReportSignoff } from "../data/store";
import type { VenueProfile } from "../domain/temperature";
import { formatDateTime } from "../format";
import ReadingsTable from "./ReadingsTable";

interface Props {
  venues: VenueProfile[];
  readings: Reading[];
  signoffs: ReportSignoff[];
  onSign: (venueId: string) => void;
}

export default function ReportPage({ venues, readings, signoffs, onSign }: Props) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>单次维护报告</p>
          <h2>报告签发</h2>
        </div>
      </div>
      <p className="muted">
        报告按场馆汇总上次签发之后的读数，偏差值均为折算回基准温度后的结果。报告期内仍有待复检音管时不能签发。
      </p>
      {venues.map((venue) => {
        const period = periodReadings(readings, signoffs, venue.id);
        const pending = period.filter((r) => r.status === "pending");
        const canSign = period.length > 0 && pending.length === 0;
        const avgAbs =
          period.length > 0
            ? (period.reduce((sum, r) => sum + Math.abs(r.correctedCents), 0) / period.length).toFixed(1)
            : "—";
        const history = signoffs
          .filter((s) => s.venueId === venue.id)
          .sort((a, b) => b.signedAt.localeCompare(a.signedAt));

        return (
          <div className="report-block" key={venue.id}>
            <div className="heading">
              <div>
                <p>
                  基准 {venue.referenceTemp}℃ · 阈值 ±{venue.recheckThreshold}℃
                </p>
                <h3>{venue.name}</h3>
              </div>
              <button className="primary" disabled={!canSign} onClick={() => onSign(venue.id)}>
                签发报告
              </button>
            </div>
            <div className="report-stats">
              <span>本期读数 {period.length} 条</span>
              <span>待复检 {pending.length} 条</span>
              <span>平均 |折算偏差| {avgAbs} 音分</span>
            </div>
            {period.length > 0 && pending.length > 0 && (
              <p className="notice notice-warn">
                {pending
                  .map((r) => `${r.stop} ${r.pipeNo}`)
                  .join("、")}{" "}
                仍在待复检队列，完成复核后才能签发本报告。
              </p>
            )}
            {period.length === 0 && <p className="muted">本期暂无读数，无可签发内容。</p>}
            {period.length > 0 && <ReadingsTable readings={period} venues={venues} showVenue={false} />}
            {history.length > 0 && (
              <div className="signoff-list">
                <h4>历史签发</h4>
                {history.map((s) => (
                  <p className="muted" key={s.id}>
                    {formatDateTime(s.signedAt)} 签发 · 含 {s.readingCount} 条读数
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
