import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "./ImageWithFallback";
import { PriceTrendBadge } from "./PriceTrendBadge";
import { formatPrice } from "@/lib/utils";
import type { Card as CardType } from "@/types";

interface TCGCardProps {
  card: CardType;
  onAdd?: (card: CardType) => void;
  showAddButton?: boolean;
}

export function TCGCard({ card, onAdd, showAddButton = true }: TCGCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="group overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
      onClick={() => navigate(`/cards/${card.id}`)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <ImageWithFallback
            src={card.image_url ?? undefined}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            fallbackClassName="w-full h-full"
          />
        </div>
        <div className="p-4 space-y-2">
          <div>
            <h3 className="font-medium truncate">{card.name}</h3>
            <p className="text-sm text-muted-foreground">
              {card.set_name}
              {card.card_number ? ` \u2022 ${card.card_number}` : ""}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-2xl font-semibold">
                {formatPrice(card.latest_price)}
              </p>
              <PriceTrendBadge trend={card.price_trend} />
            </div>
            {showAddButton && onAdd && (
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(card);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
          {card.rarity && (
            <div className="pt-2 border-t">
              <span className="inline-block px-2 py-1 text-xs bg-secondary rounded">
                {card.rarity}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
