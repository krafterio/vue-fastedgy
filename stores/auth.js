/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { bus } from "../composables/bus.js";
import { useFetcherService } from "../composables/fetcher.js";
import { setDefaultAuthorization } from "../plugins/fetcher.js";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

const fetcher = useFetcherService();

export const useAuthStore = defineStore("auth", () => {
    const user = ref(null);
    const token = ref(localStorage.getItem("access_token"));
    const refreshToken = ref(localStorage.getItem("refresh_token"));
    const loading = ref(false);

    const isAuthenticated = computed(
        () => !!token.value && !!refreshToken.value
    );

    const isTokenExpired = computed(() => {
        if (!token.value) return false;
        const now = new Date();
        const payload = JSON.parse(atob(token.value.split(".")[1]));
        const expirationDate = new Date(payload.exp * 1000);
        return expirationDate < now;
    });

    const canRefreshToken = computed(() => {
        return isAuthenticated.value && !!refreshToken.value;
    });

    const setTokens = (accessToken, newRefreshToken) => {
        token.value = accessToken;
        refreshToken.value = newRefreshToken;

        if (accessToken) {
            localStorage.setItem("access_token", accessToken);
        } else {
            localStorage.removeItem("access_token");
        }

        if (newRefreshToken) {
            localStorage.setItem("refresh_token", newRefreshToken);
        } else {
            localStorage.removeItem("refresh_token");
        }

        setDefaultAuthorization(token.value);
    };

    const setToken = (newToken) => {
        token.value = newToken;
        if (newToken) {
            localStorage.setItem("access_token", newToken);
        } else {
            localStorage.removeItem("access_token");
        }

        setDefaultAuthorization(newToken);
    };

    const login = async (credentials) => {
        try {
            loading.value = true;

            const response = await fetcher.post("/auth/token", {
                username: credentials.email || credentials.username,
                password: credentials.password,
            });

            setTokens(response.data.access_token, response.data.refresh_token);
            user.value = (await fetcher.get("/me")).data;

            bus.trigger("auth:logged");
            return { success: true };
        } catch (error) {
            let message =
                error.data?.detail ||
                error.response?.data?.detail ||
                "Erreur de connexion";
            if (message === "Incorrect email or password") {
                message = "Email ou mot de passe incorrect";
            }
            return { success: false, message };
        } finally {
            loading.value = false;
        }
    };

    const register = async (userData, invitationToken = null) => {
        try {
            loading.value = true;

            // Construire l'URL avec le token si fourni
            const url = invitationToken
                ? `/auth/register?token=${invitationToken}`
                : "/auth/register";

            await fetcher.post(url, userData);

            const loginResult = await login({
                email: userData.email,
                password: userData.password,
            });

            return loginResult;
        } catch (error) {
            let message =
                error.data?.detail ||
                error.response?.data?.detail ||
                "Erreur lors de l'inscription";
            if (message === "Email already registered")
                message = "Email déjà enregistré";
            return { success: false, message };
        } finally {
            loading.value = false;
        }
    };

    const logout = async () => {
        try {
            user.value = null;
            setTokens(null, null);
            bus.trigger("auth:logout");
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
        }
    };

    const refreshAccessToken = async () => {
        if (!refreshToken.value) {
            await logout();
            return false;
        }

        try {
            const response = await fetcher.post("/auth/refresh", {
                refresh_token: refreshToken.value,
            });

            setTokens(response.data.access_token, response.data.refresh_token);
            return true;
        } catch (error) {
            console.error("Erreur lors du refresh du token:", error);
            await logout();
            return false;
        }
    };

    const checkUser = async () => {
        if (token.value && !user.value) {
            user.value = (await fetcher.get("/me")).data;
        }

        return user.value;
    };

    const refreshUser = async () => {
        if (token.value) {
            user.value = (await fetcher.get("/me")).data;
        }

        return user.value;
    };

    return {
        user,
        token,
        loading,
        isAuthenticated,
        canRefreshToken,
        isTokenExpired,
        register,
        login,
        logout,
        setToken,
        setTokens,
        refreshToken,
        refreshAccessToken,
        checkUser,
        refreshUser,
    };
});
