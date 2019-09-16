"use strict";

const RequestHandler = require("./eris/rest/RequestHandler");

/**
 * Make requests to discord's OAuth2 API
 * @extends requestHandler
 */
class oauth extends RequestHandler {
    /**
     * 
     * @arg {Object} options All the options default to the same as the default Eris Client, an Eris Client object can be passed to emite events and use the passed options in the constructor
     * @arg {Number} [options.requestTimeout=15000] A number of milliseconds before requests are considered timed out
     * @arg {Number} [options.latencyThreshold=30000] The average request latency at which the RequestHandler will start emitting latency errors
     * @arg {Number} [options.ratelimiterOffset=0] A number of milliseconds to offset the ratelimit timing calculations by
     * @arg {Object} client 
     */
    constructor(options = {}, client) {
        super({
            requestTimeout: options.requestTimeout || 15000,
            latencyThreshold: options.latencyThreshold || 30000,
            ratelimiterOffset: options.ratelimiterOffset ||  0
        }, client);

        this.credentials = options.credentials;
    }

    encode(object) {
        let string = "";
        for (const [key, value] of Object.entries(object)) {
            string += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
        return string.substring(1);
    }

    /**
     * Exchange the code returned by discord in the query for the user access token
     * If specified, can also use the refresh_token to get a new valid token
     * Read discord's oauth2 documentation for a full example (https://discordapp.com/developers/docs/topics/oauth2)
     * @arg {Object} object The object containing the parameters for the request
     * @returns {Promise<Object>}
     */
    tokenRequest(object) {
        return this.request("POST", "/oauth2/token", this.encode(object), { contentType: "application/x-www-form-urlencoded" });
    }

    /**
     * Revoke the user access token
     * @arg {String} token The user access token
     * @arg {String} credentials Base64 encoding of the UTF-8 encoded credentials string
     * @returns {Promise<String>}
     */
    revokeToken(access_token, credentials) {
        if (!credentials || !this.credentials) throw new Error("Missing credentials for revokeToken method");
        return this.request("POST", "/oauth2/token/revoke", this.encode({ token: access_token }), {
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
     * @arg {String} token The user access token
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
     * @arg {String} token The user access token
     * @returns {Promise<Object>}
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
     * @arg {String} data.access_token The user access token
     * @arg {String} data.bot_token The token of the bot used to authenticate
     * @arg {String} data.guild_ID The ID of the guild to join
     * @arg {String} data.user_ID The ID of the user to be added to the guild
     * @returns {Promise<Object | String>}
     */
    addMember(data) {
        return this.request("PUT", `/guilds/${data.guild_ID}/members/${data.user_ID}`, { access_token: data.access_token }, {
            auth: {
                type: "Bot",
                creds: data.bot_token
            },
            contentType: "application/json"
        });
    }
}

module.exports = oauth;
