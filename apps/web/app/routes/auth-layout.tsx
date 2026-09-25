import { Link, Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 py-4">
        <Link to="/" className="font-semibold">
          TCG Price Tracker
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pt-16">
        <Outlet />
      </main>
    </div>
  );
}
