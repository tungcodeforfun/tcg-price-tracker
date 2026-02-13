import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PriceTrendBadgeProps {
  trend: string | null | undefined;
  className?: string;
}

export function PriceTrendBadge({ trend, className }: PriceTrendBadgeProps) {
  if (!trend || trend === "stable") {
    return (
      <Badge variant="secondary" className={className}>
        <Minus className="mr-1 h-3 w-3" />
        Stable
      </Badge>
    );
  }

  if (trend === "up") {
    return (
      <Badge variant="success" className={className}>
        <TrendingUp className="mr-1 h-3 w-3" />
        Up
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className={className}>
      <TrendingDown className="mr-1 h-3 w-3" />
      Down
    </Badge>
  );
}
