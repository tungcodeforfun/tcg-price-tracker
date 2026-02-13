import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatsCardsSkeleton, ChartSkeleton } from "@/components/shared/Skeletons";
import { PriceTrendBadge } from "@/components/shared/PriceTrendBadge";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { collectionsApi, pricesApi, usersApi } from "@/lib/api";
import { formatPrice, formatPercent } from "@/lib/utils";
import type {
  CollectionStats,
  ValueHistoryResponse,
  PriceAlert,
  PriceTrend,
} from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Package,
  Hash,
  AlertCircle,
} from "lucide-react";

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [valueHistory, setValueHistory] = useState<ValueHistoryResponse | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [trends, setTrends] = useState<PriceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyDays, setHistoryDays] = useState("30");

  useEffect(() => {
    async function load() {
      try {
        const [s, a, t] = await Promise.all([
          collectionsApi.getStats(),
          usersApi.getAlerts(),
          pricesApi.getTrends(),
        ]);
        setStats(s);
        setAlerts(a);
        const allTrends: PriceTrend[] = [];
        if (t.trends) {
          Object.values(t.trends).forEach((arr) => allTrends.push(...arr));
        }
        setTrends(allTrends.slice(0, 10));
      } catch {
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    collectionsApi
      .getValueHistory(Number(historyDays))
      .then(setValueHistory)
      .catch(() => toast.error("Failed to load value history"));
  }, [historyDays]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your portfolio overview.</p>
        </div>
        <StatsCardsSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  const profitLoss = stats?.profit_loss ?? 0;
  const isProfitable = profitLoss >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your portfolio overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatPrice(stats?.total_value ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Current market value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invested</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatPrice(stats?.total_invested ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total amount spent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Loss</CardTitle>
            {isProfitable ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${isProfitable ? "text-green-500" : "text-red-500"}`}>
              {isProfitable ? "+" : ""}{formatPrice(profitLoss)}
            </div>
            <p className={`text-xs mt-1 ${isProfitable ? "text-green-500" : "text-red-500"}`}>
              {formatPercent(stats?.profit_loss_percentage ?? 0)} return
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cards</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_cards ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Hash className="inline h-3 w-3" /> {stats?.unique_cards ?? 0} unique
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Portfolio Value (Last {historyDays} Days)</CardTitle>
          <Select value={historyDays} onValueChange={setHistoryDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {valueHistory && valueHistory.history.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={valueHistory.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [formatPrice(value), "Value"]}
                  labelFormatter={(label: any) =>
                    new Date(label).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No value history yet. Add cards to your collection to start tracking.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Active Price Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {a.card?.name ?? `Card #${a.card_id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {a.alert_type === "above" ? "Above" : "Below"}{" "}
                        {formatPrice(a.price_threshold)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(a.card?.latest_price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No active alerts triggered. Create alerts to get notified of price changes.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <div className="space-y-3">
                {trends.slice(0, 5).map((t) => (
                  <div
                    key={t.card_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors"
                    onClick={() => navigate(`/cards/${t.card_id}`)}
                  >
                    <ImageWithFallback
                      src={undefined}
                      alt={t.card_name}
                      className="w-12 h-16 object-cover rounded"
                      fallbackClassName="w-12 h-16 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.card_name}</p>
                      <p className="text-sm text-muted-foreground">{t.set_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatPrice(t.current_price)}</p>
                      <PriceTrendBadge trend={t.trend} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No price trends available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
