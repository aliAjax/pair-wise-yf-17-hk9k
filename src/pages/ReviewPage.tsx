import { useState } from "react";
import {
  PIPE_KIND_LABEL,
  formatCents,
  isOutOfTolerance,
  type Reading,
  type VenueProfile,
} from "../temperature/conversion";
import { fmtTime } from "../utils/format";

interface ReviewPageProps {
  venues: VenueProfile[];
  readings: Reading[];
  onReview: (readingId: string, reviewNote: string) => void;
}

/**
 * 复核页面：只负责"待复检 → 已复核"这条流水线。
 * 复核只追加结论（reviewedAt / reviewNote），原始实测与折算结果保留不改。
 */
export function ReviewPage({ venues, readings, onReview }: ReviewPageProps) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  const venueById = (id: string) => venues.find((v) => v.id === id);
  const venueName = (id: string) => venueById(id)?.name ?? id;

  const pending = readings
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reviewed = readings
    .filter((r) => r.status === "reviewed")
    .sort((a, b) => (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? ""));

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>稳定性复核</p>
            <h2>待复检读数（{pending.length}）</h2>
          </div>
          <span className="muted">
            同一音管温升/温降超过阈值即列入待复检；复核完成前，对应场馆的维护报告不能签发。
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="ok-box">没有待复检的读数，所有场馆报告均可正常签发。</div>
        ) : (
          <div className="review-grid">
            {pending.map((r) => {
              const venue = venueById(r.venueId);
              return (
                <article key={r.id} className="review-card">
                  <div className="review-head">
                    <b>
                      {venueName(r.venueId)} · {r.stopName} · {r.pipeNo}
                    </b>
                    <div>
                      <span className="badge kind">{PIPE_KIND_LABEL[r.pipeKind]}</span>{" "}
                      <span className="badge pending">
                        {r.swingC >= 0 ? "升温" : "降温"} {Math.abs(r.swingC).toFixed(1)}℃
                      </span>{" "}
                      {isOutOfTolerance(r) && <span className="badge alert">超限</span>}
                    </div>
                  </div>
                  <div className="kv">
                    <span>现场温度</span>
                    <b className="num">{r.tempC.toFixed(1)} ℃</b>
                  </div>
                  <div className="kv">
                    <span>对比基线（{r.swingBaselineLabel}）</span>
                    <b className="num">{r.swingBaselineC.toFixed(1)} ℃</b>
                  </div>
                  <div className="kv">
                    <span>基准温度 / 阈值</span>
                    <b className="num">
                      {venue?.referenceTempC.toFixed(1)} ℃ / {venue?.recheckThresholdC.toFixed(1)} ℃
                    </b>
                  </div>
                  <div className="kv">
                    <span>实测 → 折算</span>
                    <b className="num">
                      {formatCents(r.measuredCents)} → {formatCents(r.correctedCents)} 音分
                    </b>
                  </div>
                  <div className="kv">
                    <span>录入时间</span>
                    <b className="num">{fmtTime(r.createdAt)}</b>
                  </div>
                  {r.note && (
                    <div className="kv">
                      <span>维修备注</span>
                      <b>{r.note}</b>
                    </div>
                  )}
                  <textarea
                    placeholder="复核结论（如：复测确认 / 已调整簧片）"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <button
                    className="primary"
                    type="button"
                    onClick={() => onReview(r.id, (notes[r.id] ?? "").trim() || "复测确认")}
                  >
                    复核通过
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>历史保留</p>
            <h2>已复核读数（{reviewed.length}）</h2>
          </div>
          <span className="muted">复核只追加结论，原始实测与折算结果保留不改。</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>复核时间</th>
                <th>场馆</th>
                <th>音栓 / 音管</th>
                <th>实测偏差</th>
                <th>折算@基准</th>
                <th>复核结论</th>
                <th>原始录入</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.reviewedAt ? fmtTime(r.reviewedAt) : "—"}</td>
                  <td>{venueName(r.venueId)}</td>
                  <td>
                    {r.stopName} · {r.pipeNo}
                  </td>
                  <td className="num">{formatCents(r.measuredCents)}</td>
                  <td className="num">
                    <b>{formatCents(r.correctedCents)}</b>
                  </td>
                  <td>{r.reviewNote || "—"}</td>
                  <td className="num">{fmtTime(r.createdAt)}</td>
                </tr>
              ))}
              {reviewed.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    还没有已复核的读数。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
