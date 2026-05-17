import { Router, Request, Response } from 'express';
import { usersService } from '../services/users.service';
import { jwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { requireRoles } from '../../../common/guards/roles.guard';
import { asyncHandler } from '../../../common/utils/async-handler';
import { RoleName } from '../../roles/entities/role.entity';

export const usersRouter = Router();

usersRouter.use(jwtAuthGuard);

const adminOrOperator = requireRoles(RoleName.SUPER_ADMIN, RoleName.OPERATOR);
const adminOnly = requireRoles(RoleName.SUPER_ADMIN);

function notFound(res: Response): Response {
  return res.status(404).json({
    statusCode: 404,
    message: 'User not found',
    error: 'Not Found',
    timestamp: new Date().toISOString(),
  });
}

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: Returns every user with their role. Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Array of users ordered by creation date descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 */
// GET /api/users
usersRouter.get(
  '/',
  adminOrOperator,
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json(await usersService.findAll());
  }),
);

/**
 * @openapi
 * /api/users/pending:
 *   get:
 *     tags: [Users]
 *     summary: List users awaiting approval
 *     description: Returns users with status `pending_approval` ordered by creation date ascending. Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Array of pending users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 */
// GET /api/users/pending
usersRouter.get(
  '/pending',
  adminOrOperator,
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json(await usersService.findPending());
  }),
);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by ID
 *     description: Returns a single user with their role and direct permissions. Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     responses:
 *       '200':
 *         description: User object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/users/:id
usersRouter.get(
  '/:id',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.findById(req.params.id);
    return user ? res.json(user) : notFound(res);
  }),
);

/**
 * @openapi
 * /api/users/{id}/activate:
 *   patch:
 *     tags: [Users]
 *     summary: Activate a pending user
 *     description: |
 *       Atomically transitions the user from `pending_approval` to `active`.
 *       In the same DB transaction: marks the originating invitation token as used,
 *       clears Redis pending keys, and dispatches a welcome email. SUPER_ADMIN only.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     responses:
 *       '200':
 *         description: Updated user object (status is now `active`)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// PATCH /api/users/:id/activate
usersRouter.patch(
  '/:id/activate',
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    return res.json(await usersService.activateUser(req.params.id));
  }),
);

/**
 * @openapi
 * /api/users/{id}/suspend:
 *   patch:
 *     tags: [Users]
 *     summary: Suspend an active user
 *     description: |
 *       Sets the user status to `suspended` and writes `suspended:{id}` to Redis.
 *       The JWT guard checks this key on every authenticated request, so revocation
 *       is immediate — the user's next request returns 401 without waiting for the
 *       access token to expire. SUPER_ADMIN only.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     responses:
 *       '200':
 *         description: Updated user object (status is now `suspended`)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// PATCH /api/users/:id/suspend
usersRouter.patch(
  '/:id/suspend',
  adminOnly,
  asyncHandler(async (req: Request, res: Response) => {
    return res.json(await usersService.suspendUser(req.params.id));
  }),
);
