import Icon from "./icons";
import { Chip } from "./ui";
import { countdownLabel } from "../lib/birthdays";

/** "Today" / "Tomorrow" / "In 5 days", coloured by how close it is. */
export default function CountdownChip({ days }: { days: number }) {
  const tone = days <= 0 ? "brand" : days <= 7 ? "yellow" : "neutral";
  return (
    <Chip tone={tone}>
      {days <= 0 && <Icon name="sparkles" className="size-3" />}
      {countdownLabel(days)}
    </Chip>
  );
}
