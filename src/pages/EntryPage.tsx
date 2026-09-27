import { useMemo, useState } from "react";
import {
  OUT_OF_TOLERANCE_CENTS,
  PIPE_KIND_LABEL,
  STATUS_LABEL,
  correctToReference,
  evaluateStability,
  formatCents,
  formatTemp,
  isOutOfTolerance,
  type PipeKind,
  type Reading,
  type VenueProfile,
} from "../temperature/conversion";
import { fmtTime } from "../utils/format";

export interface NewReadingInput {
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
}

interface EntryPageProps {
  venues: VenueProfile[];
  readings: Reading[];
  onAdd: (input: NewReadingInput) => Reading;
}

type FilterKey = "all" | "flue" | "reed" | "pending" | "out";

const FILTER_LABELS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "flue", label: "唇管" },
  { key: "reed", label: "簧片" },
  { key: "pending", label: "待复检" },
  { key: "out", label: "偏差超限" },
];

export function EntryPage({ venues, readings, onAdd }: EntryPageProps) {
  const [form, setForm] = useState({
    venueId: venues[0]?.id ?? "",
    stopName: "",
    pipeNo: "",
    pipeKind: "flue" as PipeKind,
    pitch: "",
    measuredCents: "",
    tempC: "",
    humidityPct: "",
    reedState: "正常",
    note: "",
  });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [saved, setSaved] = useState<Reading | null>(null);

  const venueById = (id: string) => venues.find((v) => v.id === id);
  const venueName = (id: string) => venueById(id)?.name ?? id;

  const venue = venueById(form.venueId) ?? venues[0];
  const measured = parseFloat(form.measuredCents);
  const temp = parseFloat(form.tempC);
  const numbersOk = Number.isFinite(measured) && Number.isFinite(temp);

  // 录入时实时预览：折算回基准温度 + 同管温差稳定性预判
  const preview = venue && numbersOk ? correctToReference(venue, form.pipeKind, measured, temp) : null;
  const stability =
    venue && numbersOk && form.stopName.trim() && form.pipeNo.trim()
      ? evaluateStability(
          { venueId: venue.id, stopName: form.stopName, pipeNo: form.pipeNo, tempC: temp },
          readings,
          venue
        )
      : null;

  const canSubmit = Boolean(venue && form.stopName.trim() && form.pipeNo.trim() && numbersOk);

  const knownStops = useMemo(
    () => Array.from(new Set(readings.map((r) => r.stopName))),
    [readings]
  );

  const filtered = readings
    .filter((r) => {
      switch (filter) {
        case "flue":
          return r.pipeKind === "flue";
        case "reed":
          return r.pipeKind === "reed";
        case "pending":
          return r.status === "pending";
        case "out":
          return isOutOfTolerance(r);
        default:
          return true;
      }
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!canSubmit || !venue) return;
    const humidity = parseFloat(form.humidityPct);
    const reading = onAdd({
      venueId: venue.id,
      stopName: form.stopName.trim(),
      pipeNo: form.pipeNo.trim(),
      pipeKind: form.pipeKind,
      pitch: form.pitch.trim() || form.pipeNo.trim(),
      measuredCents: measured,
      tempC: temp,
      humidityPct: Number.isFinite(humidity) ? humidity : 0,
      reedState: form.reedState,
      note: form.note.trim(),
    });
    setSaved(reading);
    setForm((f) => ({ ...f, measuredCents: "", note: "" }));
  }

  return (
    <>
      <section className="workspace">
        <aside className="panel">
          <h2>音栓列表</h2>
          {knownStops.length === 0 ? (
            <p className="muted">还没有读数，保存第一条后自动生成音栓列表。</p>
          ) : (
            <div className="chips">
              {knownStops.map((stop) => (
                <button key={stop} type="button" onClick={() => update("stopName", stop)}>
                  {stop} · {readings.filter((r) => r.stopName === stop).length}
                </button>
              ))}
            </div>
          )}

          <h2 className="mt">折算预览（{PIPE_KIND_LABEL[form.pipeKind]}）</h2>
          {preview && venue ? (
            <div className="kv-stack">
              <div className="kv">
                <span>敏感系数 k</span>
                <b className="num">{preview.coefficient.toFixed(1)} 音分/℃</b>
              </div>
              <div className="kv">
                <span>基准温度</span>
                <b className="num">{venue.referenceTempC.toFixed(1)} ℃</b>
              </div>
              <div className="kv">
                <span>现场 − 基准</span>
                <b className="num">{formatTemp(preview.deltaTempC)} ℃</b>
              </div>
              <div className="kv">
                <span>折算偏差</span>
                <b className="num">{formatCents(preview.correctedCents)} 音分</b>
              </div>
              {stability &&
                (stability.needsRecheck ? (
                  <div className="warn-box">
                    相对{stability.baselineLabel}（{stability.baselineTempC.toFixed(1)}℃）
                    {stability.swingC >= 0 ? "升温" : "降温"} {Math.abs(stability.swingC).toFixed(1)} ℃，
                    超过阈值 {venue.recheckThresholdC.toFixed(1)} ℃，保存后将列入待复检。
                  </div>
                ) : (
                  <div className="ok-box">
                    相对{stability.baselineLabel}（{stability.baselineTempC.toFixed(1)}℃）温差{" "}
                    {formatTemp(stability.swingC)} ℃，未超阈值 {venue.recheckThresholdC.toFixed(1)} ℃。
                  </div>
                ))}
            </div>
          ) : (
            <p className="muted">填写实测偏差与现场温度后，这里实时显示折算结果。</p>
          )}
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>专业字段</p>
              <h2>新增读数</h2>
            </div>
            <button className="primary" type="button" disabled={!canSubmit} onClick={submit}>
              保存读数
            </button>
          </div>

          {saved &&
            (saved.status === "pending" ? (
              <div className="stop-box banner">
                已保存并列入待复检：{saved.stopName} {saved.pipeNo} 相对{saved.swingBaselineLabel}
                {saved.swingC >= 0 ? "升温" : "降温"} {Math.abs(saved.swingC).toFixed(1)} ℃ 超过阈值。
                复核完成前，该场馆维护报告不能签发。
              </div>
            ) : (
              <div className="ok-box banner">
                已保存：折算偏差 {formatCents(saved.correctedCents)} 音分（基准{" "}
                {venueById(saved.venueId)?.referenceTempC.toFixed(1)}℃），状态正常。
              </div>
            ))}

          <div className="field-grid">
            <label>
              <span>场馆名称</span>
              <select value={form.venueId} onChange={(e) => update("venueId", e.target.value)}>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}（基准 {v.referenceTempC}℃）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>音栓</span>
              <input
                list="known-stops"
                placeholder="如 Trumpet 8'"
                value={form.stopName}
                onChange={(e) => update("stopName", e.target.value)}
              />
              <datalist id="known-stops">
                {knownStops.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label>
              <span>音管编号</span>
              <input
                placeholder="如 C#4"
                value={form.pipeNo}
                onChange={(e) => update("pipeNo", e.target.value)}
              />
            </label>
            <label>
              <span>音管类型</span>
              <select
                value={form.pipeKind}
                onChange={(e) => update("pipeKind", e.target.value as PipeKind)}
              >
                <option value="flue">唇管</option>
                <option value="reed">簧片</option>
              </select>
            </label>
            <label>
              <span>音高</span>
              <input
                placeholder="如 C#4"
                value={form.pitch}
                onChange={(e) => update("pitch", e.target.value)}
              />
            </label>
            <label>
              <span>实测音分偏差</span>
              <input
                type="number"
                step="0.1"
                placeholder="如 +9"
                value={form.measuredCents}
                onChange={(e) => update("measuredCents", e.target.value)}
              />
            </label>
            <label>
              <span>现场温度 ℃</span>
              <input
                type="number"
                step="0.1"
                placeholder="如 24"
                value={form.tempC}
                onChange={(e) => update("tempC", e.target.value)}
              />
            </label>
            <label>
              <span>湿度 %</span>
              <input
                type="number"
                step="1"
                placeholder="如 55"
                value={form.humidityPct}
                onChange={(e) => update("humidityPct", e.target.value)}
              />
            </label>
            <label>
              <span>簧片状态</span>
              <select value={form.reedState} onChange={(e) => update("reedState", e.target.value)}>
                <option>正常</option>
                <option>需微调</option>
                <option>需更换</option>
                <option>不适用（唇管）</option>
              </select>
            </label>
            <label>
              <span>维修备注</span>
              <input
                placeholder="选填"
                value={form.note}
                onChange={(e) => update("note", e.target.value)}
              />
            </label>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>调音偏差表</p>
            <h2>读数存档（{filtered.length}）</h2>
          </div>
          <div className="chips">
            {FILTER_LABELS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? "chip-active" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted hint">
          折算口径：折算偏差 = 实测偏差 − k × (现场温度 − 基准温度)；|折算偏差| &gt;{" "}
          {OUT_OF_TOLERANCE_CENTS} 音分记为超限（异常音管标记）。
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>场馆</th>
                <th>音栓</th>
                <th>音管</th>
                <th>类型</th>
                <th>实测偏差</th>
                <th>温湿度</th>
                <th>折算@基准</th>
                <th>状态</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="num">{fmtTime(r.createdAt)}</td>
                  <td>{venueName(r.venueId)}</td>
                  <td>{r.stopName}</td>
                  <td>
                    <b>{r.pipeNo}</b>
                    {r.pitch && r.pitch !== r.pipeNo ? (
                      <span className="muted"> {r.pitch}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className="badge kind">{PIPE_KIND_LABEL[r.pipeKind]}</span>
                  </td>
                  <td className="num">{formatCents(r.measuredCents)}</td>
                  <td className="num">
                    {r.tempC.toFixed(1)}℃ / {r.humidityPct}%
                  </td>
                  <td className="num">
                    <b>{formatCents(r.correctedCents)}</b>
                  </td>
                  <td>
                    <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>{" "}
                    {isOutOfTolerance(r) && <span className="badge alert">超限</span>}
                  </td>
                  <td>{r.note || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted">
                    当前筛选下没有读数。
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
