"use client";

import { useMemo, useState } from "react";
import { Dropdown } from "@carbon/react";
import { incomeExpenseHistory } from "@/lib/mock-data";

const chartHeight = 320;
const chartWidth = 1040;
const padding = { top: 28, right: 28, bottom: 42, left: 74 };
const minValue = -130000;
const maxValue = 110000;
const periods = ["12 mdr.", "2026", "2025"];

function yScale(value: number) {
  const plotHeight = chartHeight - padding.top - padding.bottom;
  return (
    padding.top +
    ((maxValue - value) / (maxValue - minValue)) * plotHeight
  );
}

function xScale(index: number, count: number) {
  const plotWidth = chartWidth - padding.left - padding.right;
  return padding.left + (index / Math.max(1, count - 1)) * plotWidth;
}

function formatAmount(value: number) {
  return `${new Intl.NumberFormat("da-DK").format(Math.abs(value))} kr`;
}

export function IncomeExpenseChart() {
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const visibleHistory = useMemo(() => {
    if (selectedPeriod === "2026") {
      return incomeExpenseHistory.filter((item) => item.year === 2026);
    }

    if (selectedPeriod === "2025") {
      return incomeExpenseHistory.filter((item) => item.year === 2025);
    }

    return incomeExpenseHistory;
  }, [selectedPeriod]);

  const chartItems = visibleHistory.map((item) => ({
    ...item,
    expenses: -(item.bills + item.spending),
    balance: item.income - item.bills - item.spending,
  }));
  const activeItem = activeIndex !== null ? chartItems[activeIndex] : null;
  const linePoints = chartItems
    .map((item, index) => `${xScale(index, chartItems.length)},${yScale(item.balance)}`)
    .join(" ");

  return (
    <div className="income-expense-chart">
      <div className="chart-header">
        <h2>Indkomst og udgifter</h2>
        <Dropdown
          id="income-expense-period"
          items={periods}
          label="Periode"
          selectedItem={selectedPeriod}
          size="sm"
          titleText="Periode"
          type="inline"
          onChange={({ selectedItem }) => {
            if (selectedItem) {
              setSelectedPeriod(selectedItem);
              setActiveIndex(null);
            }
          }}
        />
      </div>

      <div
        className="income-expense-chart__body"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <svg
          aria-label="Indkomst, udgifter og månedligt resultat"
          className="income-expense-chart__svg"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          {[100000, 0, -100000].map((tick) => (
            <g key={tick}>
              <line
                className="chart-gridline"
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
              />
              <text
                className="chart-axis-label"
                textAnchor="end"
                x={padding.left - 12}
                y={yScale(tick) + 6}
              >
                {new Intl.NumberFormat("da-DK").format(tick)}
              </text>
            </g>
          ))}

          <line
            className="chart-zero-line"
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={yScale(0)}
            y2={yScale(0)}
          />

          {chartItems.map((item, index) => {
            const x = xScale(index, chartItems.length);
            const barWidth = 28;
            const incomeTop = yScale(item.income);
            const zero = yScale(0);
            const billsBottom = yScale(-item.bills);
            const expensesBottom = yScale(item.expenses);
            const hoverWidth = Math.max(44, chartWidth / chartItems.length - 12);

            return (
              <g
                key={`${item.month}-${item.year}-${index}`}
                onFocus={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
                tabIndex={0}
              >
                <rect
                  className="chart-hover-target"
                  height={chartHeight - padding.top - padding.bottom}
                  width={hoverWidth}
                  x={x - hoverWidth / 2}
                  y={padding.top}
                />
                {item.income > 0 ? (
                  <rect
                    className="chart-income-bar"
                    height={zero - incomeTop}
                    width={barWidth}
                    x={x - barWidth / 2}
                    y={incomeTop}
                  />
                ) : null}
                {item.bills > 0 ? (
                  <rect
                    className="chart-bills-bar"
                    height={billsBottom - zero}
                    width={barWidth}
                    x={x - barWidth / 2}
                    y={zero}
                  />
                ) : null}
                <rect
                  className="chart-expense-bar"
                  height={expensesBottom - billsBottom}
                  width={barWidth}
                  x={x - barWidth / 2}
                  y={billsBottom}
                />
                <text
                  className="chart-month-label"
                  textAnchor="middle"
                  x={x}
                  y={chartHeight - 12}
                >
                  {item.month}
                </text>
              </g>
            );
          })}

          <polyline className="chart-balance-line" points={linePoints} />
          {chartItems.map((item, index) => (
            <circle
              className="chart-balance-dot"
              cx={xScale(index, chartItems.length)}
              cy={yScale(item.balance)}
              key={`${item.month}-${item.year}-${index}-dot`}
              r="5"
            />
          ))}
        </svg>

        {activeItem ? (
          <div
            className="chart-tooltip"
            style={{
              left: `clamp(9rem, ${
                (xScale(activeIndex ?? 0, chartItems.length) / chartWidth) * 100
              }%, calc(100% - 9rem))`,
              top: `${(yScale(activeItem.balance) / chartHeight) * 100}%`,
            }}
          >
            <div className="chart-tooltip__title">
              {activeItem.month} {activeItem.year}
            </div>
            <div className="chart-tooltip__grid">
              <span>Resultat</span>
              <strong>
                {activeItem.balance < 0 ? "-" : ""}
                {formatAmount(activeItem.balance)}
              </strong>
              <span>Indkomst</span>
              <strong>{formatAmount(activeItem.income)}</strong>
              <span>Regninger</span>
              <strong>{formatAmount(activeItem.bills)}</strong>
              <span>Forbrug</span>
              <strong>{formatAmount(activeItem.spending)}</strong>
            </div>
          </div>
        ) : null}
      </div>

      <div className="chart-legend" aria-hidden="true">
        <span>
          <i className="chart-legend__income" />
          Indkomst
        </span>
        <span>
          <i className="chart-legend__bills" />
          Regninger
        </span>
        <span>
          <i className="chart-legend__spending" />
          Forbrug
        </span>
        <span>
          <i className="chart-legend__balance" />
          Resultat
        </span>
      </div>
    </div>
  );
}
