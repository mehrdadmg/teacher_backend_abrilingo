import { Resend } from 'resend';
import { config } from './env.config';

export const resend = new Resend(config.resend.apiKey);
