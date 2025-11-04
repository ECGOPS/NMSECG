// SecurityService now only handles frontend rate limiting and login attempt tracking.
// All authentication is handled by Azure AD.

class SecurityService {
  private static instance: SecurityService;
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private requestCounts: Map<string, { count: number; windowStart: number }> = new Map();

  private constructor() {}

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }

  private isRateLimited(email: string): boolean {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) return false;

    const now = Date.now();
    const timeSinceLastAttempt = now - attempts.lastAttempt;
    // Reset attempts if enough time has passed
    if (timeSinceLastAttempt > 15 * 60 * 1000) { // 15 minutes
      this.resetLoginAttempts(email);
      return false;
    }
    return attempts.count >= 5; // Max 5 attempts
  }

  private incrementLoginAttempts(email: string): void {
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.loginAttempts.set(email, attempts);
  }

  // No actual login/logout, handled by Azure AD
  public async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (this.isRateLimited(email)) {
      return {
        success: false,
        error: 'Too many login attempts. Please try again later.'
      };
    }
    // Always fail, as login is handled by Azure AD
    this.incrementLoginAttempts(email);
    return {
      success: false,
      error: 'Login is handled by Azure AD.'
    };
  }

  public async logout(): Promise<void> {
    // No-op, handled by Azure AD
  }

  public isAuthenticated(): boolean {
    // Always return false, handled by Azure AD
    return false;
  }

  public getCurrentUser() {
    // No-op, handled by Azure AD
    return null;
  }

  public async checkRateLimit(ip: string): Promise<boolean> {
    const now = Date.now();
    const windowSize = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100;
    const requestData = this.requestCounts.get(ip) || { count: 0, windowStart: now };
    // Reset if window has passed
    if (now - requestData.windowStart > windowSize) {
      requestData.count = 0;
      requestData.windowStart = now;
    }
    // Check if limit exceeded
    if (requestData.count >= maxRequests) {
      return false;
    }
    // Increment count
    requestData.count++;
    this.requestCounts.set(ip, requestData);
    return true;
  }
}

export const securityService = SecurityService.getInstance(); 