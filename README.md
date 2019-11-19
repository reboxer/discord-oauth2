# discord-oauth2 [![NPM version](https://img.shields.io/npm/v/discord-oauth2.svg?style=flat-square)](https://www.npmjs.com/package/discord-oauth2)

A really simple to use module to use discord's OAuth2 API.

Please check out discord's OAuth2 documentation: https://discordapp.com/developers/docs/topics/oauth2

### Installing

```bash
npm install discord-oauth2
```

### Class constructor

One parameter is passed to the class constructor:

#### Options

Since the module uses a modified version of [Eris](https://github.com/abalabahaha/eris) request handler, it takes the same options, all of them default to the default Eris Client options if no options are passed.

```
requestTimeout: A number of milliseconds before requests are considered timed out.

latencyThreshold: The average request latency at which the RequestHandler will start emitting latency errors.

ratelimiterOffset: A number of milliseconds to offset the ratelimit timing calculations by.

credentials: Base64 encoding of the UTF-8 encoded credentials string of your application, you can pass this in the constructor to not pass it every time you want to use the revokeToken() method.
```

### Events

In the Eris Library, client extends the `events` modules and the client is passed to the RequestHandler so it's able to emit events, this modified RequestHandler extends `events` so it can emit the same events.

There are only two events, `debug` and `warn`.

### Methods

#### tokenRequest()

Takes an object as only parameter, with the parameters necessary for the token exchange or refresh.

Returns a promise which resolves in an object with the access token.

Please refer to discord's OAuth2 [documentation](https://discordapp.com/developers/docs/topics/oauth2#authorization-code-grant-access-token-exchange-example) for the parameters needed.

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

oauth.tokenRequest({
    clientId: "your client ID",
    clientSecret: "your client secret",

    code: "query code",
    scope: "identify guilds",
    grantType: "authorization_code",
    
    redirectUri: "http://localhost/callback"
}).then(console.log)

// If the request was succesful
/*
    {
        "access_token": "6qrZcUqja7812RVdnEKjpzOL4CvHBFG",
        "token_type": "Bearer",
        "expires_in": 604800,
        "refresh_token": "D43f5y0ahjqew82jZ4NViEr2YafMKhue",
        "scope": "identify guilds"
    }
*/
```

#### revokeToken()

Takes two parameters, the first one is the access_token from the user, the second is a Base64 encoding of the UTF-8 encoded credentials string of your application.

Returns a promise which resolves in an empty object if successful.

Example with credentials included:

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

const clientID = "496357551512441271";
const client_secret = "cKlFh_71_OXfGVN1hmArPnL8SfKF41kA";
const access_token = "2qRZcUqUa9816RVnnEKRpzOL2CvHBgF";

const Base64 = require("js-base64").base64;
// You must encode your client ID along with your client secret string including the colon in between
const credentials = Base64(`${clientID}:${client_secret}`); // NDkwNTU3NTkxNTQyNDMxNzc1OmNLbG9oXzc4X09YV0dWTjFobU9ycm5MOFNmS0Y0MWt3

oauth.revokeToken(access_token, credentials).then(console.log); // {}
```

#### getUser()

Only takes one parameter which is the user's access token.

Returns the [user](https://discordapp.com/developers/docs/resources/user#user-object) object of the requester's account, this requires the `identify` scope, which will return the object without an email, and optionally the `email` scope, which returns the object with an email.

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

const access_token = "2qRZcUqUa9816RVnnEKRpzOL2CvHBgF";

oauth.getUser(access_token).then(console.log);
/*
    { 
        username: '1337 Krew',
        locale: 'en-US',
        mfa_enabled: true,
        flags: 128,
        avatar: '8342729096ea3675442027381ff50dfe',
        discriminator: '4421',
        id: '80351110224678912' 
    }
*/
```

#### getUserGuilds()

Only takes one parameter which is the user's access token.

Returns a list of partial [guild](https://discordapp.com/developers/docs/resources/guild#guild-object) objects the current user is a member of. Requires the `guilds` scope.

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

const access_token = "2qRZcUqUa9816RVnnEKRpzOL2CvHBgF";

oauth.getUserGuilds(access_token).then(console.log);
/*
    {
        "id": "80351110224678912",
        "name": "1337 Krew",
        "icon": "8342729096ea3675442027381ff50dfe",
        "owner": true,
        "permissions": 36953089
    }
*/
```

#### getUserConnections()

Only takes one parameter which is the user's access token.

Returns a list of [connection](https://discordapp.com/developers/docs/resources/user#connection-object) objects. Requires the `connections` OAuth2 scope.

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

const access_token = "2qRZcUqUa9816RVnnEKRpzOL2CvHBgF";

oauth.getUserConnections(access_token).then(console.log);
/*
    [ { verified: true,
        name: 'epicusername',
        show_activity: true,
        friend_sync: false,
        type: 'twitch',
        id: '31244565',
        visibility: 1 } ]
*/
```

#### addMember()

Only takes an object with the following properties:

`accessToken`: The user access token.

`botToken`: The token of the bot used to authenticate.

`guildId`: The ID of the guild to join.

`userId`: The ID of the user to be added to the guild.

Optional properties (the above ones are required):

`nickname`: Value to set users nickname to.

`roles`: Array of role ids the member is assigned.

`mute`: Whether the user is muted in voice channels.

`deaf`: Whether the user is deafened in voice channels.

Returns a member object if the user wasn't part of the guild, else, returns an empty string (length 0).

Example:

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

oauth.addMember({
    accessToken: "2qRZcUqUa9816RVnnEKRpzOL2CvHBgF",
    botToken: "NDgyMjM4ODQzNDI1MjU5NTIz.XK93JQ.bnLsc71_DGum-Qnymb4T5F6kGY8",
    guildId: "216488324594438692",
    userId: "80351110224678912",

    nickname: "george michael",
    roles: ["624615851966070786"],
    mute: true,
    deaf: true
}).then(console.log); // Member object or empty string

/*
    {
        nick: 'george michael',
        user: {
        username: 'some username',
        discriminator: '0001',
        id: '421610529323943943',
        avatar: null
        },
        roles: [ '324615841966570766' ],
        premium_since: null,
        deaf: true,
        mute: true,
        joined_at: '2019-09-20T14:44:12.603123+00:00'
    }
*/

```

### Contributing

All contributions are welcome.
