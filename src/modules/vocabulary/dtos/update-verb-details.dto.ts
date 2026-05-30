import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Auxiliary } from '../entities/word.entity';

export class UpdateVerbDetailsDto {
  @IsOptional()
  @IsBoolean()
  isRegular?: boolean;

  @IsOptional()
  @IsString()
  presentThirdPerson?: string;

  @IsOptional()
  @IsString()
  praeteritumThirdPerson?: string;

  @IsOptional()
  @IsEnum(Auxiliary)
  perfektAuxiliary?: Auxiliary;

  @IsOptional()
  @IsString()
  perfectParticiple?: string;

  @IsOptional()
  @IsString()
  imperativeDu?: string;

  @IsOptional()
  @IsString()
  imperativeIhr?: string;

  @IsOptional()
  @IsString()
  imperativeSie?: string;

  @IsOptional()
  @IsString()
  reflexivePronoun?: string;
}
