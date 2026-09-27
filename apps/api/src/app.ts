import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { apiRouter } from './routes.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Trust exactly one proxy hop (nginx / the platform load balancer) — see
  // config.auth.trustProxy for why this must not be on by default when the API
  // is exposed directly.
  app.set('trust proxy', config.auth.trustProxy ? 1 : false);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin/no-origin requests (curl, server-to-server) are allowed;
        // browsers get an allow-list check.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} is not allowed by CORS_ORIGINS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '64kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));
  app.use(cookieParser());
  app.use(loadUser);

  app.use('/api/v1', generalLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
