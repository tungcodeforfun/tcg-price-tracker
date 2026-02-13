import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usersApi } from "@/lib/api";
import type { Card, AlertType } from "@/types";
import { toast } from "sonner";

interface CreateAlertModalProps {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAlertModal({
  card,
  open,
  onOpenChange,
}: CreateAlertModalProps) {
  const [targetPrice, setTargetPrice] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("below");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(targetPrice);
    if (!card || !targetPrice || isNaN(price) || price <= 0) return;

    setLoading(true);
    try {
      await usersApi.createAlert({
        card_id: card.id,
        target_price: price,
        alert_type: alertType,
      });
      toast.success(`Alert created for ${card.name}`);
      onOpenChange(false);
      setTargetPrice("");
      setAlertType("below");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create alert",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Price Alert</DialogTitle>
          <DialogDescription>
            {card
              ? `Set a price alert for "${card.name}".`
              : "Set a price alert."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-price">Target Price (USD)</Label>
            <Input
              id="target-price"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alert-type">Alert When Price Goes</Label>
            <Select
              value={alertType}
              onValueChange={(v) => setAlertType(v as AlertType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="below">Below Target</SelectItem>
                <SelectItem value="above">Above Target</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Alert"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
