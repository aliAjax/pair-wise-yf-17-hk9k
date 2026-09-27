// 复核页面：待复检队列与已复核历史，独立维护。
import { useState } from "react";
import type { Reading } from "../data/store";
import { PIPE_TYPE_LABEL, driftLabel, formatCents, type VenueProfile } from "../domain/temperature";
import { formatDateTime } from "../format";
import StatusBadge from "./StatusBadge";

interface Props {
  venues: VenueProfile[];
  readings: Reading[];
  onRecheck: (readingId: string, note: string) => void;
}

export default function RecheckPage({ venues, readings, onRecheck }: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? id;

  const pending = readings
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const history = readings
    .filter((r) => r.status === "rechecked")
    .sort((a, b) => (b.recheckedAt ?? "").localeCompare(a.recheckedAt ?? ""));

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>稳定性复核</p>
            <h2>待复检音管（{pending.length}）</h2>
          </div>
        </div>
        <p className="muted">
          现场温度相对基准温度升/降超过阈值的音管在此排队；逐条复检通过后，对应场馆的维护报告才能签发。
        </p>
        {pending.length === 0 && <p className="notice notice-ok">当前没有待复检的音管。</p>}
        <div className="card-grid">
          {pending.map((r) => (
            <article className="card" key={r.id}>
              <div className="card-head">
                <h3>
                  {r.stop} · {r.pipeNo}
                </h3>
                <StatusBadge status={r.status} />
              </div>
              <div className="kv">
                <span>场馆</span>
                <b>{venueName(r.venueId)}</b>
              </div>
              <div className="kv">
                <span>音高 / 类型</span>
                <b>
                  {r.pitch} · {PIPE_TYPE_LABEL[r.pipeType]}
                </b>
              </div>
              <div className="kv">
                <span>实测偏差</span>
                <b>{formatCents(r.measuredCents)} 音分</b>
              </div>
              <div className="kv">
                <span>现场温度（基准 {r.referenceTemp}℃）</span>
                <b>{r.temperature.toFixed(1)}℃</b>
              </div>
              <div className="kv">
                <span>温漂</span>
                <b>{driftLabel(r.deltaT, 0)}</b>
              </div>
              <div className="kv">
                <span>折算后偏差</span>
                <b>{formatCents(r.correctedCents)} 音分</b>
              </div>
              <div className="kv">
                <span>录入时间</span>
                <b>{formatDateTime(r.measuredAt)}</b>
              </div>
              <label>
                <span>复核结论（可选）</span>
                <textarea
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="如：复测确认属温漂，无需调整"
                />
              </label>
              <button className="primary" onClick={() => onRecheck(r.id, notes[r.id] ?? "")}>
                复核通过
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>历史保留</p>
            <h2>已复核读数（{history.length}）</h2>
          </div>
        </div>
        <p className="muted">已复核的历史读数继续保留，折算结果以录入时的规则为准，不随后续规则调整而改变。</p>
        {history.length === 0 && <p className="muted">暂无已复核读数。</p>}
        <div className="records">
          {history.map((r) => (
            <article key={r.id}>
              <b>{formatCents(r.correctedCents)}</b>
              <div>
                <h3>
                  {venueName(r.venueId)} · {r.stop} {r.pipeNo}（{r.pitch}）
                </h3>
                <p>
                  实测 {formatCents(r.measuredCents)} 音分 @ {r.temperature.toFixed(1)}℃ → 折算 {formatCents(r.correctedCents)} 音分
                  @ {r.referenceTemp}℃ · 复核于 {r.recheckedAt ? formatDateTime(r.recheckedAt) : "—"}
                </p>
                {r.recheckNote && <p>结论：{r.recheckNote}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
