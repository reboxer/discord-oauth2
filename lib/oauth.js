"use strict";

const RequestHandler = require("./eris/rest/RequestHandler");

/**
 * Make requests to discord's OAuth2 API
 * @extends requestHandler
 */
class OAuth extends RequestHandler {
	/**
	 *
	 * @arg {Object} options
	 * @arg {Object} options.agent A HTTPS Agent used to proxy requests
	 * @arg {Number} [options.requestTimeout=15000] A number of milliseconds before requests are considered timed out
	 * @arg {Number} [options.latencyThreshold=30000] The average request latency at which the RequestHandler will start emitting latency errors
	 * @arg {Number} [options.ratelimiterOffset=0] A number of milliseconds to offset the ratelimit timing calculations by
	 * @arg {Boolean} [options.disableLatencyCompensation=false] Whether to disable the built-in latency compensator or not
	 * @arg {String?} options.clientId Your application's client id
	 * @arg {String?} options.clientSecret Your application's client secret
	 * @arg {String?} options.redirectUri Your URL redirect uri
	 * @arg {String?} options.credentials Base64 encoding of the UTF-8 encoded credentials string of your application
	 */
	constructor(options = {}) {
		super({
			// there must be a better way to do this.
			// defaults should be in RequestHandler, not here, but passing undefined makes it ignore the default
			...(options.agent ? { agent: options.agent } : {}),
			...(options.requestTimeout
				? { requestTimeout: options.requestTimeout }
				: {}),
			...(options.latencyThreshold
				? { latencyThreshold: options.latencyThreshold }
				: {}),
			...(options.ratelimiterOffset
				? { ratelimiterOffset: options.ratelimiterOffset }
				: {}),
			...(options.disableLatencyCompensation
				? {
					disableLatencyCompensation:
							options.disableLatencyCompensation,
					// this looks horrible, probably should stop using prettier
					// eslint-disable-next-line no-mixed-spaces-and-tabs
				  }
				: {}),
		});

		this.clientId = options.clientId;
		this.clientSecret = options.clientSecret;
		this.redirectUri = options.redirectUri;

		this.credentials = options.credentials;
	}

	_encode(obj) {
		let string = "";

		for (const [key, value] of Object.entries(obj)) {
			if (!value) continue;
			string += `&${encodeURIComponent(key)}=${encodeURIComponent(
				value,
			)}`;
		}

		return string.substring(1);
	}

	/**
	 * Exchange the code returned by discord in the query for the user access token
	 * If specified, can also use refresh_token to get a new valid token
	 * Read discord's OAuth2 documentation for a full example (https://discord.com/developers/docs/topics/oauth2)
	 * @arg {Object} options The object containing the parameters for the request
	 * @arg {String?} options.clientId Your application's client id
	 * @arg {String?} options.clientSecret Your application's client secret
	 * @arg {String} options.grantType Either authorization_code or refresh_token
	 * @arg {String?} options.code The code from the querystring
	 * @arg {String?} options.refreshToken The user's refresh token
	 * @arg {String?} options.redirectUri Your URL redirect uri
	 * @arg {String} options.scope The scopes requested in your authorization url, space-delimited
	 * @returns {Promise<Object>}
	 */
	tokenRequest(options = {}) {
		const obj = {
			client_id: options.clientId || this.clientId,
			client_secret: options.clientSecret || this.clientSecret,
			grant_type: undefined,
			code: undefined,
			refresh_token: undefined,
			redirect_uri: options.redirectUri || this.redirectUri,
			scope:
				options.scope instanceof Array
					? options.scope.join(" ")
					: options.scope,
		};

		if (options.grantType === "authorization_code") {
			obj.code = options.code;
			obj.grant_type = options.grantType;
		}
		else if (options.grantType === "refresh_token") {
			obj.refresh_token = options.refreshToken;
			obj.grant_type = options.grantType;
		}
		else
			throw new Error(
				"Invalid grant_type provided, it must be either authorization_code or refresh_token",
			);

		const encoded_string = this._encode(obj);

		return this.request("POST", "/oauth2/token", encoded_string, {
			contentType: "application/x-www-form-urlencoded",
		});
	}

	/**
	 * Revoke the user access token
	 * @arg {String} access_token The user access token
	 * @arg {String} credentials Base64 encoding of the UTF-8 encoded credentials string of your application
	 * @returns {Promise<String>}
	 */
	revokeToken(access_token, credentials) {
		if (!credentials && !this.credentials)
			throw new Error("Missing credentials for revokeToken method");
		return this.request(
			"POST",
			"/oauth2/token/revoke",
			`token=${access_token}`,
			{
				auth: {
					type: "Basic",
					creds: credentials || this.credentials,
				},
				contentType: "application/x-www-form-urlencoded",
			},
		);
	}

