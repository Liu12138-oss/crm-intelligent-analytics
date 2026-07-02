import { defineStore } from 'pinia';
import { authService } from '@/services/auth.service';
import { analysisService } from '@/services/analysis.service';
import type { AuthSessionView } from '@/types/auth';
import type { AnalysisCapability } from '@/types/analysis';

const CAPABILITY_SNAPSHOT_TTL_MS = 30 * 1000;
let hydrateSessionPromise: Promise<AuthSessionView | null> | null = null;
let loadCapabilitiesPromise: Promise<AnalysisCapability | null> | null = null;

interface AuthState {
  session: AuthSessionView | null;
  capabilities: AnalysisCapability | null;
  hydrated: boolean;
  isSubmitting: boolean;
  sessionHydratedAt: number | null;
  capabilitiesHydratedAt: number | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    session: null,
    capabilities: null,
    hydrated: false,
    isSubmitting: false,
    sessionHydratedAt: null,
    capabilitiesHydratedAt: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.session?.authenticated),
    currentUser: (state) => state.session?.user ?? null,
    visibleMenus: (state) => state.capabilities?.visibleMenus ?? [],
    actionKeys: (state) => state.capabilities?.actionKeys ?? [],
  },
  actions: {
    async hydrateSession(force = false): Promise<AuthSessionView | null> {
      if (this.hydrated && !force) {
        return this.session;
      }
      if (hydrateSessionPromise) {
        return hydrateSessionPromise;
      }

      hydrateSessionPromise = (async () => {
        try {
          this.session = await authService.getCurrentSession();
          this.sessionHydratedAt = Date.now();
          if (this.session?.authenticated) {
            await this.loadCapabilities(force);
          } else {
            this.invalidateCapabilities();
          }
        } catch {
          this.session = null;
          this.sessionHydratedAt = null;
          this.invalidateCapabilities();
        } finally {
          this.hydrated = true;
          hydrateSessionPromise = null;
        }

        return this.session;
      })();

      return hydrateSessionPromise;
    },

    async loginWithPassword(payload: {
      login: string;
      password: string;
      corpId?: string;
      wecomBindToken?: string;
    }): Promise<AuthSessionView> {
      this.isSubmitting = true;
      try {
        this.session = await authService.login(payload);
        this.sessionHydratedAt = Date.now();
        await this.loadCapabilities(true);
        this.hydrated = true;
        return this.session;
      } finally {
        this.isSubmitting = false;
      }
    },

    async loginWithWecomCode(payload: {
      code?: string;
      authCode?: string;
      state?: string;
    }): Promise<AuthSessionView> {
      this.isSubmitting = true;
      try {
        this.session = await authService.exchangeWecomCode(payload);
        this.sessionHydratedAt = Date.now();
        await this.loadCapabilities(true);
        this.hydrated = true;
        return this.session;
      } finally {
        this.isSubmitting = false;
      }
    },

    async startWecomLogin(): Promise<void> {
      this.isSubmitting = true;
      try {
        const initiate = await authService.startWecomLogin();
        window.location.assign(initiate.authorizeUrl);
      } finally {
        this.isSubmitting = false;
      }
    },

    async logout(): Promise<void> {
      try {
        await authService.logout();
      } finally {
        this.clearSession();
      }
    },

    clearSession(): void {
      hydrateSessionPromise = null;
      loadCapabilitiesPromise = null;
      this.session = null;
      this.sessionHydratedAt = null;
      this.invalidateCapabilities();
      this.hydrated = true;
      this.isSubmitting = false;
    },

    invalidateCapabilities(): void {
      loadCapabilitiesPromise = null;
      this.capabilities = null;
      this.capabilitiesHydratedAt = null;
    },

    async loadCapabilities(force = false): Promise<AnalysisCapability | null> {
      if (!this.session?.authenticated) {
        this.invalidateCapabilities();
        return null;
      }
      if (!force && this.capabilities && this.capabilitiesHydratedAt !== null) {
        const snapshotAgeMs = Date.now() - this.capabilitiesHydratedAt;
        if (snapshotAgeMs < CAPABILITY_SNAPSHOT_TTL_MS) {
          return this.capabilities;
        }
      }
      if (loadCapabilitiesPromise) {
        return loadCapabilitiesPromise;
      }

      loadCapabilitiesPromise = (async () => {
        try {
          this.capabilities = await analysisService.getCapabilities();
          this.capabilitiesHydratedAt = Date.now();
        } catch {
          this.invalidateCapabilities();
        } finally {
          loadCapabilitiesPromise = null;
        }

        return this.capabilities;
      })();

      return loadCapabilitiesPromise;
    },

    hasVisibleMenu(menuKey: string): boolean {
      return this.visibleMenus.includes(menuKey);
    },

    hasAction(actionKey: string): boolean {
      return this.actionKeys.includes(actionKey);
    },
  },
});
