export const useAuthStore: import("pinia").StoreDefinition<"auth", Pick<{
    user: import("vue").Ref<any, any>;
    token: import("vue").Ref<string, string>;
    refreshToken: import("vue").Ref<string, string>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    login: (credentials: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    register: (userData: any, invitationToken?: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<any>;
}, "user" | "token" | "refreshToken" | "loading">, Pick<{
    user: import("vue").Ref<any, any>;
    token: import("vue").Ref<string, string>;
    refreshToken: import("vue").Ref<string, string>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    login: (credentials: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    register: (userData: any, invitationToken?: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<any>;
}, "isAuthenticated" | "canRefreshToken" | "isTokenExpired">, Pick<{
    user: import("vue").Ref<any, any>;
    token: import("vue").Ref<string, string>;
    refreshToken: import("vue").Ref<string, string>;
    loading: import("vue").Ref<boolean, boolean>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    canRefreshToken: import("vue").ComputedRef<boolean>;
    isTokenExpired: import("vue").ComputedRef<boolean>;
    login: (credentials: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    register: (userData: any, invitationToken?: any) => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: any;
    }>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<boolean>;
    checkUser: () => Promise<any>;
}, "login" | "register" | "logout" | "refreshAccessToken" | "checkUser">>;
//# sourceMappingURL=auth.d.ts.map