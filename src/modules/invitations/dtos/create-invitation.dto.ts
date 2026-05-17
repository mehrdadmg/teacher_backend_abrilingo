import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateInvitationDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;
}