	/**
	 * Request basic user data
	 * Requires the `identify` scope
	 * @arg {String} access_token The user access token
	 * @returns {Promise<Object>}
	 */
	getUser(access_token) {
		return this.request("GET", "/users/@me", undefined, {
			auth: {
				type: "Bearer",
				creds: access_token,
			},
		});
	}

	/**
	 * Request all the guilds the user is in
	 * Requires the `guilds` scope
	 * @arg {String} access_token The user access token
	 * @returns {Promise<Object[]>}
	 */
	getUserGuilds(access_token) {
		return this.request("GET", "/users/@me/guilds", undefined, {
			auth: {
				type: "Bearer",
				creds: access_token,
			},
		});
	}

	/**
	 * Request a user's connections
	 * Requires the `connections` scope
	 * @arg {String} access_token The user access token
	 * @returns {Promise<Object[]>}
	 */
	getUserConnections(access_token) {
		return this.request("GET", "/users/@me/connections", undefined, {
			auth: {
				type: "Bearer",
				creds: access_token,
			},
		});
	}

	/**
	 * Force a user to join a guild
	 * Requires the `guilds.join` scope
	 * @arg {Object} options
	 * @arg {String} options.guildId The ID of the guild to join
	 * @arg {String} options.userId The ID of the user to be added to the guild
	 * @arg {Boolean?} options.deaf Whether the user is deafened in voice channels
	 * @arg {Boolean?} options.mute Whether the user is muted in voice channels
	 * @arg {String?} options.nickname Value to set users nickname to
	 * @arg {String[]?} options.roles Array of role ids the member is assigned
	 * @arg {String} options.accessToken The user access token
	 * @arg {String} options.botToken The token of the bot used to authenticate
	 * @returns {Promise<Object | String>}
	 */
	addMember(options) {
		return this.request(
			"PUT",
			`/guilds/${options.guildId}/members/${options.userId}`,
			{
				deaf: options.deaf,
				mute: options.mute,
				nick: options.nickname,
				roles: options.roles,
				access_token: options.accessToken,
			},
			{
				auth: {
					type: "Bot",
					creds: options.botToken,
				},
				contentType: "application/json",
			},
		);
	}

	/**
	 * Get the member object of a user in a guild
	 * Requires the `guilds.members.read` scope
	 * @arg {String} accessToken The user access token
	 * @arg {String} guildId The ID of the guild
	 * @returns {Promise<Object>}
	 */
	getGuildMember(accessToken, guildId) {
		return this.request(
			"GET",
			`/users/@me/guilds/${guildId}/member`,
			undefined,
			{
				auth: {
					type: "Bearer",
					creds: accessToken,
				},
			},
		);
	}

	/**
	 *
	 * @arg {Object} options
	 * @arg {String} options.clientId Your application's client id
	 * @arg {String?} options.prompt Controls how existing authorizations are handled, either consent or none (for passthrough scopes authorization is always required).
	 * @arg {String?} options.redirectUri Your URL redirect uri
	 * @arg {String?} options.responseType The response type, either code or token (token is for client-side web applications only). Defaults to code
	 * @arg {String | Array} options.scope The scopes for your URL
	 * @arg {String?} options.state A unique cryptographically secure string (https://discord.com/developers/docs/topics/oauth2#state-and-security)
	 * @arg {Number?} options.permissions The permissions number for the bot invite (only with bot scope) (https://discord.com/developers/docs/topics/permissions)
	 * @arg {String?} options.guildId The guild id to pre-fill the bot invite (only with bot scope)
	 * @arg {Boolean?} options.disableGuildSelect Disallows the user from changing the guild for the bot invite, either true or false (only with bot scope)
	 * @returns {String}
	 */
	generateAuthUrl(options = {}) {
		const obj = {
			client_id: options.clientId || this.clientId,
			prompt: options.prompt,
			redirect_uri: options.redirectUri || this.redirectUri,
			response_type: options.responseType || "code",
			scope:
				options.scope instanceof Array
					? options.scope.join(" ")
					: options.scope,
			permissions: options.permissions,
			guild_id: options.guildId,
			disable_guild_select: options.disableGuildSelect,
			state: options.state,
		};

		const encoded_string = this._encode(obj);

		return `https://discord.com/oauth2/authorize?${encoded_string}`;
	}
}

module.exports = OAuth;
