import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateExampleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sentence?: string;

  @IsOptional()
  @IsString()
  translationFa?: string | null;

  @IsOptional()
  @IsString()
  translationEn?: string | null;

  @IsOptional()
  @IsString()
  translationRu?: string | null;

  @IsOptional()
  @IsString()
  translationAr?: string | null;
}
