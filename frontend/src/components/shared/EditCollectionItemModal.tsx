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
import type { CollectionItem, CardCondition } from "@/types";
import { toast } from "sonner";

interface EditCollectionItemModalProps {
  item: CollectionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: CollectionItem) => void;
}

export function EditCollectionItemModal({
  item,
  open,
  onOpenChange,
  onSaved,
}: EditCollectionItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>("near_mint");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && item) {
      setQuantity(item.quantity);
      setCondition(item.condition);
      setPurchasePrice(item.purchase_price != null ? String(item.purchase_price) : "");
      setNotes(item.notes ?? "");
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;

    setLoading(true);
    try {
      const updated = await collectionsApi.updateItem(item.id, {
        quantity,
        condition,
        purchase_price: purchasePrice ? Number(purchasePrice) : undefined,
        notes: notes || undefined,
      });
      toast.success("Item updated");
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update item",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Collection Item</DialogTitle>
          <DialogDescription>
            {item?.card ? `Update "${item.card.name}" in your collection.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity</Label>
            <Input
              id="edit-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-condition">Condition</Label>
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
            <Label htmlFor="edit-price">Purchase Price (USD)</Label>
            <Input
              id="edit-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Input
              id="edit-notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
