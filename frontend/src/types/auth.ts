export interface AuthenticatedUserView {
  id: string;
  name: string;
  roleNames: string[];
  channels: string[];
  organizationIds: string[];
  departmentIds: string[];
}

export interface AuthSessionView {
  authenticated: boolean;
  sessionId: string;
  source: 'password-login' | 'wecom-scan';
  expiresAt: string;
  user: AuthenticatedUserView;
}

export interface WecomLoginInitiateView {
  enabled: boolean;
  state: string;
  authorizeUrl: string;
  reason?: string;
  widget?: {
    appId: string;
    agentId: string;
    redirectUri: string;
    state: string;
    scope?: string;
  };
}
