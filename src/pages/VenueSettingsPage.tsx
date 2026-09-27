import { useState } from "react";
import type { VenueProfile } from "../temperature/conversion";
import { fmtTime } from "../utils/format";

interface VenueSettingsPageProps {
  venues: VenueProfile[];
  onSave: (venues: VenueProfile[]) => void;
}

interface VenueDraft {
  id: string;
  name: string;
  referenceTempC: string;
  reedCentsPerDeg: string;
  flueCentsPerDeg: string;
  recheckThresholdC: string;
}

/**
 * 场馆档案维护：基准温度、簧片/唇管敏感系数、复检阈值。
 * 参数只影响保存之后录入的新读数；历史读数的折算结果随读数固化，不追溯。
 */
export function VenueSettingsPage({ venues, onSave }: VenueSettingsPageProps) {
  const [draft, setDraft] = useState<VenueDraft[]>(() =>
    venues.map((v) => ({
      id: v.id,
      name: v.name,
      referenceTempC: String(v.referenceTempC),
      reedCentsPerDeg: String(v.reedCentsPerDeg),
      flueCentsPerDeg: String(v.flueCentsPerDeg),
      recheckThresholdC: String(v.recheckThresholdC),
    }))
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function update(id: string, key: keyof VenueDraft, value: string) {
    setDraft((list) => list.map((d) => (d.id === id ? { ...d, [key]: value } : d)));
  }

  function save() {
    const next: VenueProfile[] = draft.map((d) => {
      const orig = venues.find((v) => v.id === d.id);
      const num = (s: string, fallback: number) => {
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : fallback;
      };
      return {
        id: d.id,
        name: d.name.trim() || orig?.name || d.id,
        referenceTempC: num(d.referenceTempC, orig?.referenceTempC ?? 18),
        reedCentsPerDeg: num(d.reedCentsPerDeg, orig?.reedCentsPerDeg ?? 0.8),
        flueCentsPerDeg: num(d.flueCentsPerDeg, orig?.flueCentsPerDeg ?? 3),
        recheckThresholdC: num(d.recheckThresholdC, orig?.recheckThresholdC ?? 5),
      };
    });
    onSave(next);
    setSavedAt(new Date().toISOString());
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>折算规则参数</p>
          <h2>场馆档案</h2>
        </div>
        <button className="primary" type="button" onClick={save}>
          保存全部参数
        </button>
      </div>
      <p className="muted hint">
        每个场馆独立保存基准温度与簧片、唇管敏感系数；参数只影响保存之后录入的新读数，
        历史读数的折算结果与复核结论保留不变。
        {savedAt ? ` 已于 ${fmtTime(savedAt)} 保存。` : ""}
      </p>
      <div className="venue-grid">
        {draft.map((d) => (
          <article key={d.id} className="venue-card">
            <label>
              <span>场馆名称</span>
              <input value={d.name} onChange={(e) => update(d.id, "name", e.target.value)} />
            </label>
            <div className="field-grid">
              <label>
                <span>基准温度 ℃</span>
                <input
                  type="number"
                  step="0.5"
                  value={d.referenceTempC}
                  onChange={(e) => update(d.id, "referenceTempC", e.target.value)}
                />
              </label>
              <label>
                <span>复检阈值 ℃</span>
                <input
                  type="number"
                  step="0.5"
                  value={d.recheckThresholdC}
                  onChange={(e) => update(d.id, "recheckThresholdC", e.target.value)}
                />
              </label>
              <label>
                <span>簧片系数 音分/℃</span>
                <input
                  type="number"
                  step="0.1"
                  value={d.reedCentsPerDeg}
                  onChange={(e) => update(d.id, "reedCentsPerDeg", e.target.value)}
                />
              </label>
              <label>
                <span>唇管系数 音分/℃</span>
                <input
                  type="number"
                  step="0.1"
                  value={d.flueCentsPerDeg}
                  onChange={(e) => update(d.id, "flueCentsPerDeg", e.target.value)}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
