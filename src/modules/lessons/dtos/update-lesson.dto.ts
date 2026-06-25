import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Level } from '../../vocabulary/entities/word.entity';

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsIn(Object.values(Level))
  level?: string;
}
