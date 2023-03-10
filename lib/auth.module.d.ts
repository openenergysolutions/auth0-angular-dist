import { ModuleWithProviders } from '@angular/core';
import { AuthConfig } from './auth.config';
import * as i0 from "@angular/core";
export declare class AuthModule {
    /**
     * Initialize the authentication module system. Configuration can either be specified here,
     * or by calling AuthClientConfig.set (perhaps from an APP_INITIALIZER factory function).
     * @param config The optional configuration for the SDK.
     */
    static forRoot(config?: AuthConfig): ModuleWithProviders<AuthModule>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AuthModule, never>;
    static ɵmod: i0.ɵɵNgModuleDeclaration<AuthModule, never, never, never>;
    static ɵinj: i0.ɵɵInjectorDeclaration<AuthModule>;
}
