import { Injectable, Inject } from '@angular/core';
import { of, from, Subject, iif, defer, ReplaySubject, throwError, } from 'rxjs';
import { concatMap, tap, map, takeUntil, catchError, switchMap, withLatestFrom, } from 'rxjs/operators';
import { Auth0ClientService } from './auth.client';
import * as i0 from "@angular/core";
import * as i1 from "./auth.config";
import * as i2 from "./abstract-navigator";
import * as i3 from "./auth.state";
import * as i4 from "@auth0/auth0-spa-js";
export class AuthService {
    constructor(auth0Client, configFactory, navigator, authState) {
        this.auth0Client = auth0Client;
        this.configFactory = configFactory;
        this.navigator = navigator;
        this.authState = authState;
        this.appStateSubject$ = new ReplaySubject(1);
        // https://stackoverflow.com/a/41177163
        this.ngUnsubscribe$ = new Subject();
        /**
         * Emits boolean values indicating the loading state of the SDK.
         */
        this.isLoading$ = this.authState.isLoading$;
        /**
         * Emits boolean values indicating the authentication state of the user. If `true`, it means a user has authenticated.
         * This depends on the value of `isLoading$`, so there is no need to manually check the loading state of the SDK.
         */
        this.isAuthenticated$ = this.authState.isAuthenticated$;
        /**
         * Emits details about the authenticated user, or null if not authenticated.
         */
        this.user$ = this.authState.user$;
        /**
         * Emits ID token claims when authenticated, or null if not authenticated.
         */
        this.idTokenClaims$ = this.authState.idTokenClaims$;
        /**
         * Emits errors that occur during login, or when checking for an active session on startup.
         */
        this.error$ = this.authState.error$;
        /**
         * Emits the value (if any) that was passed to the `loginWithRedirect` method call
         * but only **after** `handleRedirectCallback` is first called
         */
        this.appState$ = this.appStateSubject$.asObservable();
        console.log('auth0-angular, AuthService constructor called');
        const checkSessionOrCallback$ = (isCallback) => iif(() => isCallback, this.handleRedirectCallback(), defer(() => this.auth0Client.checkSession()));
        this.shouldHandleCallback()
            .pipe(switchMap((isCallback) => checkSessionOrCallback$(isCallback).pipe(catchError((error) => {
            console.log('auth0-angular, AuthService, checkSession error: ', error);
            const config = this.configFactory.get();
            this.navigator.navigateByUrl(config.errorPath || '/');
            this.authState.setError(error);
            return of(undefined);
        }))), tap(() => {
            this.authState.setIsLoading(false);
        }), takeUntil(this.ngUnsubscribe$))
            .subscribe();
    }
    /**
     * Called when the service is destroyed
     */
    ngOnDestroy() {
        // https://stackoverflow.com/a/41177163
        this.ngUnsubscribe$.next();
        this.ngUnsubscribe$.complete();
    }
    /**
     * ```js
     * loginWithRedirect(options);
     * ```
     *
     * Performs a redirect to `/authorize` using the parameters
     * provided as arguments. Random and secure `state` and `nonce`
     * parameters will be auto-generated.
     *
     * @param options The login options
     */
    loginWithRedirect(options) {
        console.log('auth0-angular, AuthService, loginWithRedirect called, options: ', JSON.stringify(options));
        return from(this.auth0Client.loginWithRedirect(options));
    }
    /**
     * ```js
     * await loginWithPopup(options);
     * ```
     *
     * Opens a popup with the `/authorize` URL using the parameters
     * provided as arguments. Random and secure `state` and `nonce`
     * parameters will be auto-generated. If the response is successful,
     * results will be valid according to their expiration times.
     *
     * IMPORTANT: This method has to be called from an event handler
     * that was started by the user like a button click, for example,
     * otherwise the popup will be blocked in most browsers.
     *
     * @param options The login options
     * @param config Configuration for the popup window
     */
    loginWithPopup(options, config) {
        console.log('auth0-angular, AuthService, loginWithPopup called, options: ', JSON.stringify(options), ', config: ', JSON.stringify(config));
        return from(this.auth0Client.loginWithPopup(options, config).then(() => {
            this.authState.refresh();
        }));
    }
    /**
     * ```js
     * logout();
     * ```
     *
     * Clears the application session and performs a redirect to `/v2/logout`, using
     * the parameters provided as arguments, to clear the Auth0 session.
     * If the `federated` option is specified it also clears the Identity Provider session.
     * If the `localOnly` option is specified, it only clears the application session.
     * It is invalid to set both the `federated` and `localOnly` options to `true`,
     * and an error will be thrown if you do.
     * [Read more about how Logout works at Auth0](https://auth0.com/docs/logout).
     *
     * @param options The logout options
     */
    logout(options) {
        console.log('auth0-angular, AuthService, logout called, options: ', JSON.stringify(options));
        const logout = this.auth0Client.logout(options) || of(null);
        from(logout).subscribe(() => {
            if (options === null || options === void 0 ? void 0 : options.localOnly) {
                this.authState.refresh();
            }
        });
    }
    /**
     * ```js
     * getAccessTokenSilently(options).subscribe(token => ...)
     * ```
     *
     * If there's a valid token stored, return it. Otherwise, opens an
     * iframe with the `/authorize` URL using the parameters provided
     * as arguments. Random and secure `state` and `nonce` parameters
     * will be auto-generated. If the response is successful, results
     * will be valid according to their expiration times.
     *
     * If refresh tokens are used, the token endpoint is called directly with the
     * 'refresh_token' grant. If no refresh token is available to make this call,
     * the SDK falls back to using an iframe to the '/authorize' URL.
     *
     * This method may use a web worker to perform the token call if the in-memory
     * cache is used.
     *
     * If an `audience` value is given to this function, the SDK always falls
     * back to using an iframe to make the token exchange.
     *
     * Note that in all cases, falling back to an iframe requires access to
     * the `auth0` cookie, and thus will not work in browsers that block third-party
     * cookies by default (Safari, Brave, etc).
     *
     * @param options The options for configuring the token fetch.
     */
    getAccessTokenSilently(options = {}) {
        console.log('auth0-angular, AuthService, getAccessTokenSilently called, options: ', JSON.stringify(options));
        return of(this.auth0Client).pipe(concatMap((client) => options.detailedResponse === true
            ? client.getTokenSilently(Object.assign(Object.assign({}, options), { detailedResponse: true }))
            : client.getTokenSilently(options)), tap((token) => this.authState.setAccessToken(typeof token === 'string' ? token : token.access_token)), catchError((error) => {
            this.authState.setError(error);
            this.authState.refresh();
            return throwError(error);
        }));
    }
    /**
     * ```js
     * getTokenWithPopup(options).subscribe(token => ...)
     * ```
     *
     * Get an access token interactively.
     *
     * Opens a popup with the `/authorize` URL using the parameters
     * provided as arguments. Random and secure `state` and `nonce`
     * parameters will be auto-generated. If the response is successful,
     * results will be valid according to their expiration times.
     */
    getAccessTokenWithPopup(options) {
        console.log('auth0-angular, AuthService, getAccessTokenWithPopup called, options: ', JSON.stringify(options));
        return of(this.auth0Client).pipe(concatMap((client) => client.getTokenWithPopup(options)), tap((token) => this.authState.setAccessToken(token)), catchError((error) => {
            this.authState.setError(error);
            this.authState.refresh();
            return throwError(error);
        }));
    }
    /**
     * ```js
     * getUser(options).subscribe(user => ...);
     * ```
     *
     * Returns the user information if available (decoded
     * from the `id_token`).
     *
     * If you provide an audience or scope, they should match an existing Access Token
     * (the SDK stores a corresponding ID Token with every Access Token, and uses the
     * scope and audience to look up the ID Token)
     *
     * @remarks
     *
     * The returned observable will emit once and then complete.
     *
     * @typeparam TUser The type to return, has to extend {@link User}.
     * @param options The options to get the user
     */
    getUser(options) {
        console.log('auth0-angular, AuthService, getUser called, options: ', JSON.stringify(options));
        return defer(() => this.auth0Client.getUser(options));
    }
    /**
     * ```js
     * getIdTokenClaims(options).subscribe(claims => ...);
     * ```
     *
     * Returns all claims from the id_token if available.
     *
     * If you provide an audience or scope, they should match an existing Access Token
     * (the SDK stores a corresponding ID Token with every Access Token, and uses the
     * scope and audience to look up the ID Token)
     *
     * @remarks
     *
     * The returned observable will emit once and then complete.
     *
     * @param options The options to get the Id token claims
     */
    getIdTokenClaims(options) {
        console.log('auth0-angular, AuthService, getIdTokenClaims called, options: ', JSON.stringify(options));
        return defer(() => this.auth0Client.getIdTokenClaims(options));
    }
    /**
     * ```js
     * handleRedirectCallback(url).subscribe(result => ...)
     * ```
     *
     * After the browser redirects back to the callback page,
     * call `handleRedirectCallback` to handle success and error
     * responses from Auth0. If the response is successful, results
     * will be valid according to their expiration times.
     *
     * Calling this method also refreshes the authentication and user states.
     *
     * @param url The URL to that should be used to retrieve the `state` and `code` values. Defaults to `window.location.href` if not given.
     */
    handleRedirectCallback(url) {
        console.log('auth0-angular, AuthService, handleRedirectCallback called, url: ', url);
        return defer(() => this.auth0Client.handleRedirectCallback(url)).pipe(withLatestFrom(this.authState.isLoading$), tap(([result, isLoading]) => {
            var _a;
            if (!isLoading) {
                this.authState.refresh();
            }
            const appState = result === null || result === void 0 ? void 0 : result.appState;
            const target = (_a = appState === null || appState === void 0 ? void 0 : appState.target) !== null && _a !== void 0 ? _a : '/';
            if (appState) {
                this.appStateSubject$.next(appState);
            }
            this.navigator.navigateByUrl(target);
        }), map(([result]) => result));
    }
    /**
     * ```js
     * buildAuthorizeUrl().subscribe(url => ...)
     * ```
     *
     * Builds an `/authorize` URL for loginWithRedirect using the parameters
     * provided as arguments. Random and secure `state` and `nonce`
     * parameters will be auto-generated.
     * @param options The options
     * @returns A URL to the authorize endpoint
     */
    buildAuthorizeUrl(options) {
        console.log('auth0-angular, AuthService, buildAuthorizeUrl called, options: ', JSON.stringify(options));
        return defer(() => this.auth0Client.buildAuthorizeUrl(options));
    }
    /**
     * ```js
     * buildLogoutUrl().subscribe(url => ...)
     * ```
     * Builds a URL to the logout endpoint.
     *
     * @param options The options used to configure the parameters that appear in the logout endpoint URL.
     * @returns a URL to the logout endpoint using the parameters provided as arguments.
     */
    buildLogoutUrl(options) {
        console.log('auth0-angular, AuthService, buildLogoutUrl called, options: ', JSON.stringify(options));
        return of(this.auth0Client.buildLogoutUrl(options));
    }
    shouldHandleCallback() {
        console.log('auth0-angular, AuthService, shouldHandleCallback called, location.search: ', location.search, ', skipRedirectCallback: ', this.configFactory.get().skipRedirectCallback ? 'true' : 'false');
        return of(location.search).pipe(map((search) => {
            return ((search.includes('code=') || search.includes('error=')) &&
                search.includes('state=') &&
                !this.configFactory.get().skipRedirectCallback);
        }));
    }
}
AuthService.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "12.2.16", ngImport: i0, type: AuthService, deps: [{ token: Auth0ClientService }, { token: i1.AuthClientConfig }, { token: i2.AbstractNavigator }, { token: i3.AuthState }], target: i0.ɵɵFactoryTarget.Injectable });
AuthService.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "12.2.16", ngImport: i0, type: AuthService, providedIn: 'root' });
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "12.2.16", ngImport: i0, type: AuthService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root',
                }]
        }], ctorParameters: function () { return [{ type: i4.Auth0Client, decorators: [{
                    type: Inject,
                    args: [Auth0ClientService]
                }] }, { type: i1.AuthClientConfig }, { type: i2.AbstractNavigator }, { type: i3.AuthState }]; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvYXV0aDAtYW5ndWxhci9zcmMvbGliL2F1dGguc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBYSxNQUFNLGVBQWUsQ0FBQztBQW1COUQsT0FBTyxFQUNMLEVBQUUsRUFDRixJQUFJLEVBQ0osT0FBTyxFQUVQLEdBQUcsRUFDSCxLQUFLLEVBQ0wsYUFBYSxFQUNiLFVBQVUsR0FDWCxNQUFNLE1BQU0sQ0FBQztBQUVkLE9BQU8sRUFDTCxTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsRUFDSCxTQUFTLEVBQ1QsVUFBVSxFQUNWLFNBQVMsRUFDVCxjQUFjLEdBQ2YsTUFBTSxnQkFBZ0IsQ0FBQztBQUV4QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxlQUFlLENBQUM7Ozs7OztBQVFuRCxNQUFNLE9BQU8sV0FBVztJQXNDdEIsWUFDc0MsV0FBd0IsRUFDcEQsYUFBK0IsRUFDL0IsU0FBNEIsRUFDNUIsU0FBb0I7UUFIUSxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtRQUNwRCxrQkFBYSxHQUFiLGFBQWEsQ0FBa0I7UUFDL0IsY0FBUyxHQUFULFNBQVMsQ0FBbUI7UUFDNUIsY0FBUyxHQUFULFNBQVMsQ0FBVztRQXhDdEIscUJBQWdCLEdBQUcsSUFBSSxhQUFhLENBQVksQ0FBQyxDQUFDLENBQUM7UUFFM0QsdUNBQXVDO1FBQy9CLG1CQUFjLEdBQUcsSUFBSSxPQUFPLEVBQVEsQ0FBQztRQUM3Qzs7V0FFRztRQUNNLGVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztRQUVoRDs7O1dBR0c7UUFDTSxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO1FBRTVEOztXQUVHO1FBQ00sVUFBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMs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RyxFQUFFLENBQUMsb0JBQW9CLENBQy9DLENBQUM7UUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQzs7eUdBMVhVLFdBQVcsa0JBdUNaLGtCQUFrQjs2R0F2Q2pCLFdBQVcsY0FGVixNQUFNOzRGQUVQLFdBQVc7a0JBSHZCLFVBQVU7bUJBQUM7b0JBQ1YsVUFBVSxFQUFFLE1BQU07aUJBQ25COzswQkF3Q0ksTUFBTTsyQkFBQyxrQkFBa0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBJbmplY3QsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5pbXBvcnQge1xuICBBdXRoMENsaWVudCxcbiAgUmVkaXJlY3RMb2dpbk9wdGlvbnMsXG4gIFBvcHVwTG9naW5PcHRpb25zLFxuICBQb3B1cENvbmZpZ09wdGlvbnMsXG4gIExvZ291dE9wdGlvbnMsXG4gIEdldFRva2VuU2lsZW50bHlPcHRpb25zLFxuICBHZXRUb2tlbldpdGhQb3B1cE9wdGlvbnMsXG4gIFJlZGlyZWN0TG9naW5SZXN1bHQsXG4gIExvZ291dFVybE9wdGlvbnMsXG4gIEdldFRva2VuU2lsZW50bHlWZXJib3NlUmVzcG9uc2UsXG4gIEdldFVzZXJPcHRpb25zLFxuICBVc2VyLFxuICBHZXRJZFRva2VuQ2xhaW1zT3B0aW9ucyxcbiAgSWRUb2tlbixcbn0gZnJvbSAnQGF1dGgwL2F1dGgwLXNwYS1qcyc7XG5cbmltcG9ydCB7XG4gIG9mLFxuICBmcm9tLFxuICBTdWJqZWN0LFxuICBPYnNlcnZhYmxlLFxuICBpaWYsXG4gIGRlZmVyLFxuICBSZXBsYXlTdWJqZWN0LFxuICB0aHJvd0Vycm9yLFxufSBmcm9tICdyeGpzJztcblxuaW1wb3J0IHtcbiAgY29uY2F0TWFwLFxuICB0YXAsXG4gIG1hcCxcbiAgdGFrZVVudGlsLFxuICBjYXRjaEVycm9yLFxuICBzd2l0Y2hNYXAsXG4gIHdpdGhMYXRlc3RGcm9tLFxufSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCB7IEF1dGgwQ2xpZW50U2VydmljZSB9IGZyb20gJy4vYXV0aC5jbGllbnQnO1xuaW1wb3J0IHsgQWJzdHJhY3ROYXZpZ2F0b3IgfSBmcm9tICcuL2Fic3RyYWN0LW5hdmlnYXRvcic7XG5pbXBvcnQgeyBBdXRoQ2xpZW50Q29uZmlnLCBBcHBTdGF0ZSB9IGZyb20gJy4vYXV0aC5jb25maWcnO1xuaW1wb3J0IHsgQXV0aFN0YXRlIH0gZnJvbSAnLi9hdXRoLnN0YXRlJztcblxuQEluamVjdGFibGUoe1xuICBwcm92aWRlZEluOiAncm9vdCcsXG59KVxuZXhwb3J0IGNsYXNzIEF1dGhTZXJ2aWNlPFRBcHBTdGF0ZSBleHRlbmRzIEFwcFN0YXRlID0gQXBwU3RhdGU+XG4gIGltcGxlbWVudHMgT25EZXN0cm95IHtcbiAgcHJpdmF0ZSBhcHBTdGF0ZVN1YmplY3QkID0gbmV3IFJlcGxheVN1YmplY3Q8VEFwcFN0YXRlPigxKTtcblxuICAvLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvNDExNzcxNjNcbiAgcHJpdmF0ZSBuZ1Vuc3Vic2NyaWJlJCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XG4gIC8qKlxuICAgKiBFbWl0cyBib29sZWFuIHZhbHVlcyBpbmRpY2F0aW5nIHRoZSBsb2FkaW5nIHN0YXRlIG9mIHRoZSBTREsuXG4gICAqL1xuICByZWFkb25seSBpc0xvYWRpbmckID0gdGhpcy5hdXRoU3RhdGUuaXNMb2FkaW5nJDtcblxuICAvKipcbiAgICogRW1pdHMgYm9vbGVhbiB2YWx1ZXMgaW5kaWNhdGluZyB0aGUgYXV0aGVudGljYXRpb24gc3RhdGUgb2YgdGhlIHVzZXIuIElmIGB0cnVlYCwgaXQgbWVhbnMgYSB1c2VyIGhhcyBhdXRoZW50aWNhdGVkLlxuICAgKiBUaGlzIGRlcGVuZHMgb24gdGhlIHZhbHVlIG9mIGBpc0xvYWRpbmckYCwgc28gdGhlcmUgaXMgbm8gbmVlZCB0byBtYW51YWxseSBjaGVjayB0aGUgbG9hZGluZyBzdGF0ZSBvZiB0aGUgU0RLLlxuICAgKi9cbiAgcmVhZG9ubHkgaXNBdXRoZW50aWNhdGVkJCA9IHRoaXMuYXV0aFN0YXRlLmlzQXV0aGVudGljYXRlZCQ7XG5cbiAgLyoqXG4gICAqIEVtaXRzIGRldGFpbHMgYWJvdXQgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciwgb3IgbnVsbCBpZiBub3QgYXV0aGVudGljYXRlZC5cbiAgICovXG4gIHJlYWRvbmx5IHVzZXIkID0gdGhpcy5hdXRoU3RhdGUudXNlciQ7XG5cbiAgLyoqXG4gICAqIEVtaXRzIElEIHRva2VuIGNsYWltcyB3aGVuIGF1dGhlbnRpY2F0ZWQsIG9yIG51bGwgaWYgbm90IGF1dGhlbnRpY2F0ZWQuXG4gICAqL1xuICByZWFkb25seSBpZFRva2VuQ2xhaW1zJCA9IHRoaXMuYXV0aFN0YXRlLmlkVG9rZW5DbGFpbXMkO1xuXG4gIC8qKlxuICAgKiBFbWl0cyBlcnJvcnMgdGhhdCBvY2N1ciBkdXJpbmcgbG9naW4sIG9yIHdoZW4gY2hlY2tpbmcgZm9yIGFuIGFjdGl2ZSBzZXNzaW9uIG9uIHN0YXJ0dXAuXG4gICAqL1xuICByZWFkb25seSBlcnJvciQgPSB0aGlzLmF1dGhTdGF0ZS5lcnJvciQ7XG5cbiAgLyoqXG4gICAqIEVtaXRzIHRoZSB2YWx1ZSAoaWYgYW55KSB0aGF0IHdhcyBwYXNzZWQgdG8gdGhlIGBsb2dpbldpdGhSZWRpcmVjdGAgbWV0aG9kIGNhbGxcbiAgICogYnV0IG9ubHkgKiphZnRlcioqIGBoYW5kbGVSZWRpcmVjdENhbGxiYWNrYCBpcyBmaXJzdCBjYWxsZWRcbiAgICovXG4gIHJlYWRvbmx5IGFwcFN0YXRlJCA9IHRoaXMuYXBwU3RhdGVTdWJqZWN0JC5hc09ic2VydmFibGUoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBASW5qZWN0KEF1dGgwQ2xpZW50U2VydmljZSkgcHJpdmF0ZSBhdXRoMENsaWVudDogQXV0aDBDbGllbnQsXG4gICAgcHJpdmF0ZSBjb25maWdGYWN0b3J5OiBBdXRoQ2xpZW50Q29uZmlnLFxuICAgIHByaXZhdGUgbmF2aWdhdG9yOiBBYnN0cmFjdE5hdmlnYXRvcixcbiAgICBwcml2YXRlIGF1dGhTdGF0ZTogQXV0aFN0YXRlXG4gICkge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSBjb25zdHJ1Y3RvciBjYWxsZWQnKTtcbiAgICBjb25zdCBjaGVja1Nlc3Npb25PckNhbGxiYWNrJCA9IChpc0NhbGxiYWNrOiBib29sZWFuKSA9PlxuICAgICAgaWlmKFxuICAgICAgICAoKSA9PiBpc0NhbGxiYWNrLFxuICAgICAgICB0aGlzLmhhbmRsZVJlZGlyZWN0Q2FsbGJhY2soKSxcbiAgICAgICAgZGVmZXIoKCkgPT4gdGhpcy5hdXRoMENsaWVudC5jaGVja1Nlc3Npb24oKSlcbiAgICAgICk7XG5cbiAgICB0aGlzLnNob3VsZEhhbmRsZUNhbGxiYWNrKClcbiAgICAgIC5waXBlKFxuICAgICAgICBzd2l0Y2hNYXAoKGlzQ2FsbGJhY2spID0+XG4gICAgICAgICAgY2hlY2tTZXNzaW9uT3JDYWxsYmFjayQoaXNDYWxsYmFjaykucGlwZShcbiAgICAgICAgICAgIGNhdGNoRXJyb3IoKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgY2hlY2tTZXNzaW9uIGVycm9yOiAnLCBlcnJvcik7XG4gICAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuY29uZmlnRmFjdG9yeS5nZXQoKTtcbiAgICAgICAgICAgICAgdGhpcy5uYXZpZ2F0b3IubmF2aWdhdGVCeVVybChjb25maWcuZXJyb3JQYXRoIHx8ICcvJyk7XG4gICAgICAgICAgICAgIHRoaXMuYXV0aFN0YXRlLnNldEVycm9yKGVycm9yKTtcbiAgICAgICAgICAgICAgcmV0dXJuIG9mKHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgdGFwKCgpID0+IHtcbiAgICAgICAgICB0aGlzLmF1dGhTdGF0ZS5zZXRJc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICB9KSxcbiAgICAgICAgdGFrZVVudGlsKHRoaXMubmdVbnN1YnNjcmliZSQpXG4gICAgICApXG4gICAgICAuc3Vic2NyaWJlKCk7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGVkIHdoZW4gdGhlIHNlcnZpY2UgaXMgZGVzdHJveWVkXG4gICAqL1xuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICAvLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvNDExNzcxNjNcbiAgICB0aGlzLm5nVW5zdWJzY3JpYmUkLm5leHQoKTtcbiAgICB0aGlzLm5nVW5zdWJzY3JpYmUkLmNvbXBsZXRlKCk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogbG9naW5XaXRoUmVkaXJlY3Qob3B0aW9ucyk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBQZXJmb3JtcyBhIHJlZGlyZWN0IHRvIGAvYXV0aG9yaXplYCB1c2luZyB0aGUgcGFyYW1ldGVyc1xuICAgKiBwcm92aWRlZCBhcyBhcmd1bWVudHMuIFJhbmRvbSBhbmQgc2VjdXJlIGBzdGF0ZWAgYW5kIGBub25jZWBcbiAgICogcGFyYW1ldGVycyB3aWxsIGJlIGF1dG8tZ2VuZXJhdGVkLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgbG9naW4gb3B0aW9uc1xuICAgKi9cbiAgbG9naW5XaXRoUmVkaXJlY3QoXG4gICAgb3B0aW9ucz86IFJlZGlyZWN0TG9naW5PcHRpb25zPFRBcHBTdGF0ZT5cbiAgKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBsb2dpbldpdGhSZWRpcmVjdCBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpKTtcbiAgICByZXR1cm4gZnJvbSh0aGlzLmF1dGgwQ2xpZW50LmxvZ2luV2l0aFJlZGlyZWN0KG9wdGlvbnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBhd2FpdCBsb2dpbldpdGhQb3B1cChvcHRpb25zKTtcbiAgICogYGBgXG4gICAqXG4gICAqIE9wZW5zIGEgcG9wdXAgd2l0aCB0aGUgYC9hdXRob3JpemVgIFVSTCB1c2luZyB0aGUgcGFyYW1ldGVyc1xuICAgKiBwcm92aWRlZCBhcyBhcmd1bWVudHMuIFJhbmRvbSBhbmQgc2VjdXJlIGBzdGF0ZWAgYW5kIGBub25jZWBcbiAgICogcGFyYW1ldGVycyB3aWxsIGJlIGF1dG8tZ2VuZXJhdGVkLiBJZiB0aGUgcmVzcG9uc2UgaXMgc3VjY2Vzc2Z1bCxcbiAgICogcmVzdWx0cyB3aWxsIGJlIHZhbGlkIGFjY29yZGluZyB0byB0aGVpciBleHBpcmF0aW9uIHRpbWVzLlxuICAgKlxuICAgKiBJTVBPUlRBTlQ6IFRoaXMgbWV0aG9kIGhhcyB0byBiZSBjYWxsZWQgZnJvbSBhbiBldmVudCBoYW5kbGVyXG4gICAqIHRoYXQgd2FzIHN0YXJ0ZWQgYnkgdGhlIHVzZXIgbGlrZSBhIGJ1dHRvbiBjbGljaywgZm9yIGV4YW1wbGUsXG4gICAqIG90aGVyd2lzZSB0aGUgcG9wdXAgd2lsbCBiZSBibG9ja2VkIGluIG1vc3QgYnJvd3NlcnMuXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBsb2dpbiBvcHRpb25zXG4gICAqIEBwYXJhbSBjb25maWcgQ29uZmlndXJhdGlvbiBmb3IgdGhlIHBvcHVwIHdpbmRvd1xuICAgKi9cbiAgbG9naW5XaXRoUG9wdXAoXG4gICAgb3B0aW9ucz86IFBvcHVwTG9naW5PcHRpb25zLFxuICAgIGNvbmZpZz86IFBvcHVwQ29uZmlnT3B0aW9uc1xuICApOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZygnYXV0aDAtYW5ndWxhciwgQXV0aFNlcnZpY2UsIGxvZ2luV2l0aFBvcHVwIGNhbGxlZCwgb3B0aW9uczogJywgSlNPTi5zdHJpbmdpZnkob3B0aW9ucyksICcsIGNvbmZpZzogJywgSlNPTi5zdHJpbmdpZnkoY29uZmlnKSk7XG4gICAgcmV0dXJuIGZyb20oXG4gICAgICB0aGlzLmF1dGgwQ2xpZW50LmxvZ2luV2l0aFBvcHVwKG9wdGlvbnMsIGNvbmZpZykudGhlbigoKSA9PiB7XG4gICAgICAgIHRoaXMuYXV0aFN0YXRlLnJlZnJlc2goKTtcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBsb2dvdXQoKTtcbiAgICogYGBgXG4gICAqXG4gICAqIENsZWFycyB0aGUgYXBwbGljYXRpb24gc2Vzc2lvbiBhbmQgcGVyZm9ybXMgYSByZWRpcmVjdCB0byBgL3YyL2xvZ291dGAsIHVzaW5nXG4gICAqIHRoZSBwYXJhbWV0ZXJzIHByb3ZpZGVkIGFzIGFyZ3VtZW50cywgdG8gY2xlYXIgdGhlIEF1dGgwIHNlc3Npb24uXG4gICAqIElmIHRoZSBgZmVkZXJhdGVkYCBvcHRpb24gaXMgc3BlY2lmaWVkIGl0IGFsc28gY2xlYXJzIHRoZSBJZGVudGl0eSBQcm92aWRlciBzZXNzaW9uLlxuICAgKiBJZiB0aGUgYGxvY2FsT25seWAgb3B0aW9uIGlzIHNwZWNpZmllZCwgaXQgb25seSBjbGVhcnMgdGhlIGFwcGxpY2F0aW9uIHNlc3Npb24uXG4gICAqIEl0IGlzIGludmFsaWQgdG8gc2V0IGJvdGggdGhlIGBmZWRlcmF0ZWRgIGFuZCBgbG9jYWxPbmx5YCBvcHRpb25zIHRvIGB0cnVlYCxcbiAgICogYW5kIGFuIGVycm9yIHdpbGwgYmUgdGhyb3duIGlmIHlvdSBkby5cbiAgICogW1JlYWQgbW9yZSBhYm91dCBob3cgTG9nb3V0IHdvcmtzIGF0IEF1dGgwXShodHRwczovL2F1dGgwLmNvbS9kb2NzL2xvZ291dCkuXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBsb2dvdXQgb3B0aW9uc1xuICAgKi9cbiAgbG9nb3V0KG9wdGlvbnM/OiBMb2dvdXRPcHRpb25zKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBsb2dvdXQgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgY29uc3QgbG9nb3V0ID0gdGhpcy5hdXRoMENsaWVudC5sb2dvdXQob3B0aW9ucykgfHwgb2YobnVsbCk7XG5cbiAgICBmcm9tKGxvZ291dCkuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgIGlmIChvcHRpb25zPy5sb2NhbE9ubHkpIHtcbiAgICAgICAgdGhpcy5hdXRoU3RhdGUucmVmcmVzaCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEZldGNoZXMgYSBuZXcgYWNjZXNzIHRva2VuIGFuZCByZXR1cm5zIHRoZSByZXNwb25zZSBmcm9tIHRoZSAvb2F1dGgvdG9rZW4gZW5kcG9pbnQsIG9taXR0aW5nIHRoZSByZWZyZXNoIHRva2VuLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyBmb3IgY29uZmlndXJpbmcgdGhlIHRva2VuIGZldGNoLlxuICAgKi9cbiAgZ2V0QWNjZXNzVG9rZW5TaWxlbnRseShcbiAgICBvcHRpb25zOiBHZXRUb2tlblNpbGVudGx5T3B0aW9ucyAmIHsgZGV0YWlsZWRSZXNwb25zZTogdHJ1ZSB9XG4gICk6IE9ic2VydmFibGU8R2V0VG9rZW5TaWxlbnRseVZlcmJvc2VSZXNwb25zZT47XG5cbiAgLyoqXG4gICAqIEZldGNoZXMgYSBuZXcgYWNjZXNzIHRva2VuIGFuZCByZXR1cm5zIGl0LlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyBmb3IgY29uZmlndXJpbmcgdGhlIHRva2VuIGZldGNoLlxuICAgKi9cbiAgZ2V0QWNjZXNzVG9rZW5TaWxlbnRseShvcHRpb25zPzogR2V0VG9rZW5TaWxlbnRseU9wdGlvbnMpOiBPYnNlcnZhYmxlPHN0cmluZz47XG5cbiAgLyoqXG4gICAqIGBgYGpzXG4gICAqIGdldEFjY2Vzc1Rva2VuU2lsZW50bHkob3B0aW9ucykuc3Vic2NyaWJlKHRva2VuID0+IC4uLilcbiAgICogYGBgXG4gICAqXG4gICAqIElmIHRoZXJlJ3MgYSB2YWxpZCB0b2tlbiBzdG9yZWQsIHJldHVybiBpdC4gT3RoZXJ3aXNlLCBvcGVucyBhblxuICAgKiBpZnJhbWUgd2l0aCB0aGUgYC9hdXRob3JpemVgIFVSTCB1c2luZyB0aGUgcGFyYW1ldGVycyBwcm92aWRlZFxuICAgKiBhcyBhcmd1bWVudHMuIFJhbmRvbSBhbmQgc2VjdXJlIGBzdGF0ZWAgYW5kIGBub25jZWAgcGFyYW1ldGVyc1xuICAgKiB3aWxsIGJlIGF1dG8tZ2VuZXJhdGVkLiBJZiB0aGUgcmVzcG9uc2UgaXMgc3VjY2Vzc2Z1bCwgcmVzdWx0c1xuICAgKiB3aWxsIGJlIHZhbGlkIGFjY29yZGluZyB0byB0aGVpciBleHBpcmF0aW9uIHRpbWVzLlxuICAgKlxuICAgKiBJZiByZWZyZXNoIHRva2VucyBhcmUgdXNlZCwgdGhlIHRva2VuIGVuZHBvaW50IGlzIGNhbGxlZCBkaXJlY3RseSB3aXRoIHRoZVxuICAgKiAncmVmcmVzaF90b2tlbicgZ3JhbnQuIElmIG5vIHJlZnJlc2ggdG9rZW4gaXMgYXZhaWxhYmxlIHRvIG1ha2UgdGhpcyBjYWxsLFxuICAgKiB0aGUgU0RLIGZhbGxzIGJhY2sgdG8gdXNpbmcgYW4gaWZyYW1lIHRvIHRoZSAnL2F1dGhvcml6ZScgVVJMLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBtYXkgdXNlIGEgd2ViIHdvcmtlciB0byBwZXJmb3JtIHRoZSB0b2tlbiBjYWxsIGlmIHRoZSBpbi1tZW1vcnlcbiAgICogY2FjaGUgaXMgdXNlZC5cbiAgICpcbiAgICogSWYgYW4gYGF1ZGllbmNlYCB2YWx1ZSBpcyBnaXZlbiB0byB0aGlzIGZ1bmN0aW9uLCB0aGUgU0RLIGFsd2F5cyBmYWxsc1xuICAgKiBiYWNrIHRvIHVzaW5nIGFuIGlmcmFtZSB0byBtYWtlIHRoZSB0b2tlbiBleGNoYW5nZS5cbiAgICpcbiAgICogTm90ZSB0aGF0IGluIGFsbCBjYXNlcywgZmFsbGluZyBiYWNrIHRvIGFuIGlmcmFtZSByZXF1aXJlcyBhY2Nlc3MgdG9cbiAgICogdGhlIGBhdXRoMGAgY29va2llLCBhbmQgdGh1cyB3aWxsIG5vdCB3b3JrIGluIGJyb3dzZXJzIHRoYXQgYmxvY2sgdGhpcmQtcGFydHlcbiAgICogY29va2llcyBieSBkZWZhdWx0IChTYWZhcmksIEJyYXZlLCBldGMpLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyBmb3IgY29uZmlndXJpbmcgdGhlIHRva2VuIGZldGNoLlxuICAgKi9cbiAgZ2V0QWNjZXNzVG9rZW5TaWxlbnRseShcbiAgICBvcHRpb25zOiBHZXRUb2tlblNpbGVudGx5T3B0aW9ucyA9IHt9XG4gICk6IE9ic2VydmFibGU8c3RyaW5nIHwgR2V0VG9rZW5TaWxlbnRseVZlcmJvc2VSZXNwb25zZT4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgZ2V0QWNjZXNzVG9rZW5TaWxlbnRseSBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpKTtcbiAgICByZXR1cm4gb2YodGhpcy5hdXRoMENsaWVudCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoY2xpZW50KSA9PlxuICAgICAgICBvcHRpb25zLmRldGFpbGVkUmVzcG9uc2UgPT09IHRydWVcbiAgICAgICAgICA/IGNsaWVudC5nZXRUb2tlblNpbGVudGx5KHsgLi4ub3B0aW9ucywgZGV0YWlsZWRSZXNwb25zZTogdHJ1ZSB9KVxuICAgICAgICAgIDogY2xpZW50LmdldFRva2VuU2lsZW50bHkob3B0aW9ucylcbiAgICAgICksXG4gICAgICB0YXAoKHRva2VuKSA9PlxuICAgICAgICB0aGlzLmF1dGhTdGF0ZS5zZXRBY2Nlc3NUb2tlbihcbiAgICAgICAgICB0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnID8gdG9rZW4gOiB0b2tlbi5hY2Nlc3NfdG9rZW5cbiAgICAgICAgKVxuICAgICAgKSxcbiAgICAgIGNhdGNoRXJyb3IoKGVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuYXV0aFN0YXRlLnNldEVycm9yKGVycm9yKTtcbiAgICAgICAgdGhpcy5hdXRoU3RhdGUucmVmcmVzaCgpO1xuICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlcnJvcik7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogZ2V0VG9rZW5XaXRoUG9wdXAob3B0aW9ucykuc3Vic2NyaWJlKHRva2VuID0+IC4uLilcbiAgICogYGBgXG4gICAqXG4gICAqIEdldCBhbiBhY2Nlc3MgdG9rZW4gaW50ZXJhY3RpdmVseS5cbiAgICpcbiAgICogT3BlbnMgYSBwb3B1cCB3aXRoIHRoZSBgL2F1dGhvcml6ZWAgVVJMIHVzaW5nIHRoZSBwYXJhbWV0ZXJzXG4gICAqIHByb3ZpZGVkIGFzIGFyZ3VtZW50cy4gUmFuZG9tIGFuZCBzZWN1cmUgYHN0YXRlYCBhbmQgYG5vbmNlYFxuICAgKiBwYXJhbWV0ZXJzIHdpbGwgYmUgYXV0by1nZW5lcmF0ZWQuIElmIHRoZSByZXNwb25zZSBpcyBzdWNjZXNzZnVsLFxuICAgKiByZXN1bHRzIHdpbGwgYmUgdmFsaWQgYWNjb3JkaW5nIHRvIHRoZWlyIGV4cGlyYXRpb24gdGltZXMuXG4gICAqL1xuICBnZXRBY2Nlc3NUb2tlbldpdGhQb3B1cChcbiAgICBvcHRpb25zPzogR2V0VG9rZW5XaXRoUG9wdXBPcHRpb25zXG4gICk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBnZXRBY2Nlc3NUb2tlbldpdGhQb3B1cCBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpKTtcbiAgICByZXR1cm4gb2YodGhpcy5hdXRoMENsaWVudCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoY2xpZW50KSA9PiBjbGllbnQuZ2V0VG9rZW5XaXRoUG9wdXAob3B0aW9ucykpLFxuICAgICAgdGFwKCh0b2tlbikgPT4gdGhpcy5hdXRoU3RhdGUuc2V0QWNjZXNzVG9rZW4odG9rZW4pKSxcbiAgICAgIGNhdGNoRXJyb3IoKGVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuYXV0aFN0YXRlLnNldEVycm9yKGVycm9yKTtcbiAgICAgICAgdGhpcy5hdXRoU3RhdGUucmVmcmVzaCgpO1xuICAgICAgICByZXR1cm4gdGhyb3dFcnJvcihlcnJvcik7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogZ2V0VXNlcihvcHRpb25zKS5zdWJzY3JpYmUodXNlciA9PiAuLi4pO1xuICAgKiBgYGBcbiAgICpcbiAgICogUmV0dXJucyB0aGUgdXNlciBpbmZvcm1hdGlvbiBpZiBhdmFpbGFibGUgKGRlY29kZWRcbiAgICogZnJvbSB0aGUgYGlkX3Rva2VuYCkuXG4gICAqXG4gICAqIElmIHlvdSBwcm92aWRlIGFuIGF1ZGllbmNlIG9yIHNjb3BlLCB0aGV5IHNob3VsZCBtYXRjaCBhbiBleGlzdGluZyBBY2Nlc3MgVG9rZW5cbiAgICogKHRoZSBTREsgc3RvcmVzIGEgY29ycmVzcG9uZGluZyBJRCBUb2tlbiB3aXRoIGV2ZXJ5IEFjY2VzcyBUb2tlbiwgYW5kIHVzZXMgdGhlXG4gICAqIHNjb3BlIGFuZCBhdWRpZW5jZSB0byBsb29rIHVwIHRoZSBJRCBUb2tlbilcbiAgICpcbiAgICogQHJlbWFya3NcbiAgICpcbiAgICogVGhlIHJldHVybmVkIG9ic2VydmFibGUgd2lsbCBlbWl0IG9uY2UgYW5kIHRoZW4gY29tcGxldGUuXG4gICAqXG4gICAqIEB0eXBlcGFyYW0gVFVzZXIgVGhlIHR5cGUgdG8gcmV0dXJuLCBoYXMgdG8gZXh0ZW5kIHtAbGluayBVc2VyfS5cbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIG9wdGlvbnMgdG8gZ2V0IHRoZSB1c2VyXG4gICAqL1xuICBnZXRVc2VyPFRVc2VyIGV4dGVuZHMgVXNlcj4oXG4gICAgb3B0aW9ucz86IEdldFVzZXJPcHRpb25zXG4gICk6IE9ic2VydmFibGU8VFVzZXIgfCB1bmRlZmluZWQ+IHtcbiAgICBjb25zb2xlLmxvZygnYXV0aDAtYW5ndWxhciwgQXV0aFNlcnZpY2UsIGdldFVzZXIgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIGRlZmVyKCgpID0+IHRoaXMuYXV0aDBDbGllbnQuZ2V0VXNlcjxUVXNlcj4ob3B0aW9ucykpO1xuICB9XG5cbiAgLyoqXG4gICAqIGBgYGpzXG4gICAqIGdldElkVG9rZW5DbGFpbXMob3B0aW9ucykuc3Vic2NyaWJlKGNsYWltcyA9PiAuLi4pO1xuICAgKiBgYGBcbiAgICpcbiAgICogUmV0dXJucyBhbGwgY2xhaW1zIGZyb20gdGhlIGlkX3Rva2VuIGlmIGF2YWlsYWJsZS5cbiAgICpcbiAgICogSWYgeW91IHByb3ZpZGUgYW4gYXVkaWVuY2Ugb3Igc2NvcGUsIHRoZXkgc2hvdWxkIG1hdGNoIGFuIGV4aXN0aW5nIEFjY2VzcyBUb2tlblxuICAgKiAodGhlIFNESyBzdG9yZXMgYSBjb3JyZXNwb25kaW5nIElEIFRva2VuIHdpdGggZXZlcnkgQWNjZXNzIFRva2VuLCBhbmQgdXNlcyB0aGVcbiAgICogc2NvcGUgYW5kIGF1ZGllbmNlIHRvIGxvb2sgdXAgdGhlIElEIFRva2VuKVxuICAgKlxuICAgKiBAcmVtYXJrc1xuICAgKlxuICAgKiBUaGUgcmV0dXJuZWQgb2JzZXJ2YWJsZSB3aWxsIGVtaXQgb25jZSBhbmQgdGhlbiBjb21wbGV0ZS5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIG9wdGlvbnMgdG8gZ2V0IHRoZSBJZCB0b2tlbiBjbGFpbXNcbiAgICovXG4gIGdldElkVG9rZW5DbGFpbXMoXG4gICAgb3B0aW9ucz86IEdldElkVG9rZW5DbGFpbXNPcHRpb25zXG4gICk6IE9ic2VydmFibGU8SWRUb2tlbiB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgZ2V0SWRUb2tlbkNsYWltcyBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpKTtcbiAgICByZXR1cm4gZGVmZXIoKCkgPT4gdGhpcy5hdXRoMENsaWVudC5nZXRJZFRva2VuQ2xhaW1zKG9wdGlvbnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBoYW5kbGVSZWRpcmVjdENhbGxiYWNrKHVybCkuc3Vic2NyaWJlKHJlc3VsdCA9PiAuLi4pXG4gICAqIGBgYFxuICAgKlxuICAgKiBBZnRlciB0aGUgYnJvd3NlciByZWRpcmVjdHMgYmFjayB0byB0aGUgY2FsbGJhY2sgcGFnZSxcbiAgICogY2FsbCBgaGFuZGxlUmVkaXJlY3RDYWxsYmFja2AgdG8gaGFuZGxlIHN1Y2Nlc3MgYW5kIGVycm9yXG4gICAqIHJlc3BvbnNlcyBmcm9tIEF1dGgwLiBJZiB0aGUgcmVzcG9uc2UgaXMgc3VjY2Vzc2Z1bCwgcmVzdWx0c1xuICAgKiB3aWxsIGJlIHZhbGlkIGFjY29yZGluZyB0byB0aGVpciBleHBpcmF0aW9uIHRpbWVzLlxuICAgKlxuICAgKiBDYWxsaW5nIHRoaXMgbWV0aG9kIGFsc28gcmVmcmVzaGVzIHRoZSBhdXRoZW50aWNhdGlvbiBhbmQgdXNlciBzdGF0ZXMuXG4gICAqXG4gICAqIEBwYXJhbSB1cmwgVGhlIFVSTCB0byB0aGF0IHNob3VsZCBiZSB1c2VkIHRvIHJldHJpZXZlIHRoZSBgc3RhdGVgIGFuZCBgY29kZWAgdmFsdWVzLiBEZWZhdWx0cyB0byBgd2luZG93LmxvY2F0aW9uLmhyZWZgIGlmIG5vdCBnaXZlbi5cbiAgICovXG4gIGhhbmRsZVJlZGlyZWN0Q2FsbGJhY2soXG4gICAgdXJsPzogc3RyaW5nXG4gICk6IE9ic2VydmFibGU8UmVkaXJlY3RMb2dpblJlc3VsdDxUQXBwU3RhdGU+PiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBoYW5kbGVSZWRpcmVjdENhbGxiYWNrIGNhbGxlZCwgdXJsOiAnLCB1cmwpO1xuICAgIHJldHVybiBkZWZlcigoKSA9PlxuICAgICAgdGhpcy5hdXRoMENsaWVudC5oYW5kbGVSZWRpcmVjdENhbGxiYWNrPFRBcHBTdGF0ZT4odXJsKVxuICAgICkucGlwZShcbiAgICAgIHdpdGhMYXRlc3RGcm9tKHRoaXMuYXV0aFN0YXRlLmlzTG9hZGluZyQpLFxuICAgICAgdGFwKChbcmVzdWx0LCBpc0xvYWRpbmddKSA9PiB7XG4gICAgICAgIGlmICghaXNMb2FkaW5nKSB7XG4gICAgICAgICAgdGhpcy5hdXRoU3RhdGUucmVmcmVzaCgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFwcFN0YXRlID0gcmVzdWx0Py5hcHBTdGF0ZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gYXBwU3RhdGU/LnRhcmdldCA/PyAnLyc7XG5cbiAgICAgICAgaWYgKGFwcFN0YXRlKSB7XG4gICAgICAgICAgdGhpcy5hcHBTdGF0ZVN1YmplY3QkLm5leHQoYXBwU3RhdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5uYXZpZ2F0b3IubmF2aWdhdGVCeVVybCh0YXJnZXQpO1xuICAgICAgfSksXG4gICAgICBtYXAoKFtyZXN1bHRdKSA9PiByZXN1bHQpXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBidWlsZEF1dGhvcml6ZVVybCgpLnN1YnNjcmliZSh1cmwgPT4gLi4uKVxuICAgKiBgYGBcbiAgICpcbiAgICogQnVpbGRzIGFuIGAvYXV0aG9yaXplYCBVUkwgZm9yIGxvZ2luV2l0aFJlZGlyZWN0IHVzaW5nIHRoZSBwYXJhbWV0ZXJzXG4gICAqIHByb3ZpZGVkIGFzIGFyZ3VtZW50cy4gUmFuZG9tIGFuZCBzZWN1cmUgYHN0YXRlYCBhbmQgYG5vbmNlYFxuICAgKiBwYXJhbWV0ZXJzIHdpbGwgYmUgYXV0by1nZW5lcmF0ZWQuXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zXG4gICAqIEByZXR1cm5zIEEgVVJMIHRvIHRoZSBhdXRob3JpemUgZW5kcG9pbnRcbiAgICovXG4gIGJ1aWxkQXV0aG9yaXplVXJsKG9wdGlvbnM/OiBSZWRpcmVjdExvZ2luT3B0aW9ucyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBidWlsZEF1dGhvcml6ZVVybCBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpKTtcbiAgICByZXR1cm4gZGVmZXIoKCkgPT4gdGhpcy5hdXRoMENsaWVudC5idWlsZEF1dGhvcml6ZVVybChvcHRpb25zKSk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogYnVpbGRMb2dvdXRVcmwoKS5zdWJzY3JpYmUodXJsID0+IC4uLilcbiAgICogYGBgXG4gICAqIEJ1aWxkcyBhIFVSTCB0byB0aGUgbG9nb3V0IGVuZHBvaW50LlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyB1c2VkIHRvIGNvbmZpZ3VyZSB0aGUgcGFyYW1ldGVycyB0aGF0IGFwcGVhciBpbiB0aGUgbG9nb3V0IGVuZHBvaW50IFVSTC5cbiAgICogQHJldHVybnMgYSBVUkwgdG8gdGhlIGxvZ291dCBlbmRwb2ludCB1c2luZyB0aGUgcGFyYW1ldGVycyBwcm92aWRlZCBhcyBhcmd1bWVudHMuXG4gICAqL1xuICBidWlsZExvZ291dFVybChvcHRpb25zPzogTG9nb3V0VXJsT3B0aW9ucyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBidWlsZExvZ291dFVybCBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpKTtcbiAgICByZXR1cm4gb2YodGhpcy5hdXRoMENsaWVudC5idWlsZExvZ291dFVybChvcHRpb25zKSk7XG4gIH1cblxuICBwcml2YXRlIHNob3VsZEhhbmRsZUNhbGxiYWNrKCk6IE9ic2VydmFibGU8Ym9vbGVhbj4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgc2hvdWxkSGFuZGxlQ2FsbGJhY2sgY2FsbGVkLCBsb2NhdGlvbi5zZWFyY2g6ICcsIGxvY2F0aW9uLnNlYXJjaCwgJywgc2tpcFJlZGlyZWN0Q2FsbGJhY2s6ICcsIHRoaXMuY29uZmlnRmFjdG9yeS5nZXQoKS5za2lwUmVkaXJlY3RDYWxsYmFjayA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICAgIHJldHVybiBvZihsb2NhdGlvbi5zZWFyY2gpLnBpcGUoXG4gICAgICBtYXAoKHNlYXJjaCkgPT4ge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIChzZWFyY2guaW5jbHVkZXMoJ2NvZGU9JykgfHwgc2VhcmNoLmluY2x1ZGVzKCdlcnJvcj0nKSkgJiZcbiAgICAgICAgICBzZWFyY2guaW5jbHVkZXMoJ3N0YXRlPScpICYmXG4gICAgICAgICAgIXRoaXMuY29uZmlnRmFjdG9yeS5nZXQoKS5za2lwUmVkaXJlY3RDYWxsYmFja1xuICAgICAgICApO1xuICAgICAgfSlcbiAgICApO1xuICB9XG59XG4iXX0=