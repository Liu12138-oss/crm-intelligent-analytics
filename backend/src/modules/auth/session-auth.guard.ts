import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CRM_AUTH_SESSION_COOKIE } from './auth-session.constants';
import { CrmAuthService } from './crm-auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly crmAuthService: CrmAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Record<string, any> & {
        headers: Record<string, string | undefined>;
        cookies?: Record<string, string | undefined>;
      }
    >();

    const authSessionId = request.cookies?.[CRM_AUTH_SESSION_COOKIE];
    if (!authSessionId) {
      throw new UnauthorizedException('当前未登录或会话已失效。');
    }

    const resolved = await this.crmAuthService.resolveSessionUser(authSessionId);
    request.crmUser = resolved.user;
    request.authSession = resolved.session;
    return true;
  }
}
