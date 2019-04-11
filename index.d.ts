declare module "discord-oauth2" {

    interface RequestHandlerOptions {
        requestTimeout?: number;
        latencyThreshold?: number;
        ratelimiterOffset?: number;
    }

    export class oauth {
        public options: RequestHandlerOptions
        public tokenRequest(object: {
            client_id: string,
            client_secret: string,
            grant_type: string,
            code: string,
            redirect_uri: string,
            scope: string
        }): Promise<object>;
        public revokeToken(access_token: string, credentials: string): Promise<string>;
        public getUser(access_token: string): Promise<object>;
        public getUserGuilds(access_token: string): Promise<object>;
        public addMember(data: {
            access_token: string,
            bot_token: string,
            guild_ID: string,
            user_ID: string,
        }): Promise<object | string>
    }
}