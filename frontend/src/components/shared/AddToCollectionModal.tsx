import { useState, useEffect } from "react";
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
import { collectionsApi } from "@/lib/api";
import { CONDITION_LABELS } from "@/lib/utils";
import type { Card, CardCondition } from "@/types";
import { toast } from "sonner";

interface AddToCollectionModalProps {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToCollectionModal({
  card,
  open,
  onOpenChange,
}: AddToCollectionModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>("near_mint");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) resetForm();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;

    setLoading(true);
    try {
      await collectionsApi.addItem({
        card_id: card.id,
        quantity,
        condition,
        purchase_price: purchasePrice ? Number(purchasePrice) : undefined,
        notes: notes || undefined,
      });
      toast.success(`Added ${card.name} to collection`);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add to collection",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setQuantity(1);
    setCondition("near_mint");
    setPurchasePrice("");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
          <DialogDescription>
            {card ? `Add "${card.name}" to your collection.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as CardCondition)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Purchase Price (USD)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add to Collection"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
