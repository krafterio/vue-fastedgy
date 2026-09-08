/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

import { bus } from '../composables/bus.js';
import { t } from '../utils/i18n.js';
import { useFetcherService } from '../composables/fetcher.js';
import { setDefaultAuthorization } from '../plugins/fetcher.js';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const fetcher = useFetcherService();

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const token = ref(localStorage.getItem('access_token'));
    const refreshToken = ref(localStorage.getItem('refresh_token'));
    const loading = ref(false);
    /** @type {Promise<void>|null} */
    let checkUserPromise = null;

    const isAuthenticated = computed(() => !!token.value && !!refreshToken.value);

    const isTokenExpired = computed(() => {
        if (!token.value) return false;
        const now = new Date();
        const payload = JSON.parse(atob(token.value.split('.')[1]));
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
            localStorage.setItem('access_token', accessToken);
        } else {
            localStorage.removeItem('access_token');
        }

        if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
        } else {
            localStorage.removeItem('refresh_token');
        }

        setDefaultAuthorization(token.value);
    };

    const setToken = (newToken) => {
        token.value = newToken;
        if (newToken) {
            localStorage.setItem('access_token', newToken);
        } else {
            localStorage.removeItem('access_token');
        }

        setDefaultAuthorization(newToken);
    };

    const login = async (credentials) => {
        try {
            loading.value = true;

            const response = await fetcher.post('/auth/token', {
                username: credentials.email || credentials.username,
                password: credentials.password,
            });

            setTokens(response.data.access_token, response.data.refresh_token);
            user.value = (await fetcher.get('/me')).data;

            bus.trigger('auth:logged');
            return { success: true };
        } catch (error) {
            // The server localizes what it sends, so its message is displayed as it
            // comes: only the wording of the package is translated here.
            const detail = error.data?.detail || error.response?.data?.detail;

            return { success: false, message: detail || t('Connection error') };
        } finally {
            loading.value = false;
        }
    };

    /**
     * @param {object} userData
     * @param {String|null} [invitationToken]
     */
    const register = async (userData, invitationToken = null) => {
        try {
            loading.value = true;

            // Build the url with the token when one is given
            const url = invitationToken ? `/auth/register?token=${invitationToken}` : '/auth/register';

            await fetcher.post(url, userData);

            const loginResult = await login({
                email: userData.email,
                password: userData.password,
            });

            return loginResult;
        } catch (error) {
            const detail = error.data?.detail || error.response?.data?.detail;

            return { success: false, message: detail || t('Registration error') };
        } finally {
            loading.value = false;
        }
    };

    const logout = async () => {
        try {
            user.value = null;
            setTokens(null, null);
            bus.trigger('auth:logout');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const refreshAccessToken = async () => {
        if (!refreshToken.value) {
            await logout();
            return false;
        }

        try {
            const response = await fetcher.post('/auth/refresh', {
                refresh_token: refreshToken.value,
            });

            setTokens(response.data.access_token, response.data.refresh_token);
            return true;
        } catch (error) {
            const status = error?.response?.status;

            if (401 === status || 403 === status) {
                await logout();
            } else {
                // Network or server error: the refresh token may still be
                // valid, keep the session so the app recovers when the
                // server comes back.
                console.error('Token refresh failed:', error);
            }

            return false;
        }
    };

    /**
     * Ask for the mail that starts a password reset.
     *
     * @param {String} email
     * @returns {Promise<{message: String}>}
     */
    const forgotPassword = async (email) => {
        const response = await fetcher.post('/auth/password/forgot', { email });

        return response.data;
    };

    /**
     * Whether a reset token is still worth a form.
     *
     * @param {String} token
     * @returns {Promise<{valid: Boolean, email?: String}>}
     */
    const validatePasswordToken = async (token) => {
        const response = await fetcher.post('/auth/password/validate', { token });

        return response.data;
    };

    /**
     * Set the password the reset token was sent for.
     *
     * @param {String} token
     * @param {String} password
     * @returns {Promise<{message: String}>}
     */
    const resetPassword = async (token, password) => {
        const response = await fetcher.post('/auth/password/reset', { token, password });

        return response.data;
    };

    const checkUser = async () => {
        if (token.value && !user.value) {
            checkUserPromise ??= fetcher
                .get('/me')
                .then((response) => {
                    user.value = response.data;
                })
                .finally(() => {
                    checkUserPromise = null;
                });

            await checkUserPromise;
        }

        return user.value;
    };

    /**
     * Change what the account holds, and keep what is held here in step.
     *
     * @param {object} payload
     * @returns {Promise<object|null>} - The account as the server answers it
     */
    const updateUser = async (payload) => {
        const response = await fetcher.patch('/me', payload);

        user.value = response.data ?? user.value;

        return user.value;
    };

    const refreshUser = async () => {
        if (token.value) {
            user.value = (await fetcher.get('/me')).data;
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
        updateUser,
        forgotPassword,
        validatePasswordToken,
        resetPassword,
    };
});
