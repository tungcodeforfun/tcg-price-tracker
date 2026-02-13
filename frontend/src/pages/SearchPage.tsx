import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchResultRow } from "@/components/shared/SearchResultRow";
import { AddToCollectionModal } from "@/components/shared/AddToCollectionModal";
import { SearchResultListSkeleton } from "@/components/shared/Skeletons";
import { cardsApi, searchApi } from "@/lib/api";
import type { Card as CardType, SearchResult, TCGType, UnifiedSearchResult } from "@/types";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const [tcgType, setTcgType] = useState<TCGType | "all">("all");
  const [internalResults, setInternalResults] = useState<CardType[]>([]);
  const [externalResults, setExternalResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [addCard, setAddCard] = useState<CardType | null>(null);

  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  // Track whether search was triggered by form submit to avoid double-execution
  const submitTriggeredRef = useRef(false);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearchParamsRef.current({ q: q.trim() });

    try {
      const typeParam = tcgType === "all" ? undefined : tcgType;
      const [internal, external] = await Promise.all([
        cardsApi.search({ query: q.trim(), tcg_type: typeParam, limit: 40 }),
        searchApi
          .searchAll({ query: q.trim(), tcg_type: typeParam })
          .catch(() => ({ tcgplayer: [], ebay: [], pricecharting: [], justtcg: [], errors: [] })),
      ]);
      setInternalResults(internal);
      setExternalResults([
        ...external.justtcg,
        ...external.pricecharting,
        ...external.tcgplayer,
        ...external.ebay,
      ]);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }, [tcgType]);

  // Only run for external URL changes (back/forward, direct nav), not from handleSubmit
  useEffect(() => {
    if (urlQuery) {
      if (submitTriggeredRef.current) {
        submitTriggeredRef.current = false;
        return;
      }
      setQuery(urlQuery);
      performSearch(urlQuery);
    }
  }, [urlQuery, performSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitTriggeredRef.current = true;
    performSearch(query);
  }

  async function handleAddExternal(result: SearchResult) {
    setImportingId(result.external_id);
    try {
      const card = await searchApi.importCard(result);
      setInternalResults((prev) => [card, ...prev]);
      setExternalResults((prev) =>
        prev.filter((r) => r.external_id !== result.external_id),
      );
      setAddCard(card);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Import failed",
      );
    } finally {
      setImportingId(null);
    }
  }

  const unifiedResults = useMemo<UnifiedSearchResult[]>(() => {
    const libraryIds = new Set(
      internalResults.map((c) => c.external_id).filter(Boolean),
    );
    return [
      ...internalResults.map((card) => ({ kind: "library" as const, card })),
      ...externalResults
        .filter((r) => !libraryIds.has(r.external_id))
        .map((result) => ({ kind: "external" as const, result })),
    ];
  }, [internalResults, externalResults]);

  const hasSearched = !!searchParams.get("q");
  const libraryCount = internalResults.length;
  const externalCount = unifiedResults.length - libraryCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Search Cards</h1>
        <p className="text-muted-foreground">Find cards from Pokemon and One Piece TCG</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by card name, set, or number..."
                className="pl-10 h-12 text-base"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">TCG Type:</span>
            <div className="flex gap-2">
              <Badge
                variant={tcgType === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTcgType("all")}
              >
                All
              </Badge>
              <Badge
                variant={tcgType === "pokemon" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTcgType("pokemon")}
              >
                Pokemon
              </Badge>
              <Badge
                variant={tcgType === "onepiece" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTcgType("onepiece")}
              >
                One Piece
              </Badge>
            </div>
          </div>
        </form>
      </Card>

      {loading ? (
        <SearchResultListSkeleton count={10} />
      ) : hasSearched ? (
        unifiedResults.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {libraryCount} in library · {externalCount} from external sources
            </p>
            <div className="space-y-1">
              {unifiedResults.map((item) => (
                <SearchResultRow
                  key={
                    item.kind === "library"
                      ? `lib-${item.card.id}`
                      : `ext-${item.result.source}-${item.result.external_id}`
                  }
                  item={item}
                  importingId={importingId}
                  onImport={handleAddExternal}
                  onAdd={setAddCard}
                />
              ))}
            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No cards found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search query or filters
            </p>
          </Card>
        )
      ) : null}

      <AddToCollectionModal
        card={addCard}
        open={!!addCard}
        onOpenChange={(open) => !open && setAddCard(null)}
      />
    </div>
  );
}
