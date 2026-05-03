type SavingsGoal = {
  name: string;
  saved: string;
  target: string;
  percent: number;
};

export function SavingsGoals({ goals }: { goals: SavingsGoal[] }) {
  return (
    <div className="savings-goals">
      {goals.map((goal) => (
        <div className="savings-goal" key={goal.name}>
          <div>
            <strong>{goal.name}</strong>
            <span>
              {goal.saved} af {goal.target}
            </span>
          </div>
          <div>
            <i style={{ width: `${goal.percent}%` }} />
          </div>
          <span>{goal.percent}%</span>
        </div>
      ))}
    </div>
  );
}
