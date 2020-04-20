/*
	Modifications to work with discord's OAuth2 made by https://github.com/reboxer

	All credits for the original request handler go to abalabahaha (https://github.com/abalabahaha) and the Eris Discord library contributors (https://github.com/abalabahaha/eris)
*/

"use strict";

const DiscordHTTPError = require("../errors/DiscordHTTPError");
const DiscordRESTError = require("../errors/DiscordRESTError");
const HTTPS = require("https");
const SequentialBucket = require("../util/SequentialBucket");
const EventEmitter = require("events");

/**
* Handles API requests
*/
class RequestHandler extends EventEmitter {
	constructor(options) {
		super();
		this.userAgent = `Discord-OAuth2 (https://github.com/reboxer/discord-oauth2, ${require("../../../package.json").version})`;
		this.ratelimits = {};
		this.requestTimeout = options.requestTimeout;
		this.latencyThreshold = options.latencyThreshold;
		this.latencyRef = {
			latency: 500,
			offset: options.ratelimiterOffset,
			raw: new Array(10).fill(500),
			timeOffset: 0,
			timeOffsets: new Array(10).fill(0),
			lastTimeOffsetCheck: 0,
		};
		this.globalBlock = false;
		this.readyQueue = [];
	}

	globalUnblock() {
		this.globalBlock = false;
		while (this.readyQueue.length > 0) {
			this.readyQueue.shift()();
		}
	}

	// We need this for the Add Guild Member endpoint
	routefy(url) {
		return url.replace(/\/([a-z-]+)\/(?:[0-9]{17,19})/g, function(match, p) {
			return p === "guilds" ? match : `/${p}/:id`;
		});
	}

