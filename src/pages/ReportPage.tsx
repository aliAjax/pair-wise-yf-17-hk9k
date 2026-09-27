import { useState } from "react";
import {
  STATUS_LABEL,
  formatCents,
  isOutOfTolerance,
  type Reading,
  type VenueProfile,
} from "../temperature/conversion";
import type { MaintenanceReport } from "../storage/localStore";
import { fmtTime } from "../utils/format";

interface ReportPageProps {
  venues: VenueProfile[];
  readings: Reading[];
  reports: MaintenanceReport[];
  onIssue: (venueId: string, title: string) => MaintenanceReport | null;
}

/**
 * 单次维护报告页：按场馆汇总读数并签发。
 * 签发闸口：该场馆只要还有"待复检"读数，报告就不能签发。
 */
export function ReportPage({ venues, readings, reports, onIssue }: ReportPageProps) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [issued, setIssued] = useState<MaintenanceReport | null>(null);

  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  const scope = readings
    .filter((r) => r.venueId === venue?.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pendingList = scope.filter((r) => r.status === "pending");
  const outCount = scope.filter(isOutOfTolerance).length;
  const avg = scope.length ? scope.reduce((s, r) => s + r.correctedCents, 0) / scope.length : 0;
  const blocked = pendingList.length > 0;

  const venueReports = reports.filter((r) => r.venueId === venue?.id);

  function issue() {
    if (!venue) return;
    const report = onIssue(venue.id, title);
    if (report) {
      setIssued(report);
      setTitle("");
    }
  }

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>单次维护报告</p>
            <h2>报告签发</h2>
          </div>
          <button className="primary" type="button" disabled={blocked || !venue} onClick={issue}>
            签发报告
          </button>
        </div>

        <div className="field-grid">
          <label>
            <span>场馆</span>
            <select
              value={venue?.id ?? ""}
              onChange={(e) => {
                setVenueId(e.target.value);
                setIssued(null);
              }}
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>报告标题</span>
            <input
              placeholder={`${venue?.name ?? ""} 维护报告`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>

        <div className="metrics in-panel">
          <article>
            <small>读数总数</small>
            <strong>{scope.length}</strong>
          </article>
          <article>
            <small>待复检</small>
            <strong>{pendingList.length}</strong>
          </article>
          <article>
            <small>偏差超限</small>
            <strong>{outCount}</strong>
          </article>
          <article>
            <small>平均折算偏差</small>
            <strong>{formatCents(avg)}</strong>
          </article>
        </div>

        {blocked ? (
          <div className="stop-box">
            存在 {pendingList.length} 条待复检读数（
            {pendingList.map((r) => `${r.stopName} ${r.pipeNo}`).join("、")}
            ）。完成复核前，本场馆维护报告不能签发。
          </div>
        ) : (
          <div className="ok-box">全部读数状态正常或已复核，可以签发。</div>
        )}

        {issued && (
          <div className="ok-box banner">
            已签发：{issued.title}（{fmtTime(issued.issuedAt)}），共 {issued.summary.total} 条读数。
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>报告内容预览</p>
            <h2>{venue?.name} · 读数明细</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>音栓</th>
                <th>音管</th>
                <th>实测偏差</th>
                <th>现场温度</th>
                <th>折算@基准</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {scope.map((r) => (
                <tr key={r.id}>
                  <td className="num">{fmtTime(r.createdAt)}</td>
                  <td>{r.stopName}</td>
                  <td>
                    <b>{r.pipeNo}</b>
                  </td>
                  <td className="num">{formatCents(r.measuredCents)}</td>
                  <td className="num">{r.tempC.toFixed(1)}℃</td>
                  <td className="num">
                    <b>{formatCents(r.correctedCents)}</b>
                  </td>
                  <td>
                    <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>{" "}
                    {isOutOfTolerance(r) && <span className="badge alert">超限</span>}
                  </td>
                </tr>
              ))}
              {scope.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    该场馆还没有读数。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>存档</p>
            <h2>已签发报告（{venueReports.length}）</h2>
          </div>
        </div>
        {venueReports.length === 0 ? (
          <p className="muted">该场馆还没有签发过报告。</p>
        ) : (
          <div className="records">
            {venueReports.map((r, i) => (
              <article key={r.id}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <div>
                  <h3>{r.title}</h3>
                  <p>
                    签发 {fmtTime(r.issuedAt)} · 读数 {r.summary.total} 条 · 已复核{" "}
                    {r.summary.reviewed} 条 · 超限 {r.summary.outOfTolerance} 条 · 平均折算偏差{" "}
                    {formatCents(r.summary.avgCorrectedCents)} 音分
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
