// Base class for all invitation-related errors.
// Object.setPrototypeOf is required for instanceof checks to work correctly
// when extending Error in TypeScript compiled to ES5/CommonJS.
export class InvitationException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 422,
  ) {
    super(message);
    this.name = 'InvitationException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvitationRequiredException extends InvitationException {
  constructor() {
    super(
      'INVITATION_REQUIRED',
      'An invitation is required to create an account. Please ask an administrator for an invite.',
      403,
    );
    this.name = 'InvitationRequiredException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidInvitationException extends InvitationException {
  constructor() {
    super(
      'INVITATION_INVALID',
      'This invitation link is invalid or does not exist.',
      400,
    );
    this.name = 'InvalidInvitationException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvitationUsedException extends InvitationException {
  constructor() {
    super(
      'INVITATION_USED',
      'This invitation link has already been used. Each link can only be used once.',
      409,
    );
    this.name = 'InvitationUsedException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvitationExpiredException extends InvitationException {
  constructor() {
    super(
      'INVITATION_EXPIRED',
      'This invitation link has expired (links are valid for 7 days). Please request a new invitation from an administrator.',
      410,
    );
    this.name = 'InvitationExpiredException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvitationEmailMismatchException extends InvitationException {
  constructor() {
    super(
      'INVITATION_EMAIL_MISMATCH',
      'This invitation was sent to a different email address. Please sign in with the email that received the invitation.',
      403,
    );
    this.name = 'InvitationEmailMismatchException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
