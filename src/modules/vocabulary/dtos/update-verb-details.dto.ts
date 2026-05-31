import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Auxiliary } from '../entities/word.entity';

export class UpdateVerbDetailsDto {
  @IsOptional()
  @IsBoolean()
  isRegular?: boolean;

  @IsOptional()
  @IsString()
  presentThirdPerson?: string | null;

  @IsOptional()
  @IsString()
  praeteritumThirdPerson?: string | null;

  @IsOptional()
  @IsEnum(Auxiliary)
  perfektAuxiliary?: Auxiliary | null;

  @IsOptional()
  @IsString()
  perfectParticiple?: string | null;

  @IsOptional()
  @IsString()
  imperativeDu?: string | null;

  @IsOptional()
  @IsString()
  imperativeIhr?: string | null;

  @IsOptional()
  @IsString()
  imperativeSie?: string | null;

  @IsOptional()
  @IsString()
  reflexivePronoun?: string | null;
}
