import { useState } from "react";
import type { VenueProfile } from "../domain/temperature";

interface Props {
  venues: VenueProfile[];
  onSave: (venue: VenueProfile) => void;
  onAdd: () => void;
}

export default function VenueSettings({ venues, onSave, onAdd }: Props) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>折算规则配置</p>
          <h2>场馆与敏感系数</h2>
        </div>
        <button onClick={onAdd}>新增场馆</button>
      </div>
      <p className="muted">
        每个场馆独立保存基准温度与簧片、唇管的敏感系数。修改规则只影响之后录入的读数；历史读数保留录入时的折算结果，已复核记录不受影响。
      </p>
      <div className="card-grid">
        {venues.map((venue) => (
          <VenueCard key={venue.id} venue={venue} onSave={onSave} />
        ))}
      </div>
    </section>
  );
}

function VenueCard({ venue, onSave }: { venue: VenueProfile; onSave: (v: VenueProfile) => void }) {
  const [name, setName] = useState(venue.name);
  const [referenceTemp, setReferenceTemp] = useState(String(venue.referenceTemp));
  const [flueCoeff, setFlueCoeff] = useState(String(venue.flueCoeff));
  const [reedCoeff, setReedCoeff] = useState(String(venue.reedCoeff));
  const [threshold, setThreshold] = useState(String(venue.recheckThreshold));
  const [saved, setSaved] = useState(false);

  const nums = [referenceTemp, flueCoeff, reedCoeff, threshold].map((s) => parseFloat(s));
  const valid = name.trim() !== "" && nums.every(Number.isFinite) && nums[3] > 0;

  const edit =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setSaved(false);
    };

  const save = () => {
    if (!valid) return;
    onSave({
      ...venue,
      name: name.trim(),
      referenceTemp: nums[0],
      flueCoeff: nums[1],
      reedCoeff: nums[2],
      recheckThreshold: nums[3],
    });
    setSaved(true);
  };

  return (
    <article className="card">
      <label>
        <span>场馆名称</span>
        <input value={name} onChange={edit(setName)} />
      </label>
      <div className="field-grid">
        <label>
          <span>基准温度 ℃</span>
          <input type="number" step="0.5" value={referenceTemp} onChange={edit(setReferenceTemp)} />
        </label>
        <label>
          <span>复检阈值 ℃</span>
          <input type="number" step="0.5" min="0.5" value={threshold} onChange={edit(setThreshold)} />
        </label>
        <label>
          <span>唇管系数 音分/℃</span>
          <input type="number" step="0.05" value={flueCoeff} onChange={edit(setFlueCoeff)} />
        </label>
        <label>
          <span>簧片系数 音分/℃</span>
          <input type="number" step="0.05" value={reedCoeff} onChange={edit(setReedCoeff)} />
        </label>
      </div>
      <button className="primary" disabled={!valid} onClick={save}>
        保存规则
      </button>
      {saved && <p className="notice notice-ok">已保存，之后录入的读数按新规则折算。</p>}
    </article>
  );
}
