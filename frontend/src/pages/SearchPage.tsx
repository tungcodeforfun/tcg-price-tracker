import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TCGCard } from "@/components/shared/TCGCard";
import { AddToCollectionModal } from "@/components/shared/AddToCollectionModal";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { cardsApi, searchApi } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import type { Card as CardType, SearchResult, TCGType } from "@/types";
import { Search, SlidersHorizontal, Download, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (urlQuery) {
      setQuery(urlQuery);
      performSearch(urlQuery);
    }
  }, [urlQuery]);

  async function performSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearchParams({ q: q.trim() });

    try {
      const typeParam = tcgType === "all" ? undefined : tcgType;
      const [internal, external] = await Promise.all([
        cardsApi.search({ query: q.trim(), tcg_type: typeParam, limit: 40 }),
        searchApi
          .searchAll({ query: q.trim(), tcg_type: typeParam })
          .catch(() => ({ tcgplayer: [], ebay: [], errors: [] })),
      ]);
      setInternalResults(internal);
      setExternalResults([...external.tcgplayer, ...external.ebay]);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    performSearch(query);
  }

  async function handleImport(result: SearchResult) {
    setImportingId(result.external_id);
    try {
      const card = await searchApi.importCard(result);
      toast.success(`Imported "${card.name}"`);
      setInternalResults((prev) => [card, ...prev]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Import failed",
      );
    } finally {
      setImportingId(null);
    }
  }

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
        <CardGridSkeleton count={12} />
      ) : (
        <Tabs defaultValue="internal">
          <TabsList>
            <TabsTrigger value="internal">
              Library ({internalResults.length})
            </TabsTrigger>
            <TabsTrigger value="external">
              External ({externalResults.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal">
            {internalResults.length > 0 ? (
              <>
                <p className="text-muted-foreground mb-4">
                  {internalResults.length} {internalResults.length === 1 ? "result" : "results"} found
                </p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {internalResults.map((card) => (
                    <TCGCard
                      key={card.id}
                      card={card}
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
                  {query
                    ? "Try adjusting your search query or filters"
                    : "Enter a search query to find cards."}
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="external">
            {externalResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {externalResults.map((result) => (
                  <Card key={`${result.source}-${result.external_id}`}>
                    <CardContent className="flex gap-3 p-3">
                      <ImageWithFallback
                        src={result.image_url ?? undefined}
                        alt={result.name}
                        className="h-20 w-14 rounded object-cover"
                        fallbackClassName="h-20 w-14 rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {result.name}
                        </h3>
                        <p className="truncate text-xs text-muted-foreground">
                          {result.set_name}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {result.source}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-sm font-bold">
                            {formatPrice(result.price)}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={importingId === result.external_id}
                            onClick={() => handleImport(result)}
                          >
                            {importingId === result.external_id ? (
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                {query
                  ? "No external results found."
                  : "Search to find cards from TCGPlayer, eBay, and more."}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AddToCollectionModal
        card={addCard}
        open={!!addCard}
        onOpenChange={(open) => !open && setAddCard(null)}
      />
    </div>
  );
}
