import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { usersApi } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import type { PriceAlert } from "@/types";
import { Bell, BellOff, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  useEffect(() => {
    usersApi
      .getAlerts(false)
      .then(setAlerts)
      .catch(() => toast.error("Failed to load alerts"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(alertId: number) {
    try {
      const updated = await usersApi.toggleAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? updated : a)),
      );
    } catch {
      toast.error("Failed to toggle alert");
    }
  }

  async function handleDelete(alertId: number) {
    if (!window.confirm("Delete this alert?")) return;
    try {
      await usersApi.deleteAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success("Alert deleted");
    } catch {
      toast.error("Failed to delete alert");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-medium">Price Alerts</h1>
          <p className="text-muted-foreground">Get notified when cards reach your target price</p>
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  const filteredAlerts = showActiveOnly
    ? alerts.filter((a) => a.is_active)
    : alerts;

  function checkIfTriggered(alert: PriceAlert): boolean {
    if (!alert.is_active || !alert.card?.latest_price) return false;
    return alert.alert_type === "below"
      ? Number(alert.card.latest_price) < alert.price_threshold
      : Number(alert.card.latest_price) > alert.price_threshold;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Price Alerts</h1>
          <p className="text-muted-foreground">Get notified when cards reach your target price</p>
        </div>
        <Button onClick={() => navigate("/search")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Alert
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span>Show active alerts only</span>
            </div>
            <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
          </div>
        </CardContent>
      </Card>

      {filteredAlerts.length === 0 ? (
        <Card className="p-12 text-center">
          <BellOff className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No alerts</h3>
          <p className="text-muted-foreground mb-4">
            Create price alerts to get notified when cards reach your target price
          </p>
          <Button onClick={() => navigate("/search")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const isTriggered = checkIfTriggered(alert);

            return (
              <Card key={alert.id} className={isTriggered ? "border-green-500" : ""}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-20 h-28 flex-shrink-0 rounded overflow-hidden bg-muted cursor-pointer"
                      onClick={() => alert.card && navigate(`/cards/${alert.card_id}`)}
                    >
                      <ImageWithFallback
                        src={alert.card?.image_url ?? undefined}
                        alt={alert.card?.name ?? ""}
                        className="w-full h-full object-cover"
                        fallbackClassName="w-full h-full"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-medium truncate cursor-pointer hover:text-primary"
                            onClick={() => alert.card && navigate(`/cards/${alert.card_id}`)}
                          >
                            {alert.card?.name ?? `Card #${alert.card_id}`}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {alert.card?.set_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={alert.is_active}
                            onCheckedChange={() => handleToggle(alert.id)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(alert.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Alert Type</p>
                          <Badge variant={alert.alert_type === "below" ? "default" : "secondary"}>
                            {alert.alert_type === "below" ? "Drop Below" : "Rise Above"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Target Price</p>
                          <p className="font-semibold">{formatPrice(alert.price_threshold)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Price</p>
                          <p className="font-semibold">
                            {formatPrice(alert.card?.latest_price)}
                          </p>
                        </div>
                      </div>

                      {isTriggered && (
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500 rounded-lg">
                          <div className="flex items-center gap-2 text-green-500">
                            <Bell className="w-4 h-4" />
                            <span className="font-medium">Alert Triggered!</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            This card has reached your target price
                          </p>
                        </div>
                      )}

                      {alert.last_triggered && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Last triggered: {formatDate(alert.last_triggered)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
