import { useState, type FormEvent } from "react";
import {
  PIPE_TYPE_LABEL,
  correctToReference,
  driftLabel,
  formatCents,
  type PipeType,
  type VenueProfile,
} from "../domain/temperature";
import type { NewReadingInput, Reading } from "../data/store";
import ReadingsTable from "./ReadingsTable";

interface Props {
  venues: VenueProfile[];
  readings: Reading[];
  onAdd: (venueId: string, input: NewReadingInput) => void;
}

export default function EntryForm({ venues, readings, onAdd }: Props) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [stop, setStop] = useState("");
  const [pipeNo, setPipeNo] = useState("");
  const [pipeType, setPipeType] = useState<PipeType>("flue");
  const [pitch, setPitch] = useState("");
  const [cents, setCents] = useState("");
  const [temp, setTemp] = useState("");
  const [humidity, setHumidity] = useState("");
  const [reedStatus, setReedStatus] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");

  const venue = venues.find((v) => v.id === venueId) ?? venues[0];

  const measuredCents = parseFloat(cents);
  const temperature = parseFloat(temp);
  const humidityValue = parseFloat(humidity);

  // 录入时实时折算回基准温度，保存前即可确认结果
  const preview =
    venue && Number.isFinite(measuredCents) && Number.isFinite(temperature)
      ? correctToReference(measuredCents, temperature, venue, pipeType)
      : null;

  const canSubmit =
    !!venue &&
    stop.trim() !== "" &&
    pipeNo.trim() !== "" &&
    pitch.trim() !== "" &&
    preview !== null &&
    Number.isFinite(humidityValue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !venue || !preview) return;
    onAdd(venue.id, {
      stop: stop.trim(),
      pipeNo: pipeNo.trim(),
      pipeType,
      pitch: pitch.trim(),
      measuredCents,
      temperature,
      humidity: humidityValue,
      reedStatus: reedStatus.trim() || "—",
      note: note.trim(),
    });
    setSaved(
      `已保存 ${venue.name} · ${stop.trim()} ${pipeNo.trim()}：折算后 ${formatCents(preview.correctedCents)} 音分` +
        (preview.needsRecheck ? "，温漂超阈值，已列入待复检" : "")
    );
    setStop("");
    setPipeNo("");
    setPitch("");
    setCents("");
    setTemp("");
    setHumidity("");
    setReedStatus("");
    setNote("");
  };

  if (!venue) {
    return <section className="panel">请先在“场馆与折算规则”中添加场馆。</section>;
  }

  const recent = [...readings].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)).slice(0, 8);

  return (
    <>
      <section className="panel">
        <div className="heading">
          <div>
            <p>录入即折算</p>
            <h2>新增调音记录</h2>
          </div>
          <button className="primary" onClick={handleSubmit} disabled={!canSubmit}>
            保存记录
          </button>
        </div>
        <form className="field-grid" onSubmit={handleSubmit}>
          <label>
            <span>场馆名称</span>
            <select value={venue.id} onChange={(e) => setVenueId(e.target.value)}>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>音管类型</span>
            <select value={pipeType} onChange={(e) => setPipeType(e.target.value as PipeType)}>
              {(Object.keys(PIPE_TYPE_LABEL) as PipeType[]).map((t) => (
                <option key={t} value={t}>
                  {PIPE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>音栓</span>
            <input value={stop} onChange={(e) => setStop(e.target.value)} placeholder="如 Trumpet 8'" />
          </label>
          <label>
            <span>音管编号</span>
            <input value={pipeNo} onChange={(e) => setPipeNo(e.target.value)} placeholder="如 R-12" />
          </label>
          <label>
            <span>音高</span>
            <input value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="如 C#4" />
          </label>
          <label>
            <span>实测音分偏差</span>
            <input type="number" step="0.1" value={cents} onChange={(e) => setCents(e.target.value)} placeholder="如 +9" />
          </label>
          <label>
            <span>现场温度 ℃</span>
            <input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="如 23.5" />
          </label>
          <label>
            <span>湿度 %</span>
            <input type="number" step="1" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="如 55" />
          </label>
          <label>
            <span>簧片状态</span>
            <input value={reedStatus} onChange={(e) => setReedStatus(e.target.value)} placeholder="唇管可填 —" />
          </label>
          <label>
            <span>维修备注</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="填写维修备注" />
          </label>
        </form>

        <p className="muted">
          当前场馆规则：基准 {venue.referenceTemp}℃ · 唇管 {venue.flueCoeff} 音分/℃ · 簧片 {venue.reedCoeff} 音分/℃ ·
          复检阈值 ±{venue.recheckThreshold}℃
        </p>

        {preview && (
          <div className="preview">
            <div>
              <small>相对基准</small>
              <strong>{driftLabel(preview.deltaT, venue.recheckThreshold)}</strong>
            </div>
            <div>
              <small>采用系数</small>
              <strong>{preview.coeff} 音分/℃</strong>
            </div>
            <div>
              <small>热漂分量</small>
              <strong>{formatCents(preview.thermalCents)} 音分</strong>
            </div>
            <div>
              <small>折算后偏差（{venue.referenceTemp}℃）</small>
              <strong>{formatCents(preview.correctedCents)} 音分</strong>
            </div>
            <p className={preview.needsRecheck ? "notice notice-warn" : "notice notice-ok"}>
              {preview.needsRecheck
                ? `现场温度相对基准${preview.deltaT > 0 ? "升高" : "降低"} ${Math.abs(preview.deltaT).toFixed(1)}℃，超过阈值 ±${venue.recheckThreshold}℃，保存后将列入待复检。`
                : "温漂在阈值内，保存后即为正常读数。"}
            </p>
          </div>
        )}

        {saved && <p className="notice notice-ok">{saved}</p>}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>调音偏差表</p>
            <h2>近期读数（已折算）</h2>
          </div>
        </div>
        <ReadingsTable readings={recent} venues={venues} />
      </section>
    </>
  );
}
