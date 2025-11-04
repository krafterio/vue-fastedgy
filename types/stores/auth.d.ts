export const useAuthStore: import("pinia").StoreDefinition<"auth", Pick<{
    user: import("vue").Ref<any, any>;
    token: import("vue").Ref<string, string>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    register: (userData: any, invitationToken?: any) => Promise<{
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
    refreshToken: import("vue").Ref<string, string>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<any>;
    refreshUser: () => Promise<any>;
}, "user" | "token" | "loading" | "refreshToken">, Pick<{
    user: import("vue").Ref<any, any>;
    token: import("vue").Ref<string, string>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    register: (userData: any, invitationToken?: any) => Promise<{
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
    refreshToken: import("vue").Ref<string, string>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<any>;
    refreshUser: () => Promise<any>;
}, "isAuthenticated" | "canRefreshToken" | "isTokenExpired">, Pick<{
    user: import("vue").Ref<any, any>;
    token: import("vue").Ref<string, string>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    register: (userData: any, invitationToken?: any) => Promise<{
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
    refreshToken: import("vue").Ref<string, string>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<any>;
    refreshUser: () => Promise<any>;
}, "register" | "login" | "logout" | "setToken" | "setTokens" | "refreshAccessToken" | "checkUser" | "refreshUser">>;
//# sourceMappingURL=auth.d.ts.map