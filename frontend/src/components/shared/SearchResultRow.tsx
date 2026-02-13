import { useNavigate } from "react-router-dom";
import { Plus, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "./ImageWithFallback";
import { PriceTrendBadge } from "./PriceTrendBadge";
import { formatPrice } from "@/lib/utils";
import type { UnifiedSearchResult, Card as CardType, SearchResult } from "@/types";

interface SearchResultRowProps {
  item: UnifiedSearchResult;
  importingId: string | null;
  onImport: (result: SearchResult) => void;
  onAdd: (card: CardType) => void;
}

export function SearchResultRow({ item, importingId, onImport, onAdd }: SearchResultRowProps) {
  const navigate = useNavigate();

  if (item.kind === "library") {
    const { card } = item;
    return (
      <div
        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/50 transition-colors cursor-pointer"
        onClick={() => navigate(`/cards/${card.id}`)}
      >
        <ImageWithFallback
          src={card.image_url ?? undefined}
          alt={card.name}
          className="w-14 h-[74px] rounded object-cover shrink-0"
          fallbackClassName="w-14 h-[74px] rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{card.name}</span>
            <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">
              Library
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {card.set_name}
            {card.card_number ? ` · ${card.card_number}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm font-semibold">{formatPrice(card.latest_price)}</p>
            <PriceTrendBadge trend={card.price_trend} className="text-[10px] px-1.5 py-0" />
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(card);
            }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  const { result } = item;
  const isImporting = importingId === result.external_id;

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/50 transition-colors">
      <ImageWithFallback
        src={result.image_url ?? undefined}
        alt={result.name}
        className="w-14 h-[74px] rounded object-cover shrink-0"
        fallbackClassName="w-14 h-[74px] rounded shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{result.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
            {result.source}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{result.set_name}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-sm font-semibold">{formatPrice(result.price)}</p>
        <Button
          size="sm"
          variant="secondary"
          disabled={isImporting}
          onClick={(e) => {
            e.stopPropagation();
            onImport(result);
          }}
        >
          {isImporting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Download className="mr-1 h-3 w-3" />
              Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
