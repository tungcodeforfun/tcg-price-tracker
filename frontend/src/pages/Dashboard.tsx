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
  Bell,
  ArrowUpRight,
  ArrowDownRight,
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your portfolio overview.</p>
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your portfolio overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Value */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-info-muted to-transparent pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-muted">
              <Wallet className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground">{formatPrice(stats?.total_value ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Current market value</p>
          </CardContent>
        </Card>

        {/* Invested */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invested</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground">{formatPrice(stats?.total_invested ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total amount spent</p>
          </CardContent>
        </Card>

        {/* Profit/Loss */}
        <Card className="relative overflow-hidden">
          <div
            className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${
              isProfitable ? "from-success-muted to-transparent" : "from-danger-muted to-transparent"
            }`}
          />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Loss</CardTitle>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                isProfitable ? "bg-success-muted" : "bg-danger-muted"
              }`}
            >
              {isProfitable ? (
                <ArrowUpRight className="h-4 w-4 text-success" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-danger" />
              )}
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className={`text-3xl font-bold ${isProfitable ? "text-success" : "text-danger"}`}>
              {isProfitable ? "+" : ""}{formatPrice(profitLoss)}
            </div>
            <p className={`text-xs mt-1 ${isProfitable ? "text-success" : "text-danger"}`}>
              {formatPercent(stats?.profit_loss_percentage ?? 0)} return
            </p>
          </CardContent>
        </Card>

        {/* Cards */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-warning-muted to-transparent pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cards</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-muted">
              <Hash className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground">{stats?.total_cards ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.unique_cards ?? 0} unique cards
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Value Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Portfolio Value (Last {historyDays} Days)</CardTitle>
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tick={{ fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tick={{ fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    color: "var(--color-foreground)",
                  }}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                  itemStyle={{ color: "var(--color-foreground)" }}
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
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
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

      {/* Alerts & Trending */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Price Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-muted">
                <Bell className="h-4 w-4 text-warning" />
              </div>
              Active Price Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length > 0 ? (
              <div className="space-y-2">
                {alerts.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          a.alert_type === "above" ? "bg-success-muted" : "bg-danger-muted"
                        }`}
                      >
                        {a.alert_type === "above" ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-danger" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {a.card?.name ?? `Card #${a.card_id}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.alert_type === "above" ? "Above" : "Below"}{" "}
                          {formatPrice(a.price_threshold)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-semibold text-foreground">
                        {formatPrice(a.card?.latest_price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No active alerts triggered. Create alerts to get notified of price changes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trending Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-muted">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              Trending Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <div className="space-y-2">
                {trends.slice(0, 5).map((t) => (
                  <div
                    key={t.card_id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(`/cards/${t.card_id}`)}
                  >
                    <ImageWithFallback
                      src={undefined}
                      alt={t.card_name}
                      className="w-12 h-16 object-cover rounded"
                      fallbackClassName="w-12 h-16 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{t.card_name}</p>
                      <p className="text-sm text-muted-foreground">{t.set_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-foreground">{formatPrice(t.current_price)}</p>
                      <PriceTrendBadge trend={t.trend} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No price trends available yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
