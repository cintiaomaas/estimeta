export function GoalProgress({ value }: { value: string }) {
  return <span className="goal-progress"><progress max={100} value={Math.min(100, Number(value))} aria-label={`${value.replace(".", ",")}% concluído`} /><span>{value.replace(".", ",")}%</span></span>;
}
