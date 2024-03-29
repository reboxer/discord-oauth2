/*
	The MIT License (MIT)

	Copyright (c) 2016-2020 abalabahaha

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

/**
* Ratelimit requests and release in sequence
* @prop {Number} limit How many tokens the bucket can consume in the current interval
* @prop {Number} remaining How many tokens the bucket has left in the current interval
* @prop {Number} reset Timestamp of next reset
* @prop {Boolean} processing Whether the queue is being processed
*/
class SequentialBucket {
	/**
    * Construct a SequentialBucket
    * @arg {Number} tokenLimit The max number of tokens the bucket can consume per interval
    * @arg {Object} [latencyRef] An object
    * @arg {Number} latencyRef.latency Interval between consuming tokens
    */
	constructor(limit, latencyRef = { latency: 0 }) {
		this.limit = this.remaining = limit;
		this.resetInterval = 0;
		this.reset = 0;
		this.processing = false;
		this.latencyRef = latencyRef;
		this._queue = [];
	}

	/**
    * Queue something in the SequentialBucket
    * @arg {Function} func A function to call when a token can be consumed. The function will be passed a callback argument, which must be called to allow the bucket to continue to work
    */
	queue(func, short) {
		if (short) {
			this._queue.unshift(func);
		}
		else {
			this._queue.push(func);
		}
		this.check();
	}

	check(override) {
		if (this._queue.length === 0) {
			if (this.processing) {
				clearTimeout(this.processing);
				this.processing = false;
			}
			return;
		}
		if (this.processing && !override) {
			return;
		}
		const now = Date.now();
		const offset = this.latencyRef.latency + (this.latencyRef.offset || 0);
		if (!this.reset) {
			this.reset = now - offset;
			this.remaining = this.limit;
		}
		else if (this.reset < now - offset) {
			this.reset = now - offset + (this.resetInterval || 0);
			this.remaining = this.limit;
		}
		this.last = now;
		if (this.remaining <= 0) {
			this.processing = setTimeout(() => {
				this.processing = false;
				this.check(true);
			}, Math.max(0, (this.reset || 0) - now) + offset);
			return;
		}
		--this.remaining;
		this.processing = true;
		this._queue.shift()(() => {
			if (this._queue.length > 0) {
				this.check(true);
			}
			else {
				this.processing = false;
			}
		});
	}
}

module.exports = SequentialBucket;