	/**
    * Make an API request
    * @arg {String} method Uppercase HTTP method
    * @arg {String} url URL of the endpoint
    * @arg {Object} options
    * @arg {Object} [options.auth]
    * @arg {String} [options.auth.type] The type of Authorization to use in the header, wheather Basic, Bearer or Bot
    * @arg {String} [options.auth.creds] The credentials used for the authentication (bot or user access token), if Basic, a base64 string with application's credentials must be passed
    * @arg {String} options.contentType The content type to set in the headers of the request
    * @arg {Object} [body] Request payload
    * @returns {Promise<Object>} Resolves with the returned JSON data
    */
	request(method, url, body, options, _route, short) {
		const route = _route || this.routefy(url, method);

		const _stackHolder = {}; // Preserve async stack
		Error.captureStackTrace(_stackHolder);

		return new Promise((resolve, reject) => {
			let attempts = 0;

			const actualCall = (cb) => {
				const headers = {
					"User-Agent": this.userAgent,
					"Content-Type": options.contentType,
				};
				let data;
				try {
					if (options.auth) {
						headers["Authorization"] = `${options.auth.type} ${options.auth.creds}`;
					}
					if (headers["Content-Type"] === "application/json") {
						data = JSON.stringify(body);
					}
					else {
						data = body;
					}
				}
				catch (err) {
					cb();
					reject(err);
					return;
				}

				const req = HTTPS.request({
					method: method,
					host: "discordapp.com",
					path: "/api/v7" + url,
					headers: headers,
				});

				let reqError;

				req.once("abort", () => {
					cb();
					reqError = reqError || new Error(`Request aborted by client on ${method} ${url}`);
					reqError.req = req;
					reject(reqError);
				}).once("error", (err) => {
					reqError = err;
					req.abort();
				});

				let latency = Date.now();

				req.once("response", (resp) => {
					latency = Date.now() - latency;
					this.latencyRef.raw.push(latency);
					this.latencyRef.latency = this.latencyRef.latency - ~~(this.latencyRef.raw.shift() / 10) + ~~(latency / 10);

					const headerNow = Date.parse(resp.headers["date"]);
					if (this.latencyRef.lastTimeOffsetCheck < Date.now() - 5000) {
						const timeOffset = ~~((this.latencyRef.lastTimeOffsetCheck = Date.now()) - headerNow);
						if (this.latencyRef.timeOffset - this.latencyRef.latency >= this.latencyThreshold && timeOffset - this.latencyRef.latency >= this.latencyThreshold) {
							this.emit("warn", new Error(`Your clock is ${this.latencyRef.timeOffset}ms behind Discord's server clock. Please check your connection and system time.`));
						}
						this.latencyRef.timeOffset = ~~(this.latencyRef.timeOffset - this.latencyRef.timeOffsets.shift() / 10 + timeOffset / 10);
						this.latencyRef.timeOffsets.push(timeOffset);
					}
					
					resp.once("aborted", () => {
						cb();
						reqError = reqError || new Error(`Request aborted by server on ${method} ${url}`);
						reqError.req = req;
						reject(reqError);
					});

					let response = "";

					const _respStream = resp;

					_respStream.on("data", (str) => {
						response += str;
					}).on("error", (err) => {
						reqError = err;
						req.abort();
					}).once("end", () => {
						const now = Date.now();

						if (resp.headers["x-ratelimit-limit"]) {
							this.ratelimits[route].limit = +resp.headers["x-ratelimit-limit"];
						}

						if (method !== "GET" && (resp.headers["x-ratelimit-remaining"] === undefined || resp.headers["x-ratelimit-limit"] === undefined) && this.ratelimits[route].limit !== 1) {
							this.emit("debug", `Missing ratelimit headers for SequentialBucket(${this.ratelimits[route].remaining}/${this.ratelimits[route].limit}) with non-default limit\n`
                                + `${resp.statusCode} ${resp.headers["content-type"]}: ${method} ${route} | ${resp.headers["cf-ray"]}\n`
                                + "content-type = " + "\n"
                                + "x-ratelimit-remaining = " + resp.headers["x-ratelimit-remaining"] + "\n"
                                + "x-ratelimit-limit = " + resp.headers["x-ratelimit-limit"] + "\n"
                                + "x-ratelimit-reset = " + resp.headers["x-ratelimit-reset"] + "\n"
                                + "x-ratelimit-global = " + resp.headers["x-ratelimit-global"]);
						}

						this.ratelimits[route].remaining = resp.headers["x-ratelimit-remaining"] === undefined ? 1 : +resp.headers["x-ratelimit-remaining"] || 0;

						if (resp.headers["retry-after"]) {
							if (resp.headers["x-ratelimit-global"]) {
								this.globalBlock = true;
								setTimeout(() => this.globalUnblock(), +resp.headers["retry-after"] || 1);
							}
							else {
								this.ratelimits[route].reset = (+resp.headers["retry-after"] || 1) + now;
							}
						}
						else if (resp.headers["x-ratelimit-reset"]) {
							if ((~route.lastIndexOf("/reactions/:id")) && (+resp.headers["x-ratelimit-reset"] * 1000 - headerNow) === 1000) {
								this.ratelimits[route].reset = Math.max(now + 250 - this.latencyRef.timeOffset, now);
							}
							else {
								this.ratelimits[route].reset = Math.max(+resp.headers["x-ratelimit-reset"] * 1000 - this.latencyRef.timeOffset, now);
							}
						}
						else {
							this.ratelimits[route].reset = now;
						}

						if (resp.statusCode !== 429) {
							this.emit("debug", `${body && body.content} ${now} ${route} ${resp.statusCode}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
						}

						if (resp.statusCode >= 300) {
							if (resp.statusCode === 429) {
								this.emit("debug", `${resp.headers["x-ratelimit-global"] ? "Global" : "Unexpected"} 429 (╯°□°）╯︵ ┻━┻: ${response}\n${body && body.content} ${now} ${route} ${resp.statusCode}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
								if (resp.headers["retry-after"]) {
									setTimeout(() => {
										cb();
										this.request(method, url, body, options, route, true).then(resolve).catch(reject);
									}, +resp.headers["retry-after"]);
									return;
								}
								else {
									cb();
									this.request(method, url, body, options, route, true).then(resolve).catch(reject);
									return;
								}
							}
							else if (resp.statusCode === 502 && ++attempts < 4) {
								this.emit("debug", "A wild 502 appeared! Thanks CloudFlare!");
								setTimeout(() => {
									this.request(method, url, body, options, route, true).then(resolve).catch(reject);
								}, Math.floor(Math.random() * 1900 + 100));
								return cb();
							}
							cb();

							if (response.length > 0) {
								if (resp.headers["content-type"] === "application/json") {
									try {
										response = JSON.parse(response);
									}
									catch (err) {
										reject(err);
										return;
									}
								}
							}

							let { stack } = _stackHolder;
							if (stack.startsWith("Error\n")) {
								stack = stack.substring(6);
							}
							let err;
							if (response.code) {
								err = new DiscordRESTError(req, resp, response, stack);
							}
							else {
								err = new DiscordHTTPError(req, resp, response, stack);
							}
							reject(err);
							return;
						}

						if (response.length > 0) {
							if (resp.headers["content-type"] === "application/json") {
								try {
									response = JSON.parse(response);
								}
								catch (err) {
									cb();
									reject(err);
									return;
								}
							}
						}

						cb();
						resolve(response);
					});
				});

				req.setTimeout(this.requestTimeout, () => {
					reqError = new Error(`Request timed out (>${this.requestTimeout}ms) on ${method} ${url}`);
					req.abort();
				});

				req.end(data);
			};

			if (this.globalBlock && (options.auth)) {
				this.readyQueue.push(() => {
					if (! this.ratelimits[route]) {
						this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
					}
					this.ratelimits[route].queue(actualCall, short);
				});
			}
			else {
				if (! this.ratelimits[route]) {
					this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
				}
				this.ratelimits[route].queue(actualCall, short);
			}
		});
	}
}

module.exports = RequestHandler;
