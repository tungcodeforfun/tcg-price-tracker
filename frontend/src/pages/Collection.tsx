import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import {
  StatsCardsSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/shared/Skeletons";
import { collectionsApi } from "@/lib/api";
import {
  formatPrice,
  formatPercent,
  CONDITION_LABELS,
} from "@/lib/utils";
import type {
  CollectionItem,
  CollectionStats,
  ValueHistoryResponse,
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
  Package,
  Grid3x3,
  List,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

export function Collection() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [valueHistory, setValueHistory] = useState<ValueHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [i, s, vh] = await Promise.all([
          collectionsApi.getItems({ limit: 200 }),
          collectionsApi.getStats(),
          collectionsApi.getValueHistory(30),
        ]);
        setItems(i);
        setStats(s);
        setValueHistory(vh);
      } catch {
        toast.error("Failed to load collection");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDelete(itemId: number) {
    if (!window.confirm("Remove this card from your collection?")) return;
    try {
      await collectionsApi.deleteItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      collectionsApi.getStats().then(setStats).catch(() => {});
      toast.success("Removed from collection");
    } catch {
      toast.error("Failed to remove item");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium">My Collection</h1>
          <p className="text-muted-foreground">Manage and track your card collection</p>
        </div>
        <StatsCardsSkeleton />
        <ChartSkeleton />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const profitLoss = stats?.profit_loss ?? 0;
  const isProfitable = profitLoss >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">My Collection</h1>
          <p className="text-muted-foreground">Manage and track your card collection</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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

        <Card className="relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${isProfitable ? "from-success-muted to-transparent" : "from-danger-muted to-transparent"}`} />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Loss</CardTitle>
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isProfitable ? "bg-success-muted" : "bg-danger-muted"}`}>
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

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-warning-muted to-transparent pointer-events-none" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-muted">
              <Package className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-foreground">{stats?.total_cards ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats?.unique_cards ?? 0} unique cards</p>
          </CardContent>
        </Card>
      </div>

      {valueHistory && valueHistory.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Collection Value (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
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
                  labelFormatter={(label: any) => new Date(label).toLocaleDateString()}
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
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No cards in collection</h3>
          <p className="text-muted-foreground mb-4">
            Start adding cards to track their value over time
          </p>
          <Button onClick={() => navigate("/search")}>Browse Cards</Button>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="space-y-1">
          {items.map((item) => {
            const currentValue = item.current_value ? Number(item.current_value) : 0;
            const invested = item.purchase_price ? Number(item.purchase_price) * item.quantity : 0;
            const gainLoss = invested > 0 ? currentValue - invested : null;

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => item.card && navigate(`/cards/${item.card_id}`)}
              >
                <ImageWithFallback
                  src={item.card?.image_url ?? undefined}
                  alt={item.card?.name ?? ""}
                  className="w-14 h-[74px] rounded object-cover shrink-0"
                  fallbackClassName="w-14 h-[74px] rounded shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">
                      {item.card?.name ?? `Card #${item.card_id}`}
                    </span>
                    <Badge className="text-[10px] px-1.5 py-0 shrink-0">
                      {item.quantity}x
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.card?.set_name} · {CONDITION_LABELS[item.condition]}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatPrice(currentValue)}</p>
                    {gainLoss !== null && (
                      <p className={`text-xs font-medium ${gainLoss >= 0 ? "text-success" : "text-danger"}`}>
                        {gainLoss >= 0 ? "+" : ""}{formatPrice(gainLoss)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">Gain/Loss</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const currentValue = item.current_value ? Number(item.current_value) : 0;
                  const invested = item.purchase_price ? Number(item.purchase_price) * item.quantity : 0;
                  const gainLoss = invested > 0 ? currentValue - invested : null;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => item.card && navigate(`/cards/${item.card_id}`)}
                        >
                          <ImageWithFallback
                            src={item.card?.image_url ?? undefined}
                            alt={item.card?.name ?? ""}
                            className="w-12 h-16 object-cover rounded"
                            fallbackClassName="w-12 h-16 rounded"
                          />
                          <div>
                            <p className="font-medium">{item.card?.name ?? `Card #${item.card_id}`}</p>
                            <p className="text-sm text-muted-foreground">{item.card?.set_name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{CONDITION_LABELS[item.condition]}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatPrice(invested)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatPrice(currentValue)}</TableCell>
                      <TableCell className={`text-right font-semibold ${gainLoss !== null ? (gainLoss >= 0 ? "text-success" : "text-danger") : ""}`}>
                        {gainLoss !== null ? `${gainLoss >= 0 ? "+" : ""}${formatPrice(gainLoss)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
