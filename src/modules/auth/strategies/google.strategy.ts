import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from '../../../config/env.config';

export function registerGoogleStrategy(): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      // The strategy only retrieves the Google profile; all auth logic lives in AuthService.
      (_accessToken, _refreshToken, profile: Profile, done) => {
        done(null, profile);
      },
    ),
  );
}
