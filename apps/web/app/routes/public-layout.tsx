import { Outlet, useLocation, useSearchParams } from "react-router";
import { SiteFooter, SiteHeader } from "~/components/site-header";

export default function PublicLayout() {
  const [params] = useSearchParams();
  const onSearch = useLocation().pathname === "/search";
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        key={onSearch ? params.get("q") : "site"}
        query={onSearch ? (params.get("q") ?? "") : ""}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
