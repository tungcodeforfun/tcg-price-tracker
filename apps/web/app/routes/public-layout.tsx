import { Outlet, useLocation, useSearchParams } from "react-router";
import { SiteFooter, SiteHeader } from "~/components/terminal/site-chrome";

export default function PublicLayout() {
  const [params] = useSearchParams();
  const onSearch = useLocation().pathname === "/search";
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        key={onSearch ? params.get("q") : "site"}
        query={onSearch ? (params.get("q") ?? "") : ""}
      />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
