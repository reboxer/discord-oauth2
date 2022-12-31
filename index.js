"use strict";
const OAuth = require("./lib/oauth");
OAuth.DiscordHTTPError = require("./lib/eris/errors/DiscordHTTPError");
OAuth.DiscordRESTError = require("./lib/eris/errors/DiscordRESTError");
module.exports = OAuth;
