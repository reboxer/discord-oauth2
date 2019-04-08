"use strict";

const RequestHandler = require("./eris/rest/RequestHandler");

/**
 * Make requests to discord's OAuth2 API
 * @extends requestHandler
 */
class oauth extends RequestHandler {
    /**
     * 
     * @arg {Object} [options] All the options default to the same as the default Eris Client, an Eris Client object can be passed to use the specified options in the constructor
     * @arg {Number} [options.requestTimeout=15000] A number of milliseconds before requests are considered timed out
     * @arg {Number} [options.latencyThreshold=30000] The average request latency at which the RequestHandler will start emitting latency errors
     * @arg {Number} [options.ratelimiterOffset=0] A number of milliseconds to offset the ratelimit timing calculations by
     * @arg {Object} client 
     */
    constructor(options, client) {
        super({
            requestTimeout: options ? options.requestTimeout : 15000,
            latencyThreshold: options ? options.latencyThreshold : 30000,
            ratelimiterOffset: options ? options.ratelimiterOffset : 0
        }, client);
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
     * @param {Object} object The object containing the parameters for the request
     * @returns {Promise}
     */
    async tokenRequest(object) {
        return this.request("POST", "/oauth2/token", this.encode(object), { contentType: "application/x-www-form-urlencoded" });
    }

    /**
     * Revoke the user access token
     * @param {String} token The user access token
     * @param {String} credentials Base64 encoding of the UTF-8 encoded credentials string
     * @returns {Promise}
     */
    async revokeToken(token, credentials) {
        return this.request("POST", "/oauth2/token/revoke", this.encode({ token: token }), {
            auth: {
                type: "Basic",
                creds: credentials
            },
            contentType: "application/x-www-form-urlencoded"
        });
    }

    /**
     * Request basic user data
     * Requires the `identify` scope
     * @param {String} token The user access token
     * @returns {Promise}
     */
    async getUser(token) {
        return this.request("GET", "/users/@me", undefined, {
            auth: {
                type: "Bearer",
                creds: token
            },
            contentType: "application/x-www-form-urlencoded"
        });
    }

    /**
     * Request all the guilds the user is in
     * Requires the `guilds` scope
     * @param {String} token The user access token
     * @returns {Promise}
     */
    async getUserGuilds(token) {
        return this.request("GET", "/users/@me/guilds", undefined, {
            auth: {
                type: "Bearer",
                creds: token
            },
            contentType: "application/x-www-form-urlencoded"
        });
    }
}

module.exports = oauth;
