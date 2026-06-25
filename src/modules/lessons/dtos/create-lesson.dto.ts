import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Level } from '../../vocabulary/entities/word.entity';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsIn(Object.values(Level))
  level: string;
}
