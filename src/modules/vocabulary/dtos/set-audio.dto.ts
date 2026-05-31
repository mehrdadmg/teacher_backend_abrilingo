import { IsUrl } from 'class-validator';

export class SetAudioDto {
  /** Full URL to the audio file (mp3 / ogg / wav). */
  @IsUrl()
  fileUrl: string;
}
