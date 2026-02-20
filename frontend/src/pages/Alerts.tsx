import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { usersApi } from "@/lib/api";
import { formatPrice, formatRelativeTime } from "@/lib/utils";
import type { PriceAlert } from "@/types";
import { Bell, BellOff, Trash2, Plus, TrendingUp, TrendingDown, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Inline editing
  const [editingAlertId, setEditingAlertId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");

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

  function startEditing(alert: PriceAlert) {
    setEditingAlertId(alert.id);
    setEditPrice(String(alert.target_price));
  }

  function cancelEditing() {
    setEditingAlertId(null);
    setEditPrice("");
  }

  async function saveEdit(alert: PriceAlert) {
    const newPrice = Number(editPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      toast.error("Enter a valid price");
      return;
    }

    try {
      const updated = await usersApi.createAlert({
        card_id: alert.card_id,
        target_price: newPrice,
        alert_type: alert.alert_type,
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? updated : a)),
      );
      setEditingAlertId(null);
      setEditPrice("");
      toast.success("Alert updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update alert");
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent, alert: PriceAlert) {
    if (e.key === "Enter") saveEdit(alert);
    else if (e.key === "Escape") cancelEditing();
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
      ? Number(alert.card.latest_price) < alert.target_price
      : Number(alert.card.latest_price) > alert.target_price;
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
        <div className="space-y-2">
          {filteredAlerts.map((alert) => {
            const isTriggered = checkIfTriggered(alert);
            const isEditing = editingAlertId === alert.id;

            return (
              <div
                key={alert.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-secondary/50 ${isTriggered ? "border-success bg-success-muted" : "border-border/50 bg-secondary/30"}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${alert.alert_type === "above" ? "bg-success-muted" : "bg-danger-muted"}`}
                >
                  {alert.alert_type === "above" ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-danger" />
                  )}
                </div>

                <ImageWithFallback
                  src={alert.card?.image_url ?? undefined}
                  alt={alert.card?.name ?? ""}
                  className="w-10 h-14 rounded object-cover shrink-0 cursor-pointer"
                  fallbackClassName="w-10 h-14 rounded shrink-0"
                  onClick={() => alert.card && navigate(`/cards/${alert.card_id}`)}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary"
                    onClick={() => alert.card && navigate(`/cards/${alert.card_id}`)}
                  >
                    {alert.card?.name ?? `Card #${alert.card_id}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {alert.card?.set_name} · {alert.alert_type === "below" ? "Below" : "Above"}{" "}
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="inline-block w-24 h-6 text-xs px-1 py-0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, alert)}
                        onBlur={() => saveEdit(alert)}
                        autoFocus
                      />
                    ) : (
                      formatPrice(alert.target_price)
                    )}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    {formatPrice(alert.card?.latest_price)}
                  </p>
                  {isTriggered && (
                    <span className="text-[10px] font-medium text-success">Triggered</span>
                  )}
                  {alert.last_triggered && !isTriggered && (
                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(alert.last_triggered)}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success"
                        onClick={() => saveEdit(alert)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={cancelEditing}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => startEditing(alert)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={() => handleToggle(alert.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(alert.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
