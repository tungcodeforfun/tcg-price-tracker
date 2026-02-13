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
  TrendingUp,
  Package,
  Grid3x3,
  List,
  Trash2,
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Loss</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_cards ?? 0}</div>
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
                  labelFormatter={(label: any) => new Date(label).toLocaleDateString()}
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const currentValue = item.current_value ? Number(item.current_value) : 0;
            const invested = item.purchase_price ? Number(item.purchase_price) * item.quantity : 0;
            const gainLoss = invested > 0 ? currentValue - invested : null;

            return (
              <Card key={item.id} className="overflow-hidden group">
                <CardContent className="p-0">
                  <div
                    className="relative aspect-[3/4] bg-muted cursor-pointer"
                    onClick={() => item.card && navigate(`/cards/${item.card_id}`)}
                  >
                    <ImageWithFallback
                      src={item.card?.image_url ?? undefined}
                      alt={item.card?.name ?? ""}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      fallbackClassName="w-full h-full"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge>{item.quantity}x</Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div>
                      <h3 className="font-medium truncate">
                        {item.card?.name ?? `Card #${item.card_id}`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {CONDITION_LABELS[item.condition]}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Current</p>
                        <p className="font-semibold">{formatPrice(currentValue)}</p>
                      </div>
                      {gainLoss !== null && (
                        <div>
                          <p className="text-muted-foreground">Gain/Loss</p>
                          <p className={`font-semibold ${gainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {gainLoss >= 0 ? "+" : ""}{formatPrice(gainLoss)}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                      <TableCell className={`text-right font-semibold ${gainLoss !== null ? (gainLoss >= 0 ? "text-green-500" : "text-red-500") : ""}`}>
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
