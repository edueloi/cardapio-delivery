import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiJson, apiFetch, getAuthToken, setAuthToken, AuthError } from "./api";
import type { Account, AuthPayload, TenantMembership } from "../types";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  establishmentName?: string;
  establishmentSlug?: string;
  description?: string;
  address?: string;
  whatsapp?: string;
  claimSlug?: string;
}

interface AuthContextValue {
  loading: boolean;
  isAuthenticated: boolean;
  account: Account | null;
  tenants: TenantMembership[];
  login: (email: string, password: string) => Promise<AuthPayload>;
  register: (input: RegisterInput) => Promise<AuthPayload>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setTenants: (tenants: TenantMembership[]) => void;
}

const AUTH_CACHE_KEY = "cardapio_delivery_auth_cache";

function readCache(): { account: Account; tenants: TenantMembership[] } | null {
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(account: Account, tenants: TenantMembership[]) {
  try {
    window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ account, tenants }));
  } catch {
    // storage full or unavailable — ignore
  }
}

function clearCache() {
  window.localStorage.removeItem(AUTH_CACHE_KEY);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = readCache();
  const hasToken = !!getAuthToken();

  // Initialise from cache so the app renders immediately without a loading flash.
  // If there is no token at all there's nothing to restore.
  const [loading, setLoading] = useState(hasToken && !cached);
  const [account, setAccount] = useState<Account | null>(cached?.account ?? null);
  const [tenants, setTenants] = useState<TenantMembership[]>(cached?.tenants ?? []);

  const applyPayload = (payload: AuthPayload | { account: Account; tenants: TenantMembership[]; token?: string }) => {
    if ("token" in payload && payload.token) {
      setAuthToken(payload.token);
    }

    setAccount(payload.account);
    setTenants(payload.tenants);
    writeCache(payload.account, payload.tenants);
  };

  const clearAuth = () => {
    setAuthToken(null);
    setAccount(null);
    setTenants([]);
    clearCache();
  };

  const refresh = async () => {
    const token = getAuthToken();
    if (!token) {
      clearAuth();
      setLoading(false);
      return;
    }

    try {
      const payload = await apiJson<{ account: Account; tenants: TenantMembership[] }>("/api/auth/me");
      applyPayload(payload);
    } catch (err) {
      if (err instanceof AuthError) {
        // Token explicitly rejected by server — sign out
        clearAuth();
      }
      // Network / server errors: keep existing account data so the user stays logged in
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (email: string, password: string) => {
    const payload = await apiJson<AuthPayload>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    applyPayload(payload);
    return payload;
  };

  const register = async (input: RegisterInput) => {
    const payload = await apiJson<AuthPayload>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    applyPayload(payload);
    return payload;
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearAuth();
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isAuthenticated: !!account,
      account,
      tenants,
      login,
      register,
      logout,
      refresh,
      setTenants,
    }),
    [loading, account, tenants],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
