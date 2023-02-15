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
        console.log('auth0-angular, AuthService constructor called, config: ', JSON.stringify(this.configFactory.get()));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvYXV0aDAtYW5ndWxhci9zcmMvbGliL2F1dGguc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBYSxNQUFNLGVBQWUsQ0FBQztBQW1COUQsT0FBTyxFQUNMLEVBQUUsRUFDRixJQUFJLEVBQ0osT0FBTyxFQUVQLEdBQUcsRUFDSCxLQUFLLEVBQ0wsYUFBYSxFQUNiLFVBQVUsR0FDWCxNQUFNLE1BQU0sQ0FBQztBQUVkLE9BQU8sRUFDTCxTQUFTLEVBQ1QsR0FBRyxFQUNILEdBQUcsRUFDSCxTQUFTLEVBQ1QsVUFBVSxFQUNWLFNBQVMsRUFDVCxjQUFjLEdBQ2YsTUFBTSxnQkFBZ0IsQ0FBQztBQUV4QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxlQUFlLENBQUM7Ozs7OztBQVFuRCxNQUFNLE9BQU8sV0FBVztJQXNDdEIsWUFDc0MsV0FBd0IsRUFDcEQsYUFBK0IsRUFDL0IsU0FBNEIsRUFDNUIsU0FBb0I7UUFIUSxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtRQUNwRCxrQkFBYSxHQUFiLGFBQWEsQ0FBa0I7UUFDL0IsY0FBUyxHQUFULFNBQVMsQ0FBbUI7UUFDNUIsY0FBUyxHQUFULFNBQVMsQ0FBVztRQXhDdEIscUJBQWdCLEdBQUcsSUFBSSxhQUFhLENBQVksQ0FBQyxDQUFDLENBQUM7UUFFM0QsdUNBQXVDO1FBQy9CLG1CQUFjLEdBQUcsSUFBSSxPQUFPLEVBQVEsQ0FBQztRQUM3Qzs7V0FFRztRQUNNLGVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQztRQUVoRDs7O1dBR0c7UUFDTSxxQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO1FBRTVEOztXQUVHO1FBQ00sVUFBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMs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Q0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO2dCQUN6QixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUMsb0JBQW9CLENBQy9DLENBQUM7UUFDSixDQUFDLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQzs7eUdBMVhVLFdBQVcsa0JBdUNaLGtCQUFrQjs2R0F2Q2pCLFdBQVcsY0FGVixNQUFNOzRGQUVQLFdBQVc7a0JBSHZCLFVBQVU7bUJBQUM7b0JBQ1YsVUFBVSxFQUFFLE1BQU07aUJBQ25COzswQkF3Q0ksTUFBTTsyQkFBQyxrQkFBa0IiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbmplY3RhYmxlLCBJbmplY3QsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5pbXBvcnQge1xuICBBdXRoMENsaWVudCxcbiAgUmVkaXJlY3RMb2dpbk9wdGlvbnMsXG4gIFBvcHVwTG9naW5PcHRpb25zLFxuICBQb3B1cENvbmZpZ09wdGlvbnMsXG4gIExvZ291dE9wdGlvbnMsXG4gIEdldFRva2VuU2lsZW50bHlPcHRpb25zLFxuICBHZXRUb2tlbldpdGhQb3B1cE9wdGlvbnMsXG4gIFJlZGlyZWN0TG9naW5SZXN1bHQsXG4gIExvZ291dFVybE9wdGlvbnMsXG4gIEdldFRva2VuU2lsZW50bHlWZXJib3NlUmVzcG9uc2UsXG4gIEdldFVzZXJPcHRpb25zLFxuICBVc2VyLFxuICBHZXRJZFRva2VuQ2xhaW1zT3B0aW9ucyxcbiAgSWRUb2tlbixcbn0gZnJvbSAnQGF1dGgwL2F1dGgwLXNwYS1qcyc7XG5cbmltcG9ydCB7XG4gIG9mLFxuICBmcm9tLFxuICBTdWJqZWN0LFxuICBPYnNlcnZhYmxlLFxuICBpaWYsXG4gIGRlZmVyLFxuICBSZXBsYXlTdWJqZWN0LFxuICB0aHJvd0Vycm9yLFxufSBmcm9tICdyeGpzJztcblxuaW1wb3J0IHtcbiAgY29uY2F0TWFwLFxuICB0YXAsXG4gIG1hcCxcbiAgdGFrZVVudGlsLFxuICBjYXRjaEVycm9yLFxuICBzd2l0Y2hNYXAsXG4gIHdpdGhMYXRlc3RGcm9tLFxufSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCB7IEF1dGgwQ2xpZW50U2VydmljZSB9IGZyb20gJy4vYXV0aC5jbGllbnQnO1xuaW1wb3J0IHsgQWJzdHJhY3ROYXZpZ2F0b3IgfSBmcm9tICcuL2Fic3RyYWN0LW5hdmlnYXRvcic7XG5pbXBvcnQgeyBBdXRoQ2xpZW50Q29uZmlnLCBBcHBTdGF0ZSB9IGZyb20gJy4vYXV0aC5jb25maWcnO1xuaW1wb3J0IHsgQXV0aFN0YXRlIH0gZnJvbSAnLi9hdXRoLnN0YXRlJztcblxuQEluamVjdGFibGUoe1xuICBwcm92aWRlZEluOiAncm9vdCcsXG59KVxuZXhwb3J0IGNsYXNzIEF1dGhTZXJ2aWNlPFRBcHBTdGF0ZSBleHRlbmRzIEFwcFN0YXRlID0gQXBwU3RhdGU+XG4gIGltcGxlbWVudHMgT25EZXN0cm95IHtcbiAgcHJpdmF0ZSBhcHBTdGF0ZVN1YmplY3QkID0gbmV3IFJlcGxheVN1YmplY3Q8VEFwcFN0YXRlPigxKTtcblxuICAvLyBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvNDExNzcxNjNcbiAgcHJpdmF0ZSBuZ1Vuc3Vic2NyaWJlJCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XG4gIC8qKlxuICAgKiBFbWl0cyBib29sZWFuIHZhbHVlcyBpbmRpY2F0aW5nIHRoZSBsb2FkaW5nIHN0YXRlIG9mIHRoZSBTREsuXG4gICAqL1xuICByZWFkb25seSBpc0xvYWRpbmckID0gdGhpcy5hdXRoU3RhdGUuaXNMb2FkaW5nJDtcblxuICAvKipcbiAgICogRW1pdHMgYm9vbGVhbiB2YWx1ZXMgaW5kaWNhdGluZyB0aGUgYXV0aGVudGljYXRpb24gc3RhdGUgb2YgdGhlIHVzZXIuIElmIGB0cnVlYCwgaXQgbWVhbnMgYSB1c2VyIGhhcyBhdXRoZW50aWNhdGVkLlxuICAgKiBUaGlzIGRlcGVuZHMgb24gdGhlIHZhbHVlIG9mIGBpc0xvYWRpbmckYCwgc28gdGhlcmUgaXMgbm8gbmVlZCB0byBtYW51YWxseSBjaGVjayB0aGUgbG9hZGluZyBzdGF0ZSBvZiB0aGUgU0RLLlxuICAgKi9cbiAgcmVhZG9ubHkgaXNBdXRoZW50aWNhdGVkJCA9IHRoaXMuYXV0aFN0YXRlLmlzQXV0aGVudGljYXRlZCQ7XG5cbiAgLyoqXG4gICAqIEVtaXRzIGRldGFpbHMgYWJvdXQgdGhlIGF1dGhlbnRpY2F0ZWQgdXNlciwgb3IgbnVsbCBpZiBub3QgYXV0aGVudGljYXRlZC5cbiAgICovXG4gIHJlYWRvbmx5IHVzZXIkID0gdGhpcy5hdXRoU3RhdGUudXNlciQ7XG5cbiAgLyoqXG4gICAqIEVtaXRzIElEIHRva2VuIGNsYWltcyB3aGVuIGF1dGhlbnRpY2F0ZWQsIG9yIG51bGwgaWYgbm90IGF1dGhlbnRpY2F0ZWQuXG4gICAqL1xuICByZWFkb25seSBpZFRva2VuQ2xhaW1zJCA9IHRoaXMuYXV0aFN0YXRlLmlkVG9rZW5DbGFpbXMkO1xuXG4gIC8qKlxuICAgKiBFbWl0cyBlcnJvcnMgdGhhdCBvY2N1ciBkdXJpbmcgbG9naW4sIG9yIHdoZW4gY2hlY2tpbmcgZm9yIGFuIGFjdGl2ZSBzZXNzaW9uIG9uIHN0YXJ0dXAuXG4gICAqL1xuICByZWFkb25seSBlcnJvciQgPSB0aGlzLmF1dGhTdGF0ZS5lcnJvciQ7XG5cbiAgLyoqXG4gICAqIEVtaXRzIHRoZSB2YWx1ZSAoaWYgYW55KSB0aGF0IHdhcyBwYXNzZWQgdG8gdGhlIGBsb2dpbldpdGhSZWRpcmVjdGAgbWV0aG9kIGNhbGxcbiAgICogYnV0IG9ubHkgKiphZnRlcioqIGBoYW5kbGVSZWRpcmVjdENhbGxiYWNrYCBpcyBmaXJzdCBjYWxsZWRcbiAgICovXG4gIHJlYWRvbmx5IGFwcFN0YXRlJCA9IHRoaXMuYXBwU3RhdGVTdWJqZWN0JC5hc09ic2VydmFibGUoKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBASW5qZWN0KEF1dGgwQ2xpZW50U2VydmljZSkgcHJpdmF0ZSBhdXRoMENsaWVudDogQXV0aDBDbGllbnQsXG4gICAgcHJpdmF0ZSBjb25maWdGYWN0b3J5OiBBdXRoQ2xpZW50Q29uZmlnLFxuICAgIHByaXZhdGUgbmF2aWdhdG9yOiBBYnN0cmFjdE5hdmlnYXRvcixcbiAgICBwcml2YXRlIGF1dGhTdGF0ZTogQXV0aFN0YXRlXG4gICkge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSBjb25zdHJ1Y3RvciBjYWxsZWQsIGNvbmZpZzogJywgSlNPTi5zdHJpbmdpZnkodGhpcy5jb25maWdGYWN0b3J5LmdldCgpKSk7XG4gICAgY29uc3QgY2hlY2tTZXNzaW9uT3JDYWxsYmFjayQgPSAoaXNDYWxsYmFjazogYm9vbGVhbikgPT5cbiAgICAgIGlpZihcbiAgICAgICAgKCkgPT4gaXNDYWxsYmFjayxcbiAgICAgICAgdGhpcy5oYW5kbGVSZWRpcmVjdENhbGxiYWNrKCksXG4gICAgICAgIGRlZmVyKCgpID0+IHRoaXMuYXV0aDBDbGllbnQuY2hlY2tTZXNzaW9uKCkpXG4gICAgICApO1xuXG4gICAgdGhpcy5zaG91bGRIYW5kbGVDYWxsYmFjaygpXG4gICAgICAucGlwZShcbiAgICAgICAgc3dpdGNoTWFwKChpc0NhbGxiYWNrKSA9PlxuICAgICAgICAgIGNoZWNrU2Vzc2lvbk9yQ2FsbGJhY2skKGlzQ2FsbGJhY2spLnBpcGUoXG4gICAgICAgICAgICBjYXRjaEVycm9yKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnYXV0aDAtYW5ndWxhciwgQXV0aFNlcnZpY2UsIGNoZWNrU2Vzc2lvbiBlcnJvcjogJywgZXJyb3IpO1xuICAgICAgICAgICAgICBjb25zdCBjb25maWcgPSB0aGlzLmNvbmZpZ0ZhY3RvcnkuZ2V0KCk7XG4gICAgICAgICAgICAgIHRoaXMubmF2aWdhdG9yLm5hdmlnYXRlQnlVcmwoY29uZmlnLmVycm9yUGF0aCB8fCAnLycpO1xuICAgICAgICAgICAgICB0aGlzLmF1dGhTdGF0ZS5zZXRFcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgIHJldHVybiBvZih1bmRlZmluZWQpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICAgICksXG4gICAgICAgIHRhcCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5hdXRoU3RhdGUuc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgfSksXG4gICAgICAgIHRha2VVbnRpbCh0aGlzLm5nVW5zdWJzY3JpYmUkKVxuICAgICAgKVxuICAgICAgLnN1YnNjcmliZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCB3aGVuIHRoZSBzZXJ2aWNlIGlzIGRlc3Ryb3llZFxuICAgKi9cbiAgbmdPbkRlc3Ryb3koKTogdm9pZCB7XG4gICAgLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzQxMTc3MTYzXG4gICAgdGhpcy5uZ1Vuc3Vic2NyaWJlJC5uZXh0KCk7XG4gICAgdGhpcy5uZ1Vuc3Vic2NyaWJlJC5jb21wbGV0ZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIGBgYGpzXG4gICAqIGxvZ2luV2l0aFJlZGlyZWN0KG9wdGlvbnMpO1xuICAgKiBgYGBcbiAgICpcbiAgICogUGVyZm9ybXMgYSByZWRpcmVjdCB0byBgL2F1dGhvcml6ZWAgdXNpbmcgdGhlIHBhcmFtZXRlcnNcbiAgICogcHJvdmlkZWQgYXMgYXJndW1lbnRzLiBSYW5kb20gYW5kIHNlY3VyZSBgc3RhdGVgIGFuZCBgbm9uY2VgXG4gICAqIHBhcmFtZXRlcnMgd2lsbCBiZSBhdXRvLWdlbmVyYXRlZC5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIGxvZ2luIG9wdGlvbnNcbiAgICovXG4gIGxvZ2luV2l0aFJlZGlyZWN0KFxuICAgIG9wdGlvbnM/OiBSZWRpcmVjdExvZ2luT3B0aW9uczxUQXBwU3RhdGU+XG4gICk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgbG9naW5XaXRoUmVkaXJlY3QgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIGZyb20odGhpcy5hdXRoMENsaWVudC5sb2dpbldpdGhSZWRpcmVjdChvcHRpb25zKSk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogYXdhaXQgbG9naW5XaXRoUG9wdXAob3B0aW9ucyk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBPcGVucyBhIHBvcHVwIHdpdGggdGhlIGAvYXV0aG9yaXplYCBVUkwgdXNpbmcgdGhlIHBhcmFtZXRlcnNcbiAgICogcHJvdmlkZWQgYXMgYXJndW1lbnRzLiBSYW5kb20gYW5kIHNlY3VyZSBgc3RhdGVgIGFuZCBgbm9uY2VgXG4gICAqIHBhcmFtZXRlcnMgd2lsbCBiZSBhdXRvLWdlbmVyYXRlZC4gSWYgdGhlIHJlc3BvbnNlIGlzIHN1Y2Nlc3NmdWwsXG4gICAqIHJlc3VsdHMgd2lsbCBiZSB2YWxpZCBhY2NvcmRpbmcgdG8gdGhlaXIgZXhwaXJhdGlvbiB0aW1lcy5cbiAgICpcbiAgICogSU1QT1JUQU5UOiBUaGlzIG1ldGhvZCBoYXMgdG8gYmUgY2FsbGVkIGZyb20gYW4gZXZlbnQgaGFuZGxlclxuICAgKiB0aGF0IHdhcyBzdGFydGVkIGJ5IHRoZSB1c2VyIGxpa2UgYSBidXR0b24gY2xpY2ssIGZvciBleGFtcGxlLFxuICAgKiBvdGhlcndpc2UgdGhlIHBvcHVwIHdpbGwgYmUgYmxvY2tlZCBpbiBtb3N0IGJyb3dzZXJzLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgbG9naW4gb3B0aW9uc1xuICAgKiBAcGFyYW0gY29uZmlnIENvbmZpZ3VyYXRpb24gZm9yIHRoZSBwb3B1cCB3aW5kb3dcbiAgICovXG4gIGxvZ2luV2l0aFBvcHVwKFxuICAgIG9wdGlvbnM/OiBQb3B1cExvZ2luT3B0aW9ucyxcbiAgICBjb25maWc/OiBQb3B1cENvbmZpZ09wdGlvbnNcbiAgKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBsb2dpbldpdGhQb3B1cCBjYWxsZWQsIG9wdGlvbnM6ICcsIEpTT04uc3RyaW5naWZ5KG9wdGlvbnMpLCAnLCBjb25maWc6ICcsIEpTT04uc3RyaW5naWZ5KGNvbmZpZykpO1xuICAgIHJldHVybiBmcm9tKFxuICAgICAgdGhpcy5hdXRoMENsaWVudC5sb2dpbldpdGhQb3B1cChvcHRpb25zLCBjb25maWcpLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLmF1dGhTdGF0ZS5yZWZyZXNoKCk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogbG9nb3V0KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBDbGVhcnMgdGhlIGFwcGxpY2F0aW9uIHNlc3Npb24gYW5kIHBlcmZvcm1zIGEgcmVkaXJlY3QgdG8gYC92Mi9sb2dvdXRgLCB1c2luZ1xuICAgKiB0aGUgcGFyYW1ldGVycyBwcm92aWRlZCBhcyBhcmd1bWVudHMsIHRvIGNsZWFyIHRoZSBBdXRoMCBzZXNzaW9uLlxuICAgKiBJZiB0aGUgYGZlZGVyYXRlZGAgb3B0aW9uIGlzIHNwZWNpZmllZCBpdCBhbHNvIGNsZWFycyB0aGUgSWRlbnRpdHkgUHJvdmlkZXIgc2Vzc2lvbi5cbiAgICogSWYgdGhlIGBsb2NhbE9ubHlgIG9wdGlvbiBpcyBzcGVjaWZpZWQsIGl0IG9ubHkgY2xlYXJzIHRoZSBhcHBsaWNhdGlvbiBzZXNzaW9uLlxuICAgKiBJdCBpcyBpbnZhbGlkIHRvIHNldCBib3RoIHRoZSBgZmVkZXJhdGVkYCBhbmQgYGxvY2FsT25seWAgb3B0aW9ucyB0byBgdHJ1ZWAsXG4gICAqIGFuZCBhbiBlcnJvciB3aWxsIGJlIHRocm93biBpZiB5b3UgZG8uXG4gICAqIFtSZWFkIG1vcmUgYWJvdXQgaG93IExvZ291dCB3b3JrcyBhdCBBdXRoMF0oaHR0cHM6Ly9hdXRoMC5jb20vZG9jcy9sb2dvdXQpLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgbG9nb3V0IG9wdGlvbnNcbiAgICovXG4gIGxvZ291dChvcHRpb25zPzogTG9nb3V0T3B0aW9ucyk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgbG9nb3V0IGNhbGxlZCwgb3B0aW9uczogJywgSlNPTi5zdHJpbmdpZnkob3B0aW9ucykpO1xuICAgIGNvbnN0IGxvZ291dCA9IHRoaXMuYXV0aDBDbGllbnQubG9nb3V0KG9wdGlvbnMpIHx8IG9mKG51bGwpO1xuXG4gICAgZnJvbShsb2dvdXQpLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICBpZiAob3B0aW9ucz8ubG9jYWxPbmx5KSB7XG4gICAgICAgIHRoaXMuYXV0aFN0YXRlLnJlZnJlc2goKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaGVzIGEgbmV3IGFjY2VzcyB0b2tlbiBhbmQgcmV0dXJucyB0aGUgcmVzcG9uc2UgZnJvbSB0aGUgL29hdXRoL3Rva2VuIGVuZHBvaW50LCBvbWl0dGluZyB0aGUgcmVmcmVzaCB0b2tlbi5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIG9wdGlvbnMgZm9yIGNvbmZpZ3VyaW5nIHRoZSB0b2tlbiBmZXRjaC5cbiAgICovXG4gIGdldEFjY2Vzc1Rva2VuU2lsZW50bHkoXG4gICAgb3B0aW9uczogR2V0VG9rZW5TaWxlbnRseU9wdGlvbnMgJiB7IGRldGFpbGVkUmVzcG9uc2U6IHRydWUgfVxuICApOiBPYnNlcnZhYmxlPEdldFRva2VuU2lsZW50bHlWZXJib3NlUmVzcG9uc2U+O1xuXG4gIC8qKlxuICAgKiBGZXRjaGVzIGEgbmV3IGFjY2VzcyB0b2tlbiBhbmQgcmV0dXJucyBpdC5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIG9wdGlvbnMgZm9yIGNvbmZpZ3VyaW5nIHRoZSB0b2tlbiBmZXRjaC5cbiAgICovXG4gIGdldEFjY2Vzc1Rva2VuU2lsZW50bHkob3B0aW9ucz86IEdldFRva2VuU2lsZW50bHlPcHRpb25zKTogT2JzZXJ2YWJsZTxzdHJpbmc+O1xuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBnZXRBY2Nlc3NUb2tlblNpbGVudGx5KG9wdGlvbnMpLnN1YnNjcmliZSh0b2tlbiA9PiAuLi4pXG4gICAqIGBgYFxuICAgKlxuICAgKiBJZiB0aGVyZSdzIGEgdmFsaWQgdG9rZW4gc3RvcmVkLCByZXR1cm4gaXQuIE90aGVyd2lzZSwgb3BlbnMgYW5cbiAgICogaWZyYW1lIHdpdGggdGhlIGAvYXV0aG9yaXplYCBVUkwgdXNpbmcgdGhlIHBhcmFtZXRlcnMgcHJvdmlkZWRcbiAgICogYXMgYXJndW1lbnRzLiBSYW5kb20gYW5kIHNlY3VyZSBgc3RhdGVgIGFuZCBgbm9uY2VgIHBhcmFtZXRlcnNcbiAgICogd2lsbCBiZSBhdXRvLWdlbmVyYXRlZC4gSWYgdGhlIHJlc3BvbnNlIGlzIHN1Y2Nlc3NmdWwsIHJlc3VsdHNcbiAgICogd2lsbCBiZSB2YWxpZCBhY2NvcmRpbmcgdG8gdGhlaXIgZXhwaXJhdGlvbiB0aW1lcy5cbiAgICpcbiAgICogSWYgcmVmcmVzaCB0b2tlbnMgYXJlIHVzZWQsIHRoZSB0b2tlbiBlbmRwb2ludCBpcyBjYWxsZWQgZGlyZWN0bHkgd2l0aCB0aGVcbiAgICogJ3JlZnJlc2hfdG9rZW4nIGdyYW50LiBJZiBubyByZWZyZXNoIHRva2VuIGlzIGF2YWlsYWJsZSB0byBtYWtlIHRoaXMgY2FsbCxcbiAgICogdGhlIFNESyBmYWxscyBiYWNrIHRvIHVzaW5nIGFuIGlmcmFtZSB0byB0aGUgJy9hdXRob3JpemUnIFVSTC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgbWF5IHVzZSBhIHdlYiB3b3JrZXIgdG8gcGVyZm9ybSB0aGUgdG9rZW4gY2FsbCBpZiB0aGUgaW4tbWVtb3J5XG4gICAqIGNhY2hlIGlzIHVzZWQuXG4gICAqXG4gICAqIElmIGFuIGBhdWRpZW5jZWAgdmFsdWUgaXMgZ2l2ZW4gdG8gdGhpcyBmdW5jdGlvbiwgdGhlIFNESyBhbHdheXMgZmFsbHNcbiAgICogYmFjayB0byB1c2luZyBhbiBpZnJhbWUgdG8gbWFrZSB0aGUgdG9rZW4gZXhjaGFuZ2UuXG4gICAqXG4gICAqIE5vdGUgdGhhdCBpbiBhbGwgY2FzZXMsIGZhbGxpbmcgYmFjayB0byBhbiBpZnJhbWUgcmVxdWlyZXMgYWNjZXNzIHRvXG4gICAqIHRoZSBgYXV0aDBgIGNvb2tpZSwgYW5kIHRodXMgd2lsbCBub3Qgd29yayBpbiBicm93c2VycyB0aGF0IGJsb2NrIHRoaXJkLXBhcnR5XG4gICAqIGNvb2tpZXMgYnkgZGVmYXVsdCAoU2FmYXJpLCBCcmF2ZSwgZXRjKS5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIG9wdGlvbnMgZm9yIGNvbmZpZ3VyaW5nIHRoZSB0b2tlbiBmZXRjaC5cbiAgICovXG4gIGdldEFjY2Vzc1Rva2VuU2lsZW50bHkoXG4gICAgb3B0aW9uczogR2V0VG9rZW5TaWxlbnRseU9wdGlvbnMgPSB7fVxuICApOiBPYnNlcnZhYmxlPHN0cmluZyB8IEdldFRva2VuU2lsZW50bHlWZXJib3NlUmVzcG9uc2U+IHtcbiAgICBjb25zb2xlLmxvZygnYXV0aDAtYW5ndWxhciwgQXV0aFNlcnZpY2UsIGdldEFjY2Vzc1Rva2VuU2lsZW50bHkgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIG9mKHRoaXMuYXV0aDBDbGllbnQpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKGNsaWVudCkgPT5cbiAgICAgICAgb3B0aW9ucy5kZXRhaWxlZFJlc3BvbnNlID09PSB0cnVlXG4gICAgICAgICAgPyBjbGllbnQuZ2V0VG9rZW5TaWxlbnRseSh7IC4uLm9wdGlvbnMsIGRldGFpbGVkUmVzcG9uc2U6IHRydWUgfSlcbiAgICAgICAgICA6IGNsaWVudC5nZXRUb2tlblNpbGVudGx5KG9wdGlvbnMpXG4gICAgICApLFxuICAgICAgdGFwKCh0b2tlbikgPT5cbiAgICAgICAgdGhpcy5hdXRoU3RhdGUuc2V0QWNjZXNzVG9rZW4oXG4gICAgICAgICAgdHlwZW9mIHRva2VuID09PSAnc3RyaW5nJyA/IHRva2VuIDogdG9rZW4uYWNjZXNzX3Rva2VuXG4gICAgICAgIClcbiAgICAgICksXG4gICAgICBjYXRjaEVycm9yKChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLmF1dGhTdGF0ZS5zZXRFcnJvcihlcnJvcik7XG4gICAgICAgIHRoaXMuYXV0aFN0YXRlLnJlZnJlc2goKTtcbiAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZXJyb3IpO1xuICAgICAgfSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIGBgYGpzXG4gICAqIGdldFRva2VuV2l0aFBvcHVwKG9wdGlvbnMpLnN1YnNjcmliZSh0b2tlbiA9PiAuLi4pXG4gICAqIGBgYFxuICAgKlxuICAgKiBHZXQgYW4gYWNjZXNzIHRva2VuIGludGVyYWN0aXZlbHkuXG4gICAqXG4gICAqIE9wZW5zIGEgcG9wdXAgd2l0aCB0aGUgYC9hdXRob3JpemVgIFVSTCB1c2luZyB0aGUgcGFyYW1ldGVyc1xuICAgKiBwcm92aWRlZCBhcyBhcmd1bWVudHMuIFJhbmRvbSBhbmQgc2VjdXJlIGBzdGF0ZWAgYW5kIGBub25jZWBcbiAgICogcGFyYW1ldGVycyB3aWxsIGJlIGF1dG8tZ2VuZXJhdGVkLiBJZiB0aGUgcmVzcG9uc2UgaXMgc3VjY2Vzc2Z1bCxcbiAgICogcmVzdWx0cyB3aWxsIGJlIHZhbGlkIGFjY29yZGluZyB0byB0aGVpciBleHBpcmF0aW9uIHRpbWVzLlxuICAgKi9cbiAgZ2V0QWNjZXNzVG9rZW5XaXRoUG9wdXAoXG4gICAgb3B0aW9ucz86IEdldFRva2VuV2l0aFBvcHVwT3B0aW9uc1xuICApOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgZ2V0QWNjZXNzVG9rZW5XaXRoUG9wdXAgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIG9mKHRoaXMuYXV0aDBDbGllbnQpLnBpcGUoXG4gICAgICBjb25jYXRNYXAoKGNsaWVudCkgPT4gY2xpZW50LmdldFRva2VuV2l0aFBvcHVwKG9wdGlvbnMpKSxcbiAgICAgIHRhcCgodG9rZW4pID0+IHRoaXMuYXV0aFN0YXRlLnNldEFjY2Vzc1Rva2VuKHRva2VuKSksXG4gICAgICBjYXRjaEVycm9yKChlcnJvcikgPT4ge1xuICAgICAgICB0aGlzLmF1dGhTdGF0ZS5zZXRFcnJvcihlcnJvcik7XG4gICAgICAgIHRoaXMuYXV0aFN0YXRlLnJlZnJlc2goKTtcbiAgICAgICAgcmV0dXJuIHRocm93RXJyb3IoZXJyb3IpO1xuICAgICAgfSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIGBgYGpzXG4gICAqIGdldFVzZXIob3B0aW9ucykuc3Vic2NyaWJlKHVzZXIgPT4gLi4uKTtcbiAgICogYGBgXG4gICAqXG4gICAqIFJldHVybnMgdGhlIHVzZXIgaW5mb3JtYXRpb24gaWYgYXZhaWxhYmxlIChkZWNvZGVkXG4gICAqIGZyb20gdGhlIGBpZF90b2tlbmApLlxuICAgKlxuICAgKiBJZiB5b3UgcHJvdmlkZSBhbiBhdWRpZW5jZSBvciBzY29wZSwgdGhleSBzaG91bGQgbWF0Y2ggYW4gZXhpc3RpbmcgQWNjZXNzIFRva2VuXG4gICAqICh0aGUgU0RLIHN0b3JlcyBhIGNvcnJlc3BvbmRpbmcgSUQgVG9rZW4gd2l0aCBldmVyeSBBY2Nlc3MgVG9rZW4sIGFuZCB1c2VzIHRoZVxuICAgKiBzY29wZSBhbmQgYXVkaWVuY2UgdG8gbG9vayB1cCB0aGUgSUQgVG9rZW4pXG4gICAqXG4gICAqIEByZW1hcmtzXG4gICAqXG4gICAqIFRoZSByZXR1cm5lZCBvYnNlcnZhYmxlIHdpbGwgZW1pdCBvbmNlIGFuZCB0aGVuIGNvbXBsZXRlLlxuICAgKlxuICAgKiBAdHlwZXBhcmFtIFRVc2VyIFRoZSB0eXBlIHRvIHJldHVybiwgaGFzIHRvIGV4dGVuZCB7QGxpbmsgVXNlcn0uXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIGdldCB0aGUgdXNlclxuICAgKi9cbiAgZ2V0VXNlcjxUVXNlciBleHRlbmRzIFVzZXI+KFxuICAgIG9wdGlvbnM/OiBHZXRVc2VyT3B0aW9uc1xuICApOiBPYnNlcnZhYmxlPFRVc2VyIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc29sZS5sb2coJ2F1dGgwLWFuZ3VsYXIsIEF1dGhTZXJ2aWNlLCBnZXRVc2VyIGNhbGxlZCwgb3B0aW9uczogJywgSlNPTi5zdHJpbmdpZnkob3B0aW9ucykpO1xuICAgIHJldHVybiBkZWZlcigoKSA9PiB0aGlzLmF1dGgwQ2xpZW50LmdldFVzZXI8VFVzZXI+KG9wdGlvbnMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBgYGBqc1xuICAgKiBnZXRJZFRva2VuQ2xhaW1zKG9wdGlvbnMpLnN1YnNjcmliZShjbGFpbXMgPT4gLi4uKTtcbiAgICogYGBgXG4gICAqXG4gICAqIFJldHVybnMgYWxsIGNsYWltcyBmcm9tIHRoZSBpZF90b2tlbiBpZiBhdmFpbGFibGUuXG4gICAqXG4gICAqIElmIHlvdSBwcm92aWRlIGFuIGF1ZGllbmNlIG9yIHNjb3BlLCB0aGV5IHNob3VsZCBtYXRjaCBhbiBleGlzdGluZyBBY2Nlc3MgVG9rZW5cbiAgICogKHRoZSBTREsgc3RvcmVzIGEgY29ycmVzcG9uZGluZyBJRCBUb2tlbiB3aXRoIGV2ZXJ5IEFjY2VzcyBUb2tlbiwgYW5kIHVzZXMgdGhlXG4gICAqIHNjb3BlIGFuZCBhdWRpZW5jZSB0byBsb29rIHVwIHRoZSBJRCBUb2tlbilcbiAgICpcbiAgICogQHJlbWFya3NcbiAgICpcbiAgICogVGhlIHJldHVybmVkIG9ic2VydmFibGUgd2lsbCBlbWl0IG9uY2UgYW5kIHRoZW4gY29tcGxldGUuXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIGdldCB0aGUgSWQgdG9rZW4gY2xhaW1zXG4gICAqL1xuICBnZXRJZFRva2VuQ2xhaW1zKFxuICAgIG9wdGlvbnM/OiBHZXRJZFRva2VuQ2xhaW1zT3B0aW9uc1xuICApOiBPYnNlcnZhYmxlPElkVG9rZW4gfCB1bmRlZmluZWQ+IHtcbiAgICBjb25zb2xlLmxvZygnYXV0aDAtYW5ndWxhciwgQXV0aFNlcnZpY2UsIGdldElkVG9rZW5DbGFpbXMgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIGRlZmVyKCgpID0+IHRoaXMuYXV0aDBDbGllbnQuZ2V0SWRUb2tlbkNsYWltcyhvcHRpb25zKSk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogaGFuZGxlUmVkaXJlY3RDYWxsYmFjayh1cmwpLnN1YnNjcmliZShyZXN1bHQgPT4gLi4uKVxuICAgKiBgYGBcbiAgICpcbiAgICogQWZ0ZXIgdGhlIGJyb3dzZXIgcmVkaXJlY3RzIGJhY2sgdG8gdGhlIGNhbGxiYWNrIHBhZ2UsXG4gICAqIGNhbGwgYGhhbmRsZVJlZGlyZWN0Q2FsbGJhY2tgIHRvIGhhbmRsZSBzdWNjZXNzIGFuZCBlcnJvclxuICAgKiByZXNwb25zZXMgZnJvbSBBdXRoMC4gSWYgdGhlIHJlc3BvbnNlIGlzIHN1Y2Nlc3NmdWwsIHJlc3VsdHNcbiAgICogd2lsbCBiZSB2YWxpZCBhY2NvcmRpbmcgdG8gdGhlaXIgZXhwaXJhdGlvbiB0aW1lcy5cbiAgICpcbiAgICogQ2FsbGluZyB0aGlzIG1ldGhvZCBhbHNvIHJlZnJlc2hlcyB0aGUgYXV0aGVudGljYXRpb24gYW5kIHVzZXIgc3RhdGVzLlxuICAgKlxuICAgKiBAcGFyYW0gdXJsIFRoZSBVUkwgdG8gdGhhdCBzaG91bGQgYmUgdXNlZCB0byByZXRyaWV2ZSB0aGUgYHN0YXRlYCBhbmQgYGNvZGVgIHZhbHVlcy4gRGVmYXVsdHMgdG8gYHdpbmRvdy5sb2NhdGlvbi5ocmVmYCBpZiBub3QgZ2l2ZW4uXG4gICAqL1xuICBoYW5kbGVSZWRpcmVjdENhbGxiYWNrKFxuICAgIHVybD86IHN0cmluZ1xuICApOiBPYnNlcnZhYmxlPFJlZGlyZWN0TG9naW5SZXN1bHQ8VEFwcFN0YXRlPj4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgaGFuZGxlUmVkaXJlY3RDYWxsYmFjayBjYWxsZWQsIHVybDogJywgdXJsKTtcbiAgICByZXR1cm4gZGVmZXIoKCkgPT5cbiAgICAgIHRoaXMuYXV0aDBDbGllbnQuaGFuZGxlUmVkaXJlY3RDYWxsYmFjazxUQXBwU3RhdGU+KHVybClcbiAgICApLnBpcGUoXG4gICAgICB3aXRoTGF0ZXN0RnJvbSh0aGlzLmF1dGhTdGF0ZS5pc0xvYWRpbmckKSxcbiAgICAgIHRhcCgoW3Jlc3VsdCwgaXNMb2FkaW5nXSkgPT4ge1xuICAgICAgICBpZiAoIWlzTG9hZGluZykge1xuICAgICAgICAgIHRoaXMuYXV0aFN0YXRlLnJlZnJlc2goKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhcHBTdGF0ZSA9IHJlc3VsdD8uYXBwU3RhdGU7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGFwcFN0YXRlPy50YXJnZXQgPz8gJy8nO1xuXG4gICAgICAgIGlmIChhcHBTdGF0ZSkge1xuICAgICAgICAgIHRoaXMuYXBwU3RhdGVTdWJqZWN0JC5uZXh0KGFwcFN0YXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubmF2aWdhdG9yLm5hdmlnYXRlQnlVcmwodGFyZ2V0KTtcbiAgICAgIH0pLFxuICAgICAgbWFwKChbcmVzdWx0XSkgPT4gcmVzdWx0KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogYGBganNcbiAgICogYnVpbGRBdXRob3JpemVVcmwoKS5zdWJzY3JpYmUodXJsID0+IC4uLilcbiAgICogYGBgXG4gICAqXG4gICAqIEJ1aWxkcyBhbiBgL2F1dGhvcml6ZWAgVVJMIGZvciBsb2dpbldpdGhSZWRpcmVjdCB1c2luZyB0aGUgcGFyYW1ldGVyc1xuICAgKiBwcm92aWRlZCBhcyBhcmd1bWVudHMuIFJhbmRvbSBhbmQgc2VjdXJlIGBzdGF0ZWAgYW5kIGBub25jZWBcbiAgICogcGFyYW1ldGVycyB3aWxsIGJlIGF1dG8tZ2VuZXJhdGVkLlxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9uc1xuICAgKiBAcmV0dXJucyBBIFVSTCB0byB0aGUgYXV0aG9yaXplIGVuZHBvaW50XG4gICAqL1xuICBidWlsZEF1dGhvcml6ZVVybChvcHRpb25zPzogUmVkaXJlY3RMb2dpbk9wdGlvbnMpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgYnVpbGRBdXRob3JpemVVcmwgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIGRlZmVyKCgpID0+IHRoaXMuYXV0aDBDbGllbnQuYnVpbGRBdXRob3JpemVVcmwob3B0aW9ucykpO1xuICB9XG5cbiAgLyoqXG4gICAqIGBgYGpzXG4gICAqIGJ1aWxkTG9nb3V0VXJsKCkuc3Vic2NyaWJlKHVybCA9PiAuLi4pXG4gICAqIGBgYFxuICAgKiBCdWlsZHMgYSBVUkwgdG8gdGhlIGxvZ291dCBlbmRwb2ludC5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIG9wdGlvbnMgdXNlZCB0byBjb25maWd1cmUgdGhlIHBhcmFtZXRlcnMgdGhhdCBhcHBlYXIgaW4gdGhlIGxvZ291dCBlbmRwb2ludCBVUkwuXG4gICAqIEByZXR1cm5zIGEgVVJMIHRvIHRoZSBsb2dvdXQgZW5kcG9pbnQgdXNpbmcgdGhlIHBhcmFtZXRlcnMgcHJvdmlkZWQgYXMgYXJndW1lbnRzLlxuICAgKi9cbiAgYnVpbGRMb2dvdXRVcmwob3B0aW9ucz86IExvZ291dFVybE9wdGlvbnMpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIGNvbnNvbGUubG9nKCdhdXRoMC1hbmd1bGFyLCBBdXRoU2VydmljZSwgYnVpbGRMb2dvdXRVcmwgY2FsbGVkLCBvcHRpb25zOiAnLCBKU09OLnN0cmluZ2lmeShvcHRpb25zKSk7XG4gICAgcmV0dXJuIG9mKHRoaXMuYXV0aDBDbGllbnQuYnVpbGRMb2dvdXRVcmwob3B0aW9ucykpO1xuICB9XG5cbiAgcHJpdmF0ZSBzaG91bGRIYW5kbGVDYWxsYmFjaygpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICBjb25zb2xlLmxvZygnYXV0aDAtYW5ndWxhciwgQXV0aFNlcnZpY2UsIHNob3VsZEhhbmRsZUNhbGxiYWNrIGNhbGxlZCwgbG9jYXRpb24uc2VhcmNoOiAnLCBsb2NhdGlvbi5zZWFyY2gsICcsIHNraXBSZWRpcmVjdENhbGxiYWNrOiAnLCB0aGlzLmNvbmZpZ0ZhY3RvcnkuZ2V0KCkuc2tpcFJlZGlyZWN0Q2FsbGJhY2sgPyAndHJ1ZScgOiAnZmFsc2UnKTtcbiAgICByZXR1cm4gb2YobG9jYXRpb24uc2VhcmNoKS5waXBlKFxuICAgICAgbWFwKChzZWFyY2gpID0+IHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAoc2VhcmNoLmluY2x1ZGVzKCdjb2RlPScpIHx8IHNlYXJjaC5pbmNsdWRlcygnZXJyb3I9JykpICYmXG4gICAgICAgICAgc2VhcmNoLmluY2x1ZGVzKCdzdGF0ZT0nKSAmJlxuICAgICAgICAgICF0aGlzLmNvbmZpZ0ZhY3RvcnkuZ2V0KCkuc2tpcFJlZGlyZWN0Q2FsbGJhY2tcbiAgICAgICAgKTtcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxufVxuIl19