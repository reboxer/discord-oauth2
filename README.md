# discord-oauth2

A really simple to use module to use discord's OAuth2 API

Please check out discord's OAuth2 documentation: https://discordapp.com/developers/docs/topics/oauth2

### Installing

```bash
npm install discord-oauth2
```

### Example

```js
const DiscordOauth2 = require("discord-oauth2");
const oauth = new DiscordOauth2();

oauth.exchangeCode({
        client_id: "your client ID",
        client_secret: "your client secret",
        grant_type: "authorization_code",
        code: "query code",
        redirect_uri: "http://localhost/",
        scope: "identify guilds"
    }).then(console.log).catch(console.error);
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

### Methods

Soon™