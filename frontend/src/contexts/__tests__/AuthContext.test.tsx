import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "../AuthContext";

// Mock the api module
vi.mock("@/lib/api", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
  },
  usersApi: {
    getMe: vi.fn(),
  },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  getAccessToken: vi.fn(() => null),
}));

import { authApi, usersApi, setTokens, clearTokens, getAccessToken } from "@/lib/api";

const mockUser = {
  id: 1,
  email: "test@example.com",
  username: "testuser",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout, register } =
    useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="username">{user?.username ?? "none"}</span>
      <button onClick={() => login("user", "pass")}>Login</button>
      <button onClick={() => register("a@b.com", "newuser", "pass")}>
        Register
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("AuthProvider", () => {
  it("starts unauthenticated when no token exists", () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("username").textContent).toBe("none");
  });

  it("loads user on mount when token exists", async () => {
    vi.mocked(getAccessToken).mockReturnValue("existing_token");
    vi.mocked(usersApi.getMe).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
      expect(screen.getByTestId("username").textContent).toBe("testuser");
    });
  });

  it("clears tokens if getMe fails on mount", async () => {
    vi.mocked(getAccessToken).mockReturnValue("bad_token");
    vi.mocked(usersApi.getMe).mockRejectedValue(new Error("Unauthorized"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(clearTokens).toHaveBeenCalled();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("login stores tokens and fetches user", async () => {
    const user = userEvent.setup();

    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
    vi.mocked(usersApi.getMe).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByText("Login"));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });

    expect(authApi.login).toHaveBeenCalledWith("user", "pass");
    expect(setTokens).toHaveBeenCalledWith({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
  });

  it("register calls register then login", async () => {
    const user = userEvent.setup();

    vi.mocked(authApi.register).mockResolvedValue(mockUser);
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
    vi.mocked(usersApi.getMe).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByText("Register"));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });

    expect(authApi.register).toHaveBeenCalledWith("a@b.com", "newuser", "pass");
    expect(authApi.login).toHaveBeenCalledWith("newuser", "pass");
  });

  it("logout clears user and tokens", async () => {
    const user = userEvent.setup();

    // Start authenticated
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: "tok",
      refresh_token: "ref",
      token_type: "bearer",
    });
    vi.mocked(usersApi.getMe).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await user.click(screen.getByText("Login"));
    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });

    await user.click(screen.getByText("Logout"));

    expect(clearTokens).toHaveBeenCalled();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("username").textContent).toBe("none");
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    // Suppress React error boundary logging
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );

    spy.mockRestore();
  });
});
