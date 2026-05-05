import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiJson, apiFetch, getAuthToken, setAuthToken } from "./api";
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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [tenants, setTenants] = useState<TenantMembership[]>([]);

  const applyPayload = (payload: AuthPayload | { account: Account; tenants: TenantMembership[]; token?: string }) => {
    if ("token" in payload && payload.token) {
      setAuthToken(payload.token);
    }

    setAccount(payload.account);
    setTenants(payload.tenants);
  };

  const clearAuth = () => {
    setAuthToken(null);
    setAccount(null);
    setTenants([]);
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
    } catch {
      clearAuth();
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
