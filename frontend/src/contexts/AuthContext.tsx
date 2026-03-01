import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { User } from "@/types";
import {
  authApi,
  usersApi,
  markAuthenticated,
  clearTokens,
} from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    setUser(null);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || "/api/v1"}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Server unreachable -- cookies will expire naturally
    }
    clearTokens();
  }, []);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getMe()
      .then((u) => {
        if (!cancelled) {
          setUser(u);
          markAuthenticated();
        }
      })
      .catch(() => { if (!cancelled) clearTokens(); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await usersApi.getMe();
    setUser(u);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await authApi.login(username, password);
    markAuthenticated();
    const me = await usersApi.getMe();
    setUser(me);
  }, []);

  const register = useCallback(async (
    email: string,
    username: string,
    password: string,
  ) => {
    await authApi.register(email, username, password);
    await login(username, password);
  }, [login]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  }), [user, isLoading, login, register, logout, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
