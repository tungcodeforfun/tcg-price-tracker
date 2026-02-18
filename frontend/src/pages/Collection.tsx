import { useState, useEffect, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { EditCollectionItemModal } from "@/components/shared/EditCollectionItemModal";
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
  TCG_LABELS,
} from "@/lib/utils";
import type {
  CollectionItem,
  CollectionStats,
  ValueHistoryResponse,
  TCGType,
  CardCondition,
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
  Pencil,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

type SortKey = "name" | "value" | "date" | "gainloss";

export function Collection() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [valueHistory, setValueHistory] = useState<ValueHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filters
  const [filterTcg, setFilterTcg] = useState<TCGType | "all">("all");
  const [filterCondition, setFilterCondition] = useState<CardCondition | "all">("all");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Edit modal
  const [editItem, setEditItem] = useState<CollectionItem | null>(null);

  // Initial load + filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setOffset(0);
      try {
        const tcgParam = filterTcg === "all" ? undefined : filterTcg;
        const params: Parameters<typeof collectionsApi.getItems>[0] = {
          limit: PAGE_SIZE,
          offset: 0,
        };
        if (filterTcg !== "all") params!.tcg_type = filterTcg;
        if (filterCondition !== "all") params!.condition = filterCondition;

        const [i, s, vh] = await Promise.all([
          collectionsApi.getItems(params),
          collectionsApi.getStats(tcgParam),
          collectionsApi.getValueHistory(30),
        ]);
        if (cancelled) return;
        setItems(i);
        setHasMore(i.length === PAGE_SIZE);
        setStats(s);
        setValueHistory(vh);
      } catch {
        if (!cancelled) toast.error("Failed to load collection");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filterTcg, filterCondition]);

  async function handleLoadMore() {
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const params: Parameters<typeof collectionsApi.getItems>[0] = {
        limit: PAGE_SIZE,
        offset: nextOffset,
      };
      if (filterTcg !== "all") params!.tcg_type = filterTcg;
      if (filterCondition !== "all") params!.condition = filterCondition;

      const more = await collectionsApi.getItems(params);
      setItems((prev) => [...prev, ...more]);
      setOffset(nextOffset);
      setHasMore(more.length === PAGE_SIZE);
    } catch {
      toast.error("Failed to load more items");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(itemId: number) {
    if (!window.confirm("Remove this card from your collection?")) return;
    try {
      await collectionsApi.deleteItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      const tcgParam = filterTcg === "all" ? undefined : filterTcg;
      collectionsApi.getStats(tcgParam).then(setStats).catch(() => {});
      toast.success("Removed from collection");
    } catch {
      toast.error("Failed to remove item");
    }
  }

  function handleSaved(updated: CollectionItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    const tcgParam = filterTcg === "all" ? undefined : filterTcg;
    collectionsApi.getStats(tcgParam).then(setStats).catch(() => {});
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.card?.name ?? "").localeCompare(b.card?.name ?? "");
          break;
        case "value": {
          const av = a.current_value ? Number(a.current_value) : 0;
          const bv = b.current_value ? Number(b.current_value) : 0;
          cmp = av - bv;
          break;
        }
        case "date":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "gainloss": {
          const aGain = getGainLoss(a) ?? -Infinity;
          const bGain = getGainLoss(b) ?? -Infinity;
          cmp = aGain - bGain;
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [items, sortKey, sortAsc]);

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
  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterTcg} onValueChange={(v) => setFilterTcg(v as TCGType | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All TCG Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All TCG Types</SelectItem>
            {(Object.entries(TCG_LABELS) as [TCGType, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCondition} onValueChange={(v) => setFilterCondition(v as CardCondition | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Conditions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            {(Object.entries(CONDITION_LABELS) as [CardCondition, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-sm text-muted-foreground mr-1">Sort:</span>
          {([
            ["name", "Name"],
            ["value", "Value"],
            ["date", "Date"],
            ["gainloss", "Gain/Loss"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <Badge
              key={key}
              variant={sortKey === key ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleSort(key)}
            >
              {label}{sortIndicator(key)}
            </Badge>
          ))}
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No cards in collection</h3>
          <p className="text-muted-foreground mb-4">
            {filterTcg !== "all" || filterCondition !== "all"
              ? "No cards match your filters. Try adjusting them."
              : "Start adding cards to track their value over time"}
          </p>
          {filterTcg === "all" && filterCondition === "all" && (
            <Button onClick={() => navigate("/search")}>Browse Cards</Button>
          )}
        </Card>
      ) : viewMode === "grid" ? (
        <div className="space-y-1">
          {sortedItems.map((item) => {
            const gainLoss = getGainLoss(item);

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
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatPrice(item.current_value ? Number(item.current_value) : 0)}</p>
                    {gainLoss !== null && (
                      <p className={`text-xs font-medium ${gainLoss >= 0 ? "text-success" : "text-danger"}`}>
                        {gainLoss >= 0 ? "+" : ""}{formatPrice(gainLoss)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditItem(item);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
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
                {sortedItems.map((item) => {
                  const currentValue = item.current_value ? Number(item.current_value) : 0;
                  const invested = item.purchase_price ? Number(item.purchase_price) * item.quantity : 0;
                  const gainLoss = getGainLoss(item);

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
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditItem(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {hasMore && sortedItems.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        </div>
      )}

      <EditCollectionItemModal
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function getGainLoss(item: CollectionItem): number | null {
  const currentValue = item.current_value ? Number(item.current_value) : 0;
  const invested = item.purchase_price ? Number(item.purchase_price) * item.quantity : 0;
  return invested > 0 ? currentValue - invested : null;
}
