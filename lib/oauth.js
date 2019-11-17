"use strict";

const RequestHandler = require("./eris/rest/RequestHandler");

/**
 * Make requests to discord's OAuth2 API
 * @extends requestHandler
 */
class OAuth extends RequestHandler {
    /**
     * 
     * @arg {Object} options All the options default to the same as the default Eris Client
     * @arg {Number} [options.requestTimeout=15000] A number of milliseconds before requests are considered timed out
     * @arg {Number} [options.latencyThreshold=30000] The average request latency at which the RequestHandler will start emitting latency errors
     * @arg {Number} [options.ratelimiterOffset=0] A number of milliseconds to offset the ratelimit timing calculations by
     */
    constructor(options = {}) {
        super({
            requestTimeout: options.requestTimeout || 15000,
            latencyThreshold: options.latencyThreshold || 30000,
            ratelimiterOffset: options.ratelimiterOffset ||  0
        });

        this.credentials = options.credentials;
    }

    /**
     * Exchange the code returned by discord in the query for the user access token
     * If specified, can also use the refresh_token to get a new valid token
     * Read discord's oauth2 documentation for a full example (https://discordapp.com/developers/docs/topics/oauth2)
     * @arg {Object} data The object containing the parameters for the request
     * @arg {String} data.clientId Your application's client id
     * @arg {String} data.clientSecret Your application's client secret
     * @arg {String} data.grantType Either authorization_code or refresh_token
     * @arg {String} data.code The code from the querystring
     * @arg {String} data.redirectUri Whatever URL you registered when creating your application
     * @arg {String} data.scope The scopes requested in your authorization url, space-delimited
     * @returns {Promise<Object>}
     */
    tokenRequest(data = {}) {
        const obj = {
            client_id:      data.clientId,
            client_secret:  data.clientSecret,
            grant_type:     data.grantType,
            code:           data.code,
            redirect_uri:   data.redirectUri,
            scope:          data.scope
        };

        let string = "";
        for (const [key, value] of Object.entries(obj)) {
            if (!value) throw new Error(`Missing ${key} property for tokenRequest`);
            else string += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }

        return this.request("POST", "/oauth2/token", string.substring(1), {
            contentType: "application/x-www-form-urlencoded"
        });
    }

    /**
     * Revoke the user access token
     * @arg {String} access_token The user access token
     * @arg {String} credentials Base64 encoding of the UTF-8 encoded credentials string
     * @returns {Promise<String>}
     */
    revokeToken(access_token, credentials) {
        if (!credentials && !this.credentials) throw new Error("Missing credentials for revokeToken method");
        return this.request("POST", "/oauth2/token/revoke", `token=${access_token}`, {
            auth: {
                type: "Basic",
                creds: credentials || this.credentials
            },
            contentType: "application/x-www-form-urlencoded"
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
                creds: access_token
            },
            contentType: "application/json"
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
                creds: access_token
            },
            contentType: "application/json"
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
                creds: access_token
            },
            contentType: "application/json"
        });
    }

    /**
     * Force a user to join a guild
     * Requires the `guilds.join` scope
     * @arg {Object} data
     * @arg {String} data.guildId The ID of the guild to join
     * @arg {String} data.userId The ID of the user to be added to the guild
     * @arg {Boolean?} data.deaf Whether the user is deafened in voice channels
     * @arg {Boolean?} data.mute Whether the user is muted in voice channels
     * @arg {String?} data.nickname Value to set users nickname to
     * @arg {String[]?} data.roles Array of role ids the member is assigned
     * @arg {String} data.accessToken The user access token
     * @arg {String} data.botToken The token of the bot used to authenticate
     * @returns {Promise<Object | String>}
     */
    addMember(data) {
        return this.request("PUT", `/guilds/${data.guildId}/members/${data.userId}`, {
            deaf: data.deaf,
            mute: data.mute,
            nick: data.nickname,
            roles: data.roles,
            access_token: data.accessToken
        }, {
            auth: {
                type: "Bot",
                creds: data.botToken
            },
            contentType: "application/json"
        });
    }
}

module.exports = OAuth;
