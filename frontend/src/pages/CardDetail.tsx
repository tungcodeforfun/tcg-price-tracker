import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { PriceTrendBadge } from "@/components/shared/PriceTrendBadge";
import { AddToCollectionModal } from "@/components/shared/AddToCollectionModal";
import { CreateAlertModal } from "@/components/shared/CreateAlertModal";
import { ChartSkeleton } from "@/components/shared/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cardsApi, pricesApi } from "@/lib/api";
import { formatPrice, formatDate, CONDITION_LABELS } from "@/lib/utils";
import type { Card as CardType, PriceHistory } from "@/types";
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
  ArrowLeft,
  Plus,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

export function CardDetail() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardType | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  const id = Number(cardId);

  useEffect(() => {
    if (isNaN(id)) {
      navigate("/search");
      return;
    }

    setLoading(true);
    let cancelled = false;
    async function load() {
      try {
        const [c, ph] = await Promise.all([
          cardsApi.getById(id),
          pricesApi.getHistory(id, Number(days)),
        ]);
        if (!cancelled) {
          setCard(c);
          setPriceHistory(ph);
        }
      } catch {
        if (!cancelled) {
          toast.error("Card not found");
          navigate("/search");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, days, navigate]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-6">
              <Skeleton className="w-40 h-56 rounded-lg shrink-0" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-48 mt-4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <ChartSkeleton />
      </div>
    );
  }

  if (!card) return null;

  const chartData =
    priceHistory?.prices.map((p) => ({
      date: p.timestamp,
      price: Number(p.market_price),
      source: p.source,
    })) ?? [];

  const timeRanges = [
    { label: "7D", value: "7" },
    { label: "30D", value: "30" },
    { label: "90D", value: "90" },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-6">
            <div className="w-40 shrink-0">
              <div className="aspect-[3/4] relative rounded-lg overflow-hidden bg-muted">
                <ImageWithFallback
                  src={card.image_url ?? undefined}
                  alt={card.name}
                  className="w-full h-full object-cover"
                  fallbackClassName="w-full h-full"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h1 className="text-2xl font-medium">{card.name}</h1>
                  <PriceTrendBadge trend={card.price_trend} className="shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {card.set_name}
                  {card.card_number ? ` · ${card.card_number}` : ""}
                </p>
                <div className="flex gap-2 mt-2">
                  {card.rarity && <Badge>{card.rarity}</Badge>}
                  <Badge variant="outline" className="capitalize">{card.tcg_type}</Badge>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-0.5">Current Market Price</p>
                <p className="text-3xl font-bold">{formatPrice(card.latest_price)}</p>
              </div>

              {priceHistory && (
                <div className="flex gap-6 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Average</p>
                    <p className="text-lg font-semibold">
                      {formatPrice(priceHistory.average_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Low</p>
                    <p className="text-lg font-semibold text-success">
                      {formatPrice(priceHistory.min_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">High</p>
                    <p className="text-lg font-semibold text-danger">
                      {formatPrice(priceHistory.max_price)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Collection
                </Button>
                <Button variant="outline" onClick={() => setShowAlertModal(true)}>
                  <Bell className="w-4 h-4 mr-2" />
                  Set Alert
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium">Price History</h2>
            <div className="flex gap-2">
              {timeRanges.map((tr) => (
                <Button
                  key={tr.value}
                  variant={days === tr.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDays(tr.value)}
                >
                  {tr.label}
                </Button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
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
                  formatter={(value: any) => [formatPrice(value), "Price"]}
                  labelFormatter={(label: any) => formatDate(label)}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-card)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No price history available for this period.
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList>
          <TabsTrigger value="sources">Price by Source</TabsTrigger>
          <TabsTrigger value="condition">Price by Condition</TabsTrigger>
        </TabsList>

        <TabsContent value="sources">
          <Card>
            <CardContent className="p-6">
              {priceHistory && priceHistory.prices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.prices
                      .filter((p, i, arr) =>
                        arr.findIndex((x) => x.source === p.source) === i
                      )
                      .map((p) => (
                        <TableRow key={p.source}>
                          <TableCell className="font-medium capitalize">{p.source}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPrice(Number(p.market_price))}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No price data by source available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="condition">
          <Card>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPrice(card.latest_price ? Number(card.latest_price) * getConditionMultiplier(key) : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddToCollectionModal
        card={card}
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
      <CreateAlertModal
        card={card}
        open={showAlertModal}
        onOpenChange={setShowAlertModal}
      />
    </div>
  );
}

function getConditionMultiplier(condition: string): number {
  const multipliers: Record<string, number> = {
    mint: 1.0,
    near_mint: 0.95,
    lightly_played: 0.85,
    moderately_played: 0.7,
    heavily_played: 0.5,
    damaged: 0.3,
    poor: 0.15,
  };
  return multipliers[condition] ?? 1.0;
}
