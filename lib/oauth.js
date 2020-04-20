"use strict";

const RequestHandler = require("./eris/rest/RequestHandler");

/**
 * Make requests to discord's OAuth2 API
 * @extends requestHandler
 */
class OAuth extends RequestHandler {
	/**
     * 
     * @arg {Object} opts
     * @arg {Number} [opts.requestTimeout=15000] A number of milliseconds before requests are considered timed out
     * @arg {Number} [opts.latencyThreshold=30000] The average request latency at which the RequestHandler will start emitting latency errors
     * @arg {Number} [opts.ratelimiterOffset=0] A number of milliseconds to offset the ratelimit timing calculations by
	 * @arg {String?} opts.clientId Your application's client id
	 * @arg {String?} opts.clientSecret Your application's client secret
	 * @arg {String?} opts.redirectUri Your URL redirect uri
	 * @arg {String?} opts.credentials Base64 encoding of the UTF-8 encoded credentials string of your application
     */
	constructor(opts = {}) {
		super({
			requestTimeout: opts.requestTimeout || 15000,
			latencyThreshold: opts.latencyThreshold || 30000,
			ratelimiterOffset: opts.ratelimiterOffset ||  0,
		});

		this.client_id = opts.clientId;
		this.client_secret = opts.clientSecret;
		this.redirect_uri = opts.redirectUri;

		this.credentials = opts.credentials;
	}

	_encode(obj) {
		let string = "";

		for (const [key, value] of Object.entries(obj)) {
			if (!value) continue;
			string += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
		}

		return string.substring(1);
	}

	/**
     * Exchange the code returned by discord in the query for the user access token
     * If specified, can also use refresh_token to get a new valid token
     * Read discord's OAuth2 documentation for a full example (https://discordapp.com/developers/docs/topics/oauth2)
     * @arg {Object} opts The object containing the parameters for the request
     * @arg {String?} opts.clientId Your application's client id
     * @arg {String?} opts.clientSecret Your application's client secret
     * @arg {String} opts.grantType Either authorization_code or refresh_token
     * @arg {String?} opts.code The code from the querystring
	 * @arg {String?} opts.refreshToken The user's refresh token
     * @arg {String?} opts.redirectUri Your URL redirect uri
     * @arg {String} opts.scope The scopes requested in your authorization url, space-delimited
     * @returns {Promise<Object>}
     */
	tokenRequest(opts = {}) {
		const obj = {
			client_id:      opts.clientId || this.client_id,
			client_secret:  opts.clientSecret || this.client_secret,
			grant_type:		undefined,
			code: 			undefined,
			refresh_token:	undefined,
			redirect_uri:   opts.redirectUri || this.redirect_uri,
			scope:          opts.scope instanceof Array ? opts.scope.join(" ") : opts.scope,
		};

		if (opts.grantType === "authorization_code") {
			obj.code = opts.code;
			obj.grant_type = opts.grantType;
		}
		else if (opts.grantType === "refresh_token") {
			obj.refresh_token = opts.refreshToken;
			obj.grant_type = opts.grantType;
		}
		else throw new Error("Invalid grant_type provided, it must be either authorization_code or refresh_token");

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
		if (!credentials && !this.credentials) throw new Error("Missing credentials for revokeToken method");
		return this.request("POST", "/oauth2/token/revoke", `token=${access_token}`, {
			auth: {
				type: "Basic",
				creds: credentials || this.credentials,
			},
			contentType: "application/x-www-form-urlencoded",
		});
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
			contentType: "application/json",
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
			contentType: "application/json",
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
			contentType: "application/json",
		});
	}

	/**
     * Force a user to join a guild
     * Requires the `guilds.join` scope
     * @arg {Object} opts
     * @arg {String} opts.guildId The ID of the guild to join
     * @arg {String} opts.userId The ID of the user to be added to the guild
     * @arg {Boolean?} opts.deaf Whether the user is deafened in voice channels
     * @arg {Boolean?} opts.mute Whether the user is muted in voice channels
     * @arg {String?} opts.nickname Value to set users nickname to
     * @arg {String[]?} opts.roles Array of role ids the member is assigned
     * @arg {String} opts.accessToken The user access token
     * @arg {String} opts.botToken The token of the bot used to authenticate
     * @returns {Promise<Object | String>}
     */
	addMember(opts) {
		return this.request("PUT", `/guilds/${opts.guildId}/members/${opts.userId}`, {
			deaf: opts.deaf,
			mute: opts.mute,
			nick: opts.nickname,
			roles: opts.roles,
			access_token: opts.accessToken,
		}, {
			auth: {
				type: "Bot",
				creds: opts.botToken,
			},
			contentType: "application/json",
		});
	}

	/**
	 * 
	 * @arg {Object} opts
	 * @arg {String} opts.clientId Your application's client id
	 * @arg {String?} opts.redirectUri Your URL redirect uri
	 * 	 * @arg {String?} opts.responseType The response type, either code or token (token is for client-side web applications only). Defaults to code
	 * @arg {String | Array} opts.scope The scopes for your URL
	 * @arg {String?} opts.state A unique cryptographically secure string (https://discordapp.com/developers/docs/topics/oauth2#state-and-security)
	 * @returns {String}
	 */
	generateAuthUrl(opts = {}) {
		const obj = {
			client_id: opts.clientId || this.client_id,
			redirect_uri: opts.redirectUri || this.redirect_uri,
			response_type: opts.responseType || "code",
			scope: opts.scope instanceof Array ? opts.scope.join(" ") : opts.scope,
			state: opts.state || undefined,
		};

		const encoded_string = this._encode(obj);

		return `https://discordapp.com/api/oauth2/authorize?${encoded_string}`;
	}
}

module.exports = OAuth;
