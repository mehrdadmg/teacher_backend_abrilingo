import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { invitationService } from '../services/invitation.service';
import { jwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { requireRoles } from '../../../common/guards/roles.guard';
import { validateBody } from '../../../common/middleware/validate-body.middleware';
import { asyncHandler } from '../../../common/utils/async-handler';
import { CreateInvitationDto } from '../dtos/create-invitation.dto';
import { RoleName } from '../../roles/entities/role.entity';

export const invitationRouter = Router();

// Spec requires rate limiting on invitation endpoints
const inviteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    message: 'Too many invitation requests, please try again later',
    error: 'Too Many Requests',
    timestamp: new Date().toISOString(),
  },
});

invitationRouter.use(jwtAuthGuard);
invitationRouter.use(requireRoles(RoleName.SUPER_ADMIN));
invitationRouter.use(inviteRateLimit);

/**
 * @openapi
 * /api/invitations:
 *   post:
 *     tags: [Invitations]
 *     summary: Create and send an invitation
 *     description: |
 *       Creates a 7-day invitation token and dispatches a branded invite email via Resend.
 *       Rate-limited to **20 requests per 15 minutes** per IP. SUPER_ADMIN only.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvitationRequest'
 *     responses:
 *       '201':
 *         description: Invitation created and email dispatched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateInvitationResponse'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '429':
 *         $ref: '#/components/responses/TooManyRequests'
 */
// POST /api/invitations — create & send invite
invitationRouter.post(
  '/',
  validateBody(CreateInvitationDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as CreateInvitationDto;
    const invitation = await invitationService.createAndSend(email, req.jwtPayload!.sub);
    return res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    });
  }),
);

/**
 * @openapi
 * /api/invitations:
 *   get:
 *     tags: [Invitations]
 *     summary: List all invitations
 *     description: Returns every invitation token with its status and the inviting user. SUPER_ADMIN only.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Array of invitation tokens ordered by creation date descending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InvitationToken'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '429':
 *         $ref: '#/components/responses/TooManyRequests'
 */
// GET /api/invitations — list all invitations
invitationRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const invitations = await invitationService.findAll();
    return res.status(200).json(invitations);
  }),
);
