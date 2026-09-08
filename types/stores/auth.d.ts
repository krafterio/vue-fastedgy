export declare const useAuthStore: import("pinia").SetupStoreDefinition<"auth", {
    user: import("vue").Ref<null, null>;
    token: import("vue").Ref<string | null, string | null>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    register: (userData: object, invitationToken?: string | null) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    login: (credentials: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    logout: () => Promise<void>;
    setToken: (newToken: any) => void;
    setTokens: (accessToken: any, newRefreshToken: any) => void;
    refreshToken: import("vue").Ref<string | null, string | null>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<null>;
    refreshUser: () => Promise<null>;
    forgotPassword: (email: string) => Promise<{
        message: string;
    }>;
    validatePasswordToken: (token: string) => Promise<{
        valid: boolean;
        email?: string;
    }>;
    resetPassword: (token: string, password: string) => Promise<{
        message: string;
    }>;
}>;
//# sourceMappingURL=auth.d.ts.map