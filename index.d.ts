import { EventEmitter } from "events";

interface User {
    id: string,
    avatar: string | null | undefined,
    username: string,
    discriminator: string,

    bot?: boolean,
    email?: string,
    flags?: number,
    locale?: string,
    verified?: boolean,
    mfa_enabled?: string,
    premium_type?: number,
}

interface Member {
    nick: string | null | undefined,
    user: User,
    deaf: boolean,
    mute: boolean,
    roles: string[],
    joined_at: number,
    premium_since: number | null | undefined,
}

interface Integration {
    id: string,
    user: User,
    name: string,
    type: string,
    account: {
        id: string,
        name: string,
    },
    enabled: boolean,
    role_id: string,
    syncing: boolean,
    synced_at: string,
    expire_behavior: number,
    expire_grace_period: number,
}

interface Connection {
    id: string,
    type: string,
    name: string,
    revoked?: string,
    verified: string,
    visibility: string,
    friend_sync: boolean,
    show_activity: boolean,
    integrations?: Integration[],
}

interface TokenRequestResult {
    access_token: string,
    token_type: string,
    expires_in: number,
    refresh_token: string,
    scope: string,
}

interface PartialGuild {
    id: string,
    name: string,
    icon: string | null | undefined,
    owner: boolean,
    features: string[],
    permissions?: number,
}

declare class OAuth extends EventEmitter {
    constructor(opts?: {
        clientId?: string,
        redirectUri?: string,
        credentials?: string,
        clientSecret?: string,
        requestTimeout?: number,
        latencyThreshold?: number,
        ratelimiterOffset?: number,
    });
    on(event: "debug" | "warn", listener: (message: string) => void): this;
    tokenRequest(opts: {
        code?: string,
        scope: string[] | string,
        clientId?: string,
        grantType: "authorization_code" | "refresh_token",
        redirectUri?: string,
        refreshToken?: string,
        clientSecret?: string,
    }): Promise<TokenRequestResult>;
    revokeToken(access_token: string, credentials?: string): Promise<string>;
    getUser(access_token: string): Promise<User>;
    getUserGuilds(access_token: string): Promise<PartialGuild[]>;
    getUserConnections(access_token: string): Promise<Connection[]>;
    addMember(opts: {
        deaf?: boolean,
        mute?: boolean,
        roles?: string[],
        nickname?: string,

        userId: string,
        guildId: string,
        botToken: string,
        accessToken: string,
    }): Promise<Member>;
    generateAuthUrl(opts: {
        scope: string[] | string,
        state?: string,
        clientId?: string,
        redirectUri?: string,
        responseType?: "code" | "token",
    })
}

export = OAuth;
