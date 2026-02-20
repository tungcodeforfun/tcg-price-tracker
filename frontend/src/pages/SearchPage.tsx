import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SearchResultRow } from "@/components/shared/SearchResultRow";
import { AddToCollectionModal } from "@/components/shared/AddToCollectionModal";
import { SearchResultListSkeleton } from "@/components/shared/Skeletons";
import { cardsApi, searchApi } from "@/lib/api";
import { TCG_LABELS } from "@/lib/utils";
import type { Card as CardType, SearchResult, TCGType, UnifiedSearchResult } from "@/types";
import { Search, SlidersHorizontal, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 40;

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

  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rarity, setRarity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [setName, setSetName] = useState("");

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Source filter
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());

  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  const submitTriggeredRef = useRef(false);

  // Debounced autocomplete
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    suggestionTimeoutRef.current = setTimeout(async () => {
      try {
        const typeParam = tcgType === "all" ? undefined : tcgType;
        const results = await searchApi.getSuggestions(query.trim(), typeParam);
        setSuggestions(results);
      } catch {
        // Silently fail for suggestions
      }
    }, 300);

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [query, tcgType]);

  const performSearch = useCallback(async (q: string, newOffset = 0) => {
    if (!q.trim()) return;
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);

    setSearchParamsRef.current({ q: q.trim() });
    setShowSuggestions(false);

    try {
      const typeParam = tcgType === "all" ? undefined : tcgType;
      const searchParams: Parameters<typeof cardsApi.search>[0] = {
        query: q.trim(),
        tcg_type: typeParam,
        limit: PAGE_SIZE,
        offset: newOffset,
      };
      if (rarity.trim()) searchParams.rarity = rarity.trim();
      if (minPrice) searchParams.min_price = Number(minPrice);
      if (maxPrice) searchParams.max_price = Number(maxPrice);
      if (setName.trim()) searchParams.set_name = setName.trim();

      const [internal, external] = await Promise.all([
        cardsApi.search(searchParams),
        newOffset === 0
          ? searchApi
              .searchAll({ query: q.trim(), tcg_type: typeParam })
              .catch(() => ({ tcgplayer: [], ebay: [], pricecharting: [], justtcg: [], errors: [] }))
          : Promise.resolve(null),
      ]);

      if (newOffset === 0) {
        setInternalResults(internal);
        setOffset(0);
      } else {
        setInternalResults((prev) => [...prev, ...internal]);
      }
      setHasMore(internal.length === PAGE_SIZE);
      setOffset(newOffset);

      if (external) {
        setExternalResults([
          ...external.justtcg,
          ...external.pricecharting,
          ...external.tcgplayer,
          ...external.ebay,
        ]);
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tcgType, rarity, minPrice, maxPrice, setName]);

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

  function handleSuggestionSelect(suggestion: string) {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    submitTriggeredRef.current = true;
    performSearch(suggestion);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestion((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedSuggestion >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[selectedSuggestion]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
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

  function toggleSource(source: string) {
    setHiddenSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  const unifiedResults = useMemo<UnifiedSearchResult[]>(() => {
    const libraryIds = new Set(
      internalResults.map((c) => c.external_id).filter(Boolean),
    );
    return [
      ...internalResults.map((card) => ({ kind: "library" as const, card })),
      ...externalResults
        .filter((r) => !libraryIds.has(r.external_id))
        .filter((r) => !hiddenSources.has(r.source))
        .map((result) => ({ kind: "external" as const, result })),
    ];
  }, [internalResults, externalResults, hiddenSources]);

  const hasSearched = !!searchParams.get("q");
  const libraryCount = internalResults.length;
  const externalCount = unifiedResults.length - libraryCount;

  const allSources = useMemo(() => {
    const sources = new Set<string>();
    externalResults.forEach((r) => sources.add(r.source));
    return Array.from(sources);
  }, [externalResults]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Search Cards</h1>
        <p className="text-muted-foreground">Search across {Object.values(TCG_LABELS).join(", ")}</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="search"
                placeholder="Search by card name, set, or number..."
                className="pl-10 h-12 text-base"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                  setSelectedSuggestion(-1);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={handleInputKeyDown}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary/50 transition-colors ${i === selectedSuggestion ? "bg-secondary/50" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionSelect(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">TCG Type:</span>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={tcgType === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTcgType("all")}
              >
                All
              </Badge>
              {(Object.entries(TCG_LABELS) as [TCGType, string][]).map(([key, label]) => (
                <Badge
                  key={key}
                  variant={tcgType === key ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTcgType(key)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Advanced filters toggle */}
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Advanced Filters
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Rarity</Label>
                <Input
                  placeholder="e.g. Rare Holo"
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Set Name</Label>
                <Input
                  placeholder="e.g. Base Set"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="999.99"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
          )}
        </form>
      </Card>

      {loading ? (
        <SearchResultListSkeleton count={10} />
      ) : hasSearched ? (
        unifiedResults.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {libraryCount} in library · {externalCount} from external sources
              </p>
              {allSources.length > 0 && (
                <div className="flex gap-1 ml-auto">
                  {allSources.map((source) => (
                    <Badge
                      key={source}
                      variant={hiddenSources.has(source) ? "outline" : "default"}
                      className="cursor-pointer capitalize text-xs"
                      onClick={() => toggleSource(source)}
                    >
                      {source}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
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

            {hasMore && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => performSearch(query, offset + PAGE_SIZE)} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load More
                </Button>
              </div>
            )}
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
