import type { Reading } from "../data/store";
import { PIPE_TYPE_LABEL, formatCents, type VenueProfile } from "../domain/temperature";
import { formatDateTime } from "../format";
import StatusBadge from "./StatusBadge";

interface Props {
  readings: Reading[];
  venues: VenueProfile[];
  showVenue?: boolean;
}

export default function ReadingsTable({ readings, venues, showVenue = true }: Props) {
  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? id;
  if (readings.length === 0) return <p className="muted">暂无读数。</p>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>时间</th>
            {showVenue && <th>场馆</th>}
            <th>音栓 / 编号</th>
            <th>类型</th>
            <th>音高</th>
            <th>实测偏差</th>
            <th>现场温度</th>
            <th>折算后</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.measuredAt)}</td>
              {showVenue && <td>{venueName(r.venueId)}</td>}
              <td>
                {r.stop} · {r.pipeNo}
              </td>
              <td>{PIPE_TYPE_LABEL[r.pipeType]}</td>
              <td>{r.pitch}</td>
              <td>{formatCents(r.measuredCents)}</td>
              <td>{r.temperature.toFixed(1)}℃</td>
              <td>
                <strong>{formatCents(r.correctedCents)}</strong>
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
