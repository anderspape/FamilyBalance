type CategoryBar = {
  category: string;
  amount: string;
  value?: number;
  percent: number;
};

export function CategoryBars({
  items,
  tone = "expense",
}: {
  items: CategoryBar[];
  tone?: "expense" | "income";
}) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        Ingen posteringer i denne periode.
      </div>
    );
  }

  return (
    <div className="category-bars">
      {items.map((item) => (
        <div className="category-bars__row" key={item.category}>
          <span>{item.category}</span>
          <div>
            <i
              className={
                tone === "income" ? "category-bars__fill--income" : undefined
              }
              style={{ width: `${item.percent}%` }}
            />
          </div>
          <strong>{item.amount}</strong>
        </div>
      ))}
    </div>
  );
}
