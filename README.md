# discord-oauth2

A really simple to use module to use discord's OAuth2 API

Please check out discord's OAuth2 documentation: https://discordapp.com/developers/docs/topics/oauth2

### Installing

```bash
npm install discord-oauth2
```

### Class constructor

Two parameters are passed to the class constructor:

#### Options

Since the module uses a modified version of [Eris](https://github.com/abalabahaha/eris) request handler, it takes the same options, all of them default to the default
Eris Client options if no options are passed.

The first parameter can be omitted and a second parameter, the Eris Client, can be passed to use the same options as your Client.

```
requestTimeout: A number of milliseconds before requests are considered timed out

latencyThreshold: The average request latency at which the RequestHandler will start emitting latency errors

ratelimiterOffset: A number of milliseconds to offset the ratelimit timing calculations by
```

### Methods

#### tokenRequest()

Takes an object as only parameter, with the parameters necessary for the token exchange or refresh.

Returns a promise which resolves in an object with the access token.

Please refer to discord's OAuth2 [documentation](https://discordapp.com/developers/docs/topics/oauth2#authorization-code-grant-access-token-exchange-example) for the parameters needed.

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

oauth.tokenRequest({
        client_id: "your client ID",
        client_secret: "your client secret",
        grant_type: "authorization_code",
        code: "query code",
        redirect_uri: "http://localhost/",
        scope: "identify guilds"
    }).then(console.log);
    // If the request was successful
/*
        {
            "access_token": "6qrZcUqja7812RVdnEKjpzOL4CvHBFG",
            "token_type": "Bearer",
            "expires_in": 604800,
            "refresh_token": "D43f5y0ahjqew82jZ4NViEr2YafMKhue",
            "scope": "identify"
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

const clientID = "496357551512441271",
      client_secret = "cKlFh_71_OXfGVN1hmArPnL8SfKF41kA",
      access_token = "2qRZcUqUa9816RVnnEKRpzOL2CvHBgF";

const Base64 = require("js-base64").base64;
// note: You must encode your client ID along with your client secret string including the colon in between
const credentials = Base64(`${clientID}:${client_secret}`); // NDkwNTU3NTkxNTQyNDMxNzc1OmNLbG9oXzc4X09YV0dWTjFobU9ycm5MOFNmS0Y0MWt3

oauth.revokeToken(token, credentials).then(console.log); // {}
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

### Contributing

All contributions are welcome.