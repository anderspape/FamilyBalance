import { ArrowDown, ArrowUp } from "@carbon/icons-react";
import { categorySpend } from "@/lib/mock-data";

const colors = ["#0f62fe", "#24a148", "#8a3ffc", "#ff832b", "#009d9a"];

type SpendingItem = {
  category: string;
  value?: number;
  amount: string;
  monthIndex: string;
};

export function SpendingVisualization({
  items = categorySpend,
  monthLabel = "Maj 2026",
  totalAmount = "21.480 kr.",
}: {
  items?: SpendingItem[];
  monthLabel?: string;
  totalAmount?: string;
}) {
  if (items.length === 0) {
    return <div className="empty-state">Ingen udgifter i denne måned.</div>;
  }

  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const segments = items.map((item, index) => {
    const previous = items
      .slice(0, index)
      .reduce((sum, previousItem) => sum + (previousItem.value ?? 0), 0);
    const start = total ? (previous / total) * 100 : 0;
    const end = total ? ((previous + (item.value ?? 0)) / total) * 100 : 0;

    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return (
    <div className="spending-visualization">
      <div
        aria-label="Fordeling af månedens udgifter efter kategori"
        className="spending-donut"
        role="img"
        style={{
          background: `conic-gradient(${segments.join(", ")})`,
        }}
      >
        <div>
          <span>Brugt</span>
          <strong>{totalAmount}</strong>
          <small>{monthLabel}</small>
        </div>
      </div>

      <div className="spending-legend">
        {items.map((item, index) => (
          <SpendingLegendRow
            color={colors[index % colors.length]}
            item={item}
            key={item.category}
          />
        ))}
      </div>
    </div>
  );
}

function SpendingLegendRow({
  color,
  item,
}: {
  color: string;
  item: SpendingItem;
}) {
  const direction = item.monthIndex.startsWith("-")
    ? "down"
    : item.monthIndex === "0%"
      ? "flat"
      : "up";
  const TrendIcon = direction === "down" ? ArrowDown : ArrowUp;

  return (
    <div className="spending-legend__row">
      <i style={{ background: color }} />
      <span>{item.category}</span>
      <strong>{item.amount}</strong>
      <span className={`spending-index spending-index--${direction}`}>
        {direction !== "flat" ? <TrendIcon size={14} /> : null}
        {item.monthIndex}
      </span>
    </div>
  );
}
