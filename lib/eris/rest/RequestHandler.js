/*
	The MIT License (MIT)

	Copyright (c) 2016-2021 abalabahaha

	Permission is hereby granted, free of charge, to any person obtaining a copy of
	this software and associated documentation files (the "Software"), to deal in
	the Software without restriction, including without limitation the rights to
	use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
	the Software, and to permit persons to whom the Software is furnished to do so,
	subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
	FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
	COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
	IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
	CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
"use strict";

const DiscordHTTPError = require("../errors/DiscordHTTPError");
const DiscordRESTError = require("../errors/DiscordRESTError");
const HTTPS = require("https");
const SequentialBucket = require("../util/SequentialBucket");
const Zlib = require("zlib");
const EventEmitter = require("events");

/**
* Handles API requests
*/
class RequestHandler extends EventEmitter {
	constructor(options) {
		super();

		this.options = options = Object.assign({
			agent: null,
			baseURL: "/api/v9",
			domain: "discord.com",
			disableLatencyCompensation: false,
			latencyThreshold: 30000,
			ratelimiterOffset: 0,
			requestTimeout: 15000,
		}, options);

		this.userAgent = `Discord-OAuth2 (https://github.com/reboxer/discord-oauth2, ${require("../../../package.json").version})`;
		this.ratelimits = {};
		this.latencyRef = {
			latency: this.options.ratelimiterOffset,
			raw: new Array(10).fill(this.options.ratelimiterOffset),
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
    * @arg {Boolean} [auth] Whether to add the Authorization header and token or not
	* @arg {String} [contentType] Content-Type header
	* @arg {Number} [attempts=0] Number of attempts
    * @arg {Object} [body] Request payload
    * @returns {Promise<Object>} Resolves with the returned JSON data
    */
	request(method, url, body, { auth, contentType, attempts = 0 }, _route, short) {
		const route = _route || this.routefy(url, method);

		const _stackHolder = {}; // Preserve async stack
		Error.captureStackTrace(_stackHolder);

		return new Promise((resolve, reject) => {
			const actualCall = (cb) => {
				const headers = {
					"User-Agent": this.userAgent,
					"Accept-Encoding": "gzip,deflate",
					...(contentType ? { "Content-Type": contentType } : {}),
				};

				let data;
				try {
					if (auth) {
						headers.Authorization = `${auth.type} ${auth.creds}`;
					}
					if (contentType === "application/json") {
						data = JSON.stringify(body, (k, v) => typeof v === "bigint" ? v.toString() : v);
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

				let req;
				try {
					req = HTTPS.request({
						method: method,
						host: this.options.domain,
						path: this.options.baseURL + url,
						headers: headers,
						agent: this.options.agent,
					});
				}
				catch (err) {
					cb();
					reject(err);
					return;
				}

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
					if (!this.options.disableLatencyCompensation) {
						this.latencyRef.raw.push(latency);
						this.latencyRef.latency = this.latencyRef.latency - ~~(this.latencyRef.raw.shift() / 10) + ~~(latency / 10);
					}

					const headerNow = Date.parse(resp.headers["date"]);
					if (this.latencyRef.lastTimeOffsetCheck < Date.now() - 5000) {
						const timeOffset = headerNow + 500 - (this.latencyRef.lastTimeOffsetCheck = Date.now());
						if (this.latencyRef.timeOffset - this.latencyRef.latency >= this.options.latencyThreshold && timeOffset - this.latencyRef.latency >= this.options.latencyThreshold) {
							this.emit("warn", new Error(`Your clock is ${this.latencyRef.timeOffset}ms behind Discord's server clock. Please check your connection and system time.`));
						}
						this.latencyRef.timeOffset = this.latencyRef.timeOffset - ~~(this.latencyRef.timeOffsets.shift() / 10) + ~~(timeOffset / 10);
						this.latencyRef.timeOffsets.push(timeOffset);
					}

					resp.once("aborted", () => {
						cb();
						reqError = reqError || new Error(`Request aborted by server on ${method} ${url}`);
						reqError.req = req;
						reject(reqError);
					});

					let response = "";

					let _respStream = resp;
					if (resp.headers["content-encoding"]) {
						if (resp.headers["content-encoding"].includes("gzip")) {
							_respStream = resp.pipe(Zlib.createGunzip());
						}
						else if (resp.headers["content-encoding"].includes("deflate")) {
							_respStream = resp.pipe(Zlib.createInflate());
						}
					}

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

						const retryAfter = parseInt(resp.headers["x-ratelimit-reset-after"] || resp.headers["retry-after"]) * 1000;
						if (retryAfter >= 0) {
							if (resp.headers["x-ratelimit-global"]) {
								this.globalBlock = true;
								setTimeout(() => this.globalUnblock(), retryAfter || 1);
							}
							else {
								this.ratelimits[route].reset = (retryAfter || 1) + now;
							}
						}
						else if (resp.headers["x-ratelimit-reset"]) {
							const resetTime = +resp.headers["x-ratelimit-reset"] * 1000;
							this.ratelimits[route].reset = Math.max(resetTime - this.latencyRef.latency, now);
						}
						else {
							this.ratelimits[route].reset = now;
						}

						if (resp.statusCode !== 429) {
							const content = typeof body === "object" ? `${body.content} ` : "";
							this.emit("debug", `${content}${now} ${route} ${resp.statusCode}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
						}

						if (resp.statusCode >= 300) {
							if (resp.statusCode === 429) {
								const content = typeof body === "object" ? `${body.content} ` : "";
								this.emit("debug", `${resp.headers["x-ratelimit-global"] ? "Global" : "Unexpected"} 429 (╯°□°）╯︵ ┻━┻: ${response}\n${content} ${now} ${route} ${resp.statusCode}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
								if (retryAfter) {
									setTimeout(() => {
										cb();
										this.request(method, url, body, { auth, contentType }, route, true).then(resolve).catch(reject);
									}, retryAfter);
									return;
								}
								else {
									cb();
									this.request(method, url, body, { auth, contentType }, route, true).then(resolve).catch(reject);
									return;
								}
							}
							else if (resp.statusCode === 502 && ++attempts < 4) {
								this.emit("debug", "A wild 502 appeared! Thanks CloudFlare!");
								setTimeout(() => {
									this.request(method, url, body, { auth, contentType, attempts }, route, true).then(resolve).catch(reject);
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

				req.setTimeout(this.options.requestTimeout, () => {
					reqError = new Error(`Request timed out (>${this.options.requestTimeout}ms) on ${method} ${url}`);
					req.abort();
				});

				req.end(data);
			};

			if (this.globalBlock && auth) {
				this.readyQueue.push(() => {
					if (!this.ratelimits[route]) {
						this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
					}
					this.ratelimits[route].queue(actualCall, short);
				});
			}
			else {
				if (!this.ratelimits[route]) {
					this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
				}
				this.ratelimits[route].queue(actualCall, short);
			}
		});
	}
}

module.exports = RequestHandler;
