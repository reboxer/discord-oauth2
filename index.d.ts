import { EventEmitter } from "events";
import { ClientRequest, IncomingHttpHeaders, IncomingMessage } from "http";

declare namespace OAuth {
	export interface User {
		id: string;
		username: string;
		discriminator: string;
		avatar: string | null | undefined;
		mfa_enabled?: boolean;
		banner?: string | null | undefined;
		accent_color?: string | null | undefined;
		locale?: string;
		verified?: boolean;
		email?: string | null | undefined;
		flags?: number;
		premium_type?: number;
		public_flags?: number;
	}

	export interface Member {
		user?: User;
		nick: string | null | undefined;
		roles: string[];
		joined_at: number;
		premium_since?: number | null | undefined;
		deaf: boolean;
		mute: boolean;
		pending?: boolean;
		is_pending?: boolean;
		communication_disabled_until?: string | null;
	}

	// This is not accurate as discord sends a partial object
	export interface Integration {
		id: string;
		name: string;
		type: string;
		enabled: boolean;
		syncing: boolean;
		role_id: string;
		enable_emoticons?: boolean;
		expire_behavior: 0 | 1;
		expire_grace_period: number;
		user?: User;
		account: {
			id: string;
			name: string;
		};
		synced_at: number;
		subscriber_count: number;
		revoked: boolean;
		application?: Application;
	}

	export interface Connection {
		id: string;
		name: string;
		type: string;
		revoked?: string;
		integrations?: Integration[];
		verified: boolean;
		friend_sync: boolean;
		show_activity: boolean;
		visibility: 0 | 1;
	}

	export interface Application {
		id: string;
		name: string;
		icon: string | null | undefined;
		description: string;
		summary: string;
		bot?: User;
	}

	export interface TokenRequestResult {
		access_token: string;
		token_type: string;
		expires_in: number;
		refresh_token: string;
		scope: string;
		webhook?: Webhook;
	}

	export interface PartialGuild {
		id: string;
		name: string;
		icon: string | null | undefined;
		owner?: boolean;
		permissions?: string;
		features: string[];
		approximate_member_count?: number;
		approximate_presence_count?: number;
	}

	export interface Webhook {
		type: boolean;
		id: string;
		name: string;
		avatar: string | null | undefined;
		channel_id: string;
		guild_id: string;
		application_id: string;
		token: string;
		url: string;
	}

	export interface HTTPResponse {
		code: number;
		message: string;
	}

	export class DiscordHTTPError extends Error {
		code: number;
		headers: IncomingHttpHeaders;
		name: "DiscordHTTPError";
		req: ClientRequest;
		res: IncomingMessage;
		response: HTTPResponse;
		constructor(
			req: ClientRequest,
			res: IncomingMessage,
			response: HTTPResponse,
			stack: string,
		);
		flattenErrors(errors: HTTPResponse, keyPrefix?: string): string[];
	}

	export class DiscordRESTError extends Error {
		code: number;
		headers: IncomingHttpHeaders;
		name: string;
		req: ClientRequest;
		res: IncomingMessage;
		response: HTTPResponse;
		constructor(
			req: ClientRequest,
			res: IncomingMessage,
			response: HTTPResponse,
			stack: string,
		);
		flattenErrors(errors: HTTPResponse, keyPrefix?: string): string[];
	}
}

declare class OAuth extends EventEmitter {
	constructor(opts?: {
		version?: string;
		clientId?: string;
		redirectUri?: string;
		credentials?: string;
		clientSecret?: string;
		requestTimeout?: number;
		latencyThreshold?: number;
		ratelimiterOffset?: number;
	});
	on(event: "debug" | "warn", listener: (message: string) => void): this;
	tokenRequest(opts: {
		code?: string;
		scope: string[] | string;
		clientId?: string;
		grantType: "authorization_code" | "refresh_token";
		redirectUri?: string;
		refreshToken?: string;
		clientSecret?: string;
	}): Promise<OAuth.TokenRequestResult>;
	revokeToken(access_token: string, credentials?: string): Promise<string>;
	getUser(access_token: string): Promise<OAuth.User>;
	getUserGuilds(access_token: string, opts?: {
		before?: string;
		after?: string;
		limit?: number;
		withCounts?: boolean;
	}): Promise<OAuth.PartialGuild[]>;
	getUserConnections(access_token: string): Promise<OAuth.Connection[]>;
	addMember(opts: {
		deaf?: boolean;
		mute?: boolean;
		roles?: string[];
		nickname?: string;
		userId: string;
		guildId: string;
		botToken: string;
		accessToken: string;
	}): Promise<OAuth.Member>;
	getGuildMember(
		access_token: string,
		guildId: string,
	): Promise<OAuth.Member>;
	generateAuthUrl(opts: {
		scope: string[] | string;
		state?: string;
		clientId?: string;
		prompt?: "consent" | "none";
		redirectUri?: string;
		responseType?: "code" | "token";
		permissions?: string;
		guildId?: string;
		disableGuildSelect?: boolean;
	}): string;
}
export = OAuth;
