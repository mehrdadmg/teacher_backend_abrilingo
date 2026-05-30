import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Auxiliary } from '../entities/word.entity';

export class CreateVerbDetailsDto {
  @IsBoolean()
  isRegular: boolean;

  /** Präsens 3. Person Singular — e.g. "sieht" */
  @IsOptional()
  @IsString()
  presentThirdPerson?: string;

  /** Präteritum 3. Person Singular — e.g. "sah" */
  @IsOptional()
  @IsString()
  praeteritumThirdPerson?: string;

  /** Perfekt Hilfsverb — haben or sein */
  @IsOptional()
  @IsEnum(Auxiliary)
  perfektAuxiliary?: Auxiliary;

  /** Partizip II — e.g. "gesehen" */
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

  /** Reflexivpronomen — e.g. "sich". Null/omit when not reflexive. */
  @IsOptional()
  @IsString()
  reflexivePronoun?: string;
}
