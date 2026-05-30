import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Word, Auxiliary } from './word.entity';

@Entity('verb_details')
export class VerbDetails {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'word_id' })
  wordId: string;

  @ManyToOne(() => Word, (w) => w.verbDetails, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word_id' })
  word: Word;

  @Column({ name: 'is_regular', type: 'boolean', default: true })
  isRegular: boolean;

  @Column({ name: 'present_third_person', type: 'varchar', length: 100, nullable: true })
  presentThirdPerson: string | null;

  @Column({ name: 'praeteritum_third_person', type: 'varchar', length: 100, nullable: true })
  praeteritumThirdPerson: string | null;

  @Column({
    name: 'perfekt_auxiliary',
    type: 'enum',
    enum: Auxiliary,
    enumName: 'auxiliary_enum',
    nullable: true,
  })
  perfektAuxiliary: Auxiliary | null;

  @Column({ name: 'perfect_participle', type: 'varchar', length: 100, nullable: true })
  perfectParticiple: string | null;

  @Column({ name: 'imperative_du', type: 'varchar', length: 100, nullable: true })
  imperativeDu: string | null;

  @Column({ name: 'imperative_ihr', type: 'varchar', length: 100, nullable: true })
  imperativeIhr: string | null;

  @Column({ name: 'imperative_sie', type: 'varchar', length: 100, nullable: true })
  imperativeSie: string | null;

  @Column({ name: 'reflexive_pronoun', type: 'varchar', length: 20, nullable: true })
  reflexivePronoun: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
