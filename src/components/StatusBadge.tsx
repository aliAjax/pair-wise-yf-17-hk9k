import type { ReadingStatus } from "../data/store";

const LABEL: Record<ReadingStatus, string> = {
  normal: "正常",
  pending: "待复检",
  rechecked: "已复核",
};

export default function StatusBadge({ status }: { status: ReadingStatus }) {
  return <span className={`badge badge-${status}`}>{LABEL[status]}</span>;
}
