import { Outlet } from "react-router";
import { SiteLogo } from "~/components/terminal/site-chrome";

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-grid bg-deck">
        <div className="mx-auto flex max-w-[1440px] items-center px-3 py-2 sm:px-4">
          <SiteLogo />
        </div>
      </header>
      <main className="dot-matrix flex flex-1 items-start justify-center px-3 pt-12 pb-16 sm:px-4 sm:pt-20">
        <Outlet />
      </main>
    </div>
  );
}
